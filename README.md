# v-scroll

基于原生 Web Components 实现的虚拟列表 + 自定义滚动条组件，无任何第三方依赖。

## 特性

- **真正的虚拟列表**：无论数据量多少，Shadow DOM 内始终只保留可见区域的节点（约 10 余个），滚动时复用节点更新内容，不创建/销毁 DOM
- **自定义滚动条**：替代浏览器原生滚动条，支持拖拽滑块、点击轨道跳转，悬停时平滑展开
- **Shadow DOM 封装**：样式完全隔离，外部 CSS 不会污染组件内部
- **外部样式透传**：通过 `adoptedStyleSheets` 将外部样式注入 Shadow DOM，pool 内节点可直接使用外部定义的 class
- **零依赖**：纯原生 Web Components，无框架依赖

## 工作原理

```
<v-scroll>
  shadow:
    .source（隐藏）> <slot>   ← 数据源，不参与渲染
    .scroll > .spacer         ← 撑开总滚动高度（items × row-height）
             > .pool          ← 固定数量的复用节点，absolute 定位
    .bar > .thumb             ← 自定义滚动条
  light:
    1000 个 .list-item        ← 存在于隐藏容器，仅作数据源
```

滚动时只更新 pool 节点的 `innerHTML` 和 `transform`，`transform` 走 GPU Composite，不触发 Layout。

## 使用

```html
<v-scroll>
  <div class="list-item">第 1 项</div>
  <div class="list-item">第 2 项</div>
  <!-- ... -->
</v-scroll>
```

组件自动读取所有直接子元素作为数据源，测量第一行高度后构建虚拟列表。

## CSS 自定义变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `--vs-width` | `4px` | 滚动条默认宽度 |
| `--vs-width-hover` | `8px` | 悬停时滚动条宽度 |
| `--vs-padding` | `4px` | 滚动条内边距 |
| `--vs-thumb-bg` | `rgba(128,128,128,0.45)` | 滑块默认颜色 |
| `--vs-thumb-hover` | `rgba(128,128,128,0.75)` | 滑块悬停颜色 |
| `--vs-thumb-drag` | `rgba(128,128,128,0.9)` | 滑块拖拽颜色 |
| `--vs-radius` | `99px` | 滑块圆角 |

## 开发

```bash
pnpm install
pnpm dev      # 启动开发服务器
pnpm build    # 构建产物到 dist/
```

Vite 插件会在构建时将 `theme/v-scroll.css` 压缩为 `public/theme/v-scroll.js`，通过 Import Map 以 `$/` 前缀引入，开发时支持 CSS 热更新。

