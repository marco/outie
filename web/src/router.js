import VueRouter from 'vue-router'
import StudentPage from './views/StudentPage.vue'
import AdminPage from './views/AdminPage.vue'

export default new VueRouter({
  routes: [
    {
      path: '/',
      name: 'IndexPage',
      component: StudentPage,
    },
    {
      path: '/admin/',
      name: 'AdminPage',
      component: AdminPage,
    },
  ]
})
