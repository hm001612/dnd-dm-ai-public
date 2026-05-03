// Condensed core rules from D&D SRD 5.2.1 (CC-BY-4.0)
// This is the distilled version injected into the DM's system prompt

export const SRD_DC_SCALE = {
  '非常简单': 5, '简单': 10, '中等': 15, '困难': 20, '非常困难': 25, '几乎不可能': 30
}

export const SRD_CONDITIONS = [
  { name: '目盲 (Blinded)', effect: '看不见的生物的攻击检定具有优势对其攻击，而其攻击则具有劣势；它自动在需要视觉的检定中失败。' },
  { name: '魅惑 (Charmed)', effect: '被魅惑的生物不能攻击魅惑者或以有害魔法效果将其作为目标；魅惑者对它的社交检定有优势。' },
  { name: '耳聋 (Deafened)', effect: '无法听见声音，在需要听觉的检定中自动失败。' },
  { name: '倒地 (Prone)', effect: '移动受限（只能爬行）；近战攻击对其有优势（5英尺内），远程有劣势。' },
  { name: '抓握 (Grappled)', effect: '速度为0，无法从抓握者获得速度加值。' },
  { name: '禁锢 (Restrained)', effect: '速度为0；攻击检定对其有优势，其攻击和敏捷豁免有劣势。' },
  { name: '麻痹 (Paralyzed)', effect: '无法行动或反应；5英尺内近战攻击自动暴击。' },
  { name: '惊惧 (Frightened)', effect: '对恐惧源有视线时在攻击检定和属性检定上有劣势，无法主动接近恐惧源。' },
  { name: '石化 (Petrified)', effect: '转化为无机物；对大多数伤害有抗性，对毒素和疾病免疫。' },
  { name: '中毒 (Poisoned)', effect: '所有攻击检定和属性检定有劣势。' },
  { name: '隐形 (Invisible)', effect: '无法被普通视觉察觉；攻击有优势，对方攻击它有劣势。' },
  { name: '震慑 (Stunned)', effect: '无法行动，说话只能吞吐；敏捷和力量豁免自动失败；攻击它有优势。' },
  { name: '昏迷 (Unconscious)', effect: '无法行动；掉落持有物；近战攻击对其暴击（5英尺内）。' },
  { name: '精疲力尽 (Exhaustion)', effect: '6级累积；每级降低所有d20检定-2，速度-5英尺；达到6级则死亡。' }
]

export const SRD_DAMAGE_TYPES = [
  '钝击 (Bludgeoning)', '穿刺 (Piercing)', '挥砍 (Slashing)',
  '酸性 (Acid)', '寒冷 (Cold)', '火焰 (Fire)', '力场 (Force)',
  '闪电 (Lightning)', '毒素 (Poison)', '心灵 (Psychic)',
  '光耀 (Radiant)', '雷鸣 (Thunder)', '死灵 (Necrotic)'
]

export const SRD_ACTIONS = [
  { name: '攻击 (Attack)', desc: '进行一次近战或远程武器攻击。' },
  { name: '施法 (Magic)', desc: '使用一个法术或魔法能力。' },
  { name: '冲刺 (Dash)', desc: '本回合额外获得相当于速度的移动距离。' },
  { name: '撤离 (Disengage)', desc: '本回合内的移动不会引发借机攻击。' },
  { name: '闪避 (Dodge)', desc: '下一回合前，对你的攻击检定有劣势，你的敏捷豁免有优势。' },
  { name: '协助 (Help)', desc: '帮助另一个生物执行任务，对方的下一次D20检定有优势。' },
  { name: '隐匿 (Hide)', desc: '进行敏捷（隐匿）检定以躲避察觉。' },
  { name: '影响 (Influence)', desc: '魅力检定，尝试社交影响某个生物。' },
  { name: '准备 (Ready)', desc: '设置一个触发条件，当条件满足时使用反应行动。' },
  { name: '搜寻 (Search)', desc: '进行感知检定以发现隐藏事物。' },
  { name: '研习 (Study)', desc: '进行智力检定以回忆或分析信息。' },
  { name: '使用 (Utilize)', desc: '使用一个非战斗类物品或环境。' }
]

export const SRD_SKILLS = {
  力量: ['运动 (Athletics)'],
  敏捷: ['体操 (Acrobatics)', '巧手 (Sleight of Hand)', '隐匿 (Stealth)'],
  智力: ['奥秘 (Arcana)', '历史 (History)', '调查 (Investigation)', '自然 (Nature)', '宗教 (Religion)'],
  感知: ['驯兽 (Animal Handling)', '洞察 (Insight)', '医药 (Medicine)', '察觉 (Perception)', '生存 (Survival)'],
  魅力: ['欺瞒 (Deception)', '威吓 (Intimidation)', '表演 (Performance)', '说服 (Persuasion)']
}

export const SRD_COMBAT_SUMMARY = `
## 战斗回合结构
1. **先攻**：1d20 + 敏捷修正值，高到低排序
2. **每回合行动**：1次移动（等于速度）+ 1次行动 + 1次附赠动作（如可用）+ 任意数量反应
3. **攻击检定**：1d20 + 熟练 + 属性修正值 ≥ AC 命中
4. **伤害骰**：武器伤害骰 + 属性修正值（力量或敏捷）
5. **暴击**：自然20，伤害骰数翻倍（不是最终伤害翻倍）
6. **豁免DC**：8 + 熟练 + 属性修正值

## 典型DC
- 非常简单: 5 | 简单: 10 | 中等: 15 | 困难: 20 | 非常困难: 25 | 几乎不可能: 30

## 优势/劣势
掷两个d20，优势取高，劣势取低。同类不叠加，优劣同时存在则相互抵消。
`

// Export comprehensive DM knowledge base as single string (for system prompt)
export const SRD_DM_KNOWLEDGE = `
# D&D 5.2.1 SRD 规则摘要（官方授权规则参考）

## 六大属性
力量(STR)、敏捷(DEX)、体质(CON)、智力(INT)、感知(WIS)、魅力(CHA)

## 属性修正值公式
修正值 = (属性值 - 10) / 2 (向下取整)
10→+0, 12→+1, 14→+2, 16→+3, 18→+4, 20→+5

## D20检定
属性检定、豁免检定、攻击检定均使用：1d20 + 属性修正值 + 熟练加值（若熟练）

${SRD_COMBAT_SUMMARY}

## 状态效果 (Conditions)
${SRD_CONDITIONS.map(c => `- **${c.name}**：${c.effect}`).join('\n')}

## 伤害类型
${SRD_DAMAGE_TYPES.join('、')}

## 标准动作
${SRD_ACTIONS.map(a => `- **${a.name}**：${a.desc}`).join('\n')}

## 技能分类
${Object.entries(SRD_SKILLS).map(([stat, skills]) => `- **${stat}**：${skills.join('、')}`).join('\n')}

作为DM，请在需要规则裁定时严格依照上述SRD 5.2.1规则。
`.trim()
