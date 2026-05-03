import { useState } from 'react'
import { rollDice } from '../services/gameService.js'

const DICE = [
  { sides: 4, symbol: 'd4', color: '#a0c4ff' },
  { sides: 6, symbol: 'd6', color: '#caffbf' },
  { sides: 8, symbol: 'd8', color: '#ffd6a5' },
  { sides: 10, symbol: 'd10', color: '#e8c878' },
  { sides: 12, symbol: 'd12', color: '#ffadad' },
  { sides: 20, symbol: 'd20', color: '#c9a84c' },
  { sides: 100, symbol: 'd100', color: '#bdb2ff' }
]

export default function DiceRoller({ onRollResult }) {
  const [rolling, setRolling] = useState(false)
  const [lastRoll, setLastRoll] = useState(null)
  const [history, setHistory] = useState([])
  const [count, setCount] = useState(1)
  const [modifier, setModifier] = useState(0)

  function handleRoll(sides) {
    setRolling(true)
    setTimeout(() => {
      const result = rollDice(sides, count, modifier)
      const entry = {
        dice: `${count}d${sides}${modifier !== 0 ? (modifier > 0 ? `+${modifier}` : modifier) : ''}`,
        rolls: result.rolls,
        total: result.total,
        time: new Date().toLocaleTimeString('zh', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      }
      setLastRoll(entry)
      setHistory(h => [entry, ...h.slice(0, 9)])
      onRollResult?.(entry)
      setRolling(false)
    }, 400)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%', overflow: 'hidden' }}>
      <div style={{ fontSize: '0.75rem', fontFamily: 'Cinzel,serif', color: 'var(--text-secondary)', marginBottom: 2 }}>骰子台</div>

      {/* Count & Modifier */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: 'Cinzel,serif', display: 'block', marginBottom: 2 }}>数量</label>
          <input type="number" min="1" max="10" value={count}
            onChange={e => setCount(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
            style={{ padding: '5px 8px', fontSize: '0.85rem', textAlign: 'center' }} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: 'Cinzel,serif', display: 'block', marginBottom: 2 }}>修正</label>
          <input type="number" min="-10" max="20" value={modifier}
            onChange={e => setModifier(parseInt(e.target.value) || 0)}
            style={{ padding: '5px 8px', fontSize: '0.85rem', textAlign: 'center' }} />
        </div>
      </div>

      {/* Dice Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {DICE.map(d => (
          <button key={d.sides} onClick={() => handleRoll(d.sides)} disabled={rolling}
            style={{
              padding: '8px 0', border: `1px solid ${d.color}30`, borderRadius: 6,
              background: `${d.color}10`, color: d.color, cursor: 'pointer',
              fontFamily: 'Cinzel,serif', fontSize: '0.8rem', fontWeight: 600,
              transition: 'all 0.15s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2
            }}
            onMouseEnter={e => { e.currentTarget.style.background = `${d.color}25`; e.currentTarget.style.transform = 'scale(1.05)' }}
            onMouseLeave={e => { e.currentTarget.style.background = `${d.color}10`; e.currentTarget.style.transform = 'scale(1)' }}>
            <span style={{ fontSize: '1.1rem' }}>⬡</span>
            <span>{d.symbol}</span>
          </button>
        ))}
        <button onClick={() => handleRoll(20)} disabled={rolling}
          style={{
            padding: '8px 0', border: '1px solid rgba(201,168,76,0.5)', borderRadius: 6,
            background: 'rgba(201,168,76,0.15)', color: 'var(--gold)', cursor: 'pointer',
            fontFamily: 'Cinzel,serif', fontSize: '0.72rem', transition: 'all 0.15s',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1
          }}>
          <span>🎯</span><span>先攻</span>
        </button>
      </div>

      {/* Last Result */}
      {lastRoll && (
        <div style={{
          padding: '10px 14px', borderRadius: 6,
          background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.3)',
          textAlign: 'center', animation: 'fadeIn 0.3s ease'
        }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontFamily: 'Cinzel,serif' }}>{lastRoll.dice}</div>
          <div style={{
            fontSize: '2rem', fontFamily: 'Cinzel,serif', color: 'var(--gold)',
            fontWeight: 700, lineHeight: 1.2,
            textShadow: lastRoll.total === 20 ? '0 0 20px #ffd700' : lastRoll.total === 1 ? '0 0 20px #ff4444' : 'none'
          }}>
            {lastRoll.total}
            {lastRoll.total === 20 && <span style={{ fontSize: '0.9rem', marginLeft: 6, color: '#ffd700' }}>大成功!</span>}
            {lastRoll.total === 1 && count === 1 && <span style={{ fontSize: '0.9rem', marginLeft: 6, color: '#ff4444' }}>大失败!</span>}
          </div>
          <div style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>
            [{lastRoll.rolls.join(', ')}]{modifier !== 0 ? ` ${modifier > 0 ? '+' : ''}${modifier}` : ''}
          </div>
        </div>
      )}

      {/* History */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: '0.72rem', fontFamily: 'Cinzel,serif', color: 'var(--text-dim)', marginBottom: 4 }}>掷骰历史</div>
        <div className="scroll-area" style={{ flex: 1 }}>
          {history.map((h, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '0.75rem' }}>
              <span style={{ color: 'var(--text-dim)' }}>{h.dice}</span>
              <span style={{ color: i === 0 ? 'var(--gold)' : 'var(--text-secondary)', fontWeight: i === 0 ? 600 : 400 }}>{h.total}</span>
              <span style={{ color: 'var(--text-dim)' }}>{h.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
