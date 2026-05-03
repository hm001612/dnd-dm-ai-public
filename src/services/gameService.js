import { SRD_DM_KNOWLEDGE } from '../data/srd_core.js'
import { CHARACTER_SPECIES, CHARACTER_CLASSES, CHARACTER_BACKGROUNDS } from './../data/characterClasses.js'

const API_BASE = '/api'

// Render a single character's stat block. Used once per party member.
function describeCharacter(character, isActive) {
  const species = CHARACTER_SPECIES.find(s => s.id === (character?.species || character?.race))
  const cls = CHARACTER_CLASSES.find(c => c.id === character?.class)
  const bg = CHARACTER_BACKGROUNDS.find(b => b.id === character?.background)
  const tag = isActive ? '【← 当前行动者】' : ''
  return `### ${character?.name || '无名冒险者'} ${tag}
- **物种/职业：** ${species?.name || '人类'} ${cls?.name || '冒险者'}（等级${character?.level || 1}）
- **背景：** ${bg?.name || '—'}（${bg?.featZh || ''}）
- **技能：** ${bg?.skills?.join('、') || '—'}
- **豁免：** ${cls?.saves?.join('/') || '—'}
- **HP：** ${character?.currentHp || 10}/${character?.maxHp || 10}
- **属性：** 力${character?.stats?.str || 10}(${formatMod(character?.stats?.str ?? 10)}) 敏${character?.stats?.dex || 10}(${formatMod(character?.stats?.dex ?? 10)}) 体${character?.stats?.con || 10}(${formatMod(character?.stats?.con ?? 10)}) 智${character?.stats?.int || 10}(${formatMod(character?.stats?.int ?? 10)}) 感${character?.stats?.wis || 10}(${formatMod(character?.stats?.wis ?? 10)}) 魅${character?.stats?.cha || 10}(${formatMod(character?.stats?.cha ?? 10)})`
}

// Build the system prompt. Accepts either a single `character` (legacy) or a
// `party` array plus optional `activeCharacterId` (multiplayer). Callers can
// also pass `combat` = { active: bool, order: [{id,name,init}] } to surface
// turn-order information to the DM.
export function buildSystemPrompt(characterOrParty, module, opts = {}) {
  const { activeCharacterId, combat } = opts
  // Normalise: always work with a party array internally.
  const party = Array.isArray(characterOrParty)
    ? characterOrParty
    : (characterOrParty ? [characterOrParty] : [])
  const active = party.find(c => c.id === activeCharacterId) || party[0]
  const partyBlock = party.length
    ? party.map(c => describeCharacter(c, c === active)).join('\n\n')
    : '（尚未建立角色）'
  const partyHeader = party.length > 1
    ? `## 冒险小队（共 ${party.length} 位冒险者）`
    : '## 玩家角色信息'
  const multiRules = party.length > 1 ? `
## 多人游戏规则
- 这是一个 ${party.length} 人小队的冒险。每位冒险者由不同的玩家扮演。
- 玩家消息开头会用【角色名】标识当前是谁在行动或发言，例如：【${active?.name || party[0].name}】试图撬开锁。
- 根据行动者的属性、背景、职业和技能决定难度和后果。
- 叙事时在合适的时候点名其他队员，让他们有参与感（例如：战士冲锋时，法师可以准备援护）。
- 描述共同体验的场景时，用"你们"；特定角色的感受或选项时，用角色名点出。
- NPC 与小队互动时，可以因为队伍构成（种族、职业搭配）给出不同反应。${combat?.active ? `
- 目前处于战斗状态，先攻顺序：${combat.order?.map((o, i) => `${i + 1}. ${o.name}(${o.init})`).join(' → ') || '待投'}。严格按先攻顺序推动回合。` : ''}
` : ''
  return `你是一位经验丰富的龙与地下城5e版（SRD 5.2.1）地下城主（DM），拥有数十年的游戏经验。你严格遵循威世智公司CC-BY-4.0授权的官方SRD 5.2.1规则。你的任务是主持这场沉浸式的冒险游戏。

${SRD_DM_KNOWLEDGE}


## 核心原则
- 用生动的感官细节描述场景（视觉、听觉、嗅觉、触觉）
- 给每个NPC独特的性格和说话风格
- 让每个决定都充满意义和后果
- 在遵循规则的同时保持故事流畅
- 始终以玩家行动的结果结束你的回复，留下悬念或选择空间

## 游戏机制
- 需要骰子检定时，使用格式：**【骰骰子：1d20+X 做某某事】**
- 报告伤害和HP时格式：**【HP：当前/最大 (-伤害)】**
- 豁免检定格式：**【豁免：XX属性 DC XX】**
- 战斗顺序格式：**【先攻骰：1d20+敏捷修正值】**

## 叙事风格
- 战斗：紧张刺激、充满动感
- 探索：神秘悬疑、引人入胜
- 社交：充满个性、情感丰富
- 恐怖场景：克制而令人不安

## 当前冒险
**模组：** ${module?.title || '自由冒险'}
**世界背景：** ${module?.setting || '中世纪奇幻世界'}
**主要任务：** ${module?.mainQuest?.description || '探索未知，完成使命'}

**开场背景：**
${module?.openingNarrative || '你踏上了一段全新的冒险旅程……'}
${multiRules}
${partyHeader}
${partyBlock}

## 已知NPC
${module?.npcs?.map(n => `- **${n.name}**（${n.role}）：${n.personality}。${n.description}`).join('\n') || '暂无'}

## 重要地点
${module?.locations?.map(l => `- **${l.name}**：${l.description}`).join('\n') || '暂无'}

---
记住：你的每个回复都要让玩家沉浸其中，感受到这个世界的真实与奇幻。保持回复简洁有力（战斗2-4句，场景描述1-3段），始终以一个情境或隐含选择结束。用中文回复。`
}

