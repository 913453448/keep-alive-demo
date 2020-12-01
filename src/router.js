import Vue from 'vue'
import Router from 'vue-router'
import Home from './views/Home.vue'

Vue.use(Router)

export default new Router({
  mode: "history",
  routes: [
    {
      path: '/',
      name: 'home',
      component: Home,
    },
    {
      path: "/pageA",
      name: "pageA",
      component: () => import(/* webpackChunkName: "about" */ './views/A.vue')
    },
    {
      path: "/pageB",
      name: "pageB",
      component: () => import(/* webpackChunkName: "about" */ './views/B.vue')
    }
  ]
})
