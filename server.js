import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import os from 'os'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { spawn } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ---- Config loader -------------------------------------------------------
// Read KEY=VALUE pairs from a file, assigning to process.env WITHOUT
// overwriting already-set vars (env takes priority over files). This lets
// users drop a .env next to the app, and also lets Electron write a user
// config file to ~/.dnd-dm-ai/config.env for first-run onboarding.
function loadEnvFile(p) {
  if (!p || !fs.existsSync(p)) return
  try {
    const raw = fs.readFileSync(p, 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
      if (!m || line.trim().startsWith('#')) continue
      const key = m[1]
      let val = m[2]
      // Strip surrounding quotes if present
      if ((val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = val
    }
  } catch (e) {
    console.warn(`[config] failed to load ${p}:`, e.message)
  }
}

// Load in priority order: project-local .env first, then user config dir.
// Env vars set by the shell beat both (loadEnvFile never overwrites).
loadEnvFile(path.join(__dirname, '.env'))
loadEnvFile(path.join(os.homedir(), '.dnd-dm-ai', 'config.env'))

const app = express()
const PORT = process.env.PORT || 3000

// ---- AI provider config --------------------------------------------------
// Default is OpenRouter (public, OpenAI-compatible, supports Claude / Gemini
// / GPT via a single API). Users override by setting env vars in their .env
// or (for the Electron build) via the first-run config window which writes
// ~/.dnd-dm-ai/config.env.
//
// Accepted keys (in priority order for the API key):
//   AI_API_KEY              — generic, preferred for distribution
//   OPENROUTER_API_KEY      — standard name if user is using OpenRouter
//   AI_GATEWAY_API_KEY      — legacy name for the internal Happycapy gateway
//
// AI_BASE_URL / AI_CHAT_MODELS / AI_MODULE_MODELS can be overridden to point
// at any other OpenAI-compatible endpoint (self-hosted LiteLLM, vLLM, Ollama
// with LiteLLM proxy, Azure OpenAI, etc).
const AI_API_KEY = process.env.AI_API_KEY
  || process.env.OPENROUTER_API_KEY
  || process.env.AI_GATEWAY_API_KEY
  || ''
const AI_BASE_URL = process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1'

// Fallback chain for /api/chat. Comma-separated env override.
// Defaults are OpenRouter model IDs known to support long-context Chinese.
const CHAT_MODELS = (process.env.AI_CHAT_MODELS || [
  'anthropic/claude-3.5-sonnet',
  'google/gemini-2.0-flash-001',
  'openai/gpt-4o-mini',
  'anthropic/claude-3-haiku'
].join(',')).split(',').map(s => s.trim()).filter(Boolean)

// Fallback chain for /api/parse-module and /api/generate-module.
// These need 3k-8k token outputs so we prefer larger-context models first.
const MODULE_MODELS = (process.env.AI_MODULE_MODELS || [
  'google/gemini-2.0-flash-001',
  'anthropic/claude-3.5-sonnet',
  'anthropic/claude-3-haiku'
].join(',')).split(',').map(s => s.trim()).filter(Boolean)

app.use(cors())
app.use(express.json({ limit: '10mb' }))

// Config status — lets the frontend detect a missing API key on boot and
// show a friendly "click here to configure" prompt instead of a silent 401.
app.get('/api/config/status', (req, res) => {
  const provider = /openrouter\.ai/i.test(AI_BASE_URL) ? 'openrouter'
                 : /happycapy/i.test(AI_BASE_URL) ? 'happycapy-gateway'
                 : 'custom'
  res.json({
    configured: !!AI_API_KEY,
    provider,
    baseUrl: AI_BASE_URL,
    chatModels: CHAT_MODELS,
    moduleModels: MODULE_MODELS
  })
})

function requireApiKey(res) {
  if (AI_API_KEY) return true
  res.status(503).json({
    error: '未配置 AI API Key。请在设置中填入 OpenRouter API Key，或在 .env 文件中设置 AI_API_KEY。',
    code: 'NO_API_KEY'
  })
  return false
}

// AI chat endpoint - DM responses
app.post('/api/chat', async (req, res) => {
  if (!requireApiKey(res)) return
  const { messages, systemPrompt, model: requestedModel } = req.body
  // If the client picked a specific model, try only that one (no silent
  // fallback — the user explicitly chose it, so a failure should be visible).
  // Otherwise walk the fallback chain as before.
  const modelsToTry = requestedModel
    ? [String(requestedModel)]
    : CHAT_MODELS
  let lastErr = null
  for (const model of modelsToTry) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 90000)
    try {
      const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages
          ],
          max_tokens: 1024,
          stream: false
        }),
        signal: controller.signal
      })
      clearTimeout(timer)
      if (!response.ok) {
        const err = await response.text()
        lastErr = `[${model}] ${response.status}: ${err.slice(0, 200)}`
        console.warn('chat model failed:', lastErr)
        continue
      }
      const data = await response.json()
      const content = data.choices?.[0]?.message?.content
      if (!content) {
        lastErr = `[${model}] empty content`
        continue
      }
      return res.json({ content, _model: model })
    } catch (err) {
      clearTimeout(timer)
      lastErr = `[${model}] ${err.name || 'Error'}: ${err.message}`
      console.warn('chat fetch failed:', lastErr)
      continue
    }
  }
  console.error('All chat models failed:', lastErr)
  res.status(502).json({ error: `所有AI模型均无响应。最后错误：${lastErr || '未知'}` })
})

