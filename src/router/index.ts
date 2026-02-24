import { createRouter, createWebHashHistory } from "vue-router";
// import SplicingModelsMainContainer from "../components/SplicingModelsMainContainer.vue";
import PageNotFound from "../components/ui/PageNotFound.vue";
import ThreeSceneTst from "@/components/three/ThreeSceneTst.vue";

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: "/",
      name: "home",
      // component: SplicingModelsMainContainer,
      component: ThreeSceneTst,
    },
    {
      path: "/mode/:mode",
      name: "mode",
      // component: SplicingModelsMainContainer,
      component: ThreeSceneTst,
      // Validation to ensure only 'morph' is allowed -> others go to 404
      beforeEnter: (to, from, next) => {
        if (to.params.mode === "morph") {
          next();
        } else {
          next({ name: "not-found" });
        }
      },
    },
    {
      path: "/:pathMatch(.*)*",
      name: "not-found",
      component: PageNotFound,
    },
  ],
});

export default router;
