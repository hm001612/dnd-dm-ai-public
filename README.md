# D&D AI DM

一个由 AI 驱动的龙与地下城（Dungeons & Dragons）地下城主（DM）网页应用。支持本地轮流制的多玩家冒险（1-6 人），带有战斗先攻、角色面板、骰子、语音朗读（TTS）等功能。

## 技术栈

- **前端**：React 18 + Vite
- **后端**：Node.js + Express（代理 AI Gateway 聊天接口 + TTS 生成）
- **TTS**：Python `gTTS` worker + `ffmpeg` 后处理（高通/低通/`silenceremove`/`loudnorm`）
- **AI**：通过 AI Gateway 调用 Claude / Gemini / GPT 等模型

## 开发

```bash
npm install
npm run dev      # 同时启动 Express (3000) 和 Vite (5173)
```

需要系统安装 `ffmpeg` 和 `python3`（带 `gtts` 包）用于语音生成。

环境变量：

- `AI_GATEWAY_API_KEY` — 必填，AI Gateway 的 API Key
- `PORT` — Express 端口，默认 3000

## 多玩家

顶部栏显示队伍状态，切换当前行动者即可；进入战斗后按先攻顺序自动推进回合，退出战斗恢复自由行动。聊天输入会自动带上 `【角色名】` 前缀，让 DM 区分是谁在行动。

## 目录结构

```
src/
  components/      # React 组件（SetupScreen、GameScreen、NarrativePanel ...）
  services/        # 与后端通信 + 系统 prompt 构建
  data/            # 职业、模组等静态数据
server.js          # Express 后端
tts_worker.py      # Python TTS worker (gTTS)
```
