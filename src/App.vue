<template>
  <div id="app">
    <keep-alive>
      <!-- 设置当前 router-view 的 key 为 path，来解决复用问题 -->
      <router-view :key="$route.path"/>
    </keep-alive>
  </div>
</template>

<style>
#app {
  text-align: center;
}
</style>
