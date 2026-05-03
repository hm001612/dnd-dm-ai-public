import { useState, useRef, useEffect } from 'react'

function MessageBubble({ msg }) {
  const isDM = msg.role === 'assistant'
  const isSystem = msg.role === 'system'
  const audioRef = useRef(null)
  const autoPlayedRef = useRef(false)

  // Auto-play the narration exactly once when the audio arrives, if the
  // voice toggle was on at the time this DM response was created. Screen
  // readers and visually-impaired players rely on this cue.
  useEffect(() => {
    if (msg.audioUrl && msg.autoPlay && !autoPlayedRef.current && audioRef.current) {
      autoPlayedRef.current = true
      audioRef.current.play().catch(err => console.warn('autoplay blocked:', err?.message || err))
    }
  }, [msg.audioUrl, msg.autoPlay])

  if (isSystem) {
    return (
      <div style={{ textAlign: 'center', padding: '6px 0', margin: '4px 0' }}>
        <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem', fontStyle: 'italic', background: 'var(--bg-dark)', padding: '2px 12px', borderRadius: 12, border: '1px solid var(--border)' }}>
          {msg.content}
        </span>
      </div>
    )
  }

  const downloadName = `DM-${msg.id?.replace(/[^a-zA-Z0-9-]/g, '') || Date.now()}.mp3`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isDM ? 'flex-start' : 'flex-end', marginBottom: 16, animation: 'fadeIn 0.4s ease' }}>
      <div style={{ fontSize: '0.68rem', fontFamily: 'Cinzel,serif', color: 'var(--text-dim)', marginBottom: 4, paddingLeft: isDM ? 8 : 0, paddingRight: isDM ? 0 : 8 }}>
        {isDM ? '🎲 地下城主' : (msg.speakerName ? `⚔️ ${msg.speakerName}` : '⚔️ 你')}
      </div>
      <div style={{
        maxWidth: '88%', padding: '12px 16px', borderRadius: isDM ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
        background: isDM ? 'linear-gradient(135deg, rgba(107,63,160,0.15), rgba(107,63,160,0.08))' : 'rgba(201,168,76,0.08)',
        border: `1px solid ${isDM ? 'rgba(107,63,160,0.3)' : 'rgba(201,168,76,0.2)'}`,
        color: 'var(--text-primary)', lineHeight: 1.65, fontSize: '0.9rem'
      }}>
        <FormattedText text={msg.content} />
      </div>
      {isDM && (msg.audioUrl || msg.audioLoading || msg.audioError) && (
        <div style={{ maxWidth: '88%', width: '100%', marginTop: 6, paddingLeft: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {msg.audioLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: 'Cinzel,serif' }} aria-live="polite">
              <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--purple-light)', animation: 'pulse 1s infinite' }} />
              语音生成中...
            </div>
          )}
          {msg.audioUrl && (
            <>
              <audio
                ref={audioRef}
                controls
                preload="auto"
                src={msg.audioUrl}
                aria-label="地下城主语音朗读"
                style={{ width: '100%', height: 34 }}
              />
              <a
                href={msg.audioUrl}
                download={downloadName}
                style={{ fontSize: '0.7rem', color: 'var(--gold-dim)', textDecoration: 'none', fontFamily: 'Cinzel,serif', alignSelf: 'flex-start' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--gold)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--gold-dim)' }}>
                ↓ 下载音频（{downloadName}）
              </a>
            </>
          )}
          {msg.audioError && !msg.audioUrl && (
            <div style={{ fontSize: '0.7rem', color: 'var(--red-light)', fontStyle: 'italic' }}>
              语音生成失败：{msg.audioError}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function FormattedText({ text }) {
  // Parse **bold**, 【rolls】, etc.
  const parts = text.split(/(\*\*[^*]+\*\*|【[^】]+】|\n)/g)
  return (
    <span>
      {parts.map((part, i) => {
        if (part === '\n') return <br key={i} />
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} style={{ color: 'var(--gold)', fontWeight: 600 }}>{part.slice(2, -2)}</strong>
        }
        if (part.startsWith('【') && part.endsWith('】')) {
          return (
            <span key={i} style={{
              display: 'inline-block', padding: '2px 8px', margin: '0 2px',
              background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.4)',
              borderRadius: 4, color: 'var(--gold)', fontSize: '0.82rem', fontFamily: 'Cinzel,serif'
            }}>{part}</span>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </span>
  )
}

export default function NarrativePanel({ messages, isLoading, onSend, onVoiceInput, activeChar, isMultiplayer }) {
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  function handleSend() {
    const text = input.trim()
    if (!text || isLoading) return
    onSend(text)
    setInput('')
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const quickActions = ['向前探索', '查看周围', '与NPC交谈', '检查物品', '准备战斗', '偷偷摸摸']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Messages area */}
      <div className="scroll-area" style={{ flex: 1, padding: '16px 8px', paddingBottom: 8 }}>
        {messages.map((msg, i) => (
          msg.role !== 'system' || msg.show
            ? <MessageBubble key={i} msg={msg} />
            : null
        ))}
        {isLoading && (
          <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{
              padding: '12px 16px', borderRadius: '4px 16px 16px 16px',
              background: 'linear-gradient(135deg, rgba(107,63,160,0.15), rgba(107,63,160,0.08))',
              border: '1px solid rgba(107,63,160,0.3)', display: 'flex', gap: 6, alignItems: 'center'
            }}>
              <div style={{ fontSize: '0.68rem', fontFamily: 'Cinzel,serif', color: 'var(--text-dim)', marginRight: 8 }}>地下城主沉思中</div>
              {[1,2,3].map(i => (
                <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--purple-light)', animation: `pulse ${0.6 + i * 0.2}s ease-in-out infinite` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick actions */}
      <div style={{ padding: '6px 8px', borderTop: '1px solid var(--border)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {quickActions.map(a => (
          <button key={a} onClick={() => onSend(a)} disabled={isLoading} style={{
            padding: '3px 10px', fontSize: '0.72rem', fontFamily: 'Cinzel,serif',
            border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg-input)',
            color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.15s',
            opacity: isLoading ? 0.5 : 1
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold-dim)'; e.currentTarget.style.color = 'var(--gold)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}>
            {a}
          </button>
        ))}
      </div>

      {/* Input area */}
      <div style={{ padding: '10px 8px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <button onClick={onVoiceInput} title="语音输入" style={{
          flexShrink: 0, width: 38, height: 38, border: '1px solid var(--border)', borderRadius: 6,
          background: 'var(--bg-input)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s'
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold-dim)'; e.currentTarget.style.color = 'var(--gold)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}>
          🎤
        </button>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={
            isMultiplayer && activeChar
              ? `【${activeChar.name}】的行动... (Enter发送，Shift+Enter换行)`
              : '告诉DM你要做什么... (Enter发送，Shift+Enter换行)'
          }
          rows={2}
          disabled={isLoading}
          style={{ flex: 1, resize: 'none', padding: '8px 12px', lineHeight: 1.5, fontSize: '0.9rem', minHeight: 38 }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className="btn btn-primary"
          style={{ flexShrink: 0, padding: '8px 18px', fontSize: '0.85rem' }}>
          {isLoading ? <span className="loading-spinner" /> : '行动'}
        </button>
      </div>
    </div>
  )
}
