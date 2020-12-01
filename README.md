## Vue 中 keep-alive 组件与 router-view 组件的那点事

最近项目中有小伙伴找到我，问我“为啥他写的页面第一次进去可以触发 `onCreate` 函数，第二次再进的时候就不触发了呢？”（因为我们项目是一个大型的项目，每个开发可能只接触到自己开发的一小部分），然后我就说你可以试着在 `activated` 钩子函数中做处理，然后他又接着问我“activated 钩子函数又是怎么调用的呢？”，ok！这小子是问上瘾了，我们下面就来详细解析一下。

## keep-alive

`<keep-alive>` 包裹动态组件时，会缓存不活动的组件实例，而不是销毁它们。和 `<transition>` 相似，`<keep-alive>` 是一个抽象组件：它自身不会渲染一个 DOM 元素，也不会出现在组件的父组件链中。

当组件在 `<keep-alive>` 内被切换，它的 `activated` 和 `deactivated` 这两个生命周期钩子函数将会被对应执行。

> 在 2.2.0 及其更高版本中，`activated` 和 `deactivated` 将会在 `<keep-alive>` 树内的所有嵌套组件中触发。

主要用于保留组件状态或避免重新渲染。

为了更好的来解析 `<keep-alive>`，我们 copy 到一份源码（vue@^2.6.10），`vue/src/core/components/keep-alive.js`：

```js
/* @flow */

import { isRegExp, remove } from 'shared/util'
import { getFirstComponentChild } from 'core/vdom/helpers/index'

type VNodeCache = { [key: string]: ?VNode };

function getComponentName (opts: ?VNodeComponentOptions): ?string {
  return opts && (opts.Ctor.options.name || opts.tag)
}

function matches (pattern: string | RegExp | Array<string>, name: string): boolean {
  if (Array.isArray(pattern)) {
    return pattern.indexOf(name) > -1
  } else if (typeof pattern === 'string') {
    return pattern.split(',').indexOf(name) > -1
  } else if (isRegExp(pattern)) {
    return pattern.test(name)
  }
  /* istanbul ignore next */
  return false
}

function pruneCache (keepAliveInstance: any, filter: Function) {
  const { cache, keys, _vnode } = keepAliveInstance
  for (const key in cache) {
    const cachedNode: ?VNode = cache[key]
    if (cachedNode) {
      const name: ?string = getComponentName(cachedNode.componentOptions)
      if (name && !filter(name)) {
        pruneCacheEntry(cache, key, keys, _vnode)
      }
    }
  }
}

function pruneCacheEntry (
  cache: VNodeCache,
  key: string,
  keys: Array<string>,
  current?: VNode
) {
  const cached = cache[key]
  if (cached && (!current || cached.tag !== current.tag)) {
    cached.componentInstance.$destroy()
  }
  cache[key] = null
  remove(keys, key)
}

const patternTypes: Array<Function> = [String, RegExp, Array]

export default {
  name: 'keep-alive',
  abstract: true,

  props: {
    include: patternTypes,
    exclude: patternTypes,
    max: [String, Number]
  },

  created () {
    this.cache = Object.create(null)
    this.keys = []
  },

  destroyed () {
    for (const key in this.cache) {
      pruneCacheEntry(this.cache, key, this.keys)
    }
  },

  mounted () {
    this.$watch('include', val => {
      pruneCache(this, name => matches(val, name))
    })
    this.$watch('exclude', val => {
      pruneCache(this, name => !matches(val, name))
    })
  },

  render () {
    const slot = this.$slots.default
    const vnode: VNode = getFirstComponentChild(slot) // 获取第一个子节点
    const componentOptions: ?VNodeComponentOptions = vnode && vnode.componentOptions
    if (componentOptions) {
      // check pattern
      const name: ?string = getComponentName(componentOptions) // 获取节点的名称
      const { include, exclude } = this
      if (
        // not included
        (include && (!name || !matches(include, name))) ||
        // excluded
        (exclude && name && matches(exclude, name)) // 不在范围内的节点将不会被缓存
      ) {
        return vnode
      }

      const { cache, keys } = this
      const key: ?string = vnode.key == null
        // same constructor may get registered as different local components
        // so cid alone is not enough (#3269)
        ? componentOptions.Ctor.cid + (componentOptions.tag ? `::${componentOptions.tag}` : '')
        : vnode.key // 获取缓存的 key 值
      if (cache[key]) { // 如果有缓存就使用缓存
        vnode.componentInstance = cache[key].componentInstance
        // make current key freshest
        remove(keys, key)
        keys.push(key)
      } else { // 没有缓存就将当前节点加入到缓存
        cache[key] = vnode
        keys.push(key)
        // prune oldest entry
        if (this.max && keys.length > parseInt(this.max)) { // 如果缓存超过最大限制将不再缓存
          pruneCacheEntry(cache, keys[0], keys, this._vnode)
        }
      }

      vnode.data.keepAlive = true // 标记该节点为 keepAlive 类型
    }
    return vnode || (slot && slot[0])
  }
}
```

