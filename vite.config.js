import { readdir, readFile, writeFile, mkdir } from 'fs/promises'
import { resolve, join, basename } from 'path'

const compressCss = (raw) => raw
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\s*\n\s*/g, ' ')
  .replace(/\s{2,}/g, ' ')
  .replace(/\s*([{}:;,>~+])\s*/g, '$1')
  .replace(/;}/g, '}')
  .trim()

const processCssFiles = async (theme_dir, public_theme_dir) => {
  await mkdir(public_theme_dir, { recursive: true })
  const files = await readdir(theme_dir)
  const css_files = files.filter(f => f.endsWith('.css'))
  await Promise.all(css_files.map(async (file) => {
    const raw = await readFile(join(theme_dir, file), 'utf-8')
    const compressed = compressCss(raw)
    const out_name = basename(file, '.css') + '.js'
    const out_content = `export default '${compressed.replace(/'/g, "\\'")}'`
    await writeFile(join(public_theme_dir, out_name), out_content, 'utf-8')
  }))
}

const VIRTUAL_PREFIX = '\0$/', IMPORT_PREFIX = '$/'

const cssToJsPlugin = () => {
  let theme_dir, public_theme_dir
  return {
    name: 'css-to-js',
    enforce: 'pre',
    configResolved: (config) => {
      theme_dir = resolve(config.root, 'theme')
      public_theme_dir = resolve(config.publicDir, 'theme')
    },
    buildStart: async () => {
      await processCssFiles(theme_dir, public_theme_dir)
    },
    resolveId: (id) => {
      if (id.startsWith(IMPORT_PREFIX)) return VIRTUAL_PREFIX + id.slice(IMPORT_PREFIX.length)
    },
    load: async (id) => {
      if (!id.startsWith(VIRTUAL_PREFIX)) return
      const css_name = id.slice(VIRTUAL_PREFIX.length).replace(/\.js$/, '.css')
      const css_path = join(theme_dir, css_name)
      // 将 CSS 源文件加入 Vite 的文件监听，CSS 变化时触发 HMR
      this?.addWatchFile?.(css_path)
      const raw = await readFile(css_path, 'utf-8')
      const compressed = compressCss(raw)
      return `export default '${compressed.replace(/'/g, "\\'")}'`
    },
    handleHotUpdate: async ({ file, server }) => {
      if (!file.startsWith(theme_dir) || !file.endsWith('.css')) return
      // CSS 文件变化：同步写 public/theme/*.js，并使对应虚拟模块失效触发 HMR
      await processCssFiles(theme_dir, public_theme_dir)
      const virtual_id = VIRTUAL_PREFIX + basename(file, '.css') + '.js'
      const mod = server.moduleGraph.getModuleById(virtual_id)
      if (mod) server.moduleGraph.invalidateModule(mod)
      server.hot.send({ type: 'full-reload' })
    }
  }
}

export default {
  base: '/v-scroll/',
  plugins: [cssToJsPlugin()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: { main: resolve(import.meta.dirname, 'index.html') }
    }
  }
}

