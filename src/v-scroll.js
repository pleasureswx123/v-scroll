import css from '$/v-scroll.js'

const MIN_THUMB_H = 24
const BUFFER = 2  // 上下各多渲染 2 行，防止快速滚动时白屏

// ── 滚动条计算 ────────────────────────────────────────────────────────────────

const calcThumb = (scroll_el, bar_h) => {
  const { scrollTop, scrollHeight, clientHeight } = scroll_el
  const ratio = clientHeight / scrollHeight
  const thumb_h = Math.max(ratio * bar_h, MIN_THUMB_H)
  const scrollable = scrollHeight - clientHeight
  const thumb_y = scrollable > 0 ? (scrollTop / scrollable) * (bar_h - thumb_h) : 0
  return { thumb_h, thumb_y, visible: ratio < 1 }
}

const applyThumb = (thumb_el, bar_el, thumb_h, thumb_y, visible) => {
  bar_el.classList.toggle('hidden', !visible)
  thumb_el.style.height = `${thumb_h}px`
  thumb_el.style.transform = `translateY(${thumb_y}px)`
}

const makeRefresh = (thumb_el, bar_el, scroll_el) => {
  let raf_id = 0
  return () => {
    if (raf_id) return
    raf_id = requestAnimationFrame(() => {
      raf_id = 0
      const { thumb_h, thumb_y, visible } = calcThumb(scroll_el, bar_el.clientHeight)
      applyThumb(thumb_el, bar_el, thumb_h, thumb_y, visible)
    })
  }
}

// ── 滚动条交互 ────────────────────────────────────────────────────────────────