其实从源码我们可以看到，代码并没有多少，还是比较简单的，下面我们用一下 `keep-alive` 组件。

#### Props

从源码中我们可以看到，`<keep-alive>` 组件有三个属性：

- `include` - 字符串或正则表达式。只有名称匹配的组件会被缓存。
- `exclude` - 字符串或正则表达式。任何名称匹配的组件都不会被缓存。
- `max` - 数字。最多可以缓存多少组件实例。

下面我们结合 Demo 来分析一下。

我们直接用 `vue-cli ` 创建一个简单的 vue 项目，取名为 `keep-alive-demo`:

```bash
vue create keep-alive-demo
```

然后选一下 `Router` 后一路回车：

![1-1](./1-1.png)

我们修改一下 `App.vue` 文件：

```vue
<template>
  <div id="app">
    <router-view/>
  </div>
</template>

<style>
#app {
  text-align: center;
}
</style>
```

然后 `views` 目录创建一个 `A` 组件当作 `页面 A`：

```vue
<template>
  <div class="about">
    <h1>我是 a 页面</h1>
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

```

A 页面很简单，里面一个按钮链接到了 B 页面。为了更好的显示每个组件的生命周期，我们为每个页面添加了一个 `mixin`：

```js
export default {
    computed: {
        name(){
            return this.$options.name;
        }
    },
    created(){
        console.log("created--->"+this.name);
    },
    activated() {
        console.log("activated--->"+this.name);
    },
    deactivated() {
        console.log("deactivated--->"+this.name);
    },
    destroyed() {
        console.log("destoryed--->"+this.name);
    }
}
```

直接 copy 一份 `A.vue` 代码创建一个 `页面 B`：

```vue
<template>
  <div class="about">
    <h1>我是 b 页面</h1>
  </div>
</template>
<script>
  import LifeRecycle from "../life-recycle";
  export default {
    name: "page-b",
    mixins:[LifeRecycle]
  }
</script>
```

然后修改一下 `views/Home.vue`：

```vue
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
```

给一个按钮直接链接到了 `页面 A`。

最后我们修改一下 `router.js`：

```js
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
```

代码很简单，我就不详细解析了，一个简单的 `SPA`(单页面应用) 就搭建完成了，三个平级的页面 `home`、`pageA`、`pageB`。

我们试着运行一下项目：

```bash
npm run serve
```

![1-2](./1-2.gif)

可以看到：

1. 首页打开 `home` 页面

   ```js
   created--->home
   ```

   直接触发了 `home` 页面的 `created` 方法。

2.  `home` 页面 ---> `pageA` 页面

   ```bash
   created--->page-a
   destoryed--->home
   ```

   `home` 页面触发了 `destoryed` 直接销毁了，然后触发了`pageA` 页面的 `created` 方法。

3.  `pageA` 页面 ---> `pageB` 页面

   ```bash
   created--->page-b
   destoryed--->page-a
   ```

   `pageA` 页面触发了 `destoryed` 直接销毁了，然后触发了`pageB` 页面的 `created` 方法。

