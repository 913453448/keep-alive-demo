<template>
    <div class="home">
        <h1>我是首页</h1>
        <router-link to="/pageA">点我跳转到 a 页面</router-link>
    </div>
</template>
<script>
    import LifeRecycle from "../life-recycle";

    export default {
        name: 'home',
        mixins: [LifeRecycle]
    }
</script>
