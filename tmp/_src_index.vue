<template>
  <div
    ref="sceneContainer"
    :class="[isDownload ? 'cursor-grab' : '', show ? '' : 'photo']"
    style="background: linear-gradient(90deg, #1b1b25, #363648, #1b1b25)"
    class="relative h-full w-full overflow-hidden rounded-[10px_0_0_10px]"
    :style="{ height }"
  >
    <div
      v-if="!isDownload"
      class="absolute inset-0 flex items-center justify-center"
    >
      <div class="loader"></div>
    </div>
    <!-- <div @click="takeAPhoto">拍照</div> -->
  </div>
</template>

<script setup lang="tsx" name="ModelRender">
  import {
    onMounted,
    ref,
    nextTick,
    useTemplateRef,
    onBeforeUnmount,
    shallowRef,
    watch,
  } from 'vue'
  import * as THREE from 'three'
  import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
  import { STLLoader } from 'three/addons/loaders/STLLoader.js'
  import { MTLLoader } from 'three/addons/loaders/MTLLoader.js'
  import { OBJLoader } from 'three/addons/loaders/OBJLoader.js'
  import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
  import { showMessage } from '@/utils'
  import type {
    TaskResultRes,
    BodyOrHairModel,
  } from '@/api/module/realPersonModel'
  import { downloadFile } from '@/utils'
  import JSZip from 'jszip'
  import { saveAs } from 'file-saver'
  import { emitter } from '@/utils/eventBus'
  import { getCutHead } from '../../utils/csgCutHead'

  defineOptions({
    options: { styleIsolation: 'shared' },
  })

  interface Props {
    modelInfo?: Omit<TaskResultRes, 'status'>
    height?: string
    // 用于给模型拍照，更新模型缩略图
    show?: boolean
  }

  const props = withDefaults(defineProps<Props>(), {
    height: '381px',
    show: true,
  })

  interface ModelOptions {
    scale?: number
    position?: {
      x: number
      y: number
      z: number
    }
    name: string
    rotation?: {
      x: number
      y: number
      z: number
    }
  }

  const isDownload = ref(true)
  const sceneContainer = useTemplateRef('sceneContainer')

  const camera = ref<THREE.PerspectiveCamera>()
  const controls = ref<OrbitControls>()
  const THREErenderer = ref()
  let rotatingLight: THREE.DirectionalLight | null = null
  let scene: THREE.Scene
  // 模型组引用
  let modelGroup: THREE.Group

  onMounted(() => {
    nextTick(() => {
      initThreeJS()
    })
  })

  onBeforeUnmount(() => {
    cleanupThreeJS()
    sceneContainer.value?.removeEventListener('touchstart', onTouchStart)
    sceneContainer.value?.removeEventListener('touchmove', onTouchMove)
    // 清理 Three.js 资源
    if (THREErenderer.value) {
      THREErenderer.value.dispose()
    }
  })

  /** 初始化 Three.js 场景 */
  const initThreeJS = () => {
    if (!sceneContainer.value) return
    emitter.emit('realPersonModel:loadCompleted', false)
    isDownload.value = false
    // 清理之前的实例
    cleanupThreeJS()

    // 创建场景和相机
    scene = new THREE.Scene()
    camera.value = new THREE.PerspectiveCamera(
      45,
      sceneContainer.value.clientWidth / sceneContainer.value.clientHeight,
      0.1,
      2000,
    )
    camera.value.position.set(0, 0.5, 4)
    camera.value.lookAt(0, 1, 0)

    // 创建渲染器
    const renderer = new THREE.WebGLRenderer({
      antialias: true, // 抗锯齿
      alpha: true, // 透明背景
    })

    // 使用新的颜色空间API替代已废弃的encoding属性
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.0

    THREErenderer.value = renderer
    renderer.setSize(
      sceneContainer.value.clientWidth,
      sceneContainer.value.clientHeight,
    )
    // 启用阴影渲染
    renderer.shadowMap.enabled = true
    renderer.localClippingEnabled = true // 启用局部剪切

    // 挂载渲染
    sceneContainer.value.appendChild(renderer.domElement)

    // === 改进的光源设置，更适合人头模型 ===
    // 主光（可旋转）
    rotatingLight = new THREE.DirectionalLight(0xffffff, 1.2)
    rotatingLight.position.set(5, 10, 7)
    rotatingLight.castShadow = true
    scene.add(rotatingLight)

    // 补光 - 软化阴影
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.8)
    fillLight.position.set(-5, 3, 5)
    scene.add(fillLight)

    // 背光 - 增强轮廓
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.6)
    rimLight.position.set(0, 3, -10)
    scene.add(rimLight)

    // 顶部环境光 - 确保头顶有足够的光线
    const topLight = new THREE.DirectionalLight(0xffffff, 0.5)
    topLight.position.set(0, 10, 0)
    scene.add(topLight)

    // 环境光 - 提供基础照明
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)

    // 半球光 - 提供更自然的环境照明
    const hemisphereLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 0.4)
    scene.add(hemisphereLight)

    // 初始化控制器
    controls.value = new OrbitControls(camera.value, renderer.domElement)
    controls.value.enablePan = true
    controls.value.enableZoom = true
    controls.value.enableDamping = true

    // --- 初始化模型容器组 (用于场景显示) ---
    modelGroup = new THREE.Group()
    modelGroup.name = 'mergedModel_Display'

    props.modelInfo && newMergeModels(modelGroup)

    // 初始化触摸事件
    initTouchEvents()

    // 阻止页面跟随滑动
    sceneContainer.value.addEventListener(
      'touchmove',
      (event) => {
        event.preventDefault()
      },
      { passive: false },
    )
  }

  /** 清理 Three.js 资源 */
  const cleanupThreeJS = () => {
    // 清空要下载的文件列表
    if (downloadFiles.value.length) {
      downloadFiles.value = []
    }
    if (THREErenderer.value) {
      THREErenderer.value.dispose()
      if (THREErenderer.value.domElement && sceneContainer.value) {
        sceneContainer.value.removeChild(THREErenderer.value.domElement)
      }
    }

    if (controls.value) {
      controls.value.dispose()
    }

    if (scene) {
      while (scene.children.length > 0) {
        scene.remove(scene.children[0])
      }
    }

    if (camera.value) {
      camera.value = undefined
    }

    if (modelGroup) {
      while (modelGroup.children.length > 0) {
        modelGroup.remove(modelGroup.children[0])
      }
    }
  }

  /**
   * 从 .mtl 文本中提取材质与贴图映射关系。
   * @param {string} mtlText - MTL 文件的文本内容。
   * @returns {Object} { materialName: { map_Kd, map_Bump, ... } }
   */
  const parseMtlTextureMap = (mtlText: string) => {
    const result: Record<string, Record<string, string>> = {}
    let current = null

    for (let line of mtlText.split(/\r?\n/)) {
      line = line.trim()
      if (!line || line.startsWith('#')) continue

      const mtlMatch = line.match(/^newmtl\s+(.+)/i)
      if (mtlMatch) {
        current = mtlMatch[1].trim()
        result[current] = {}
        continue
      }

      const mapMatch = line.match(/^(map_\w+)\s+(.+)/i)
      if (mapMatch && current) {
        const key = mapMatch[1]
        const val = mapMatch[2].replace(/[^\x20-\x7E]/g, '').trim()
        result[current][key] = val
      }
    }

    return result
  }

  const mtlText = ref('')

  // 加载mtl文件
  const loadMtl = async (
    urlMap: TaskResultRes['model']['head'],
    mtlKey: keyof TaskResultRes['model']['head'] = 'metaHumanLod0.mtl',
  ) => {
    const manager = new THREE.LoadingManager()
    const textureLoader = new THREE.TextureLoader(manager)
    const mtlLoader = new MTLLoader()

    // ===== 1️⃣ 获取 MTL 文本 =====
    const mtlUrl = urlMap[mtlKey]
    if (!mtlUrl) throw new Error(`MTL 文件未在 urlMap 中找到: ${mtlKey}`)

    mtlText.value = await fetch(mtlUrl).then((r) => r.text())
    console.log('🚀 ~ loadMtl ~ mtlText.value:', mtlText.value)

    // ===== 2️⃣ 解析出 材质名→贴图文件名 的映射 =====
    const textureMapping = parseMtlTextureMap(mtlText.value)
    console.log('🚀 ~ loadMtl ~ textureMapping:', textureMapping)

    // ===== 3️⃣ 使用 MTLLoader 解析 MTL 文本 =====
    const materialsCreator = mtlLoader.parse(mtlText.value, '')
    console.log('🚀 ~ loadMtl ~ materialsCreator:', materialsCreator)
    materialsCreator.preload()

    // ===== 4️⃣ 手动修复每个材质的贴图映射 =====
    for (const materialName in materialsCreator.materials) {
      const mat = materialsCreator.materials[
        materialName
      ] as THREE.MeshPhongMaterial
      console.log('🚀 ~ loadMtl ~ mat:', mat)
      const texName = textureMapping[materialName]
        ?.map_Kd as keyof TaskResultRes['model']['head']
      console.log('🚀 ~ loadMtl ~ texName:', texName)

      if (texName && urlMap[texName]) {
        const tex = textureLoader.load(urlMap[texName])
        console.log('🚀 ~ loadMtl ~ tex:', tex)
        tex.colorSpace = THREE.SRGBColorSpace
        // 修改纹理的名称
        tex.name = texName
        mat.map = tex
        mat.needsUpdate = true
        console.log(`✅ 材质 [${materialName}] 使用贴图 [${texName}]`)
      } else {
        console.warn(`⚠️ 材质 [${materialName}] 未找到贴图`)
      }
    }

    return materialsCreator
  }
  // 加载obj模型
  const loadObjModel = (
    modelFile: TaskResultRes['model']['head'] | BodyOrHairModel,
    options: ModelOptions,
  ) => {
    console.log('🚀 ~ loadObjModel ~ modelFile:', modelFile)
    return new Promise(async (resolve, reject) => {
      let materials: MTLLoader.MaterialCreator | THREE.Material | undefined
      const objLoader = new OBJLoader()

      if ('metaHumanLod0.mtl' in modelFile) {
        materials = await loadMtl(modelFile, 'metaHumanLod0.mtl')
        console.log('🚀 ~ loadObjModel ~ materials:', materials)
        // materials.preload()
        // objLoader.setMaterials(materials)
      } else {
        // 创建TextureLoader实例用于加载纹理
        const textureLoader = new THREE.TextureLoader()
        const textureImg = modelFile.model_path.map
        const texture = textureLoader.load(textureImg)
        // 获取纹理图片的格式
        let imageFormat = textureImg.substring(
          textureImg.lastIndexOf('.'),
          textureImg.length,
        )
        texture.name = options.name + '_texture' + imageFormat
        texture.colorSpace = THREE.SRGBColorSpace
        materials = new THREE.MeshStandardMaterial({
          map: texture,
          // 设置合理的默认材质属性
          roughness: 0.4,
          metalness: 0,
          name: options.name + '_mat',
        })
      }
      console.log('🚀 ~ loadObjModel ~ materials:', materials)

      const modelUrl =
        'metaHumanLod0.mtl' in modelFile
          ? modelFile['final.obj']
          : modelFile.model_path.mold
      // console.log('🚀 ~ loadObjModel ~ modelUrl:' + options.name, modelUrl)

      // 2️⃣ 加载 OBJ
      const objText = await fetch(modelUrl).then((r) => r.text())
      let object = objLoader.parse(objText)
      console.log('🚀 ~ loadObjModel ~ object:', object)
      // 执行布尔切割头部模型
      if (
        options.name === 'head' &&
        props.modelInfo?.model?.body.cutting_model_path
      ) {
        object = await getCutHead(
          object,
          props.modelInfo?.model?.body.cutting_model_path,
        )
      }

      if (
        !('metaHumanLod0.mtl' in modelFile) &&
        materials instanceof THREE.Material
      ) {
        // 为模型的所有网格应用自定义材质
        object.traverse((child) => {
          const mesh = child as THREE.Mesh
          if (mesh.isMesh && materials) {
            mesh.material = materials
          }
        })
      } else {
        // 3️⃣ 绑定材质
        object.traverse((child: any) => {
          console.log('🚀 ~ loadObjModel ~ child--:', child)
          if (child.isMesh) {
            const mat = (materials as MTLLoader.MaterialCreator).create(
              child.material.name,
            )
            if (mat) {
              const typedMat = mat as THREE.MeshPhongMaterial
              child.material = new THREE.MeshStandardMaterial({
                map: typedMat.map || null,
                normalMap: typedMat.normalMap || null,
                name: child.material.name,
              })
            }
          }
        })
      }
      const scale = options.scale || 1
      // 模型缩放
      object.scale.set(scale, scale, scale)
      // 模型位置
      object.position.set(
        options?.position?.x || 0,
        options?.position?.y || 0,
        options?.position?.z || 0,
      )
      // 模型名称
      object.name = options.name
      // 模型 旋转
      object.rotation.x = options?.rotation?.x || 0
      object.rotation.y = options?.rotation?.y || 0
      object.rotation.z = options?.rotation?.z || 0

      // 确保世界矩阵更新（防止姿态或缩放未应用）
      object.updateMatrixWorld(true)

      object.traverse((child: any) => {
        if (child.isMesh) {
          // ✅ 如果几何体已经包含法线（OBJLoader 已生成）
          // 就不要再删除或重新计算，否则平滑组信息会丢失
          const geom = child.geometry

          if (!geom.hasAttribute('normal')) {
            console.warn(`模型 ${object.name} 缺失法线，正在自动生成平滑法线`)
            geom.computeVertexNormals()
          }

          // ✅ 强制使用平滑着色
          if (child.material) {
            child.material.flatShading = false
            child.material.needsUpdate = true
          }

          // ✅ 开启阴影与渲染优化
          child.castShadow = true
          child.receiveShadow = true
          geom.normalsNeedUpdate = true
        }
      })

      // 提取实际的网格对象
      if (
        object.children.length > 0 &&
        (object.children[0] as THREE.Mesh).isMesh
      ) {
        resolve(object)
      } else {
        reject(new Error('加载的OBJ模型不包含有效的网格'))
      }
    })
  }

  // --- 合并模型到显示组 ---
  async function newMergeModels(
    modelGroup: THREE.Group<THREE.Object3DEventMap>,
  ) {
    try {
      // 检查必要的模型路径是否存在
      const hairModel = props.modelInfo?.model?.hair
      const headModel = props.modelInfo?.model?.head
      const bodyModel = props.modelInfo?.model?.body

      // 如果任何模型路径不存在，则无法加载模型
      if (!hairModel || !headModel || !bodyModel) {
        console.error('模型路径缺失:', {
          hairModel,
          headModel,
          bodyModel,
        })
        showMessage({
          type: 'error',
          message: '模型数据不完整！',
        })
        return
      }

      const [hair, head, body] = await Promise.all([
        // 加载头发模型
        loadObjModel(hairModel, {
          name: 'hair',
        }),
        //加载头部模型
        loadObjModel(headModel, {
          name: 'head',
        }),
        // 加载身体模型
        loadObjModel(bodyModel, {
          name: 'body',
        }),
      ])

      console.log('🚀 ~ newMergeModels ~ hair, head, body:', hair, head, body)

      modelGroup.clear()
      modelGroup.add(hair as THREE.Object3D<THREE.Object3DEventMap>)
      modelGroup.add(head as THREE.Object3D<THREE.Object3DEventMap>)
      modelGroup.add(body as THREE.Object3D<THREE.Object3DEventMap>)
      modelGroup.position.set(0, -1, 0)
      const scale = 0.014
      modelGroup.scale.set(scale, scale, scale) // 添加整体缩放
      scene.add(modelGroup)

      // 确保世界矩阵更新（防止姿态或缩放未应用）
      modelGroup.updateMatrixWorld(true)

      console.log('打印模型组对象:', modelGroup)

      animate(
        THREErenderer.value,
        scene,
        camera.value as THREE.PerspectiveCamera,
      )

      // 在模型加载完成后设置剪切
      nextTick(() => {
        onModelLoadComplete()
      })

      // 启用所有导出按钮
      // exportGlbButton.disabled = false
      // exportObjButton.disabled = false
    } catch (error) {
      console.error('合并模型出错:', error)
    }
  }

  /** 渲染动画 */
  const animate = (
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
  ) => {
    let angle = 0
    const renderScene = () => {
      requestAnimationFrame(renderScene)

      // 主光旋转
      if (rotatingLight) {
        angle += 0.01
        const radius = 15
        rotatingLight.position.x = Math.cos(angle) * radius
        rotatingLight.position.z = Math.sin(angle) * radius
        rotatingLight.position.y = 10
      }

      renderer.render(scene, camera)
    }
    renderScene()
  }

  // === 触控缩放 ===
  let initialDistance = 0
  let initialZoom = camera.value?.zoom

  const getTouchDistance = (event: TouchEvent) => {
    const dx = event.touches[0].clientX - event.touches[1].clientX
    const dy = event.touches[0].clientY - event.touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  const onTouchStart = (event: TouchEvent) => {
    if (event.touches.length === 2) {
      initialDistance = getTouchDistance(event)
      initialZoom = camera.value?.zoom
    }
  }

  const onTouchMove = (event: TouchEvent) => {
    if (!camera.value || !initialZoom) return
    if (event.touches.length === 2) {
      const currentDistance = getTouchDistance(event)
      const zoomFactor = currentDistance / initialDistance
      camera.value.zoom = initialZoom * zoomFactor
      camera.value.updateProjectionMatrix()
      controls.value?.update()
    }
  }

  const initTouchEvents = () => {
    sceneContainer.value?.addEventListener('touchstart', onTouchStart, {
      passive: false,
    })
    sceneContainer.value?.addEventListener('touchmove', onTouchMove, {
      passive: false,
    })
  }

  /** 模型加载完成后的回调函数 */
  const onModelLoadComplete = () => {
    showMessage({
      type: 'success',
      message: '模型加载成功！',
    })
    isDownload.value = true
    emitter.emit('realPersonModel:loadCompleted', true)
  }

  const downloadFiles = ref<{ name: string; value: Blob | string }[]>([])

  // 导出模型为OBJ文件（包含材质和纹理）
  const exportModelAsOBJ = () => {
    try {
      // 使用 OBJExporter
      import('three/examples/jsm/exporters/OBJExporter.js')
        .then(async ({ OBJExporter }) => {
          // 1. 导出 OBJ
          const exporter = new OBJExporter()
          let objData = exporter.parse(modelGroup)
          console.log('🚀 ~ exportModelAsOBJ ~ modelGroup:', modelGroup)

          // 收集要下载的整体模型
          downloadFiles.value.push({
            name: 'merged-model-head-clipped.obj',
            value: new Blob(['mtllib customMtl.mtl\n' + objData], {
              type: 'text/plain',
            }),
          })

          // 2. 循环模型组收集要下载的mtl文件和纹理图片文件
          modelGroup.children.forEach((item, index) => {
            // 将多个obj模型的mtl合并
            if (item.name !== 'head') {
              const mtlVal = generateMTL(item)
              mtlText.value = `${mtlText.value}\n${mtlVal}`
            }

            // 3. 导出纹理图片
            extractTextures(item) // 自定义函数，提取并下载纹理
          })
          downloadFiles.value.push({
            name: 'customMtl.mtl',
            value: mtlText.value,
          })

          console.log(
            '🚀 ~ exportModelAsOBJ ~ downloadFiles.value:',
            downloadFiles.value,
          )
          // 4. 统一使用jszip和filesave导出
          const zip = new JSZip()
          // 循环加载每个文件
          for (const file of downloadFiles.value) {
            let content
            try {
              if (
                typeof file.value === 'string' &&
                file.value.startsWith('http')
              ) {
                const response = await fetch(file.value)
                if (!response.ok) throw new Error(`无法下载 ${file.value}`)
                content = await response.blob()
                console.log('🚀 ~ exportModelAsOBJ ~ content:', content)
              } else {
                content = file.value
              }
              zip.file(file.name, content)
            } catch (err) {
              console.error('❌ 下载失败：', file.value, err)
            }
          }

          // 打包为 ZIP Blob
          const zipBlob = await zip.generateAsync({ type: 'blob' })

          // 下载
          saveAs(zipBlob, '3D_models_and_images.zip')
        })
        .catch((error) => {
          console.error('导出OBJ模型失败:', error)
          showMessage({
            type: 'error',
            message: 'OBJ模型导出失败！',
          })
        })
    } catch (error) {
      console.error('导出OBJ模型失败:', error)
      showMessage({
        type: 'error',
        message: 'OBJ模型导出失败！',
      })
    }
  }

  // 辅助函数：生成 MTL 内容
  function generateMTL(object: any) {
    let mtlContent = ''
    object.traverse((child: any) => {
      console.log('🚀 ~ generateMTL ~ child:', child)
      if (child.isMesh && child.material && child.material) {
        const material = child.material

        // 添加材质名称
        mtlContent += `newmtl ${material.name || 'default_shader'}\n`

        // 提取颜色属性（如果存在）
        if (material.color) {
          const { r, g, b } = material.color
          mtlContent += `Ka ${r * (material.aoMapIntensity || 0.2)} ${g * (material.aoMapIntensity || 0.2)} ${b * (material.aoMapIntensity || 0.2)}\n`
          mtlContent += `Kd ${r} ${g} ${b}\n`
        } else {
          mtlContent += `Ka 0.2 0.2 0.2\n`
          mtlContent += `Kd 0.8 0.8 0.8\n`
        }

        // 提取镜面反射属性
        if (material.specular) {
          const { r, g, b } = material.specular
          mtlContent += `Ks ${r} ${g} ${b}\n`
        } else {
          mtlContent += `Ks 0.1 0.1 0.1\n`
        }

        // 提取透射滤波（Transmission Filter）
        if (material.transmission) {
          // 如果材质有透射属性，则使用透射值，否则使用默认值
          const transmission = material.transmission || 0.0
          mtlContent += `Tf ${1 - transmission} ${1 - transmission} ${1 - transmission}\n`
        } else {
          // 默认不透明材质
          mtlContent += `Tf 1.0 1.0 1.0\n`
        }

        // 提取光学密度/折射率（Index of Refraction）
        if (material.refractionRatio) {
          // 如果材质有折射率属性
          mtlContent += `Ni ${material.refractionRatio}\n`
        } else if (material.transparent) {
          // 如果材质是透明的但没有指定折射率，使用默认玻璃折射率
          mtlContent += `Ni 1.5\n`
        } else {
          // 不透明材质使用默认空气折射率
          mtlContent += `Ni 1.0\n`
        }

        // 提取高光指数
        mtlContent += `Ns ${material.shininess || 30}\n`

        // 光照模型
        mtlContent += `illum 2\n`

        // 如果有纹理贴图，则添加纹理映射
        if (material.map) {
          const textureName =
            material.map.name ||
            getImgName(material.map.image.src) ||
            'texture.png'
          mtlContent += `map_Kd ${textureName}\n`
        }

        // 处理其他类型的纹理贴图
        if (material.bumpMap) {
          const bumpName =
            material.bumpMap.name ||
            getImgName(material.bumpMap.image.src) ||
            'bump.png'
          mtlContent += `map_Bump ${bumpName}\n`
        }

        if (material.normalMap) {
          const normalName =
            material.normalMap.name ||
            getImgName(material.normalMap.image.src) ||
            'normal.png'
          mtlContent += `map_Kn ${normalName}\n`
        }

        if (material.roughnessMap) {
          const roughnessName =
            material.roughnessMap.name ||
            getImgName(material.roughnessMap.image.src) ||
            'roughness.png'
          mtlContent += `map_Pr ${roughnessName}\n`
        }

        if (material.metalnessMap) {
          const metalnessName =
            material.metalnessMap.name ||
            getImgName(material.metalnessMap.image.src) ||
            'metalness.png'
          mtlContent += `map_Pm ${metalnessName}\n`
        }

        if (material.alphaMap) {
          const alphaName =
            material.alphaMap.name ||
            getImgName(material.alphaMap.image.src) ||
            'alpha.png'
          mtlContent += `map_d ${alphaName}\n`
        }

        mtlContent += '\n' // 材质之间添加空行分隔
      }
    })
    return mtlContent
  }

  function getImgName(url: string) {
    if (typeof url === 'string' && url !== '') {
      const arr = url.split('/')
      return arr[arr.length - 1]
    }
    return ''
  }

  // 辅助函数：提取纹理
  function extractTextures(object: any) {
    object.traverse((child: any) => {
      if (child.material?.map) {
        console.log('🚀 ~ extractTextures ~ child:', child)
        const texture = child.material.map
        const imageUrl = texture.image.src
        downloadFiles.value.push({
          name:
            child.parent.name === 'head'
              ? imageUrl.substring(
                  imageUrl.lastIndexOf('/') + 1,
                  imageUrl.length,
                )
              : texture.name,
          value: imageUrl,
        })
      }
    })
  }

  // 导出stl模型
  const exportModelAsSTL = () => {
    try {
      // 创建一个临时组来存放调整后的模型
      const exportGroup = new THREE.Group()

      // 克隆当前模型组中的所有子对象
      modelGroup.children.forEach((child) => {
        const clonedChild = child.clone(true)
        exportGroup.add(clonedChild)
      })

      // 调整模型方向，使其直立
      // 当前模型是躺倒的，需要绕X轴旋转90度使其直立
      exportGroup.rotation.x = Math.PI / 2

      // 应用变换并更新矩阵
      exportGroup.updateMatrixWorld(true)
      // 使用 STLExporter 导出模型
      // 注意：需要先安装 three/examples/jsm/exporters/STLExporter
      import('three/examples/jsm/exporters/STLExporter.js')
        .then(({ STLExporter }) => {
          const exporter = new STLExporter()
          const stlString = exporter.parse(exportGroup)

          // 创建下载链接
          const blob = new Blob([stlString], { type: 'text/plain' })
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = 'model.stl'
          link.click()

          // 清理URL对象
          URL.revokeObjectURL(url)

          showMessage({
            type: 'success',
            message: '模型导出成功！',
          })
        })
        .catch((error) => {
          console.error('导出模型失败:', error)
          showMessage({
            type: 'error',
            message: '模型导出失败！',
          })
        })
    } catch (error) {
      console.error('导出模型失败:', error)
      showMessage({
        type: 'error',
        message: '模型导出失败！',
      })
    }
  }

  watch(
    () => props.modelInfo,
    (modelInfo) => {
      console.log('🚀 ~ modelInfo:模型信息变化啦', modelInfo)
      nextTick(() => {
        initThreeJS()
      })
    },
    {
      deep: true,
    },
  )

  const takePhoto = (): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      try {
        if (
          !scene ||
          !camera.value ||
          !THREErenderer.value ||
          !sceneContainer.value
        ) {
          reject(new Error('场景尚未初始化完成'))
          return
        }

        // 保存当前控制器状态
        const currentControlsEnabled = controls.value?.enabled

        // 暂时禁用控制器，避免在拍照过程中用户操作
        if (controls.value) {
          controls.value.enabled = false
        }

        // 使用当前渲染器和相机直接渲染场景
        // 这样可以保持当前的视角、模型位置和缩放状态
        THREErenderer.value.render(scene, camera.value)

        // 获取当前渲染区域的尺寸
        const rect = sceneContainer.value.getBoundingClientRect()
        const photoWidth = rect.width
        const photoHeight = rect.height

        // 创建一个新的渲染器用于拍照，确保使用当前视图
        const photoRenderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
        })

        // 设置颜色空间和渲染参数
        photoRenderer.outputColorSpace = THREE.SRGBColorSpace
        photoRenderer.toneMapping = THREE.ACESFilmicToneMapping
        photoRenderer.toneMappingExposure = 1.0

        // 设置渲染尺寸
        photoRenderer.setSize(photoWidth, photoHeight)
        photoRenderer.setPixelRatio(window.devicePixelRatio)

        // 使用当前状态渲染场景
        photoRenderer.render(scene, camera.value)

        // 获取canvas元素并转换为blob
        photoRenderer.domElement.toBlob(
          (blob) => {
            // 恢复控制器状态
            if (controls.value) {
              controls.value.enabled = currentControlsEnabled ?? true
            }

            if (blob) {
              resolve(blob)
            } else {
              reject(new Error('无法生成图片'))
            }

            // 清理资源
            photoRenderer.dispose()
          },
          'image/png',
          0.95, // 图片质量
        )
      } catch (error) {
        reject(error)
      }
    })
  }

  // 暴露导出方法给父组件
  defineExpose({
    exportModelAsOBJ,
    exportModelAsSTL,
    takePhoto,
  })
</script>
<style lang="scss" scoped>
  // .photo {
  //   position: absolute;
  //   left: -9999px;
  // }
</style>
