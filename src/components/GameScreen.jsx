import { useState, useRef, useMemo, useCallback } from 'react'
import { sendMessage, fetchTTS } from '../services/gameService.js'
import { CHARACTER_CLASSES, getModifier } from '../data/characterClasses.js'
import NarrativePanel from './NarrativePanel.jsx'
import CharacterSheet from './CharacterSheet.jsx'
import DiceRoller from './DiceRoller.jsx'
import VoiceControls from './VoiceControls.jsx'
import SRDReference from './SRDReference.jsx'

const PANEL_TABS = [
  { id: 'character', label: '角色', icon: '⚔️' },
  { id: 'dice', label: '骰子', icon: '🎲' },
  { id: 'srd', label: '规则', icon: '📖' },
  { id: 'voice', label: '语音', icon: '🔊' },
  { id: 'module', label: '模组', icon: '📜' }
]

export default function GameScreen({ party: initialParty, module, onEndGame }) {
  // Party of 1-6 characters. Solo sessions still work (single-member party).
  const [party, setParty] = useState(initialParty)
  const [activeCharId, setActiveCharId] = useState(() => initialParty[0]?.id)
  // Combat state. When `combat.active` is true, turns advance automatically
  // along `combat.order` (desc by initiative roll).
  const [combat, setCombat] = useState({ active: false, order: [], turnIdx: 0 })
  const [messages, setMessages] = useState([])
  const [history, setHistory] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [activePanel, setActivePanel] = useState('character')
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [voiceListening, setVoiceListening] = useState(false)
  const [gameStarted, setGameStarted] = useState(false)
  const [ttsVoice, setTtsVoice] = useState('gtts')
  const recognitionRef = useRef(null)

  const activeChar = useMemo(
    () => party.find(c => c.id === activeCharId) || party[0],
    [party, activeCharId]
  )
  const isMultiplayer = party.length > 1

  // Update just the active character (used by CharacterSheet edits).
  const updateActiveCharacter = useCallback((updated) => {
    setParty(prev => prev.map(c => c.id === activeCharId ? (typeof updated === 'function' ? updated(c) : updated) : c))
  }, [activeCharId])

  // Advance to the next character in initiative order after a combat turn.
  // No-op outside combat — the player picks the next actor manually there.
  function advanceTurnAfterCombat() {
    if (!combat.active || combat.order.length === 0) return
    const nextIdx = (combat.turnIdx + 1) % combat.order.length
    const nextEntry = combat.order[nextIdx]
    setCombat(c => ({ ...c, turnIdx: nextIdx }))
    setActiveCharId(nextEntry.id)
  }

  async function handleSend(text) {
    if (!text.trim() || isLoading) return
    // Tag the message with the acting character so the DM knows who's speaking
    // or acting. Using a bracket prefix keeps the user's raw intent intact and
    // also renders nicely in the chat bubble via FormattedText.
    const prefix = isMultiplayer ? `【${activeChar.name}】` : ''
    const taggedContent = prefix ? `${prefix} ${text.trim()}` : text.trim()
    const userMsg = {
      role: 'user', content: taggedContent,
      speakerId: activeChar.id, speakerName: activeChar.name,
      id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    }
    setMessages(prev => [...prev, userMsg])
    const newHistory = [...history, { role: 'user', content: taggedContent }]
    setHistory(newHistory)
    setIsLoading(true)
    if (!gameStarted) setGameStarted(true)

    let response
    try {
      response = await sendMessage(newHistory, party, module, {
        activeCharacterId: activeChar.id,
        combat: combat.active ? { active: true, order: combat.order } : null
      })
    } catch (e) {
      console.error('sendMessage failed:', e)
      const raw = e?.message || String(e)
      const friendly = raw === 'The string did not match the expected pattern.'
        ? '网络或AI服务暂时无响应，请稍后重试。'
        : raw
      const errMsg = `[连接失败：${friendly}]`
      setMessages(prev => [...prev, { role: 'system', content: errMsg, show: true, id: `e-${Date.now()}` }])
      setIsLoading(false)
      return
    }

    const dmId = `a-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setMessages(prev => [...prev, { role: 'assistant', content: response, id: dmId, audioLoading: true, autoPlay: voiceEnabled }])
    setHistory(prev => [...prev, { role: 'assistant', content: response }])
    setIsLoading(false)
    advanceTurnAfterCombat()

    fetchTTS(response, ttsVoice).then(audioUrl => {
      setMessages(prev => prev.map(m => m.id === dmId ? { ...m, audioUrl, audioLoading: false } : m))
    }).catch(ttsErr => {
      console.warn('tts failed:', ttsErr)
      setMessages(prev => prev.map(m => m.id === dmId ? { ...m, audioLoading: false, audioError: String(ttsErr?.message || ttsErr) } : m))
    })
  }

  async function handleStartAdventure() {
    const roster = party.map(p => {
      const cls = CHARACTER_CLASSES.find(c => c.id === p.class)
      return `${p.name}（${cls?.name || '冒险者'}）`
    }).join('、')
    const opening = isMultiplayer
      ? `我们的小队已经集结：${roster}。请开始这次冒险，为我们描述《${module.title}》的开场场景，让每位冒险者都沉浸其中。`
      : `我准备好了。请开始这次冒险，为我描述《${module.title}》的开场场景，让我沉浸其中。`
    await handleSend(opening)
  }

  function handleVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('你的浏览器不支持语音识别功能')
      return
    }
    if (voiceListening) {
      recognitionRef.current?.stop()
      setVoiceListening(false)
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = 'zh-CN'
    recognition.interimResults = false
    recognition.onstart = () => setVoiceListening(true)
    recognition.onend = () => setVoiceListening(false)
    recognition.onerror = () => setVoiceListening(false)
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript
      handleSend(transcript)
    }
    recognitionRef.current = recognition
    recognition.start()
  }

  function handleDiceRoll(result) {
    const who = isMultiplayer ? `${activeChar.name}` : '我'
    const msg = `${who} 掷骰子 ${result.dice}，结果是 ${result.total}${result.rolls.length > 1 ? `（各骰：${result.rolls.join(', ')}）` : ''}。`
    setMessages(prev => [...prev, { role: 'system', content: `🎲 ${msg}`, show: true }])
    if (gameStarted) handleSend(`我刚刚掷了${result.dice}，结果是${result.total}。`)
  }

  // Roll 1d20 + Dex mod for every party member, sort desc, enter combat mode.
  function enterCombat() {
    const order = party.map(p => {
      const dexMod = getModifier(p.stats?.dex ?? 10)
      const roll = Math.floor(Math.random() * 20) + 1
      return { id: p.id, name: p.name, roll, dexMod, init: roll + dexMod }
    }).sort((a, b) => b.init - a.init || b.dexMod - a.dexMod)
    setCombat({ active: true, order, turnIdx: 0 })
    setActiveCharId(order[0].id)
    const summary = order.map((o, i) => `${i + 1}. ${o.name}(${o.init})`).join('　')
    setMessages(prev => [...prev, {
      role: 'system', show: true,
      content: `⚔️ 进入战斗！先攻顺序：${summary}`,
      id: `s-combat-${Date.now()}`
    }])
  }

  function exitCombat() {
    setCombat({ active: false, order: [], turnIdx: 0 })
    setMessages(prev => [...prev, {
      role: 'system', show: true,
      content: '🛡️ 战斗结束，恢复自由行动。',
      id: `s-exit-${Date.now()}`
    }])
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-deep)', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{
        height: 52, display: 'flex', alignItems: 'center', padding: '0 16px',
        borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.5)',
        flexShrink: 0, gap: 12
      }}>
        <span style={{ fontFamily: 'Cinzel,serif', color: 'var(--gold)', fontSize: '0.9rem', fontWeight: 700, letterSpacing: '0.1em' }}>
          D&D · AI DM
        </span>
        <div style={{ width: 1, height: 24, background: 'var(--border)' }} />
        <span style={{ color: 'var(--gold-dim)', fontSize: '0.8rem' }}>{module.cover} {module.title}</span>
        {isMultiplayer && (
          <>
            <div style={{ width: 1, height: 24, background: 'var(--border)' }} />
            <span style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>
              队伍 {party.length} 人 {combat.active ? '· ⚔️ 战斗中' : '· 🕊️ 探索中'}
            </span>
          </>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {voiceListening && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', background: 'rgba(196,53,53,0.15)', borderRadius: 12, border: '1px solid rgba(196,53,53,0.4)' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--red-light)', animation: 'pulse 1s infinite' }} />
              <span style={{ color: 'var(--red-light)', fontSize: '0.72rem', fontFamily: 'Cinzel,serif' }}>聆听中</span>
            </div>
          )}
          <button className="btn btn-sm btn-danger" onClick={() => { if(confirm('确定要结束这场冒险吗？')) onEndGame() }}>
            结束冒险
          </button>
        </div>
      </div>

      {/* Party turn bar (multiplayer only) */}
      {isMultiplayer && (
        <PartyTurnBar
          party={party}
          activeCharId={activeCharId}
          combat={combat}
          onSelect={id => {
            // Outside combat: free switch. Inside combat: allow, but resync turnIdx.
            setActiveCharId(id)
            if (combat.active) {
              const newIdx = combat.order.findIndex(o => o.id === id)
              if (newIdx >= 0) setCombat(c => ({ ...c, turnIdx: newIdx }))
            }
          }}
          onToggleCombat={() => combat.active ? exitCombat() : enterCombat()}
        />
      )}

      {/* Main layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Center: Narrative */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid var(--border)' }}>
          {!gameStarted && (
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', background: 'rgba(107,63,160,0.05)' }}>
              <h3 style={{ color: 'var(--gold)', fontSize: '1.1rem', marginBottom: 8 }}>{module.cover} {module.title}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: 12 }}>
                {module.description}
              </p>
              <button className="btn btn-primary" onClick={handleStartAdventure} disabled={isLoading}>
                {isLoading ? <><span className="loading-spinner" style={{ marginRight: 8 }} />DM准备中...</> : '▶ 开始冒险'}
              </button>
            </div>
          )}
          <NarrativePanel
            messages={messages}
            isLoading={isLoading}
            onSend={handleSend}
            onVoiceInput={handleVoiceInput}
            activeChar={activeChar}
            isMultiplayer={isMultiplayer}
          />
        </div>

        {/* Right sidebar */}
        <div style={{ width: 300, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-dark)' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            {PANEL_TABS.map(tab => (
              <button key={tab.id} onClick={() => setActivePanel(tab.id)} style={{
                flex: 1, padding: '10px 4px', border: 'none', cursor: 'pointer', background: 'none',
                borderBottom: `2px solid ${activePanel === tab.id ? 'var(--gold)' : 'transparent'}`,
                color: activePanel === tab.id ? 'var(--gold)' : 'var(--text-dim)',
                fontFamily: 'Cinzel,serif', fontSize: '0.68rem', transition: 'all 0.15s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2
              }}>
                <span style={{ fontSize: '1rem' }}>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflow: 'hidden', padding: 14 }}>
            {activePanel === 'character' && (
              <CharacterSheet character={activeChar} onUpdate={updateActiveCharacter} />
            )}
            {activePanel === 'dice' && (
              <DiceRoller onRollResult={handleDiceRoll} />
            )}
            {activePanel === 'srd' && <SRDReference />}
            {activePanel === 'voice' && (
              <VoiceControls
                enabled={voiceEnabled}
                onToggle={() => setVoiceEnabled(v => !v)}
                ttsVoice={ttsVoice}
                onTtsVoiceChange={setTtsVoice}
                onTranscript={handleSend}
              />
            )}
            {activePanel === 'module' && <ModuleInfo module={module} />}
          </div>
        </div>
      </div>
    </div>
  )
}

// Party turn bar shown only in multiplayer. Each member is a pill: click to
// make them the active actor. In combat mode an initiative badge and a marker
// on the active turn are added; the Combat button toggles the mode.
function PartyTurnBar({ party, activeCharId, combat, onSelect, onToggleCombat }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
      borderBottom: '1px solid var(--border)',
      background: combat.active ? 'rgba(196,53,53,0.08)' : 'rgba(107,63,160,0.05)',
      overflowX: 'auto', flexShrink: 0
    }}>
      <span style={{ color: 'var(--text-dim)', fontSize: '0.72rem', fontFamily: 'Cinzel,serif', whiteSpace: 'nowrap' }}>
        {combat.active ? '先攻序' : '当前行动者'}
      </span>
      {(combat.active ? combat.order : party.map(p => ({ id: p.id, name: p.name }))).map((entry, i) => {
        const p = party.find(x => x.id === entry.id)
        if (!p) return null
        const cls = CHARACTER_CLASSES.find(c => c.id === p.class)
        const isActive = p.id === activeCharId
        const hpPct = p.maxHp ? Math.max(0, Math.min(100, (p.currentHp / p.maxHp) * 100)) : 100
        return (
          <button key={p.id} onClick={() => onSelect(p.id)} title={`切换到 ${p.name}`} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px',
            border: `1px solid ${isActive ? 'var(--gold)' : 'var(--border)'}`,
            borderRadius: 14, background: isActive ? 'rgba(201,168,76,0.18)' : 'var(--bg-card)',
            cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
            boxShadow: isActive ? 'var(--glow-gold)' : 'none'
          }}>
            {combat.active && <span style={{ color: 'var(--gold-dim)', fontSize: '0.68rem', fontFamily: 'Cinzel,serif' }}>{i + 1}.</span>}
            <span style={{ fontSize: '0.9rem' }}>{cls?.icon || '⚔️'}</span>
            <span style={{ color: isActive ? 'var(--gold-light)' : 'var(--text-primary)', fontSize: '0.78rem' }}>{p.name}</span>
            {combat.active && (
              <span style={{ color: 'var(--text-dim)', fontSize: '0.68rem', fontFamily: 'Cinzel,serif' }}>({entry.init})</span>
            )}
            <span style={{
              marginLeft: 2, padding: '1px 5px', borderRadius: 8,
              background: hpPct > 50 ? 'rgba(107,200,139,0.18)' : hpPct > 25 ? 'rgba(201,168,76,0.2)' : 'rgba(196,53,53,0.25)',
              color: hpPct > 50 ? '#6bcf8b' : hpPct > 25 ? 'var(--gold)' : 'var(--red-light)',
              fontSize: '0.64rem', fontFamily: 'Cinzel,serif'
            }}>{p.currentHp}/{p.maxHp}</span>
          </button>
        )
      })}
      <button onClick={onToggleCombat} title={combat.active ? '结束战斗' : '进入战斗：为全员投先攻骰'} style={{
        marginLeft: 'auto', padding: '4px 10px', borderRadius: 14,
        border: `1px solid ${combat.active ? 'var(--red-light)' : 'var(--purple-light)'}`,
        background: 'transparent', cursor: 'pointer',
        color: combat.active ? 'var(--red-light)' : 'var(--purple-light)',
        fontSize: '0.74rem', fontFamily: 'Cinzel,serif', whiteSpace: 'nowrap'
      }}>
        {combat.active ? '🛡️ 结束战斗' : '⚔️ 进入战斗'}
      </button>
    </div>
  )
}

function ModuleInfo({ module }) {
  return (
    <div className="scroll-area" style={{ height: '100%' }}>
      <div style={{ fontSize: '2rem', marginBottom: 8, textAlign: 'center' }}>{module.cover}</div>
      <h3 style={{ textAlign: 'center', fontSize: '0.95rem', marginBottom: 4 }}>{module.title}</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'center', marginBottom: 12, fontStyle: 'italic' }}>{module.setting}</p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        <span className="tag">{module.difficulty}</span>
        <span className="tag">{module.estimatedTime}</span>
        {module.tags?.map(t => <span key={t} className="tag">{t}</span>)}
      </div>
      <hr className="divider" />
      {module.mainQuest && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: 'Cinzel,serif', color: 'var(--gold)', fontSize: '0.75rem', marginBottom: 4 }}>主线任务</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.5 }}>{module.mainQuest.description}</p>
        </div>
      )}
      {module.npcs?.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: 'Cinzel,serif', color: 'var(--gold)', fontSize: '0.75rem', marginBottom: 6 }}>重要NPC</div>
          {module.npcs.map((npc, i) => (
            <div key={i} style={{ padding: '6px 8px', background: 'var(--bg-card)', borderRadius: 4, marginBottom: 4, border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-primary)' }}>{npc.name}</div>
              <div style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>{npc.role}</div>
            </div>
          ))}
        </div>
      )}
      {module.locations?.length > 0 && (
        <div>
          <div style={{ fontFamily: 'Cinzel,serif', color: 'var(--gold)', fontSize: '0.75rem', marginBottom: 6 }}>关键地点</div>
          {module.locations.map((loc, i) => (
            <div key={i} style={{ padding: '6px 8px', background: 'var(--bg-card)', borderRadius: 4, marginBottom: 4, border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-primary)' }}>{loc.name}</div>
              <div style={{ color: 'var(--text-dim)', fontSize: '0.72rem', lineHeight: 1.4 }}>{loc.description}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