// Generate new module endpoint
app.post('/api/generate-module', async (req, res) => {
  if (!requireApiKey(res)) return
  const { theme, setting, difficulty, tone, duration } = req.body
  const prompt = `你是一个专业的龙与地下城5e版冒险模组设计师。请根据以下参数生成一个完整的冒险模组，以JSON格式返回：

主题: ${theme}
场景: ${setting}
难度: ${difficulty}
基调: ${tone}
预计时长: ${duration}

必须严格按照以下JSON格式输出，不要包含任何markdown代码块标记，只输出纯JSON：
{
  "id": "生成唯一id",
  "title": "模组标题",
  "description": "模组描述（2-3句话）",
  "setting": "世界背景",
  "difficulty": "${difficulty}",
  "estimatedTime": "${duration}",
  "theme": "${theme}",
  "openingNarrative": "开场白（3-4段，引人入胜的场景描述）",
  "mainQuest": {
    "title": "主线任务名称",
    "description": "任务描述",
    "objective": "最终目标"
  },
  "npcs": [
    {"name": "NPC姓名", "role": "职业/角色", "personality": "性格特点", "motivation": "动机", "description": "外貌描述"}
  ],
  "locations": [
    {"name": "地点名称", "description": "环境描述", "secrets": "隐藏秘密或线索"}
  ],
  "encounters": [
    {"type": "combat/social/exploration", "title": "遭遇标题", "description": "遭遇描述", "challenge": "挑战内容"}
  ],
  "treasures": [
    {"name": "物品名称", "description": "物品描述", "value": "价值"}
  ],
  "twist": "剧情转折点描述"
}`

  try {
    const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: MODULE_MODELS[0],
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 3000
      })
    })
    if (!response.ok) {
      const err = await response.text()
      return res.status(response.status).json({ error: err })
    }
    const data = await response.json()
    let content = data.choices[0].message.content.trim()
    // Strip markdown code blocks if present
    content = content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '')
    const module = JSON.parse(content)
    res.json({ module })
  } catch (err) {
    console.error('Module generation error:', err)
    res.status(500).json({ error: err.message })
  }
})

