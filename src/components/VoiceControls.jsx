import { useState, useRef, useEffect } from 'react'
import { fetchTTS } from '../services/gameService.js'

// Supported voices. Kept in sync with ALLOWED_VOICES in server.js.
// All are Microsoft Azure Neural voices via the free edge-tts endpoint
// (msedge-tts npm package, no API key needed).
const EDGE_VOICES = [
  { id: 'zh-CN-XiaoxiaoNeural', label: '晓晓（女声·温暖，推荐）' },
  { id: 'zh-CN-YunyangNeural', label: '云扬（男声·沉稳叙事）' },
  { id: 'zh-CN-YunjianNeural', label: '云健（男声·激昂戏剧）' },
  { id: 'zh-CN-YunxiNeural', label: '云希（男声·青年）' },
  { id: 'zh-CN-YunxiaNeural', label: '云夏（男声·活泼少年）' },
  { id: 'zh-CN-XiaoyiNeural', label: '晓伊（女声·生动）' },
  { id: 'zh-CN-liaoning-XiaobeiNeural', label: '晓北（女声·东北口音）' },
  { id: 'zh-CN-shaanxi-XiaoniNeural', label: '晓妮（女声·陕西口音）' }
]

export default function VoiceControls({ onTranscript, enabled, onToggle, ttsVoice, onTtsVoiceChange }) {
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testError, setTestError] = useState('')
  const [testAudioUrl, setTestAudioUrl] = useState('')
  const testAudioRef = useRef(null)
  const recognitionRef = useRef(null)

  useEffect(() => {
    const hasSTT = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
    setSupported(hasSTT)
  }, [])

  function startListening() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return
    const recognition = new SpeechRecognition()
    recognition.lang = 'zh-CN'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onstart = () => setListening(true)
    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript
      onTranscript?.(transcript)
    }
    recognitionRef.current = recognition
    recognition.start()
  }

  function stopListening() {
    recognitionRef.current?.stop()
    setListening(false)
  }

  async function testVoice() {
    if (testing) return
    setTesting(true)
    setTestError('')
    try {
      const url = await fetchTTS('欢迎来到地下城，冒险者。你的命运即将改变。', ttsVoice || 'zh-CN-XiaoxiaoNeural')
      // Set via state so React re-renders the <audio> element visible.
      // Even if autoplay is blocked, the user now sees a playable control.
      setTestAudioUrl(url)
      // Give React one frame to swap the src, then attempt autoplay.
      await new Promise(r => requestAnimationFrame(r))
      const a = testAudioRef.current
      if (a) {
        try {
          await a.play()
        } catch {
          setTestError('自动播放被浏览器拦截，请点击下方播放键试听。')
        }
      }
    } catch (err) {
      setTestError(err?.message || '试听失败')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Voice auto-play toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '0.78rem', fontFamily: 'Cinzel,serif', color: 'var(--text-secondary)' }}>DM语音朗读</div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: 2 }}>开启后，每段叙事自动播放</div>
        </div>
        <button onClick={onToggle} style={{
          padding: '4px 12px', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'Cinzel,serif',
          background: enabled ? 'rgba(76,175,125,0.2)' : 'rgba(255,255,255,0.05)',
          color: enabled ? '#4caf7d' : 'var(--text-dim)',
          transition: 'all 0.2s'
        }}>
          {enabled ? '已开启' : '已关闭'}
        </button>
      </div>

      {/* Edge-TTS voice selector (always visible — a playable MP3 is always
          generated for each DM message, even when auto-play is off) */}
      <div>
        <label style={{ display: 'block', fontSize: '0.68rem', fontFamily: 'Cinzel,serif', color: 'var(--text-dim)', marginBottom: 3 }}>叙事声音（神经语音）</label>
        <select
          value={ttsVoice}
          onChange={e => onTtsVoiceChange?.(e.target.value)}
          style={{ fontSize: '0.78rem', padding: '5px 8px', width: '100%' }}
          aria-label="选择DM叙事声音">
          {EDGE_VOICES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
        </select>
      </div>

      {/* Voice test */}
      <button
        className="btn btn-sm"
        onClick={testVoice}
        disabled={testing}
        aria-busy={testing}
        style={{ fontSize: '0.75rem' }}>
        {testing ? '生成中...' : '▶ 试听当前声音'}
      </button>
      {testAudioUrl && (
        <audio ref={testAudioRef} src={testAudioUrl} preload="auto" style={{ width: '100%' }} controls />
      )}
      {testError && <div style={{ fontSize: '0.7rem', color: 'var(--red-light)' }}>{testError}</div>}

      {/* STT Button */}
      <div>
        <label style={{ display: 'block', fontSize: '0.75rem', fontFamily: 'Cinzel,serif', color: 'var(--text-secondary)', marginBottom: 6 }}>语音输入</label>
        <button
          className="btn btn-sm"
          onClick={listening ? stopListening : startListening}
          style={{
            width: '100%', borderColor: listening ? 'var(--red-light)' : 'var(--border)',
            color: listening ? 'var(--red-light)' : 'var(--text-secondary)',
            background: listening ? 'rgba(196,53,53,0.1)' : undefined,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
          }}>
          {listening ? (
            <><span style={{ display: 'inline-block', width: 8, height: 8, background: 'var(--red-light)', borderRadius: '50%', animation: 'pulse 1s infinite' }}></span>正在聆听...</>
          ) : (
            <><span>🎤</span> 按住说话</>
          )}
        </button>
        {!supported && <p style={{ color: 'var(--text-dim)', fontSize: '0.7rem', marginTop: 4 }}>浏览器不支持语音功能</p>}
      </div>

    </div>
  )
}
