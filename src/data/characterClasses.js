// SRD 5.2.1 character options (CC-BY-4.0)
// https://www.dndbeyond.com/srd · 2024 rules

// ──────────────────────────────────────────────
// Classes (SRD 5.2.1 — 12 classes)
// Hit Die, primary ability, saving throws, recommended Standard Array
// ──────────────────────────────────────────────
export const CHARACTER_CLASSES = [
  { id: 'barbarian', name: '野蛮人', nameEn: 'Barbarian',
    description: '以狂暴之力横扫战场的蛮族勇士', icon: '🪓',
    hitDie: 12, primaryStat: ['str'], saves: ['str', 'con'],
    startingStats: { str: 15, dex: 13, con: 14, int: 10, wis: 12, cha: 8 } },
  { id: 'bard', name: '吟游诗人', nameEn: 'Bard',
    description: '以音乐与故事施展魔法的多才之人', icon: '🎵',
    hitDie: 8, primaryStat: ['cha'], saves: ['dex', 'cha'],
    startingStats: { str: 8, dex: 14, con: 12, int: 13, wis: 10, cha: 15 } },
  { id: 'cleric', name: '牧师', nameEn: 'Cleric',
    description: '蒙神明赐福、施展神圣法术的侍者', icon: '✨',
    hitDie: 8, primaryStat: ['wis'], saves: ['wis', 'cha'],
    startingStats: { str: 14, dex: 8, con: 13, int: 10, wis: 15, cha: 12 } },
  { id: 'druid', name: '德鲁伊', nameEn: 'Druid',
    description: '与自然共鸣、能化为野兽的守护者', icon: '🌿',
    hitDie: 8, primaryStat: ['wis'], saves: ['int', 'wis'],
    startingStats: { str: 8, dex: 12, con: 14, int: 13, wis: 15, cha: 10 } },
  { id: 'fighter', name: '战士', nameEn: 'Fighter',
    description: '精通武器与战甲的战斗专家', icon: '⚔️',
    hitDie: 10, primaryStat: ['str', 'dex'], saves: ['str', 'con'],
    startingStats: { str: 15, dex: 14, con: 13, int: 8, wis: 10, cha: 12 } },
  { id: 'monk', name: '武僧', nameEn: 'Monk',
    description: '以武学修行锤炼身心、徒手制敌的行者', icon: '👊',
    hitDie: 8, primaryStat: ['dex', 'wis'], saves: ['str', 'dex'],
    startingStats: { str: 12, dex: 15, con: 13, int: 10, wis: 14, cha: 8 } },
  { id: 'paladin', name: '圣骑士', nameEn: 'Paladin',
    description: '以誓言为力量来源的神圣战士', icon: '🛡️',
    hitDie: 10, primaryStat: ['str', 'cha'], saves: ['wis', 'cha'],
    startingStats: { str: 15, dex: 10, con: 13, int: 8, wis: 12, cha: 14 } },
  { id: 'ranger', name: '游侠', nameEn: 'Ranger',
    description: '在荒野中游走、精通追踪与弓术的猎手', icon: '🏹',
    hitDie: 10, primaryStat: ['dex', 'wis'], saves: ['str', 'dex'],
    startingStats: { str: 12, dex: 15, con: 13, int: 8, wis: 14, cha: 10 } },
  { id: 'rogue', name: '游荡者', nameEn: 'Rogue',
    description: '身形敏捷、精于潜行的暗影专家', icon: '🗡️',
    hitDie: 8, primaryStat: ['dex'], saves: ['dex', 'int'],
    startingStats: { str: 12, dex: 15, con: 13, int: 14, wis: 10, cha: 8 } },
  { id: 'sorcerer', name: '术士', nameEn: 'Sorcerer',
    description: '血脉觉醒、以意志驱动奥术的天生施法者', icon: '🔥',
    hitDie: 6, primaryStat: ['cha'], saves: ['con', 'cha'],
    startingStats: { str: 10, dex: 13, con: 14, int: 8, wis: 12, cha: 15 } },
  { id: 'warlock', name: '邪术师', nameEn: 'Warlock',
    description: '与异界存在立约、借其伟力行走世间', icon: '👁️',
    hitDie: 8, primaryStat: ['cha'], saves: ['wis', 'cha'],
    startingStats: { str: 8, dex: 14, con: 13, int: 12, wis: 10, cha: 15 } },
  { id: 'wizard', name: '法师', nameEn: 'Wizard',
    description: '钻研奥秘、掌握大量法术的博学者', icon: '🔮',
    hitDie: 6, primaryStat: ['int'], saves: ['int', 'wis'],
    startingStats: { str: 8, dex: 12, con: 13, int: 15, wis: 14, cha: 10 } }
]

