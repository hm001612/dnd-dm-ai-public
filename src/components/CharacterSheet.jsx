import { CHARACTER_CLASSES, CHARACTER_SPECIES, CHARACTER_BACKGROUNDS, STAT_NAMES, formatModifier } from '../data/characterClasses.js'

export default function CharacterSheet({ character, onUpdate }) {
  const cls = CHARACTER_CLASSES.find(c => c.id === character.class)
  // Support both new (species) and legacy (race) character shapes
  const species = CHARACTER_SPECIES.find(s => s.id === (character.species || character.race))
  const background = CHARACTER_BACKGROUNDS.find(b => b.id === character.background)
  const hpPct = Math.max(0, (character.currentHp / character.maxHp) * 100)
  const hpColor = hpPct > 50 ? '#4caf7d' : hpPct > 25 ? '#e8a020' : '#c43535'

  function adjustHp(delta) {
    const newHp = Math.max(0, Math.min(character.maxHp, character.currentHp + delta))
    onUpdate({ ...character, currentHp: newHp })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflow: 'hidden' }}>
      {/* Identity */}
      <div style={{ textAlign: 'center', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: '2rem', marginBottom: 4 }}>{cls?.icon || '⚔️'}</div>
        <div style={{ fontFamily: 'Cinzel,serif', color: 'var(--gold)', fontSize: '1rem', fontWeight: 600 }}>{character.name}</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: 2 }}>
          {species?.name} · {cls?.name} · Lv.{character.level}
        </div>
        {background && (
          <div style={{ color: 'var(--text-dim)', fontSize: '0.7rem', marginTop: 2, fontStyle: 'italic' }}>
            背景：{background.name}
          </div>
        )}
      </div>

      {/* HP Bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: '0.75rem', fontFamily: 'Cinzel,serif', color: 'var(--text-secondary)' }}>生命值</span>
          <span style={{ fontSize: '0.82rem', color: hpColor, fontWeight: 600 }}>{character.currentHp}/{character.maxHp}</span>
        </div>
        <div style={{ height: 8, background: 'var(--bg-input)', borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
          <div style={{ height: '100%', width: `${hpPct}%`, background: hpColor, transition: 'all 0.3s', borderRadius: 4 }} />
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {[-1, -5, -10].map(d => (
            <button key={d} className="btn btn-sm btn-danger" onClick={() => adjustHp(d)} style={{ flex: 1, padding: '4px 0', fontSize: '0.72rem' }}>
              {d}
            </button>
          ))}
          {[1, 5, 10].map(d => (
            <button key={d} className="btn btn-sm" onClick={() => adjustHp(d)} style={{ flex: 1, padding: '4px 0', fontSize: '0.72rem', borderColor: '#4caf7d', color: '#4caf7d' }}>
              +{d}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div>
        <div style={{ fontSize: '0.75rem', fontFamily: 'Cinzel,serif', color: 'var(--text-secondary)', marginBottom: 6 }}>属性值</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4 }}>
          {Object.entries(STAT_NAMES).map(([k, v]) => {
            const score = character.stats?.[k] || 10
            const mod = formatModifier(score)
            const primaryList = Array.isArray(cls?.primaryStat) ? cls.primaryStat : (cls?.primaryStat ? [cls.primaryStat] : [])
            const isPrimary = primaryList.includes(k) || primaryList.includes(v.abbr)
            return (
              <div key={k} style={{
                padding: '6px 4px', textAlign: 'center', borderRadius: 4,
                background: isPrimary ? 'rgba(201,168,76,0.1)' : 'var(--bg-input)',
                border: `1px solid ${isPrimary ? 'rgba(201,168,76,0.3)' : 'transparent'}`
              }}>
                <div style={{ fontSize: '0.6rem', fontFamily: 'Cinzel,serif', color: 'var(--text-dim)', textTransform: 'uppercase' }}>{v.abbr}</div>
                <div style={{ fontSize: '1.1rem', color: isPrimary ? 'var(--gold)' : 'var(--text-primary)', fontWeight: 600, lineHeight: 1.2 }}>{score}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{mod}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Level & XP */}
      <div className="card" style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>等级</span>
          <span style={{ color: 'var(--gold)' }}>{character.level}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginTop: 4 }}>
          <span style={{ color: 'var(--text-secondary)' }}>经验值</span>
          <span style={{ color: 'var(--text-primary)' }}>{character.xp || 0} XP</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginTop: 4 }}>
          <span style={{ color: 'var(--text-secondary)' }}>熟练奖励</span>
          <span style={{ color: 'var(--text-primary)' }}>+2</span>
        </div>
      </div>

      {/* Inventory */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: '0.75rem', fontFamily: 'Cinzel,serif', color: 'var(--text-secondary)', marginBottom: 6 }}>物品栏</div>
        <div className="scroll-area" style={{ flex: 1 }}>
          {(!character.inventory || character.inventory.length === 0) ? (
            <p style={{ color: 'var(--text-dim)', fontSize: '0.78rem', fontStyle: 'italic' }}>尚无物品</p>
          ) : (
            character.inventory.map((item, i) => (
              <div key={i} style={{ padding: '4px 8px', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', gap: 6 }}>
                <span>•</span><span>{item}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
