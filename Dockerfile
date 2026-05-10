# Self-hosted server image for D&D AI DM.
# 构建前端并用 Express 提供静态文件 + /api/* + /api/tts。

FROM node:20-bookworm-slim

WORKDIR /app

# msedge-tts 会用 ffmpeg-static 里自带的 ffmpeg，无需系统 ffmpeg
# （保留 ca-certificates 保障 HTTPS 可用）
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 先装依赖（利用 Docker 缓存）
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

# 复制源码并构建前端
COPY . .
RUN npm install --include=dev --no-audit --no-fund \
    && npm run build \
    && npm prune --omit=dev

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
