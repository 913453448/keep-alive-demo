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
      children: [
        {
          path: 'home1',
          name: 'home1',
          component: () => import(/* webpackChunkName: "about" */ './views/Home1.vue'),
        },
        {
          path: 'home2',
          name: 'home2',
          component: () => import(/* webpackChunkName: "about" */ './views/Home2.vue'),
        }
      ]
    },
    {
      path: "/pageA",
      name: "pageA",
      component: () => import(/* webpackChunkName: "about" */ './views/A.vue')
    },
    {
      path: "/pageB",
      name: "pageB",
      component: () => import(/* webpackChunkName: "about" */ './views/A.vue')
    }
  ]
})
