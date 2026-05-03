import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { spawn } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3000
const AI_API_KEY = process.env.AI_GATEWAY_API_KEY || ''
const AI_BASE_URL = 'https://ai-gateway.happycapy.ai/api/v1'

app.use(cors())
app.use(express.json({ limit: '10mb' }))

// AI chat endpoint - DM responses
app.post('/api/chat', async (req, res) => {
  const { messages, systemPrompt } = req.body
  const modelCandidates = [
    'anthropic/claude-sonnet-4.6',
    'openai/gpt-4.1',
    'google/gemini-3.1-flash-preview',
    'anthropic/claude-haiku-4.5'
  ]
  let lastErr = null
  for (const model of modelCandidates) {
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
        model: 'anthropic/claude-sonnet-4.6',
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
  const modelCandidates = [
    'openai/gpt-4.1',
    'google/gemini-3.1-flash-preview',
    'anthropic/claude-haiku-4.5'
  ]
  let lastErr = null
  for (const model of modelCandidates) {
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
          max_tokens: 2500
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

// Text-to-speech endpoint: streams MP3 bytes rendered by edge-tts worker.
// Accessibility feature: lets visually-impaired players hear DM narration and
// download a playable audio file of every beat of the story.
// Supported voices. gTTS (Google) is the default since its MP3 output is
// a single clean offline encode (more reliable across devices than Microsoft
// edge-tts's streamed chunks). Edge voices are kept as fallback options.
const ALLOWED_VOICES = new Set([
  'gtts',                  // Google Translate TTS, zh-CN (default)
  'gtts:zh-CN',            // Explicit zh-CN
  'gtts:zh-TW',            // Traditional Mandarin
  'zh-CN-YunyangNeural',   // Edge: Male, calm narrator
  'zh-CN-YunjianNeural',   // Edge: Male, dramatic
  'zh-CN-YunxiNeural',     // Edge: Male, young
  'zh-CN-YunxiaNeural',    // Edge: Male, child-like
  'zh-CN-XiaoxiaoNeural',  // Edge: Female, warm
  'zh-CN-XiaoyiNeural',    // Edge: Female, lively
  'zh-CN-liaoning-XiaobeiNeural', // Edge: Female, NE China accent
  'zh-CN-shaanxi-XiaoniNeural'    // Edge: Female, Shaanxi accent
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

// ffmpeg is REQUIRED. The Python worker emits raw PCM (to avoid MP3 stitch
// seams and tandem-coding artifacts); ffmpeg is the only thing that can
// encode that PCM to a playable MP3 for the browser.
import { execSync } from 'child_process'
let HAS_FFMPEG = false
try {
  execSync('ffmpeg -version', { stdio: 'ignore' })
  HAS_FFMPEG = true
  console.log('ffmpeg detected; TTS pipeline ready')
} catch {
  console.error('ffmpeg NOT found. TTS will fail. Install: apt-get install -y ffmpeg')
}

// Cache dir for TTS MP3 files. We save each generation to disk so the browser
// can load it via a normal HTTP GET with Range support (instead of a blob
// URL), which gives the best playback reliability across devices.
const TTS_CACHE_DIR = path.join(__dirname, '.tts-cache')
try { fs.mkdirSync(TTS_CACHE_DIR, { recursive: true }) } catch {}

app.post('/api/tts', async (req, res) => {
  const { text, voice } = req.body || {}
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text is required' })
  }
  const safeVoice = ALLOWED_VOICES.has(voice) ? voice : 'gtts'
  const speech = cleanForSpeech(text)
  if (!speech) {
    return res.status(400).json({ error: 'text is empty after cleaning' })
  }

  // Content-addressed cache: same text+voice => same file, no regeneration.
  const cacheId = crypto.createHash('sha1').update(safeVoice + '\0' + speech).digest('hex').slice(0, 16)
  const cachePath = path.join(TTS_CACHE_DIR, `${cacheId}.mp3`)

  if (!fs.existsSync(cachePath)) {
    if (!HAS_FFMPEG) {
      return res.status(500).json({ error: 'ffmpeg is required for TTS but is not installed' })
    }

    // Stage 1: Python worker emits raw s16le PCM @ 24kHz mono on stdout.
    // Why PCM (not MP3) across the subprocess boundary:
    //   - gTTS internally produces one MP3 per punctuation chunk. If we
    //     concatenated those MP3s at the byte level we'd get -20 to -40dB
    //     bleed at every stitch point (the "crackle between phrases").
    //     The worker now decodes each chunk to PCM and splices in PCM,
    //     eliminating stitch seams at the source.
    //   - Edge-TTS emits a 48 kbps CBR MP3. Re-encoding MP3->MP3 (tandem
    //     coding) compounds compression artifacts. Going MP3->PCM once
    //     in the worker + PCM->MP3 once here is cleaner.
    const pcm = await new Promise((resolve, reject) => {
      const scriptPath = path.join(__dirname, 'tts_worker.py')
      const py = spawn('python3', [scriptPath, safeVoice], {
        stdio: ['pipe', 'pipe', 'pipe']
      })
      const chunks = []
      let pyStderr = ''
      py.stdout.on('data', d => chunks.push(d))
      py.stderr.on('data', d => { pyStderr += d.toString().slice(0, 500) })
      py.on('error', reject)
      py.on('close', code => {
        if (code !== 0) return reject(new Error(`tts worker exited ${code}: ${pyStderr.trim()}`))
        resolve(Buffer.concat(chunks))
      })
      py.stdin.write(speech)
      py.stdin.end()
    }).catch(err => { console.error('tts worker error:', err.message); return null })

    if (!pcm || pcm.length < 1000) {
      return res.status(500).json({ error: 'tts worker produced no audio' })
    }

    // Stage 2: PCM -> clean MP3. Filter chain:
    //   - highpass@80 / lowpass@9000: voice band. Removes sub-bass rumble
    //     and ultrasonic hiss without touching speech intelligibility.
    //   - silenceremove (pacing): gTTS outputs one segment per punctuation
    //     mark with ~0.3-0.7s of trailing silence per segment. Played back
    //     end-to-end these stack into the "choppy / disconnected" feel the
    //     user reported. We trim only silences LONGER than 0.5s down to
    //     0.25s, and we use a conservative -40 dB threshold so we never
    //     clip real speech (which peaks at -10 to -20 dB). No agate — any
    //     gate aggressive enough to kill residual noise also kills quiet
    //     word tails (the "截字" problem).
    //   - loudnorm: broadcast-standard loudness (-16 LUFS integrated,
    //     -1.5 dBTP peak). Gives consistent volume across sessions.
    //   - libmp3lame CBR 128 kbps / 44.1 kHz: high enough bitrate that
    //     the final file has no audible compression artifacts.
    const finalMp3 = await new Promise((resolve, reject) => {
      const ff = spawn('ffmpeg', [
        '-hide_banner', '-loglevel', 'error',
        // Input: raw PCM s16le 24kHz mono (matches tts_worker.py output)
        '-f', 's16le', '-ar', '24000', '-ac', '1',
        '-i', 'pipe:0',
        '-af', [
          'highpass=f=80',
          'lowpass=f=9000',
          // Trim leading dead air entirely
          'silenceremove=start_periods=1:start_duration=0.1:start_threshold=-40dB',
          // Trim mid-stream silences > 0.5s down to 0.25s (preserves natural
          // punctuation pacing while removing gTTS segment-boundary bloat)
          'silenceremove=stop_periods=-1:stop_duration=0.5:stop_threshold=-40dB:stop_silence=0.25',
          'loudnorm=I=-16:TP=-1.5:LRA=11'
        ].join(','),
        '-c:a', 'libmp3lame', '-b:a', '128k', '-ar', '44100', '-ac', '1',
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
      ff.stdin.end(pcm)
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

app.listen(PORT, () => {
  console.log(`DnD DM Server running on port ${PORT}`)
})
