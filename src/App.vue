<template>
  <div id="app">
    <keep-alive :exclude="/page-/">
      <router-view/>
    </keep-alive>
  </div>
</template>

<style>
#app {
  text-align: center;
}
</style>