function formatMod(score) {
  const mod = Math.floor((score - 10) / 2)
  return mod >= 0 ? `+${mod}` : `${mod}`
}

export async function sendMessage(messages, characterOrParty, module, opts = {}) {
  const systemPrompt = buildSystemPrompt(characterOrParty, module, opts)
  // Client-side 120s timeout. Server's worst case is 4 models × 90s,
  // but the Cloudflare edge drops idle HTTP/2 connections near 100s, so a
  // 120s client cap gives a clean error message before the proxy cuts in.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 120000)
  let response
  try {
    response = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, systemPrompt }),
      signal: controller.signal
    })
  } catch (netErr) {
    if (netErr?.name === 'AbortError') {
      throw new Error('DM服务响应超时（2分钟内未返回），请稍后重试')
    }
    // Safari emits "Load failed" for mid-flight connection drops (e.g., when
    // Vite HMR reloads the page or the server restarts). Make it less cryptic.
    const raw = netErr?.message || '网络错误'
    const friendly = raw === 'Load failed' || raw === 'The string did not match the expected pattern.'
      ? '请求被中断（可能是页面刷新或服务重启），请重试'
      : raw
    throw new Error(`无法连接到DM服务（${friendly}）`)
  } finally {
    clearTimeout(timer)
  }
  // Read body once as text, then try JSON — avoids WebKit's cryptic
  // "The string did not match the expected pattern." on response.json()
  const bodyText = await response.text().catch(() => '')
  let parsed = null
  if (bodyText) { try { parsed = JSON.parse(bodyText) } catch { /* non-JSON body */ } }
  if (!response.ok) {
    const detail = parsed?.error || bodyText.slice(0, 200) || `HTTP ${response.status}`
    throw new Error(`DM服务返回错误：${detail}`)
  }
  if (!parsed || typeof parsed.content !== 'string') {
    throw new Error('DM服务返回了无法识别的响应')
  }
  return parsed.content
}

export async function generateModule(params) {
  const response = await fetch(`${API_BASE}/generate-module`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  })
  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.error || '模组生成失败')
  }
  const data = await response.json()
  return data.module
}

// Parse a raw text/markdown module description via AI.
export async function parseModuleText(text, filename) {
  const response = await fetch(`${API_BASE}/parse-module`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, filename })
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error || '模组解析失败')
  }
  const data = await response.json()
  return data.module
}

// Normalize any imported module to the shape the UI expects.
export function normalizeModule(raw, fallbackFilename = '') {
  if (!raw || typeof raw !== 'object') throw new Error('模组数据无效')
  const title = raw.title || raw.name || fallbackFilename.replace(/\.[^.]+$/, '') || '未命名模组'
  if (!raw.description && !raw.openingNarrative) {
    throw new Error('模组缺少描述或开场白')
  }
  return {
    id: raw.id || `upload-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    description: raw.description || (raw.openingNarrative || '').slice(0, 120) + '...',
    setting: raw.setting || '未定义世界',
    difficulty: raw.difficulty || '中等',
    estimatedTime: raw.estimatedTime || raw.duration || '2-4小时',
    theme: raw.theme || '自由冒险',
    players: raw.players || '1-4人',
    cover: raw.cover || '📜',
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    openingNarrative: raw.openingNarrative || raw.description || '',
    mainQuest: raw.mainQuest || { title: title, description: raw.description || '', objective: '' },
    npcs: Array.isArray(raw.npcs) ? raw.npcs : [],
    locations: Array.isArray(raw.locations) ? raw.locations : [],
    encounters: Array.isArray(raw.encounters) ? raw.encounters : [],
    treasures: Array.isArray(raw.treasures) ? raw.treasures : [],
    twist: raw.twist || ''
  }
}

// Fetch TTS audio for a piece of DM narration.
// Returns a regular HTTP URL pointing at a cached MP3 on the server. The
// browser's <audio> element loads it with native Range/streaming support —
// more reliable than blob URLs on mobile and inside sandboxed iframes.
export async function fetchTTS(text, voice = 'gtts') {
  // 60s timeout — TTS synthesis is typically <2s; cap prevents silent hangs
  // if the server restarts or Vite HMR reloads mid-flight (Safari reports
  // these as the cryptic "Load failed").
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 60000)
  let res
  try {
    res = await fetch(`${API_BASE}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice }),
      signal: controller.signal
    })
  } catch (netErr) {
    if (netErr?.name === 'AbortError') {
      throw new Error('语音合成超时，请重试')
    }
    const raw = netErr?.message || '网络错误'
    if (raw === 'Load failed' || raw === 'The string did not match the expected pattern.') {
      throw new Error('请求被中断（可能是页面刷新或服务重启），请重试')
    }
    throw new Error(raw)
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) {
    const bodyText = await res.text().catch(() => '')
    let detail = bodyText.slice(0, 200)
    try { detail = JSON.parse(bodyText).error || detail } catch { /* keep text */ }
    throw new Error(detail || `TTS HTTP ${res.status}`)
  }
  const data = await res.json()
  if (!data?.url) throw new Error('TTS response missing url')
  return data.url
}

export function rollDice(sides, count = 1, modifier = 0) {
  let total = 0
  const rolls = []
  for (let i = 0; i < count; i++) {
    const roll = Math.floor(Math.random() * sides) + 1
    rolls.push(roll)
    total += roll
  }
  return { rolls, total: total + modifier, modifier, sides, count }
}