4. `pageB` 页面返回

   ```bash
   created--->page-a
   destoryed--->page-b
   ```

   `pageB` 页面触发了 `destoryed` 直接销毁了，然后触发了`pageA` 页面的 `created` 方法。

5. `pageA` 页面返回

   ```bash
   created--->home
   destoryed--->page-a
   ```

   `pageA` 页面触发了 `destoryed` 直接销毁了，然后触发了`home` 页面的 `created` 方法。

   效果是没问题的，但是作为一个 `SPA` 的项目，这种用户体验肯定是不友好的，试想一下，你现在在一个 app 的首页浏览页面，然后滑呀滑呀，滑动了很长的页面好不容易看到了一个自己感兴趣的东西，然后点击查看详情离开了首页，再回到首页时候肯定是想停留在之前浏览器的地方，而不是说重新又打开一个新的首页，又要滑半天，这种体验肯定是不好的，而且也有点浪费资源，所以下面我们用一下 `<keep-alive>` 把首页缓存起来。

   我们修改一下 `App.vue` 文件：

   ```vue
   <template>
     <div id="app">
       <keep-alive>
         <router-view/>
       </keep-alive>
     </div>
   </template>
   ```

   可以看到，我们添加了一个`<keep-alive>` 组件，然后再次之前的操作：

   1. 首页打开 `home` 页面

      ```js
      created--->home
      activated--->home
      ```

      直接触发了 `home` 页面的 `created` 方法。

   2.  `home` 页面 ---> `pageA` 页面

      ```bash
      created--->page-a
      deactivated--->home
      activated--->page-a
      ```

      `home` 页面触发了 `deactivated` 变成非活跃状态，然后触发了`pageA` 页面的 `activated` 方法。

   3.  `pageA` 页面 ---> `pageB` 页面

      ```bash
      created--->page-b
      deactivated--->page-a
      activated--->page-b
      ```

      `pageA` 页面触发了 `deactivated` 变成非活跃状态，然后触发了`pageB` 页面的 `activated` 方法。

   4. `pageB` 页面返回

      ```bash
      deactivated--->page-b
      activated--->page-a
      ```

      `pageB` 页面触发了 `deactivated` 变成非活跃状态，然后触发了`pageA` 页面的 `activated` 方法。

   5. `pageA` 页面返回

      ```bash
      deactivated--->page-a
      activated--->home
      ```

细心的童鞋应该已经发现区别了吧？每个页面的 `destoryed` 不触发了，替换成了 `deactivated`，然后第一次创建页面的时候除了之前的 `created` 还多了一个 `activated` 方法。

是的！当我们加了`<keep-alive>` 组件后，所有页面都被缓存起来了，但是我们只需要缓存的是 `home` 页面，我们该怎么做呢？

1. 利用 `include` 属性规定缓存的范围

   我们修改一下 `App.vue` 给 `<keep-alive>` 组件添加 `include` 属性：

   ```vue
    <keep-alive :include="['home']">
         <router-view/>
     </keep-alive>
   ```

   `include` 可以是一个字符串数组，也可以是一个正则表达式，匹配的就是组件的名字，比如这里的 `home`，其实就是 `home` 组件的名称：

   ```js
   ...
   export default {
           name: 'home',
           mixins: [LifeRecycle]
       }
       ...
   ```

2. 利用 `exclude` 属性规定不缓存的范围

   这个刚好跟 `include` 属性相反，我们可以修改一下 `App.vue` 给 `<keep-alive>` 组件添加 `exclude` 属性：

   ```vue
   ..
   <keep-alive :exclude="/page-/">
         <router-view/>
       </keep-alive>
   ...
   ```

到这里我们思考一个问题，`<keep-alive>` 是会帮我们缓存组件，但是缓存的数量小倒还好，数量大了就有点得不偿失了，所以 vue 考虑到这个情况了，然后给`<keep-alive>` 添加了一个 `max` 属性，比如我们只需要缓存一个页面，我们只需要设置 `:max=1` 即可：

