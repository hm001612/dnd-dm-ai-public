import { useState, useMemo, useRef } from 'react'
import { SAMPLE_MODULES } from '../data/modules.js'
import {
  CHARACTER_CLASSES, CHARACTER_SPECIES, CHARACTER_BACKGROUNDS,
  STAT_NAMES, getModifier, applyBackgroundBonus, computeMaxHp
} from '../data/characterClasses.js'
import { generateModule, parseModuleText, normalizeModule } from '../services/gameService.js'

const STEPS = ['组建队伍', '选择模组', '出发冒险']
const MAX_PARTY = 6
const MIN_PARTY = 1

// Factory for a fresh character with a unique id. Used both for the initial
// default party member and for every "+ 添加冒险者" click.
function makeDefaultCharacter() {
  const defaultCls = CHARACTER_CLASSES[0]
  const defaultBg = CHARACTER_BACKGROUNDS[3]
  const baseStats = { ...defaultCls.startingStats }
  const finalStats = applyBackgroundBonus(baseStats, defaultBg, 'major')
  return {
    id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: '',
    class: defaultCls.id,
    species: CHARACTER_SPECIES[0].id,
    background: defaultBg.id,
    bgMode: 'major',
    bgPick: { plus2: defaultBg.abilities[0], plus1: defaultBg.abilities[1] },
    level: 1,
    baseStats,
    stats: finalStats,
    maxHp: computeMaxHp(defaultCls.id, finalStats.con),
    currentHp: computeMaxHp(defaultCls.id, finalStats.con),
    inventory: [],
    xp: 0
  }
}

