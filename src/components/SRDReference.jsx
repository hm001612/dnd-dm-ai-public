import { useState, useMemo } from 'react'
import glossary from '../data/srd_glossary.json'
import spells from '../data/srd_spells.json'
import monsters from '../data/srd_monsters.json'
import { SRD_CONDITIONS, SRD_DAMAGE_TYPES, SRD_ACTIONS, SRD_SKILLS, SRD_DC_SCALE } from '../data/srd_core.js'

const TABS = [
  { id: 'rules', label: '核心规则' },
  { id: 'glossary', label: '术语' },
  { id: 'spells', label: '法术' },
  { id: 'monsters', label: '怪物' }
]

const SCHOOL_COLORS = {
  Abjuration: '#7bb0ff', Conjuration: '#b38bff', Divination: '#ffd86b',
  Enchantment: '#ff8bd6', Evocation: '#ff7e5e', Illusion: '#c48bff',
  Necromancy: '#6bcf8b', Transmutation: '#ffb86b'
}

const TYPE_COLORS = {
  Dragon: '#ff7e5e', Fiend: '#c43535', Undead: '#8b7eff',
  Humanoid: '#7bb0ff', Beast: '#8bcf6b', Monstrosity: '#ffab6b',
  Aberration: '#c48bff', Fey: '#ff8bd6', Celestial: '#ffd86b',
  Elemental: '#6bcfcf', Giant: '#a88b6b', Plant: '#6bcf8b',
  Construct: '#a0a0a0', Ooze: '#8bcf8b'
}