```vue
..
<template>
  <div id="app">
    <keep-alive :max="1">
      <router-view/>
    </keep-alive>
  </div>
</template>
...
```

`<keep-alive>` 每次会缓存最新的那个页面：

1. 首页打开 `home` 页面

   ```js
   created--->home
   activated--->home
   ```

   直接触发了 `home` 页面的 `created` 方法新创建了一个页面，然后调用了 `activated` 方法激活了当前页面。

2. `home` 页面 ---> `pageA` 页面

   ```bash
   created--->page-a
   deactivated--->home
   activated--->page-a
   ```

   `home` 页面触发了 `deactivated` 变成了非活跃状态，然后触发了`pageA` 页面的 `created` 方法新创建了一个页面，然后调用了 `activated` 方法激活了当前页面。

3. `pageA` 页面点击返回

   ```bash
   created--->home
   deactivated--->page-a
   activated--->home
   ```

   `pageA` 页面触发了 `deactivated` 变成了非活跃状态，然后触发了`home` 页面的 `created` 方法新创建了一个页面，然后调用了 `activated` 方法激活了当前页面。

当缓存页面的个数大于最大限制的时候，每次都移除数据的第 0 个位置的缓存，源码为：

```js
// 如果缓存数 > 最大缓存数，移除缓存数组的第 0 位置数据
if (this.max && keys.length > parseInt(this.max)) { 
          pruneCacheEntry(cache, keys[0], keys, this._vnode)
}
...
function pruneCacheEntry (
  cache: VNodeCache,
  key: string,
  keys: Array<string>,
  current?: VNode
) {
  const cached = cache[key] // 获取需要移除的缓存页面
  if (cached && (!current || cached.tag !== current.tag)) { // 如果当前页面跟缓存的页面不一致的时候
    // 触发移除的缓存页面的 destroy 方法
    cached.componentInstance.$destroy()
  }
  cache[key] = null
  remove(keys, key)
}
```

比如当 `:max="2"` 的时候，home ---> pageA ---> pageB，当进入 pageB 的时候，home 页面就会被销毁，会触发 home 页面的 `destroyed` 方法。

到这里 `<keep-alive>` 组件的基本用法我们算是 ok 了，我们解析来分析一下项目中会经常遇到的一些问题。

#### activated 生命周期

通过上面的 demo 我们可以知道，当页面被激活的时候会触发当前页面的 `activated` 方法，那么 vue 是在什么时候才会去触发这个方法呢？

我们找到 vue 源码位置 `/vue/src/core/vdom/create-component.js`:

```js
...
insert (vnode: MountedComponentVNode) {
    const { context, componentInstance } = vnode
    if (!componentInstance._isMounted) {
      componentInstance._isMounted = true
      callHook(componentInstance, 'mounted')
    }
    if (vnode.data.keepAlive) {
      if (context._isMounted) {
        // vue-router#1212
        // 在更新过程中，一个缓存的页面的子组件可能还会改变，
        // 当前的子组件并不一定就是最后的子组件，所以这个时候去调用 activaved 方法会不准确
        // 当页面都组件更新完毕之后再去调用。
        queueActivatedComponent(componentInstance)
      } else {
        // 递归激活所有子组件
        activateChildComponent(componentInstance, true /* direct */)
      }
    }
  },
    ...
export function activateChildComponent (vm: Component, direct?: boolean) {
  if (direct) {
    vm._directInactive = false
    if (isInInactiveTree(vm)) {
      return
    }
  } else if (vm._directInactive) {
    return
  }
  if (vm._inactive || vm._inactive === null) {
    vm._inactive = false
    // 先循环调用所有子组件的 activated 方法
    for (let i = 0; i < vm.$children.length; i++) {
      activateChildComponent(vm.$children[i])
    }
    // 再调用当前组件的 activated 方法
    callHook(vm, 'activated')
  }
}
```

当前 `vnode` 节点被插入的时候会判断当前 `vnode` 节点 `data` 上是不是有 `keepAlive` 标记，有的话就会激活自身和自己所有的子组件，通过源码我们还发现，当组件第一次创建的时候 `activated` 方法是在 `mounted` 方法之后执行。

