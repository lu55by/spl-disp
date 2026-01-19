# 3D 模型拼接展示工具 (Vue 3 + Three.js)

本项目是一个基于 Vue 3 和 Three.js 的 3D 模型拼接演示系统，主要用于头发、头部和身体 OBJ/STL 模型的加载、拼接、切割及材质编辑。

## 项目结构

```text
root
├── public/                # 静态资源（模型、贴图等）
├── src/
│   ├── api/               # API 接口（如身份验证、Token 获取）
│   ├── components/        # Vue 组件
│   │   ├── three/         # Three.js 核心场景组件 (Renderer, Scene, Controls)
│   │   └── ui/            # 界面 UI 组件 (Loading, Overlays, Toasts)
│   ├── constants/         # 项目常量及多语言配置
│   ├── stores/            # Pinia 状态管理 (模型数据、认证状态)
│   ├── three/             # Three.js 业务逻辑核心
│   │   ├── csg/           # 基于 CSG 的模型切割与布尔运算逻辑
│   │   ├── exporters/     # 3D 模型导出模块
│   │   ├── gui/           # Tweakpane 调试工具配置
│   │   ├── loaders/       # 3D 模型 (OBJ/STL) 与纹理加载器
│   │   ├── managers/      # 全局管理器 (加载管理、资产管理)
│   │   ├── meshOps/       # 网格操作 (变形、平滑、修复)
│   │   ├── shaders/       # TSL (Three Shading Language) 着色器实现
│   │   └── utils/         # 三维数学与几何工具函数
│   ├── types/             # TypeScript 类型定义
│   ├── App.vue            # 主应用组件
│   └── main.ts            # 项目入口文件
├── updates/               # 开发进度与功能优化文档
├── vite.config.ts         # Vite 配置文件
└── package.json           # 项目依赖配置
```

## 核心功能

- **多格式模型加载**：支持 OBJ 和 STL 格式。
  - **导入规范**：需由模型师按规范命名，单次导入最多 2 个文件（1 个模型文件 + 1 个可选贴图）。
  - **校验逻辑**：
    - **STL**：文件名需包含 `hair`、`body` 或 `cutter` 关键字符。
    - **OBJ**：内部首个网格名 (Node Name) 需包含 `hair`、`body` 或 `cutter` 等规范字符。
    - **类型匹配**：暂不支持同时导入两个模型文件。
- **高阶网格运算**：集成 `three-bvh-csg` 进行高性能的模型切割与拼接。
- **网格修复与流形化**：利用 `manifold-3d` 处理复杂的几何损坏，生成流形网格。
- **实时材质编辑**：支持拖拽纹理文件实时替换模型材质，支持 WebGPU 下的 TSL (Three.js Shading Language) 着色器效果。
- **变换控制器**：通过 `TransformControls` 实现模型的位移、旋转和缩放 (根据模型师需求，目前相关代码已注释)。
- **响应式状态同步**：Pinia 深度集成，确保 3D 场景状态与 UI 界面完美同步。
- **自动化认证**：支持自动获取与持久化 API Token，确保后台通信安全。

## 采用技术栈

### 前端框架

- **Vue 3 (Composition API)**：响应式 UI 框架。
- **Vite**：高性能下一代前端构建工具。
- **Pinia**：轻量级 Vue 状态管理库。
- **TypeScript**：强类型保证代码质量。

### 3D 引擎与几何处理

- **Three.js (r181+)**：核心 3D 渲染引擎，支持 WebGPU 环境。
- **three-mesh-bvh**：加速几何检测与射线检测。
- **three-bvh-csg**：实时布尔运算。
- **manifold-3d (WASM)**：工业级网格修复与布尔运算。
- **TSL (Three.js Shading Language)**：编写高性能、跨平台的节点化着色器。

### UI & 工具

- **Tailwind CSS**：现代原子化 CSS 框架。
- **Tweakpane / lil-gui**：轻量级调试参数面板。
- **vue3-toastify**：优雅的通知提示系统。
- **pnpm**：高效的包管理工具。

## 启动与运行

确保你已安装 `pnpm`：

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```
