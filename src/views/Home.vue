<template>
    <div class="home">
        <h1>我是首页</h1>
        <router-link to="/pageA">点我跳转到 a 页面</router-link>
        <div>
            <router-link to="/home1">点我切换到 home1 页面</router-link>|
            <router-link to="/home2">点我跳转到 home2 页面</router-link>
            <router-view/>
        </div>
    </div>
</template>
<script>
    import LifeRecycle from "../life-recycle";

    export default {
        name: 'home',
        mixins: [LifeRecycle]
    }
</script>