#### deactivated 生命周期

通过上面的 demo 我们可以知道，当页面被隐藏的时候会触发当前页面的 `deactivated` 方法，那么 vue 是在什么时候才会去触发这个方法呢？

跟 `activated` 方法一样，我们找到 vue 源码位置 `/vue/src/core/vdom/create-component.js`:

```js
...
destroy (vnode: MountedComponentVNode) {
    const { componentInstance } = vnode
    if (!componentInstance._isDestroyed) {
      if (!vnode.data.keepAlive) {
        componentInstance.$destroy()
      } else {
        deactivateChildComponent(componentInstance, true /* direct */)
      }
    }
  }
...
export function deactivateChildComponent (vm: Component, direct?: boolean) {
  if (direct) {
    vm._directInactive = true
    if (isInInactiveTree(vm)) {
      return
    }
  }
  if (!vm._inactive) {
    vm._inactive = true
    for (let i = 0; i < vm.$children.length; i++) {
      deactivateChildComponent(vm.$children[i])
    }
    callHook(vm, 'deactivated')
  }
}
```

当前`vnode` 节点被销毁的时候，会判断当前节点是不是有 `keepAlive` 标记，有的话就不会直接调用组件的 `destroyed` 了，而是直接调用组件的 `deactivated` 方法。

那么节点的 `keepAlive` 是啥时候被标记的呢？还记得我们的 `<keep-alive>` 组件的源码不？

`vue/src/core/components/keep-alive.js`:

```js
...
render () {
    ...
      vnode.data.keepAlive = true // 标记该节点为 keepAlive 类型
    }
    return vnode || (slot && slot[0])
  }
...
```

ok！看到这里是不是就一目了然了呢？

## router-view

