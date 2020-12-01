<template>
  <div id="app">
    <keep-alive :max="1">
      <router-view/>
    </keep-alive>
  </div>
</template>

<style>
#app {
  text-align: center;
}
</style>