const startDrag = (e, thumb_el, bar_el, scroll_el, refresh) => {
  e.preventDefault()
  const start_y = e.clientY, start_scroll = scroll_el.scrollTop
  const scrollable = scroll_el.scrollHeight - scroll_el.clientHeight
  const drag_range = bar_el.clientHeight - thumb_el.clientHeight

  thumb_el.classList.add('dragging')

  const onMove = (ev) => {
    if (drag_range <= 0) return
    const ratio = (ev.clientY - start_y) / drag_range
    scroll_el.scrollTop = Math.max(0, Math.min(scrollable, start_scroll + ratio * scrollable))
  }
  const onUp = () => {
    thumb_el.classList.remove('dragging')
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    refresh()
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

const onBarClick = (e, thumb_el, bar_el, scroll_el) => {
  if (e.target === thumb_el) return
  const click_y = e.clientY - bar_el.getBoundingClientRect().top
  const drag_range = bar_el.clientHeight - thumb_el.clientHeight
  const ratio = drag_range > 0 ? (click_y - thumb_el.clientHeight / 2) / drag_range : 0
  const scrollable = scroll_el.scrollHeight - scroll_el.clientHeight
  scroll_el.scrollTop = Math.max(0, Math.min(scrollable, ratio * scrollable))
}

// ── 虚拟列表核心 ──────────────────────────────────────────────────────────────

// 将外部 document 的样式表注入 shadow DOM，使 pool 内节点可使用外部 class
const adoptDocumentStyles = (shadow, component_sheet) => {
  const external = []
  for (const sheet of document.styleSheets) {
    try {
      // 同源样式表才能读取 cssRules
      const rules = Array.from(sheet.cssRules).map(r => r.cssText).join('\n')
      const s = new CSSStyleSheet()
      s.replaceSync(rules)
      external.push(s)
    } catch { /* 跨域样式表跳过 */ }
  }
  shadow.adoptedStyleSheets = [component_sheet, ...external]
}

// 测量行高：临时渲染第一个 slot 元素，读取 offsetHeight
const measureItemH = (items, pool_el) => {
  if (!items.length) return 40
  const probe = items[0].cloneNode(true)
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;top:0;left:0;right:0'
  pool_el.appendChild(probe)
  const h = probe.offsetHeight || 40
  pool_el.removeChild(probe)
  return h
}

// 构建/重建节点池（固定数量的复用节点）
const buildPool = (pool_el, count) => {
  pool_el.innerHTML = ''
  return Array.from({ length: count }, () => {
    const el = document.createElement('div')
    el.style.cssText = 'position:absolute;left:0;right:0;will-change:transform'
    pool_el.appendChild(el)
    return el
  })
}

// 用 slot 元素的内容填充 pool 节点，并定位到正确位置
const renderPool = (pool_nodes, items, scroll_top, item_h) => {
  const start = Math.max(0, Math.floor(scroll_top / item_h) - BUFFER)
  pool_nodes.forEach((el, i) => {
    const idx = start + i
    if (idx >= items.length) { el.style.display = 'none'; return }
    el.style.display = ''
    el.style.transform = `translateY(${idx * item_h}px)`
    el.style.height = `${item_h}px`
    // 只在数据索引变化时才更新 DOM 内容，避免不必要的重绘
    if (el._idx === idx) return
    el._idx = idx
    el.className = items[idx].className
    el.innerHTML = items[idx].innerHTML
  })
}

const initVirtualList = (host, shadow, slot, scroll_el, spacer_el, pool_el, refresh) => {
  let items = []
  let item_h = 0
  let pool_nodes = []

  const rebuild = () => {
    if (!items.length) return
    item_h = measureItemH(items, pool_el)
    spacer_el.style.height = `${items.length * item_h}px`

    const visible_count = Math.ceil(scroll_el.clientHeight / item_h) + BUFFER * 2 + 1
    pool_nodes = buildPool(pool_el, visible_count)
    renderPool(pool_nodes, items, scroll_el.scrollTop, item_h)
    refresh()
  }

  const update = () => {
    if (!pool_nodes.length) return
    renderPool(pool_nodes, items, scroll_el.scrollTop, item_h)
    refresh()
  }

  slot.addEventListener('slotchange', () => {
    items = Array.from(slot.assignedElements())
    // 注入外部样式，确保 pool 内节点的 class 样式生效
    adoptDocumentStyles(shadow, shadow.adoptedStyleSheets[0])
    rebuild()
  })

  scroll_el.addEventListener('scroll', update, { passive: true })

  const ro = new ResizeObserver(rebuild)
  ro.observe(scroll_el)

  return ro
}

// ── DOM 构建 ──────────────────────────────────────────────────────────────────

const createEl = (tag, cls) => {
  const el = document.createElement(tag)
  if (cls) el.className = cls
  return el
}

const buildShadow = (shadow) => {
  const sheet = new CSSStyleSheet()
  sheet.replaceSync(css)
  shadow.adoptedStyleSheets = [sheet]

  const wrap    = createEl('div', 'wrap')
  const source  = createEl('div', 'source')   // 隐藏 slot 内容，仅供读取
  const slot    = document.createElement('slot')
  const scroll  = createEl('div', 'scroll')   // 真正的滚动容器
  const spacer  = createEl('div', 'spacer')   // 撑开总高度
  const pool    = createEl('div', 'pool')     // 虚拟列表可见行
  const bar     = createEl('div', 'bar hidden')
  const thumb   = createEl('div', 'thumb')

  source.appendChild(slot)
  scroll.append(spacer, pool)
  bar.appendChild(thumb)
  wrap.append(source, scroll, bar)
  shadow.appendChild(wrap)

  return { slot, scroll, spacer, pool, bar, thumb }
}

// ── 初始化 ────────────────────────────────────────────────────────────────────

const initScrollbar = (host) => {
  const shadow = host.attachShadow({ mode: 'open' })
  const { slot, scroll, spacer, pool, bar, thumb } = buildShadow(shadow)
  const refresh = makeRefresh(thumb, bar, scroll)

  const ro = initVirtualList(host, shadow, slot, scroll, spacer, pool, refresh)

  thumb.addEventListener('mousedown', (e) => startDrag(e, thumb, bar, scroll, refresh))
  bar.addEventListener('click', (e) => onBarClick(e, thumb, bar, scroll))

  host._vsCleanup = () => ro.disconnect()
  requestAnimationFrame(refresh)
}

const disconnectScrollbar = (host) => {
  if (host._vsCleanup) { host._vsCleanup(); delete host._vsCleanup }
}

customElements.define('v-scroll', class extends HTMLElement {
  connectedCallback() { initScrollbar(this) }
  disconnectedCallback() { disconnectScrollbar(this) }
})