`router-view` 组件的基本用法跟原理我就不在这里解析了，感兴趣的童鞋可以去看 [官网](https://router.vuejs.org/zh/guide/essentials/dynamic-matching.html#%E5%93%8D%E5%BA%94%E8%B7%AF%E7%94%B1%E5%8F%82%E6%95%B0%E7%9A%84%E5%8F%98%E5%8C%96) ，也可以去看我之前的一些文章 [前端入门之(vue-router全解析二)](https://vvbug.blog.csdn.net/article/details/82766049)。

我们看一下`router-view` 组件中的源码：

```js
import { warn } from '../util/warn'
import { extend } from '../util/misc'
import { handleRouteEntered } from '../util/route'

export default {
  name: 'RouterView',
  functional: true,
  props: {
    name: {
      type: String,
      default: 'default'
    }
  },
  render (_, { props, children, parent, data }) {
    // used by devtools to display a router-view badge
    data.routerView = true

    // directly use parent context's createElement() function
    // so that components rendered by router-view can resolve named slots
    const h = parent.$createElement
    const name = props.name
    const route = parent.$route
    const cache = parent._routerViewCache || (parent._routerViewCache = {})

    // determine current view depth, also check to see if the tree
    // has been toggled inactive but kept-alive.
    let depth = 0
    let inactive = false
    while (parent && parent._routerRoot !== parent) {
      const vnodeData = parent.$vnode ? parent.$vnode.data : {}
      if (vnodeData.routerView) {
        depth++
      }
      if (vnodeData.keepAlive && parent._directInactive && parent._inactive) {
        inactive = true
      }
      parent = parent.$parent
    }
    data.routerViewDepth = depth

    // render previous view if the tree is inactive and kept-alive
    if (inactive) {
      const cachedData = cache[name]
      const cachedComponent = cachedData && cachedData.component
      if (cachedComponent) {
        // #2301
        // pass props
        if (cachedData.configProps) {
          fillPropsinData(cachedComponent, data, cachedData.route, cachedData.configProps)
        }
        return h(cachedComponent, data, children)
      } else {
        // render previous empty view
        return h()
      }
    }

    const matched = route.matched[depth]
    const component = matched && matched.components[name]

    // render empty node if no matched route or no config component
    if (!matched || !component) {
      cache[name] = null
      return h()
    }

    // cache component
    cache[name] = { component }

    // attach instance registration hook
    // this will be called in the instance's injected lifecycle hooks
    data.registerRouteInstance = (vm, val) => {
      // val could be undefined for unregistration
      const current = matched.instances[name]
      if (
        (val && current !== vm) ||
        (!val && current === vm)
      ) {
        matched.instances[name] = val
      }
    }

    // also register instance in prepatch hook
    // in case the same component instance is reused across different routes
    ;(data.hook || (data.hook = {})).prepatch = (_, vnode) => {
      matched.instances[name] = vnode.componentInstance
    }

    // register instance in init hook
    // in case kept-alive component be actived when routes changed
    data.hook.init = (vnode) => {
      if (vnode.data.keepAlive &&
        vnode.componentInstance &&
        vnode.componentInstance !== matched.instances[name]
      ) {
        matched.instances[name] = vnode.componentInstance
      }

      // if the route transition has already been confirmed then we weren't
      // able to call the cbs during confirmation as the component was not
      // registered yet, so we call it here.
      handleRouteEntered(route)
    }

    const configProps = matched.props && matched.props[name]
    // save route and configProps in cache
    if (configProps) {
      extend(cache[name], {
        route,
        configProps
      })
      fillPropsinData(component, data, route, configProps)
    }

    return h(component, data, children)
  }
}

function fillPropsinData (component, data, route, configProps) {
  // resolve props
  let propsToPass = data.props = resolveProps(route, configProps)
  if (propsToPass) {
    // clone to prevent mutation
    propsToPass = data.props = extend({}, propsToPass)
    // pass non-declared props as attrs
    const attrs = data.attrs = data.attrs || {}
    for (const key in propsToPass) {
      if (!component.props || !(key in component.props)) {
        attrs[key] = propsToPass[key]
        delete propsToPass[key]
      }
    }
  }
}

function resolveProps (route, config) {
  switch (typeof config) {
    case 'undefined':
      return
    case 'object':
      return config
    case 'function':
      return config(route)
    case 'boolean':
      return config ? route.params : undefined
    default:
      if (process.env.NODE_ENV !== 'production') {
        warn(
          false,
          `props in "${route.path}" is a ${typeof config}, ` +
          `expecting an object, function or boolean.`
        )
      }
  }
}

```

很简单，我就不一一解析了，我们重点看一下 `render` 方法中的这一段代码：

```js
...
 render (_, { props, children, parent, data }) {
  ...
   while (parent && parent._routerRoot !== parent) {
      const vnodeData = parent.$vnode ? parent.$vnode.data : {}
      // 获取当前页面的层级数（嵌套路由情况）
      if (vnodeData.routerView) {
        depth++
      }
      if (vnodeData.keepAlive && parent._directInactive && parent._inactive) {
        inactive = true
      }
      parent = parent.$parent
    }
    data.routerViewDepth = depth

    // render previous view if the tree is inactive and kept-alive
  	// 如果父组件为非激活状态并且是被缓存的时候，就去渲染之前的组件
    if (inactive) {
      const cachedData = cache[name]
      const cachedComponent = cachedData && cachedData.component
      if (cachedComponent) {
        // #2301
        // pass props
        if (cachedData.configProps) {
          fillPropsinData(cachedComponent, data, cachedData.route, cachedData.configProps)
        }
        return h(cachedComponent, data, children)
      } else {
        // render previous empty view
        return h()
      }
    }
 }
...
```

代码现在可能不太好理解，我们还是利用 Demo 来实现一下这个场景。

```js
/**
/
+------------------+                  
| Home             |                  
| +--------------+ |                  
| | home1   home2  |              
| |              | |                 
| +--------------+ |                 
+------------------+
首页下面有两个嵌套路由 home1 跟 home2

/pageA
pageA 跟首页平级	

/pageB
pageB 跟首页平级	

*/
```

首先创建一个 `Home1.vue` 页面：

```vue
<template>
  <div class="about">
    <h1>我是 home1</h1>
  </div>
</template>
<script>
  import LifeRecycle from "../life-recycle";
  export default {
    name: "home1",
    mixins:[LifeRecycle]
  }
</script>

```

然后创建一个 `Home2.vue` 页面：

```vue
<template>
  <div class="about">
    <h1>我是 home2</h1>
  </div>
</template>
<script>
  import LifeRecycle from "../life-recycle";
  export default {
    name: "home2",
    mixins:[LifeRecycle]
  }
</script>

```

然后修改一下 `Home` 页面，为其添加一个子路由：

```vue
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
```

然后修改一下 `router.js` 路由列表：

```js
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
      component: () => import(/* webpackChunkName: "about" */ './views/B.vue')
    }
  ]
})
```

一切 ok 后，我们运行一下项目：

```bash
npm run serve
```

![1-3](./1-3.gif)

可以看到：

1. 打开 home1 页面

   ```bash
    created--->home
    created--->home1
    activated--->home1
    activated--->home
   ```

2. home1 --> home2

   ```bash
   created--->home2
   destoryed--->home1
   ```

3. home2 --> pageA

   ```bash
   created--->page-a
   deactivated--->home2
   deactivated--->home
   activated--->page-a
   ```

4. pageA 点击返回

   ```bash
   deactivated--->page-a
   activated--->home2
   activated--->home
   ```

   此时 `pageA` 失活调用 `deactivated` 方法，然后激活 `home`，而 `home2` 是 `home` 的嵌套页面，所以也直接走了 `activated` 方法被激活，而起作用的原因就是前面所列出的 `router-view` 的这一段代码：

   ```　js
   ...
    render (_, { props, children, parent, data }) {
     ...
      while (parent && parent._routerRoot !== parent) {
         const vnodeData = parent.$vnode ? parent.$vnode.data : {}
         // 获取当前页面的层级数（嵌套路由情况）
         if (vnodeData.routerView) {
           depth++
         }
         if (vnodeData.keepAlive && parent._directInactive && parent._inactive) {
           inactive = true
         }
         parent = parent.$parent
       }
       data.routerViewDepth = depth
   
       // render previous view if the tree is inactive and kept-alive
     	// 如果父组件为非激活状态并且是被缓存的时候，就去渲染之前的组件
       if (inactive) {
         const cachedData = cache[name]
         const cachedComponent = cachedData && cachedData.component
         if (cachedComponent) {
           // #2301
           // pass props
           if (cachedData.configProps) {
             fillPropsinData(cachedComponent, data, cachedData.route, cachedData.configProps)
           }
           return h(cachedComponent, data, children)
         } else {
           // render previous empty view
           return h()
         }
       }
    }
   ...
   ```

   `router-view` 会判断当前组件的父组件是不是 `keep-alive` 的缓存组件，如果是的话，当前页面（home2）离开的时候会把当前 home2 也缓存起来，下次再回到 home2 页面的时候就不会再创建一个 home2 了，而是直接用缓存的组件。

   

   ## 拓展

   在 vue-router 的官网中我们看到这么一段介绍：

   > ## 响应路由参数的变化
   >
   > 提醒一下，当使用路由参数时，例如从 `/user/foo` 导航到 `/user/bar`，**原来的组件实例会被复用**。因为两个路由都渲染同个组件，比起销毁再创建，复用则显得更加高效。**不过，这也意味着组件的生命周期钩子不会再被调用**。
   >
   > 复用组件时，想对路由参数的变化作出响应的话，你可以简单地 watch (监测变化) `$route` 对象：
   >
   > ```js
   > const User = {
   >   template: '...',
   >   watch: {
   >     $route(to, from) {
   >       // 对路由变化作出响应...
   >     }
   >   }
   > }
   > ```
   >
   > 或者使用 2.2 中引入的 `beforeRouteUpdate` [导航守卫](https://router.vuejs.org/zh/guide/advanced/navigation-guards.html)：
   >
   > ```js
   > const User = {
   >   template: '...',
   >   beforeRouteUpdate (to, from, next) {
   >     // react to route changes...
   >     // don't forget to call next()
   >   }
   > }
   > ```

   两个路由都渲染同个组件，比起销毁再创建，复用则显得更加高效。官网是这么介绍的，但是如果放弃这一点点优化，我们硬是要重新创建一个组件怎么做呢？

   比如我们现在的 Demo，我们修改一下代码，让 `pageA` 跟 `pageB` 都共用一个 `pageA` 组件：

   ```js
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
   
   ```

   然后从 `pageA` 页面跳转到 `pageB` 页面的时候，你会发现，没有任何反应，页面并不会被创建，而且继续复用了 pageA，ok，接下来我们看一下 vue 源码中判断是否可以复用的规则是咋样的。

   我们找到 `vue/src/core/vdom/patch.js` 源码中的这么一段代码：

   ```js
   ...
   function sameVnode (a, b) {
     return (
       a.key === b.key && (
         (
           a.tag === b.tag &&
           a.isComment === b.isComment &&
           isDef(a.data) === isDef(b.data) &&
           sameInputType(a, b)
         ) || (
           isTrue(a.isAsyncPlaceholder) &&
           a.asyncFactory === b.asyncFactory &&
           isUndef(b.asyncFactory.error)
         )
       )
     )
   }
   ```

   所以 vue 源码认为，只要 key 一致，并且标签名等条件一直就认为是同一个组件了。

   ok！知道判断条件后，我们来分析一下，我们并没有给页面组件指定 key 值，所以 undefined 是等于 undefined 的，然后 pageA 页面跟 pageB 页面都共用了一个 pageA 组件，所以 tag 名称也是一样的，然后后面的一些判断条件也都成立，所以 vue 认为这两个节点一致，也就不会再创建了，直接复用了，所以你会看到 pageA 点击跳转到 pageB 是没有任何反应的，那么知道原因后我们该怎么处理呢？

   很简单！直接给一个 key 就好了，所以你会在很多 vue 项目中看到这样的操作：

   ```vue
   <template>
     <div id="app">
       <keep-alive>
         <!-- 设置当前 router-view 的 key 为 path，来解决复用问题 -->
         <router-view :key="$route.path"/>
       </keep-alive>
     </div>
   </template>
   ```

   看到这是不是就很能理解这个操作了呢？所以只有对源码知根知底才能解决某些特殊的问题，这也就是看源码的重要性。

   当然，页面少的话抛开 vue 的复用是没啥问题的，多页面大项目的时候考虑内存啥的还是保持官网说的 "比起销毁再创建，复用则显得更加高效" 较好。

   说到这里有小伙伴要疑问了，`<keep-alive>` 组件是怎么来获取缓存的唯一 key 的呢？我们看一下它的做法：

   ```js
   const key: ?string = vnode.key == null
           // same constructor may get registered as different local components
           // so cid alone is not enough (#3269)
           ? componentOptions.Ctor.cid + (componentOptions.tag ? `::${componentOptions.tag}` : '')
           : vnode.key // 获取缓存的 key 值
   ```

    如果开发者有设置 key 值的话就直接用了，没有的话用的是：

   ```js
   componentOptions.Ctor.cid + (componentOptions.tag ? `::${componentOptions.tag}` : '')
   ```

   那么 `componentOptions.Ctor.cid` 又是啥呢？Vue 中 `cid` 初始值是 0，每当调用了 `Vue.extend()` 方法后 `cid` 会自动加 1，然后赋值给当前的 vue 组件。

   ## 总结

   ok！写了这么长的内容，虽然不管是解决 vue 组件的复用问题还是 activated 等方法的使用，网上一搜一大把都有对应的方案提供，但是我们得知道为什么要这么做呢？所以这个时候就会强迫你去看源码了，我相信这一圈下来，你一定会有不一样的收获的。

   加油吧，骚年！

   [Demo 源码](https://github.com/913453448/keep-alive-demo.git)

   