// ──────────────────────────────────────────────
// Species (SRD 5.2.1 — 9 species)
// In 2024 rules, species no longer grant ability-score bonuses; only size, speed, and traits.
// Ability bonuses now come from the chosen Background.
// ──────────────────────────────────────────────
export const CHARACTER_SPECIES = [
  { id: 'dragonborn', name: '龙裔', nameEn: 'Dragonborn',
    description: '流淌龙族血脉，能吐息元素之力',
    size: 'Medium', speed: 30, trait: '龙息武器 · 抗性 · 黑暗视觉60尺 · 5级起龙翼飞行' },
  { id: 'dwarf', name: '矮人', nameEn: 'Dwarf',
    description: '坚韧顽强、精于锻造的山地种族',
    size: 'Medium', speed: 30, trait: '黑暗视觉120尺 · 毒抗性 · 石觉 · 坚韧额外HP' },
  { id: 'elf', name: '精灵', nameEn: 'Elf',
    description: '优雅长寿、与自然和谐共处的古老种族',
    size: 'Medium', speed: 30, trait: '黑暗视觉60尺 · 血脉天赋 · 魅惑豁免优势 · 4小时出神' },
  { id: 'gnome', name: '侏儒', nameEn: 'Gnome',
    description: '充满好奇心、擅长机巧与幻术的小体型种族',
    size: 'Small', speed: 30, trait: '黑暗视觉60尺 · INT/WIS/CHA豁免优势 · 血脉法术' },
  { id: 'goliath', name: '巨人裔', nameEn: 'Goliath',
    description: '继承巨人血脉，身材魁梧、力大无穷',
    size: 'Medium', speed: 35, trait: '巨人血统（6选1） · 强壮体格 · 5级起可变大体型' },
  { id: 'halfling', name: '半身人', nameEn: 'Halfling',
    description: '身材矮小但运气极佳的乐天种族',
    size: 'Small', speed: 30, trait: '幸运 · 勇敢 · 天生隐匿 · 可穿过大型生物空间' },
  { id: 'human', name: '人类', nameEn: 'Human',
    description: '适应性最强、分布最广的种族',
    size: 'Medium', speed: 30, trait: '灵感恢复 · 额外技能熟练 · 免费起源专长' },
  { id: 'orc', name: '兽人', nameEn: 'Orc',
    description: '勇猛无畏、意志顽强的战斗民族',
    size: 'Medium', speed: 30, trait: '黑暗视觉120尺 · 肾上腺冲刺 · 不屈耐力' },
  { id: 'tiefling', name: '提夫林', nameEn: 'Tiefling',
    description: '带有下位位面血脉的魔裔后嗣',
    size: 'Medium', speed: 30, trait: '黑暗视觉60尺 · 血裔遗产 · 魔法戏法 · 血裔法术' }
]

// Back-compat alias — some earlier code referred to races.
export const CHARACTER_RACES = CHARACTER_SPECIES

// ──────────────────────────────────────────────
// Backgrounds (SRD 5.2.1 — 4 origin backgrounds)
// Each background lists 3 ability scores. Apply either (+2/+1) or (+1/+1/+1).
// Also grants an Origin feat, two skill proficiencies, and one tool proficiency.
// ──────────────────────────────────────────────
export const CHARACTER_BACKGROUNDS = [
  { id: 'acolyte', name: '侍僧', nameEn: 'Acolyte',
    description: '在神殿学习圣言，记诵祷文与神学史',
    abilities: ['int', 'wis', 'cha'],
    feat: 'Magic Initiate (Cleric)', featZh: '法术新秀（牧师）',
    skills: ['洞察', '宗教'],
    tool: '书法工具' },
  { id: 'criminal', name: '罪犯', nameEn: 'Criminal',
    description: '在黑市与暗巷间讨生活的偷梁换柱者',
    abilities: ['dex', 'con', 'int'],
    feat: 'Alert', featZh: '警觉',
    skills: ['巧手', '潜行'],
    tool: '盗贼工具' },
  { id: 'sage', name: '学者', nameEn: 'Sage',
    description: '在藏书阁中皓首穷经的知识追寻者',
    abilities: ['con', 'int', 'wis'],
    feat: 'Magic Initiate (Wizard)', featZh: '法术新秀（法师）',
    skills: ['奥秘', '历史'],
    tool: '书法工具' },
  { id: 'soldier', name: '士兵', nameEn: 'Soldier',
    description: '从军多年、在沙场上锤炼技艺的老兵',
    abilities: ['str', 'dex', 'con'],
    feat: 'Savage Attacker', featZh: '凶猛攻击者',
    skills: ['运动', '威吓'],
    tool: '游戏套组（自选）' }
]

export const STAT_NAMES = {
  str: { name: '力量', abbr: 'STR' },
  dex: { name: '敏捷', abbr: 'DEX' },
  con: { name: '体质', abbr: 'CON' },
  int: { name: '智力', abbr: 'INT' },
  wis: { name: '感知', abbr: 'WIS' },
  cha: { name: '魅力', abbr: 'CHA' }
}

export function getModifier(score) {
  return Math.floor((score - 10) / 2)
}

export function formatModifier(score) {
  const mod = getModifier(score)
  return mod >= 0 ? `+${mod}` : `${mod}`
}

// Compute level-1 HP: class hit die max + CON modifier
export function computeMaxHp(classId, conScore) {
  const cls = CHARACTER_CLASSES.find(c => c.id === classId)
  if (!cls) return 10
  const conMod = getModifier(conScore || 10)
  let hp = cls.hitDie + conMod
  // Dwarven Toughness: +1 per level
  return Math.max(1, hp)
}

// Apply a background's ability adjustment.
// mode: 'major' => +2 to first ability, +1 to second ability
//       'balanced' => +1 to all three
export function applyBackgroundBonus(stats, background, mode = 'major', pick = null) {
  if (!background) return { ...stats }
  const out = { ...stats }
  if (mode === 'balanced') {
    background.abilities.forEach(k => { out[k] = (out[k] || 10) + 1 })
  } else {
    // pick: { plus2: 'str', plus1: 'dex' } (must both be in abilities)
    const plus2 = pick?.plus2 || background.abilities[0]
    const plus1 = pick?.plus1 || background.abilities.find(a => a !== plus2) || background.abilities[1]
    out[plus2] = (out[plus2] || 10) + 2
    out[plus1] = (out[plus1] || 10) + 1
  }
  // cap at 20
  Object.keys(out).forEach(k => { if (out[k] > 20) out[k] = 20 })
  return out
}
