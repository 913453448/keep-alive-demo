<template>
  <div class="about">
    <h1>我是 {{$route.path}} 页面</h1>
    <router-link to="/pageB">点我跳转到 b 页面</router-link>
  </div>
</template>
<script>
  import LifeRecycle from "../life-recycle";
  export default {
    name: "page-a",
    mixins:[LifeRecycle]
  }
</script>