// Parse uploaded module (text / markdown → structured JSON)
app.post('/api/parse-module', async (req, res) => {
  if (!requireApiKey(res)) return
  const { text, filename } = req.body
  if (!text || text.trim().length < 50) {
    return res.status(400).json({ error: '模组内容太短，无法解析' })
  }
  // Truncate very long inputs to keep token use reasonable
  const snippet = text.slice(0, 8000)
  const prompt = `你是一位专业的龙与地下城5e版冒险模组结构化助手。用户上传了一份模组草稿（文件名：${filename || '未命名'}）。请将其解析并重构为标准JSON模组格式。

【输入草稿】
${snippet}

【要求】
- 保留原作者的创意与故事核心，不要另起炉灶
- 如果草稿缺少某个字段，根据已有上下文合理补全（NPC/地点/遭遇至少各2-3条）
- 开场白 openingNarrative 要生动（3-4段），以一个情境或隐含选择结束
- 所有文字用中文
- 只输出纯JSON，不要任何markdown代码块标记

【JSON格式】
{
  "title": "模组标题",
  "description": "2-3句话简介",
  "setting": "世界背景",
  "difficulty": "简单/中等/困难/极难",
  "estimatedTime": "时长（如3-4小时）",
  "theme": "主题",
  "players": "1-4人",
  "cover": "一个emoji",
  "tags": ["标签1","标签2","标签3"],
  "openingNarrative": "3-4段开场白",
  "mainQuest": { "title": "主线任务", "description": "描述", "objective": "最终目标" },
  "npcs": [{"name":"","role":"","personality":"","motivation":"","description":""}],
  "locations": [{"name":"","description":"","secrets":""}],
  "encounters": [{"type":"combat/social/exploration","title":"","description":"","challenge":""}],
  "treasures": [{"name":"","description":"","value":""}],
  "twist": "可选的剧情反转"
}`

  // Try models in order; if one times out / 5xx's, fall back to the next.
  // Prefer the larger-context model first for parsing 8k-token structured JSON.
  let lastErr = null
  for (const model of MODULE_MODELS) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 90000)
    try {
      const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 8000
        }),
        signal: controller.signal
      })
      clearTimeout(timer)
      if (!response.ok) {
        const err = await response.text()
        lastErr = `[${model}] ${response.status}: ${err.slice(0, 200)}`
        console.warn('parse-module model failed:', lastErr)
        continue
      }
      const data = await response.json()
      let content = data.choices?.[0]?.message?.content?.trim() || ''
      content = content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '')
      const firstBrace = content.indexOf('{')
      const lastBrace = content.lastIndexOf('}')
      if (firstBrace >= 0 && lastBrace > firstBrace) {
        content = content.slice(firstBrace, lastBrace + 1)
      }
      let mod
      try {
        mod = JSON.parse(content)
      } catch (parseErr) {
        const repaired = repairTruncatedJson(content)
        if (repaired) {
          try { mod = JSON.parse(repaired) } catch { /* fall through */ }
        }
        if (!mod) {
          lastErr = `[${model}] JSON parse: ${parseErr.message}`
          console.warn('parse-module JSON parse failed:', lastErr)
          continue
        }
      }
      return res.json({ module: mod, _model: model })
    } catch (err) {
      clearTimeout(timer)
      lastErr = `[${model}] ${err.name || 'Error'}: ${err.message}`
      console.warn('parse-module fetch failed:', lastErr)
      continue
    }
  }
  return res.status(502).json({ error: `所有AI模型均解析失败。最后错误：${lastErr || '未知'}` })
})

// Attempt to cut a truncated JSON string back to the last balanced position.
function repairTruncatedJson(s) {
  let depth = 0, inStr = false, esc = false, lastBalanced = -1
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (inStr) {
      if (esc) { esc = false }
      else if (ch === '\\') { esc = true }
      else if (ch === '"') { inStr = false }
      continue
    }
    if (ch === '"') inStr = true
    else if (ch === '{' || ch === '[') depth++
    else if (ch === '}' || ch === ']') { depth--; if (depth === 0) lastBalanced = i }
  }
  if (lastBalanced > 0) return s.slice(0, lastBalanced + 1)
  return null
}

// Text-to-speech endpoint: renders Microsoft Azure Neural voices via the
// public edge-tts API (msedge-tts npm package — pure Node, no Python deps).
// Accessibility feature: lets visually-impaired players hear DM narration and
// download a playable audio file of every beat of the story.
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts'
import ffmpegStatic from 'ffmpeg-static'