export default function SetupScreen({ onStartGame }) {
  const [step, setStep] = useState(0)
  // Party of 1-6 characters. Start with one so single-player still works.
  const [party, setParty] = useState(() => [makeDefaultCharacter()])
  const [activeCharIdx, setActiveCharIdx] = useState(0)
  const character = party[activeCharIdx]
  // Local helper to mutate just the currently-edited character.
  const setCharacter = (updater) => {
    setParty(prev => prev.map((c, i) => {
      if (i !== activeCharIdx) return c
      return typeof updater === 'function' ? updater(c) : updater
    }))
  }

  const [selectedModule, setSelectedModule] = useState(null)
  const [showGenerate, setShowGenerate] = useState(false)
  const [genParams, setGenParams] = useState({ theme: '地下城探索', setting: '中世纪奇幻', difficulty: '中等', tone: '史诗冒险', duration: '3小时' })
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState('')
  const [allModules, setAllModules] = useState(SAMPLE_MODULES)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  const cls = useMemo(() => CHARACTER_CLASSES.find(c => c.id === character.class), [character.class])
  const species = useMemo(() => CHARACTER_SPECIES.find(s => s.id === character.species), [character.species])
  const background = useMemo(() => CHARACTER_BACKGROUNDS.find(b => b.id === character.background), [character.background])

  function recalcStats(next) {
    const cls = CHARACTER_CLASSES.find(c => c.id === next.class)
    const bg = CHARACTER_BACKGROUNDS.find(b => b.id === next.background)
    const base = { ...cls.startingStats }
    const finalStats = applyBackgroundBonus(base, bg, next.bgMode, next.bgPick)
    const maxHp = computeMaxHp(next.class, finalStats.con)
    return { ...next, baseStats: base, stats: finalStats, maxHp, currentHp: maxHp }
  }

  function handleClassChange(classId) {
    setCharacter(c => recalcStats({ ...c, class: classId }))
  }
  function handleSpeciesChange(speciesId) {
    setCharacter(c => ({ ...c, species: speciesId }))
  }
  function handleBackgroundChange(bgId) {
    const bg = CHARACTER_BACKGROUNDS.find(b => b.id === bgId)
    const pick = { plus2: bg.abilities[0], plus1: bg.abilities[1] }
    setCharacter(c => recalcStats({ ...c, background: bgId, bgPick: pick }))
  }
  function handleBgModeChange(mode) {
    setCharacter(c => recalcStats({ ...c, bgMode: mode }))
  }
  function handleBgPick(field, val) {
    setCharacter(c => {
      const next = { ...c, bgPick: { ...c.bgPick, [field]: val } }
      // Ensure plus2 ≠ plus1
      if (field === 'plus2' && next.bgPick.plus1 === val) {
        const other = background.abilities.find(a => a !== val)
        next.bgPick.plus1 = other
      }
      if (field === 'plus1' && next.bgPick.plus2 === val) {
        const other = background.abilities.find(a => a !== val)
        next.bgPick.plus2 = other
      }
      return recalcStats(next)
    })
  }

  async function handleUploadFiles(files) {
    if (!files || files.length === 0) return
    setUploading(true)
    setUploadMsg('正在读取文件...')
    const added = []
    const failed = []
    for (const file of files) {
      try {
        const text = await file.text()
        let rawMod
        const lower = file.name.toLowerCase()
        if (lower.endsWith('.json')) {
          try { rawMod = JSON.parse(text) }
          catch (e) { throw new Error(`${file.name}：JSON 格式错误 — ${e.message}`) }
        } else if (lower.endsWith('.txt') || lower.endsWith('.md') || lower.endsWith('.markdown')) {
          setUploadMsg(`正在用AI解析《${file.name}》...`)
          rawMod = await parseModuleText(text, file.name)
        } else {
          throw new Error(`${file.name}：不支持的文件类型（仅支持 .json / .txt / .md）`)
        }
        const mod = normalizeModule(rawMod, file.name)
        added.push(mod)
      } catch (e) {
        failed.push(e.message)
      }
    }
    if (added.length) {
      setAllModules(prev => [...added, ...prev])
      setSelectedModule(added[0])
    }
    setUploading(false)
    setUploadMsg(
      [
        added.length ? `✓ 成功导入 ${added.length} 个模组` : '',
        failed.length ? `✗ ${failed.length} 个失败：${failed.join('；')}` : ''
      ].filter(Boolean).join('　') || ''
    )
    if (fileInputRef.current) fileInputRef.current.value = ''
    // Auto-clear after a bit
    setTimeout(() => setUploadMsg(''), 6000)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    handleUploadFiles(Array.from(e.dataTransfer.files || []))
  }

  async function handleGenerate() {
    setGenerating(true); setGenError('')
    try {
      const mod = await generateModule(genParams)
      mod.id = `gen-${Date.now()}`
      mod.cover = '✨'
      setAllModules(prev => [mod, ...prev])
      setSelectedModule(mod)
      setShowGenerate(false)
      setStep(1)
    } catch (e) {
      setGenError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-deep)', overflow: 'hidden' }}>
      {/* Header */}
      <header style={{ padding: '20px 40px', borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.4)', flexShrink: 0 }}>
        <h1 style={{ fontSize: '1.9rem', letterSpacing: '0.15em', textShadow: 'var(--glow-gold)', textAlign: 'center' }}>
          龙与地下城 · AI智能DM
        </h1>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: 4, fontSize: '0.88rem' }}>
          Dragon & Dungeon — Artificial Intelligence Dungeon Master
        </p>
        <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.7rem', marginTop: 2 }}>
          采用 <a href="/srd.pdf" target="_blank" rel="noopener" style={{ color: 'var(--gold-dim)', textDecoration: 'none' }}>SRD 5.2.1 ↓</a> 官方规则 · CC-BY-4.0
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 0, marginTop: 16 }}>
          {STEPS.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                border: `2px solid ${i <= step ? 'var(--gold)' : 'var(--border)'}`,
                background: i === step ? 'rgba(201,168,76,0.2)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.78rem', fontFamily: 'Cinzel,serif',
                color: i <= step ? 'var(--gold)' : 'var(--text-dim)'
              }}>{i + 1}</div>
              <span style={{ marginLeft: 8, marginRight: i < STEPS.length - 1 ? 14 : 0, fontSize: '0.8rem', color: i <= step ? 'var(--text-primary)' : 'var(--text-dim)', fontFamily: 'Cinzel,serif' }}>{s}</span>
              {i < STEPS.length - 1 && <div style={{ width: 36, height: 1, background: i < step ? 'var(--gold-dim)' : 'var(--border)', margin: '0 8px' }} />}
            </div>
          ))}
        </div>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 40px' }}>
        {/* Step 0: Character Creation */}
        {step === 0 && (
          <div style={{ maxWidth: 1000, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ fontSize: '1.3rem', margin: 0 }}>组建你的冒险队伍</h2>
              <span style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>
                本地多人 · 轮流行动 · {MIN_PARTY}-{MAX_PARTY}人
              </span>
            </div>
            {/* Party roster: one tab per character + "add" button */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16, padding: '8px 10px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6 }}>
              {party.map((p, i) => {
                const cls = CHARACTER_CLASSES.find(c => c.id === p.class)
                const isActive = i === activeCharIdx
                const nameLabel = p.name.trim() || `冒险者 ${i + 1}`
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'stretch', border: `1px solid ${isActive ? 'var(--gold)' : 'var(--border)'}`, borderRadius: 4, overflow: 'hidden', background: isActive ? 'rgba(201,168,76,0.12)' : 'var(--bg-input)' }}>
                    <button onClick={() => setActiveCharIdx(i)} title={`切换到 ${nameLabel} 编辑`} style={{
                      padding: '6px 10px', border: 'none', background: 'transparent', cursor: 'pointer',
                      color: isActive ? 'var(--gold)' : 'var(--text-secondary)', fontSize: '0.78rem',
                      display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Cinzel,serif'
                    }}>
                      <span style={{ fontSize: '1rem' }}>{cls?.icon || '⚔️'}</span>
                      <span>{nameLabel}</span>
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.68rem' }}>· {cls?.name || ''}</span>
                    </button>
                    {party.length > MIN_PARTY && (
                      <button onClick={() => {
                        if (!confirm(`移除 ${nameLabel} 吗？`)) return
                        setParty(prev => prev.filter((_, idx) => idx !== i))
                        setActiveCharIdx(idx => Math.max(0, idx > i ? idx - 1 : Math.min(idx, party.length - 2)))
                      }} title="移除该冒险者" style={{
                        padding: '0 8px', border: 'none', borderLeft: '1px solid var(--border)',
                        background: 'transparent', cursor: 'pointer', color: 'var(--red-light)', fontSize: '0.8rem'
                      }}>✕</button>
                    )}
                  </div>
                )
              })}
              {party.length < MAX_PARTY && (
                <button onClick={() => {
                  setParty(prev => [...prev, makeDefaultCharacter()])
                  setActiveCharIdx(party.length) // jump to new member
                }} style={{
                  padding: '6px 12px', border: '1px dashed var(--purple-light)', borderRadius: 4,
                  background: 'transparent', cursor: 'pointer', color: 'var(--purple-light)', fontSize: '0.78rem', fontFamily: 'Cinzel,serif'
                }}>+ 添加冒险者</button>
              )}
            </div>
            <div style={{ marginBottom: 10, color: 'var(--text-dim)', fontSize: '0.74rem', fontStyle: 'italic' }}>
              编辑中：<span style={{ color: 'var(--gold-light)' }}>{character.name.trim() || `冒险者 ${activeCharIdx + 1}`}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {/* Left: Name + Class */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.8rem', fontFamily: 'Cinzel,serif', marginBottom: 6 }}>角色名称</label>
                  <input placeholder="为你的冒险者取个名字..." value={character.name}
                    onChange={e => setCharacter(c => ({ ...c, name: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.8rem', fontFamily: 'Cinzel,serif', marginBottom: 6 }}>职业 · Class (12)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    {CHARACTER_CLASSES.map(c => (
                      <button key={c.id} onClick={() => handleClassChange(c.id)} style={{
                        padding: '8px 6px', border: `1px solid ${character.class === c.id ? 'var(--gold)' : 'var(--border)'}`,
                        background: character.class === c.id ? 'rgba(201,168,76,0.15)' : 'var(--bg-card)',
                        borderRadius: 4, cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s'
                      }} title={c.description}>
                        <div style={{ fontSize: '1.15rem', marginBottom: 2 }}>{c.icon}</div>
                        <div style={{ color: character.class === c.id ? 'var(--gold)' : 'var(--text-primary)', fontFamily: 'Cinzel,serif', fontSize: '0.74rem' }}>{c.name}</div>
                        <div style={{ color: 'var(--text-dim)', fontSize: '0.64rem' }}>d{c.hitDie} · {c.primaryStat.map(s => STAT_NAMES[s].abbr).join('/')}</div>
                      </button>
                    ))}
                  </div>
                  {cls && (
                    <p style={{ color: 'var(--text-dim)', fontSize: '0.72rem', marginTop: 6, lineHeight: 1.4 }}>
                      {cls.description}　·　豁免：{cls.saves.map(s => STAT_NAMES[s].name).join('、')}
                    </p>
                  )}
                </div>
                {/* Species */}
                <div>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.8rem', fontFamily: 'Cinzel,serif', marginBottom: 6 }}>物种 · Species (9)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                    {CHARACTER_SPECIES.map(s => (
                      <button key={s.id} onClick={() => handleSpeciesChange(s.id)} style={{
                        padding: '8px 6px', border: `1px solid ${character.species === s.id ? 'var(--purple-light)' : 'var(--border)'}`,
                        background: character.species === s.id ? 'rgba(107,63,160,0.2)' : 'var(--bg-card)',
                        borderRadius: 4, cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s'
                      }} title={s.trait}>
                        <div style={{ color: character.species === s.id ? 'var(--purple-light)' : 'var(--text-primary)', fontFamily: 'Cinzel,serif', fontSize: '0.76rem', marginBottom: 2 }}>{s.name}</div>
                        <div style={{ color: 'var(--text-dim)', fontSize: '0.62rem' }}>{s.size === 'Small' ? '小型' : '中型'} · {s.speed}尺</div>
                      </button>
                    ))}
                  </div>
                  {species && (
                    <p style={{ color: 'var(--text-dim)', fontSize: '0.72rem', marginTop: 6, lineHeight: 1.4 }}>
                      {species.description}　·　{species.trait}
                    </p>
                  )}
                </div>
              </div>

              {/* Right: Background + Stats */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.8rem', fontFamily: 'Cinzel,serif', marginBottom: 6 }}>背景 · Background (提供属性加值+专长)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 6 }}>
                    {CHARACTER_BACKGROUNDS.map(b => (
                      <button key={b.id} onClick={() => handleBackgroundChange(b.id)} style={{
                        padding: '8px 10px', border: `1px solid ${character.background === b.id ? 'var(--gold)' : 'var(--border)'}`,
                        background: character.background === b.id ? 'rgba(201,168,76,0.1)' : 'var(--bg-card)',
                        borderRadius: 4, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s'
                      }}>
                        <div style={{ color: character.background === b.id ? 'var(--gold-light)' : 'var(--text-primary)', fontFamily: 'Cinzel,serif', fontSize: '0.78rem', marginBottom: 2 }}>
                          {b.name} · {b.nameEn}
                        </div>
                        <div style={{ color: 'var(--text-dim)', fontSize: '0.66rem', lineHeight: 1.3 }}>
                          {b.abilities.map(a => STAT_NAMES[a].abbr).join(' / ')}　·　{b.featZh}
                        </div>
                      </button>
                    ))}
                  </div>
                  {background && (
                    <div style={{ marginTop: 8, padding: '8px 10px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 4 }}>
                      <div style={{ display: 'flex', gap: 10, marginBottom: 6, alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>加值方式：</span>
                        <label style={{ fontSize: '0.72rem', color: character.bgMode === 'major' ? 'var(--gold)' : 'var(--text-dim)', cursor: 'pointer' }}>
                          <input type="radio" checked={character.bgMode === 'major'} onChange={() => handleBgModeChange('major')} style={{ marginRight: 3 }} />
                          +2 / +1
                        </label>
                        <label style={{ fontSize: '0.72rem', color: character.bgMode === 'balanced' ? 'var(--gold)' : 'var(--text-dim)', cursor: 'pointer' }}>
                          <input type="radio" checked={character.bgMode === 'balanced'} onChange={() => handleBgModeChange('balanced')} style={{ marginRight: 3 }} />
                          三项各 +1
                        </label>
                      </div>
                      {character.bgMode === 'major' && (
                        <div style={{ display: 'flex', gap: 8, fontSize: '0.72rem' }}>
                          <label style={{ color: 'var(--text-secondary)' }}>
                            +2 →
                            <select value={character.bgPick.plus2} onChange={e => handleBgPick('plus2', e.target.value)} style={{ marginLeft: 4, padding: '2px 4px', fontSize: '0.72rem' }}>
                              {background.abilities.map(a => <option key={a} value={a}>{STAT_NAMES[a].abbr}</option>)}
                            </select>
                          </label>
                          <label style={{ color: 'var(--text-secondary)' }}>
                            +1 →
                            <select value={character.bgPick.plus1} onChange={e => handleBgPick('plus1', e.target.value)} style={{ marginLeft: 4, padding: '2px 4px', fontSize: '0.72rem' }}>
                              {background.abilities.filter(a => a !== character.bgPick.plus2).map(a => <option key={a} value={a}>{STAT_NAMES[a].abbr}</option>)}
                            </select>
                          </label>
                        </div>
                      )}
                      <div style={{ color: 'var(--text-dim)', fontSize: '0.68rem', marginTop: 6, lineHeight: 1.4 }}>
                        技能：{background.skills.join('、')}　·　工具：{background.tool}
                      </div>
                    </div>
                  )}
                </div>

                {/* Stats preview */}
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', fontFamily: 'Cinzel,serif' }}>属性预览（标准组）</span>
                    <span style={{ color: 'var(--text-dim)', fontSize: '0.66rem' }}>职业基础 + 背景加值</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 5 }}>
                    {Object.entries(character.stats).map(([k, v]) => {
                      const baseVal = character.baseStats[k] ?? v
                      const bonus = v - baseVal
                      const mod = getModifier(v)
                      return (
                        <div key={k} style={{ textAlign: 'center', padding: '5px', background: 'var(--bg-input)', borderRadius: 4 }}>
                          <div style={{ color: 'var(--text-dim)', fontSize: '0.62rem', fontFamily: 'Cinzel,serif' }}>{STAT_NAMES[k].name}</div>
                          <div style={{ color: 'var(--gold)', fontSize: '1.05rem', fontWeight: 'bold' }}>
                            {v}
                            {bonus > 0 && <span style={{ color: 'var(--purple-light)', fontSize: '0.6rem', marginLeft: 2 }}>+{bonus}</span>}
                          </div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.68rem' }}>{mod >= 0 ? '+' : ''}{mod}</div>
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ marginTop: 8, color: 'var(--text-secondary)', fontSize: '0.78rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span>HP: <span style={{ color: 'var(--gold)' }}>{character.maxHp}</span></span>
                    <span>熟练加值: <span style={{ color: 'var(--gold)' }}>+2</span></span>
                    <span>等级: <span style={{ color: 'var(--gold)' }}>1</span></span>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ color: 'var(--text-dim)', fontSize: '0.76rem' }}>
                {(() => {
                  const unnamed = party.filter(p => !p.name.trim()).length
                  if (unnamed > 0) return `还有 ${unnamed} 位冒险者未取名`
                  return `共 ${party.length} 位冒险者已就位`
                })()}
              </div>
              <button className="btn btn-primary"
                onClick={() => setStep(1)}
                disabled={party.some(p => !p.name.trim())}>
                继续 →
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Module Selection */}
        {step === 1 && (
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
              <h2 style={{ fontSize: '1.3rem' }}>选择冒险模组</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.txt,.md,.markdown,application/json,text/plain,text/markdown"
                  multiple
                  style={{ display: 'none' }}
                  onChange={e => handleUploadFiles(Array.from(e.target.files || []))}
                />
                <button className="btn" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                  style={{ borderColor: 'rgba(107,200,160,0.5)', color: uploading ? 'var(--text-dim)' : '#6bcf8b' }}>
                  {uploading ? <><span className="loading-spinner" style={{ marginRight: 6 }} />上传中...</> : '📤 上传模组'}
                </button>
                <button className="btn" onClick={() => setShowGenerate(!showGenerate)}>
                  {showGenerate ? '取消生成' : '✨ AI生成新模组'}
                </button>
              </div>
            </div>

            {/* Upload drop zone + status */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              style={{
                padding: '8px 12px', marginBottom: 14, borderRadius: 4,
                border: `1px dashed ${dragOver ? '#6bcf8b' : 'var(--border)'}`,
                background: dragOver ? 'rgba(107,200,139,0.08)' : 'transparent',
                transition: 'all 0.2s',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap'
              }}>
              <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>
                💡 可拖拽 <b style={{ color: 'var(--text-secondary)' }}>.json / .txt / .md</b> 文件到此处上传模组。
                JSON 直接导入；文本/Markdown 会由 AI 解析成结构化模组。
              </div>
              {uploadMsg && (
                <div style={{
                  fontSize: '0.75rem',
                  color: uploadMsg.startsWith('✓') ? '#6bcf8b' : uploadMsg.startsWith('✗') ? 'var(--red-light)' : 'var(--gold-dim)',
                  fontStyle: 'italic'
                }}>{uploadMsg}</div>
              )}
            </div>

            {showGenerate && (
              <div className="card" style={{ marginBottom: 20, borderColor: 'rgba(107,63,160,0.5)', background: 'rgba(107,63,160,0.05)' }}>
                <h3 style={{ color: 'var(--purple-light)', marginBottom: 14, fontSize: '0.95rem' }}>AI模组生成器</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 10 }}>
                  {[
                    { key: 'theme', label: '主题', options: ['地下城探索','城市冒险','荒野求生','政治阴谋','海洋冒险','恐怖悬疑'] },
                    { key: 'difficulty', label: '难度', options: ['简单','中等','困难','极难'] },
                    { key: 'tone', label: '基调', options: ['史诗冒险','黑暗恐怖','轻松幽默','悬疑神秘','悲壮史诗'] }
                  ].map(({ key, label, options }) => (
                    <div key={key}>
                      <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.76rem', fontFamily: 'Cinzel,serif', marginBottom: 4 }}>{label}</label>
                      <select value={genParams[key]} onChange={e => setGenParams(p => ({ ...p, [key]: e.target.value }))}>
                        {options.map(o => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                  ))}
                  <div>
                    <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.76rem', fontFamily: 'Cinzel,serif', marginBottom: 4 }}>世界背景</label>
                    <input value={genParams.setting} onChange={e => setGenParams(p => ({ ...p, setting: e.target.value }))} placeholder="中世纪奇幻" />
                  </div>
                  <div>
                    <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.76rem', fontFamily: 'Cinzel,serif', marginBottom: 4 }}>预计时长</label>
                    <select value={genParams.duration} onChange={e => setGenParams(p => ({ ...p, duration: e.target.value }))}>
                      {['1-2小时','2-3小时','3-4小时','4-6小时'].map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
                {genError && <p style={{ color: 'var(--red-light)', fontSize: '0.82rem', marginBottom: 6 }}>{genError}</p>}
                <button className="btn" onClick={handleGenerate} disabled={generating} style={{ borderColor: 'var(--purple-light)', color: 'var(--purple-light)' }}>
                  {generating ? <><span className="loading-spinner" style={{ marginRight: 8 }}></span>正在生成模组...</> : '生成模组'}
                </button>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
              {allModules.map(mod => (
                <div key={mod.id} onClick={() => setSelectedModule(mod)} style={{
                  cursor: 'pointer', padding: 18, borderRadius: 6,
                  border: `1px solid ${selectedModule?.id === mod.id ? 'var(--gold)' : 'var(--border)'}`,
                  background: selectedModule?.id === mod.id ? 'rgba(201,168,76,0.08)' : 'var(--bg-card)',
                  transition: 'all 0.2s', boxShadow: selectedModule?.id === mod.id ? 'var(--glow-gold)' : 'none'
                }}>
                  <div style={{ fontSize: '2.3rem', marginBottom: 8 }}>{mod.cover}</div>
                  <h3 style={{ color: selectedModule?.id === mod.id ? 'var(--gold-light)' : 'var(--gold)', fontSize: '0.95rem', marginBottom: 6 }}>{mod.title}</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.5, marginBottom: 8 }}>{mod.description}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {mod.tags?.slice(0,3).map(t => <span key={t} className="tag">{t}</span>)}
                    <span className="tag" style={{ borderColor: 'rgba(201,168,76,0.4)', color: 'var(--gold-dim)' }}>{mod.difficulty}</span>
                    <span className="tag">{mod.estimatedTime}</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
              <button className="btn" onClick={() => setStep(0)}>← 返回</button>
              <button className="btn btn-primary" onClick={() => setStep(2)} disabled={!selectedModule}>
                {selectedModule ? `开始《${selectedModule.title}》` : '请选择模组'}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Confirmation */}
        {step === 2 && selectedModule && (
          <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
            <div style={{ fontSize: '3.6rem', marginBottom: 14 }}>🎲</div>
            <h2 style={{ fontSize: '1.7rem', marginBottom: 8 }}>冒险准备完毕</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 28, fontStyle: 'italic' }}>
              命运的骰子即将投出。愿你在黑暗中找到光明，在险境中获得荣耀。
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 14, marginBottom: 28, textAlign: 'left' }}>
              <div className="card">
                <h4 style={{ marginBottom: 10, fontSize: '0.88rem' }}>
                  冒险队伍（{party.length} 人）
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {party.map((p, i) => {
                    const pc = CHARACTER_CLASSES.find(c => c.id === p.class)
                    const ps = CHARACTER_SPECIES.find(s => s.id === p.species)
                    const pb = CHARACTER_BACKGROUNDS.find(b => b.id === p.background)
                    return (
                      <div key={p.id} style={{ padding: '6px 10px', background: 'var(--bg-input)', borderRadius: 4, border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                          <span style={{ color: 'var(--gold-light)', fontSize: '0.88rem', fontFamily: 'Cinzel,serif' }}>
                            {pc?.icon} {p.name}
                          </span>
                          <span style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>HP {p.maxHp} · Lv{p.level}</span>
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.74rem' }}>
                          {ps?.name} {pc?.name} · 背景：{pb?.name}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="card">
                <h4 style={{ marginBottom: 10, fontSize: '0.88rem' }}>冒险模组</h4>
                <p style={{ color: 'var(--gold)', fontSize: '0.88rem', marginBottom: 4 }}>{selectedModule.cover} {selectedModule.title}</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>难度：{selectedModule.difficulty}</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>时长：{selectedModule.estimatedTime}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn" onClick={() => setStep(1)}>← 返回</button>
              <button className="btn btn-primary" onClick={() => onStartGame({ party, module: selectedModule })}>
                踏入地下城
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
