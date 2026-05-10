// Electron main process for D&D AI DM.
//
// Flow:
//   1. Load user config (API key, base URL, default voice) from electron-store.
//   2. If no API key yet, show the first-run setup window to collect one.
//   3. Spawn server.js as a child process on a random free port, passing the
//      user's config via env vars.
//   4. Wait for the server to print `LISTENING_ON_PORT=<n>` and then open a
//      BrowserWindow pointing at http://127.0.0.1:<n>/.
//   5. Gracefully kill the child server when the app quits.

const { app, BrowserWindow, ipcMain, shell, dialog, Menu } = require('electron')
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

// electron-store is ESM-only in v10+; load it dynamically.
let store
async function initStore() {
  const { default: Store } = await import('electron-store')
  store = new Store({
    name: 'config',
    defaults: {
      apiKey: '',
      baseUrl: 'https://openrouter.ai/api/v1',
      chatModels: 'deepseek/deepseek-v4-flash,deepseek/deepseek-v4-pro,anthropic/claude-3.5-sonnet,google/gemini-2.0-flash-001,openai/gpt-4o-mini',
      moduleModels: 'deepseek/deepseek-v4-pro,google/gemini-2.0-flash-001,anthropic/claude-3.5-sonnet',
      defaultVoice: 'zh-CN-XiaoxiaoNeural'
    }
  })
}

// Resolve the path to server.js in both dev and packaged modes. In dev the
// script runs from the repo root; in packaged builds electron-builder copies
// the whole project into `resources/app/` (we disable asar so child_process
// can spawn server.js directly without extracting it first).
function serverEntryPath() {
  return path.join(app.isPackaged ? process.resourcesPath : app.getAppPath(), 'app', 'server.js')
}
// Actually, electron-builder copies files matching `files` glob into the
// app directory which (with asar=false) is directly at resourcesPath/app/.
// But for our structure server.js is at the project root, so:
function resolveServerPath() {
  if (app.isPackaged) {
    // When packaged, package.json + server.js + node_modules + dist live
    // under resources/app/ (we configure asar:false in electron-builder).
    return path.join(process.resourcesPath, 'app', 'server.js')
  }
  // Dev mode: one level up from electron/ dir.
  return path.join(__dirname, '..', 'server.js')
}

let serverProcess = null
let serverPort = null
let mainWindow = null
let setupWindow = null

function spawnServer() {
  return new Promise((resolve, reject) => {
    const serverPath = resolveServerPath()
    if (!fs.existsSync(serverPath)) {
      return reject(new Error(`server.js not found at ${serverPath}`))
    }

    // Pass user config to the child via env. server.js reads these.
    const cfg = store.store
    const env = {
      ...process.env,
      PORT: '0',                          // let OS pick a free port
      NODE_ENV: 'production',             // serve built frontend from dist/
      AI_API_KEY: cfg.apiKey || '',
      AI_BASE_URL: cfg.baseUrl || 'https://openrouter.ai/api/v1',
      AI_CHAT_MODELS: cfg.chatModels,
      AI_MODULE_MODELS: cfg.moduleModels
    }

    // In packaged builds the child Node runtime is Electron itself invoked
    // with ELECTRON_RUN_AS_NODE=1. In dev we use the system node binary.
    let child
    if (app.isPackaged) {
      child = spawn(process.execPath, [serverPath], {
        env: { ...env, ELECTRON_RUN_AS_NODE: '1' },
        stdio: ['ignore', 'pipe', 'pipe']
      })
    } else {
      child = spawn('node', [serverPath], {
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: path.dirname(serverPath)
      })
    }

    let stdoutBuf = ''
    let resolved = false

    const onData = chunk => {
      const s = chunk.toString()
      stdoutBuf += s
      process.stdout.write(`[server] ${s}`)
      const m = stdoutBuf.match(/LISTENING_ON_PORT=(\d+)/)
      if (m && !resolved) {
        resolved = true
        serverPort = parseInt(m[1], 10)
        resolve(child)
      }
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', d => process.stderr.write(`[server] ${d}`))
    child.on('error', e => { if (!resolved) reject(e) })
    child.on('exit', (code, sig) => {
      console.log(`[server] exited code=${code} signal=${sig}`)
      if (!resolved) reject(new Error(`server exited before listening: code=${code}`))
    })

    // Safety: if the server never prints the port within 15s, fail fast.
    setTimeout(() => {
      if (!resolved) {
        resolved = true
        reject(new Error('server failed to start within 15s'))
      }
    }, 15000)
  })
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#1a1a2e',
    title: 'D&D AI DM',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false  // need preload to use require for ipcRenderer
    }
  })
  mainWindow.loadURL(`http://127.0.0.1:${serverPort}/`)
  // Open external links in the default browser, not a new Electron window
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.on('closed', () => { mainWindow = null })
}

function createSetupWindow() {
  return new Promise(resolve => {
    setupWindow = new BrowserWindow({
      width: 560,
      height: 640,
      resizable: false,
      backgroundColor: '#1a1a2e',
      title: 'D&D AI DM — 首次设置',
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    })
    setupWindow.setMenu(null)
    setupWindow.loadFile(path.join(__dirname, 'setup.html'))

    ipcMain.handleOnce('setup:save', (_ev, cfg) => {
      store.set('apiKey', cfg.apiKey || '')
      if (cfg.baseUrl) store.set('baseUrl', cfg.baseUrl)
      if (cfg.chatModels) store.set('chatModels', cfg.chatModels)
      if (cfg.moduleModels) store.set('moduleModels', cfg.moduleModels)
      setupWindow.close()
      resolve()
    })

    setupWindow.on('closed', () => {
      setupWindow = null
      // If user closed without saving and we still have no key, resolve anyway —
      // main flow will show an in-app prompt via /api/config/status
      resolve()
    })
  })
}

// IPC: allow the renderer to open the setup window later (Settings menu).
ipcMain.handle('config:get', () => store.store)
ipcMain.handle('config:set', (_ev, updates) => {
  for (const [k, v] of Object.entries(updates || {})) {
    store.set(k, v)
  }
  return store.store
})
ipcMain.handle('app:restart', () => {
  app.relaunch()
  app.exit(0)
})

async function main() {
  await initStore()

  // First-run setup: if the API key is empty, collect one before starting
  // the server. (We could start the server first with no key and let the
  // frontend show an error, but getting it up front is friendlier.)
  if (!store.get('apiKey')) {
    await createSetupWindow()
  }

  try {
    serverProcess = await spawnServer()
  } catch (err) {
    dialog.showErrorBox('无法启动本地服务', err.message)
    app.quit()
    return
  }

  createMainWindow()
}

app.whenReady().then(main)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && serverPort) createMainWindow()
})

app.on('before-quit', () => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill('SIGTERM')
  }
})
