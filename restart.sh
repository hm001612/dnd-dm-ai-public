#!/usr/bin/env bash
# restart.sh — 重启 D&D DM 服务
# 做的事：
#   1. 检查 / 安装 ffmpeg（沙箱重启后会丢失）
#   2. 杀掉旧的 server.js 和 vite 进程
#   3. 在后台重启 Express (3000) 和 Vite (5173)
#   4. 做 health check，失败则打印日志尾
#   5. 导出 5173 端口，打印公网 URL
#
# 用法:
#   ./restart.sh           # 正常重启
#   ./restart.sh --skip-ffmpeg   # 跳过 ffmpeg 安装（已知已有）
#   ./restart.sh --no-export     # 不导出端口（例如只是本地测试）

set -u
cd "$(dirname "$0")"

SKIP_FFMPEG=0
NO_EXPORT=0
for arg in "$@"; do
  case "$arg" in
    --skip-ffmpeg) SKIP_FFMPEG=1 ;;
    --no-export)   NO_EXPORT=1 ;;
    -h|--help)
      sed -n '2,14p' "$0"
      exit 0
      ;;
  esac
done

mkdir -p logs

say() { printf '\033[36m[restart]\033[0m %s\n' "$*"; }
ok()  { printf '\033[32m[  ok   ]\033[0m %s\n' "$*"; }
err() { printf '\033[31m[ fail  ]\033[0m %s\n' "$*" >&2; }

# ---------- 1. ffmpeg ----------
if [ "$SKIP_FFMPEG" -eq 0 ]; then
  if command -v ffmpeg >/dev/null 2>&1; then
    ok "ffmpeg already installed: $(ffmpeg -version 2>&1 | head -1 | awk '{print $3}')"
  else
    say "ffmpeg missing, installing..."
    if sudo apt-get install -y ffmpeg >/dev/null 2>&1; then
      ok "ffmpeg installed"
    else
      err "ffmpeg install failed — TTS will not work"
    fi
  fi
fi

# ---------- 2. 杀旧进程 ----------
say "killing old processes..."
pkill -9 -f "node server.js" 2>/dev/null || true
pkill -9 -f "node .*vite"    2>/dev/null || true
sleep 1
if ps aux | grep -E "server\.js|node .*vite" | grep -v grep >/dev/null 2>&1; then
  err "some processes still alive; try manually: pkill -9 -f vite"
fi

# ---------- 3. 启动 ----------
if [ -z "${AI_GATEWAY_API_KEY:-}" ]; then
  err "AI_GATEWAY_API_KEY is NOT set in env — chat will fail"
fi

say "starting Express backend (port 3000)..."
nohup env AI_GATEWAY_API_KEY="${AI_GATEWAY_API_KEY:-}" node server.js > logs/server.log 2>&1 &
SERVER_PID=$!

say "starting Vite dev server (port 5173)..."
nohup npx vite --port 5173 --host > logs/vite.log 2>&1 &
VITE_PID=$!

# ---------- 4. health check (poll up to 12s) ----------
say "waiting for services to come up..."
wait_for() {
  local url="$1" name="$2" tries=0
  until curl -s -o /dev/null -m 2 "$url"; do
    tries=$((tries+1))
    if [ "$tries" -ge 24 ]; then return 1; fi
    sleep 0.5
  done
}

if wait_for http://localhost:3000/ backend; then
  ok "backend (pid=$SERVER_PID) up on :3000"
else
  err "backend did not come up; log tail:"
  tail -20 logs/server.log >&2
  exit 1
fi

if wait_for http://localhost:5173/ vite; then
  ok "vite    (pid=$VITE_PID) up on :5173"
else
  err "vite did not come up; log tail:"
  tail -20 logs/vite.log >&2
  exit 1
fi

# ---------- 5. TTS ready check ----------
if grep -q "ffmpeg detected" logs/server.log 2>/dev/null; then
  ok "TTS pipeline ready"
else
  err "TTS NOT ready — check logs/server.log"
fi

# ---------- 6. 导出端口 ----------
if [ "$NO_EXPORT" -eq 0 ] && [ -x /app/export-port.sh ]; then
  say "exporting port 5173..."
  URL=$(/app/export-port.sh 5173 2>&1 | grep -Eo 'https://[a-zA-Z0-9.-]+\.happycapy\.ai' | head -1)
  if [ -n "$URL" ]; then
    ok "Preview URL: $URL"
  else
    err "export-port.sh output unexpected"
  fi
else
  ok "skipping port export"
fi

echo
say "done — logs: logs/server.log, logs/vite.log"
