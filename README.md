# D&D AI DM

一个由 AI 驱动的龙与地下城（Dungeons & Dragons）地下城主（DM）桌面应用。
支持本地轮流制的多玩家冒险（1-6 人），带战斗先攻、角色面板、骰子、
自然语音朗读（Edge Neural TTS）等功能。

- **桌面版**：一键运行的 macOS / Windows 安装包，首次启动填一次 API Key 即可
- **自托管**：`docker compose up` 本地部署，团队共用一个实例
- **开源 · MIT**

---

## 一、玩家安装（最简单）

到 [Releases](../../releases) 页面下载对应平台的安装包：

| 平台 | 文件 |
|---|---|
| macOS Apple Silicon (M1/M2/M3…) | `D&D AI DM-<version>-arm64.dmg` |
| macOS Intel | `D&D AI DM-<version>-x64.dmg` |
| Windows 10/11 (64-bit) | `D&D AI DM-Setup-<version>.exe` |

**首次启动**会弹出设置窗口，填一次 [OpenRouter API Key](https://openrouter.ai/keys) 即可。
Key 存在本地（macOS 钥匙串 / Windows 凭据管理器），不会上传。

> 当前未做代码签名：macOS 首次打开会提示"无法验证开发者"，请在 _系统设置 → 隐私与安全性_ 点"仍要打开"；
> Windows 会弹 SmartScreen，点 _更多信息 → 仍要运行_。

---

## 二、自托管（团队共用 / 服务器部署）

```bash
git clone https://github.com/hm001612/dnd-dm-ai-public.git
cd dnd-dm-ai-public
cp .env.example .env     # 填入 AI_API_KEY
docker compose up -d
```

访问 <http://localhost:3000>。

环境变量见 [`.env.example`](.env.example)。可切换任意 OpenAI 兼容的网关
（OpenRouter / Azure OpenAI / DeepSeek / 自建 LiteLLM 等）。

---

## 三、开发

```bash
npm install
npm run dev                        # Express (3000) + Vite (5173)
```

桌面版本地调试：

```bash
npm run build                      # 先打包前端到 dist/
npm run electron                   # 启动 Electron 指向打包后的前端
```

打包安装器（本机平台）：

```bash
npm run dist                       # → release/*.dmg or release/*.exe
npm run dist:mac                   # 显式指定 mac
npm run dist:win                   # 显式指定 win
```

跨平台发布由 GitHub Actions 处理 —— 推 tag 即触发：

```bash
git tag v0.1.0 && git push origin v0.1.0
```

CI 会在 macOS (Apple Silicon + Intel) 和 Windows runner 上分别构建，
并自动创建一个 GitHub Release，附上 DMG 和 EXE。

---

## 四、技术栈

- **前端**：React 18 + Vite
- **后端**：Node.js + Express（代理 OpenAI 兼容的 Chat 接口 + TTS 合成）
- **TTS**：`msedge-tts`（微软 Edge Neural 语音，免费）+ `ffmpeg-static`
  （高通滤波 + silenceremove + loudnorm，消除卡顿/爆音）
- **桌面壳**：Electron + electron-builder + electron-store
- **AI**：任何 OpenAI 兼容提供商，默认 [OpenRouter](https://openrouter.ai/)
  （可接入 Claude / Gemini / GPT 等模型，单 Key 多模型 fallback）

## 五、多玩家玩法

顶部栏显示队伍状态，切换当前行动者即可；进入战斗后按先攻顺序自动推进回合，
退出战斗恢复自由行动。聊天输入会自动带上 `【角色名】` 前缀，让 DM 区分
是谁在行动。

## 六、目录结构

```
src/
  components/       # React 组件（SetupScreen、GameScreen、NarrativePanel ...）
  services/         # 与后端通信 + 系统 prompt 构建
  data/             # 职业、模组等静态数据
electron/
  main.cjs          # Electron 主进程（启动 server.js 子进程）
  preload.cjs       # 渲染进程 ↔ 主进程 IPC 桥
  setup.html        # 首次设置窗口
server.js           # Express 后端（聊天 + TTS）
Dockerfile          # 自托管镜像
docker-compose.yml  # 一键部署
.github/workflows/
  release.yml       # tag 触发的跨平台构建
```

## 七、许可

[MIT](LICENSE)