const DEFAULT_VOICE = 'zh-CN-XiaoxiaoNeural'
const ALLOWED_VOICES = new Set([
  'zh-CN-XiaoxiaoNeural',  // Female, warm — DEFAULT
  'zh-CN-YunyangNeural',   // Male, calm narrator (recommended for DM)
  'zh-CN-YunjianNeural',   // Male, dramatic
  'zh-CN-YunxiNeural',     // Male, young
  'zh-CN-YunxiaNeural',    // Male, child-like
  'zh-CN-XiaoyiNeural',    // Female, lively
  'zh-CN-liaoning-XiaobeiNeural', // Female, NE China accent
  'zh-CN-shaanxi-XiaoniNeural'    // Female, Shaanxi accent
])

function cleanForSpeech(s) {
  if (!s) return ''
  // Strip markdown emphasis, keep inner text
  let out = s.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1')
  // Replace D&D tag brackets with natural pauses
  out = out.replace(/【([^】]+)】/g, '（$1）')
  // Collapse extra whitespace
  out = out.replace(/\n{2,}/g, '\n').replace(/[ \t]+/g, ' ').trim()
  return out.slice(0, 2500)
}

// ffmpeg is REQUIRED for MP3 post-processing (loudnorm + highpass).
// We prefer the bundled ffmpeg-static binary (zero system deps, works on
// Mac/Win/Linux out of the box), falling back to the system PATH ffmpeg
// if the bundled binary is missing (e.g. stripped by electron-builder).
const FFMPEG_BIN = ffmpegStatic && fs.existsSync(ffmpegStatic) ? ffmpegStatic : 'ffmpeg'
console.log(`ffmpeg: ${FFMPEG_BIN === ffmpegStatic ? 'bundled' : 'system'} (${FFMPEG_BIN})`)

// Cache dir for TTS MP3 files. We save each generation to disk so the browser
// can load it via a normal HTTP GET with Range support (instead of a blob
// URL), which gives the best playback reliability across devices.
const TTS_CACHE_DIR = path.join(__dirname, '.tts-cache')
try { fs.mkdirSync(TTS_CACHE_DIR, { recursive: true }) } catch {}

// Synthesize speech → MP3 bytes (Buffer) via msedge-tts.
// Uses Microsoft Azure's public edge-tts endpoint (same service Edge's
// Read-Aloud feature uses — no API key required). The library only exposes
// MP3/Opus outputs, so we take the highest-quality MP3 (24kHz 96kbps mono)
// and let ffmpeg post-process in a single re-encode pass.
async function synthSpeechMp3(text, voice) {
  const tts = new MsEdgeTTS()
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3)
  const { audioStream } = tts.toStream(text)
  return await new Promise((resolve, reject) => {
    const chunks = []
    audioStream.on('data', d => chunks.push(d))
    audioStream.on('end', () => resolve(Buffer.concat(chunks)))
    audioStream.on('error', reject)
    // Safety timeout — if the WebSocket hangs, fail fast instead of spinning.
    setTimeout(() => reject(new Error('msedge-tts timeout after 30s')), 30000)
  })
}