export default function SRDReference() {
  const [tab, setTab] = useState('rules')
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState('all')
  const [selectedEntry, setSelectedEntry] = useState(null)

  const filteredGlossary = useMemo(() => {
    const q = search.toLowerCase().trim()
    return Object.entries(glossary).filter(([k, v]) =>
      !q || k.toLowerCase().includes(q) || v.toLowerCase().includes(q)
    ).slice(0, 100)
  }, [search])

  const filteredSpells = useMemo(() => {
    const q = search.toLowerCase().trim()
    return spells.filter(s => {
      if (levelFilter !== 'all' && s.level !== parseInt(levelFilter)) return false
      if (!q) return true
      return s.name.toLowerCase().includes(q) || s.school.toLowerCase().includes(q) || s.classes.toLowerCase().includes(q)
    })
  }, [search, levelFilter])

  const filteredMonsters = useMemo(() => {
    const q = search.toLowerCase().trim()
    return monsters.filter(m => {
      if (!q) return true
      return m.name.toLowerCase().includes(q) || m.type.toLowerCase().includes(q) || m.size.toLowerCase().includes(q)
    })
  }, [search])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontFamily: 'Cinzel,serif', fontSize: '0.75rem', color: 'var(--gold)' }}>📖 SRD 5.2.1</span>
          <a href="/srd.pdf" target="_blank" rel="noopener" style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textDecoration: 'none', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 10 }}>
            下载PDF ↓
          </a>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setSelectedEntry(null); setSearch('') }}
              style={{
                flex: 1, padding: '5px 0', fontSize: '0.7rem', fontFamily: 'Cinzel,serif',
                cursor: 'pointer', borderRadius: 4,
                border: `1px solid ${tab === t.id ? 'var(--gold)' : 'var(--border)'}`,
                background: tab === t.id ? 'rgba(201,168,76,0.12)' : 'transparent',
                color: tab === t.id ? 'var(--gold)' : 'var(--text-dim)'
              }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search + filter */}
      {tab !== 'rules' && (
        <div style={{ padding: '8px 0 4px', display: 'flex', gap: 6 }}>
          <input placeholder="搜索..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, padding: '5px 10px', fontSize: '0.78rem' }} />
          {tab === 'spells' && (
            <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)}
              style={{ width: 90, padding: '5px 6px', fontSize: '0.75rem' }}>
              <option value="all">全部</option>
              <option value="0">戏法</option>
              {[1,2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>{n}环</option>)}
            </select>
          )}
        </div>
      )}

      {/* Content */}
      <div className="scroll-area" style={{ flex: 1, padding: '8px 0' }}>
        {tab === 'rules' && !selectedEntry && <RulesList onSelect={setSelectedEntry} />}
        {tab === 'rules' && selectedEntry && (
          <EntryDetail title={selectedEntry.title} onBack={() => setSelectedEntry(null)}>
            {selectedEntry.content}
          </EntryDetail>
        )}

        {tab === 'glossary' && !selectedEntry && (
          <>
            {filteredGlossary.length === 0 ? (
              <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', textAlign: 'center', padding: 20 }}>无匹配结果</p>
            ) : filteredGlossary.map(([term, def]) => (
              <div key={term} onClick={() => setSelectedEntry({ title: term, content: <p style={{ lineHeight: 1.65 }}>{def}</p> })}
                style={{ padding: '7px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(201,168,76,0.06)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{ color: 'var(--gold)', fontSize: '0.82rem', fontFamily: 'Cinzel,serif', marginBottom: 2 }}>{term}</div>
                <div style={{ color: 'var(--text-dim)', fontSize: '0.72rem', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{def}</div>
              </div>
            ))}
          </>
        )}
        {tab === 'glossary' && selectedEntry && (
          <EntryDetail title={selectedEntry.title} onBack={() => setSelectedEntry(null)}>
            {selectedEntry.content}
          </EntryDetail>
        )}

        {tab === 'spells' && (
          <>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: 6, textAlign: 'center' }}>
              共 {filteredSpells.length} / {spells.length} 条法术
            </div>
            {filteredSpells.map(sp => (
              <div key={sp.name} style={{ padding: '6px 10px', marginBottom: 4, borderLeft: `2px solid ${SCHOOL_COLORS[sp.school] || 'var(--gold-dim)'}`, background: 'var(--bg-card)', borderRadius: '0 4px 4px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: 600 }}>{sp.name}</span>
                  <span style={{ fontSize: '0.68rem', color: SCHOOL_COLORS[sp.school] || 'var(--gold-dim)' }}>
                    {sp.level === 0 ? '戏法' : `${sp.level}环`}
                  </span>
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: 2 }}>
                  {sp.school} · {sp.classes}
                </div>
              </div>
            ))}
          </>
        )}

        {tab === 'monsters' && (
          <>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: 6, textAlign: 'center' }}>
              共 {filteredMonsters.length} / {monsters.length} 个怪物
            </div>
            {filteredMonsters.map(mo => {
              const typeKey = mo.type.split(' ')[0]
              const color = TYPE_COLORS[typeKey] || 'var(--gold-dim)'
              return (
                <div key={mo.name} style={{ padding: '6px 10px', marginBottom: 4, borderLeft: `2px solid ${color}`, background: 'var(--bg-card)', borderRadius: '0 4px 4px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: 600 }}>{mo.name}</span>
                    <span style={{ fontSize: '0.68rem', color, fontFamily: 'Cinzel,serif' }}>
                      CR {mo.cr}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: 2 }}>
                    {mo.size} {mo.type} · HP {mo.hp} · {mo.alignment}
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}

function RulesList({ onSelect }) {
  const sections = [
    {
      title: '难度等级表 (DC)',
      content: (
        <div>
          {Object.entries(SRD_DC_SCALE).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <span>{k}</span>
              <span style={{ color: 'var(--gold)', fontWeight: 600 }}>DC {v}</span>
            </div>
          ))}
        </div>
      )
    },
    {
      title: '状态效果 (Conditions)',
      content: (
        <div>{SRD_CONDITIONS.map(c => (
          <div key={c.name} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ color: 'var(--gold)', fontSize: '0.85rem', marginBottom: 4 }}>{c.name}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', lineHeight: 1.5 }}>{c.effect}</div>
          </div>
        ))}</div>
      )
    },
    {
      title: '标准动作 (Actions)',
      content: (
        <div>{SRD_ACTIONS.map(a => (
          <div key={a.name} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ color: 'var(--gold)', fontSize: '0.85rem', marginBottom: 4 }}>{a.name}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', lineHeight: 1.5 }}>{a.desc}</div>
          </div>
        ))}</div>
      )
    },
    {
      title: '伤害类型 (Damage Types)',
      content: (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {SRD_DAMAGE_TYPES.map(d => <span key={d} className="tag" style={{ fontSize: '0.75rem' }}>{d}</span>)}
        </div>
      )
    },
    {
      title: '技能表 (Skills)',
      content: (
        <div>{Object.entries(SRD_SKILLS).map(([stat, skills]) => (
          <div key={stat} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ color: 'var(--gold)', fontSize: '0.82rem', marginBottom: 4 }}>{stat}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{skills.join('、')}</div>
          </div>
        ))}</div>
      )
    },
    {
      title: '属性修正值',
      content: (
        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: 10, lineHeight: 1.5 }}>
            修正值 = (属性值 - 10) ÷ 2，向下取整
          </p>
          <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: 'var(--gold)' }}>
                <th style={{ textAlign: 'left', padding: 4 }}>属性值</th>
                <th style={{ textAlign: 'right', padding: 4 }}>修正值</th>
              </tr>
            </thead>
            <tbody style={{ color: 'var(--text-secondary)' }}>
              {[[1,'-5'],[2,'-4'],['4-5','-3'],['6-7','-2'],['8-9','-1'],['10-11','+0'],['12-13','+1'],['14-15','+2'],['16-17','+3'],['18-19','+4'],['20-21','+5'],['22-23','+6']].map(([s,m])=>(
                <tr key={s} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: 4 }}>{s}</td>
                  <td style={{ padding: 4, textAlign: 'right', color: 'var(--text-primary)' }}>{m}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    },
    {
      title: '战斗回合结构',
      content: (
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.7 }}>
          <div style={{ marginBottom: 10 }}><span style={{ color: 'var(--gold)' }}>1. 先攻</span>：1d20 + 敏捷修正，高到低排序</div>
          <div style={{ marginBottom: 10 }}><span style={{ color: 'var(--gold)' }}>2. 每回合</span>：1移动 + 1行动 + 1附赠动作（如可用） + 任意反应</div>
          <div style={{ marginBottom: 10 }}><span style={{ color: 'var(--gold)' }}>3. 攻击检定</span>：1d20 + 熟练 + 属性修正 ≥ AC 命中</div>
          <div style={{ marginBottom: 10 }}><span style={{ color: 'var(--gold)' }}>4. 伤害骰</span>：武器骰 + 属性修正（STR近战 / DEX远程和灵巧）</div>
          <div style={{ marginBottom: 10 }}><span style={{ color: 'var(--gold)' }}>5. 暴击</span>：自然20，伤害骰数量翻倍</div>
          <div><span style={{ color: 'var(--gold)' }}>6. 豁免DC</span>：8 + 熟练 + 属性修正</div>
        </div>
      )
    }
  ]
  return (
    <div>
      {sections.map(s => (
        <div key={s.title} onClick={() => onSelect(s)} style={{ padding: '10px 12px', marginBottom: 6, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-card)', cursor: 'pointer', transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold-dim)'; e.currentTarget.style.background = 'rgba(201,168,76,0.05)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-card)' }}>
          <div style={{ fontFamily: 'Cinzel,serif', color: 'var(--gold)', fontSize: '0.85rem' }}>{s.title} →</div>
        </div>
      ))}
    </div>
  )
}

function EntryDetail({ title, children, onBack }) {
  return (
    <div style={{ animation: 'fadeIn 0.25s ease' }}>
      <button onClick={onBack} style={{
        background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer',
        fontSize: '0.75rem', fontFamily: 'Cinzel,serif', padding: '4px 0', marginBottom: 8
      }}>← 返回</button>
      <h4 style={{ color: 'var(--gold)', fontSize: '0.95rem', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
        {title}
      </h4>
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.6 }}>
        {children}
      </div>
    </div>
  )
}