app.post('/api/tts', async (req, res) => {
  const { text, voice } = req.body || {}
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text is required' })
  }
  const safeVoice = ALLOWED_VOICES.has(voice) ? voice : DEFAULT_VOICE
  const speech = cleanForSpeech(text)
  if (!speech) {
    return res.status(400).json({ error: 'text is empty after cleaning' })
  }

  // Content-addressed cache: same text+voice => same file, no regeneration.
  const cacheId = crypto.createHash('sha1').update(safeVoice + '\0' + speech).digest('hex').slice(0, 16)
  const cachePath = path.join(TTS_CACHE_DIR, `${cacheId}.mp3`)

  if (!fs.existsSync(cachePath)) {
    // Stage 1: msedge-tts → MP3 bytes @ 24kHz 96kbps mono.
    // (The library doesn't expose raw PCM; MP3 is the highest-fidelity
    // output it supports. One re-encode to 160kbps is acceptable given the
    // source is already a decent-quality 96kbps CBR MP3.)
    const inputMp3 = await synthSpeechMp3(speech, safeVoice).catch(err => {
      console.error('msedge-tts error:', err?.message || err)
      return null
    })

    if (!inputMp3 || inputMp3.length < 1000) {
      return res.status(500).json({ error: 'TTS 合成失败：未收到音频数据。请检查网络或稍后重试。' })
    }

    // Stage 2: PCM -> clean MP3. Filter chain (MINIMAL for Neural voices):
    //   - highpass@80: kill sub-bass rumble. NOTE: we deliberately DO NOT
    //     lowpass — Neural voices carry ~12kHz of natural sibilance that
    //     makes them sound human. Cutting at 9kHz (old gTTS setting) made
    //     them sound muffled/tinny like old telephone audio.
    //   - silenceremove (leading only): trim any dead-air at the very
    //     start. Unlike gTTS, edge-tts has natural prosody with correct
    //     punctuation timing — we do NOT touch mid-stream pauses, because
    //     doing so breaks the natural breathing/cadence that makes Neural
    //     voices sound human. (The old aggressive silenceremove was
    //     compensating for a gTTS-specific concatenation artifact.)
    //   - loudnorm: broadcast-standard loudness (-16 LUFS, -1.5 dBTP).
    //   - libmp3lame CBR 128 kbps / 44.1 kHz: high enough bitrate that
    //     the final file has no audible compression artifacts.
    const finalMp3 = await new Promise((resolve, reject) => {
      const ff = spawn(FFMPEG_BIN, [
        '-hide_banner', '-loglevel', 'error',
        // Input: MP3 from msedge-tts (auto-detected format)
        '-i', 'pipe:0',
        '-af', [
          'highpass=f=80',
          'silenceremove=start_periods=1:start_duration=0.1:start_threshold=-40dB',
          'loudnorm=I=-16:TP=-1.5:LRA=11'
        ].join(','),
        '-c:a', 'libmp3lame', '-b:a', '160k', '-ar', '44100', '-ac', '1',
        '-f', 'mp3', 'pipe:1'
      ], { stdio: ['pipe', 'pipe', 'pipe'] })
      const out = []
      let ffStderr = ''
      ff.stdout.on('data', d => out.push(d))
      ff.stderr.on('data', d => { ffStderr += d.toString().slice(0, 500) })
      ff.on('error', reject)
      ff.on('close', code => {
        if (code !== 0) return reject(new Error(`ffmpeg encode exited ${code}: ${ffStderr.trim()}`))
        const buf = Buffer.concat(out)
        if (buf.length < 1000) return reject(new Error('ffmpeg produced empty output'))
        resolve(buf)
      })
      ff.stdin.on('error', () => {})
      ff.stdin.end(inputMp3)
    }).catch(err => { console.error('ffmpeg encode error:', err.message); return null })

    if (!finalMp3) {
      return res.status(500).json({ error: 'audio encoding failed' })
    }

    // Write atomically so concurrent readers never see a partial file.
    const tmpPath = cachePath + '.tmp'
    fs.writeFileSync(tmpPath, finalMp3)
    fs.renameSync(tmpPath, cachePath)
  }

  // Return a stable URL the <audio> element can load via HTTP (with Range).
  res.json({
    url: `/api/tts/audio/${cacheId}.mp3`,
    voice: safeVoice,
    bytes: fs.statSync(cachePath).size
  })
})

// Serve cached MP3s as static files with full Range/Accept-Ranges support
// (express.static handles it). Content-Type defaults to audio/mpeg for .mp3.
app.use('/api/tts/audio', express.static(TTS_CACHE_DIR, {
  maxAge: '1h',
  fallthrough: false,
  setHeaders: (res) => {
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Cache-Control', 'public, max-age=3600')
  }
}))

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')))
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'))
  })
}

// When PORT=0 (Electron mode) the OS picks a free port. We print the actual
// bound port on a line the Electron main process can parse so it knows
// where to point its BrowserWindow.
const server = app.listen(PORT, '127.0.0.1', () => {
  const actual = server.address().port
  console.log(`DnD DM Server running on port ${actual}`)
  console.log(`  AI base URL: ${AI_BASE_URL}`)
  console.log(`  API key:     ${AI_API_KEY ? `configured (${AI_API_KEY.slice(0, 8)}…)` : 'MISSING — see /api/config/status'}`)
  // Machine-parseable marker for Electron main.js
  console.log(`LISTENING_ON_PORT=${actual}`)
})
