#!/usr/bin/env bash
#
# BuildContest 설치 스크립트 (Ubuntu / Debian 계열)
#
# 새 VM 에서 한 번 실행하면 다음까지 끝냅니다.
#   - Node.js 22 설치 (이미 20 이상이면 건너뜀)
#   - 전용 시스템 계정 생성
#   - 소스 내려받기 → 의존성 설치 → 클라이언트 빌드
#   - systemd 서비스 등록 및 기동
#   - (선택) Cloudflare Tunnel 커넥터 설치
#
# 같은 명령을 다시 실행하면 최신 소스로 갱신하고 서비스를 재시작합니다.
# 즉 설치 스크립트가 곧 업데이트 스크립트입니다.
#
#   sudo ./scripts/install.sh --domain contest.example.com
#
set -euo pipefail

APP_NAME=buildcontest
APP_DIR=/opt/buildcontest
APP_USER=buildcontest
APP_PORT=3000
DOMAIN=""
REPO=https://github.com/dariring/buildcontest.git
BRANCH=main
CF_TOKEN=""
SKIP_CLOUDFLARED=0
NODE_MAJOR=22

# ---------------------------------------------------------------- 출력 도우미

if [ -t 1 ]; then
  C_OK=$'\033[32m'; C_WARN=$'\033[33m'; C_ERR=$'\033[31m'; C_DIM=$'\033[2m'; C_OFF=$'\033[0m'
else
  C_OK=""; C_WARN=""; C_ERR=""; C_DIM=""; C_OFF=""
fi

step() { printf '\n%s==>%s %s\n' "$C_OK" "$C_OFF" "$*"; }
info() { printf '    %s\n' "$*"; }
warn() { printf '%s[주의]%s %s\n' "$C_WARN" "$C_OFF" "$*" >&2; }
die()  { printf '%s[오류]%s %s\n' "$C_ERR" "$C_OFF" "$*" >&2; exit 1; }

usage() {
  cat <<'USAGE'
사용법: sudo ./scripts/install.sh [옵션]

옵션:
  --domain <호스트>         공개 도메인. 예) contest.example.com
                            출처 검사와 디스코드 콜백 주소의 기준이 됩니다.
  --port <번호>             앱이 들을 포트 (기본 3000, 127.0.0.1 에만 바인딩)
  --dir <경로>              설치 위치 (기본 /opt/buildcontest)
  --user <계정>             서비스 실행 계정 (기본 buildcontest)
  --repo <주소>             소스 저장소 (기본 공식 저장소)
  --branch <이름>           브랜치 (기본 main)
  --cloudflared-token <값>  Zero Trust 대시보드에서 발급한 커넥터 토큰.
                            주면 cloudflared 까지 설치하고 연결합니다.
  --skip-cloudflared        cloudflared 관련 단계를 모두 건너뜁니다.
  -h, --help                이 도움말

예시:
  sudo ./scripts/install.sh --domain contest.example.com
  sudo ./scripts/install.sh --domain contest.example.com --cloudflared-token eyJhIjoi...
USAGE
}

# ------------------------------------------------------------------ 인자 처리

while [ $# -gt 0 ]; do
  case "$1" in
    --domain)             DOMAIN="${2:-}"; shift 2 ;;
    --port)               APP_PORT="${2:-}"; shift 2 ;;
    --dir)                APP_DIR="${2:-}"; shift 2 ;;
    --user)               APP_USER="${2:-}"; shift 2 ;;
    --repo)               REPO="${2:-}"; shift 2 ;;
    --branch)             BRANCH="${2:-}"; shift 2 ;;
    --cloudflared-token)  CF_TOKEN="${2:-}"; shift 2 ;;
    --skip-cloudflared)   SKIP_CLOUDFLARED=1; shift ;;
    -h|--help)            usage; exit 0 ;;
    *)                    usage >&2; die "알 수 없는 옵션: $1" ;;
  esac
done

# 인자를 먼저 확인합니다. 오타 하나 잡자고 sudo 를 다시 칠 필요는 없으니까요.
case "$APP_PORT" in
  ''|*[!0-9]*) die "--port 는 숫자여야 합니다: $APP_PORT" ;;
esac
[ "$APP_PORT" -ge 1 ] && [ "$APP_PORT" -le 65535 ] || die "--port 는 1~65535 범위여야 합니다: $APP_PORT"

case "$APP_DIR" in
  /*) ;;
  *)  die "--dir 는 절대경로여야 합니다: $APP_DIR" ;;
esac

if [ -n "$DOMAIN" ]; then
  case "$DOMAIN" in
    http://*|https://*) die "--domain 에는 스킴 없이 호스트만 적어주세요. 예) contest.example.com" ;;
    */*)                die "--domain 에는 경로 없이 호스트만 적어주세요." ;;
    *[!a-zA-Z0-9.-]*)   die "--domain 에 쓸 수 없는 문자가 있습니다: $DOMAIN" ;;
    *.*) ;;
    *)                  die "--domain 형식이 올바르지 않습니다: $DOMAIN" ;;
  esac
fi

[ "$(id -u)" -eq 0 ] || die "root 권한이 필요합니다. sudo 를 붙여 실행해주세요."
command -v apt-get >/dev/null 2>&1 || die "이 스크립트는 apt 기반 배포판(Ubuntu/Debian)용입니다."

if [ -z "$DOMAIN" ]; then
  warn "--domain 을 주지 않았습니다. 공개 주소 기준 없이 설치합니다."
  warn "터널로 공개할 예정이라면 나중에 $APP_DIR/.env 의 BUILDCONTEST_PUBLIC_ORIGIN 을 채워주세요."
fi

# ------------------------------------------------------------------ 기본 패키지

step "기본 패키지를 확인합니다"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl git rsync >/dev/null
info "완료"

# --------------------------------------------------------------------- Node.js

need_node=1
if command -v node >/dev/null 2>&1; then
  current="$(node -v | sed 's/^v\([0-9]*\).*/\1/')"
  if [ "$current" -ge 20 ] 2>/dev/null; then
    need_node=0
    info "이미 설치된 Node.js $(node -v) 를 사용합니다"
  else
    warn "Node.js $(node -v) 는 너무 낮습니다 (20 이상 필요). 새로 설치합니다."
  fi
fi

if [ "$need_node" -eq 1 ]; then
  step "Node.js ${NODE_MAJOR} 를 설치합니다"
  info "NodeSource 저장소 설정 스크립트를 내려받아 실행합니다 (deb.nodesource.com)"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" -o /tmp/nodesource_setup.sh
  bash /tmp/nodesource_setup.sh >/dev/null
  rm -f /tmp/nodesource_setup.sh
  apt-get install -y -qq nodejs >/dev/null
  info "설치된 버전: $(node -v)"
fi

# ----------------------------------------------------------------------- 계정

step "서비스 계정 '$APP_USER' 을 준비합니다"
if id "$APP_USER" >/dev/null 2>&1; then
  info "이미 존재합니다"
else
  useradd --system --create-home --home-dir "/var/lib/$APP_USER" --shell /usr/sbin/nologin "$APP_USER"
  info "생성했습니다 (로그인 불가 시스템 계정)"
fi

# ----------------------------------------------------------------------- 소스

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

step "소스를 $APP_DIR 에 준비합니다"
if [ -e "$APP_DIR" ] && [ "$(cd "$APP_DIR" 2>/dev/null && pwd)" = "$SRC_ROOT" ]; then
  info "이미 설치 위치에서 실행 중입니다. 소스는 그대로 사용합니다."
elif [ -d "$APP_DIR/.git" ]; then
  info "기존 설치를 최신 $BRANCH 로 갱신합니다"
  git -C "$APP_DIR" remote set-url origin "$REPO"
  git -C "$APP_DIR" fetch --depth 1 origin "$BRANCH"
  git -C "$APP_DIR" reset --hard "origin/$BRANCH"
elif [ -f "$APP_DIR/package.json" ]; then
  info "git 저장소는 아니지만 앱이 이미 있습니다. 소스는 건드리지 않고 빌드만 다시 합니다."
elif [ -f "$SRC_ROOT/package.json" ] && [ -f "$SRC_ROOT/src/server/index.js" ]; then
  info "이 스크립트가 들어 있는 소스를 $APP_DIR 로 복사합니다"
  mkdir -p "$APP_DIR"
  rsync -a --delete \
    --exclude '.git' --exclude 'node_modules' --exclude 'dist' --exclude 'data' \
    "$SRC_ROOT/" "$APP_DIR/"
else
  info "$REPO 에서 내려받습니다"
  git clone --depth 1 --branch "$BRANCH" "$REPO" "$APP_DIR"
fi

mkdir -p "$APP_DIR/data"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
# data/ 에는 봇 토큰과 세션 키가 평문으로 들어갑니다. 다른 계정은 아예 못 보게 막습니다.
chmod 700 "$APP_DIR/data"

# ------------------------------------------------------------------- 빌드

step "의존성을 설치하고 클라이언트를 빌드합니다"

# npm 은 --prefix 로 넘겼을 때 하위 명령마다 동작이 미묘하게 달라서, 그냥 폴더로 들어가서 씁니다.
# HOME 을 지정하지 않으면 npm 이 캐시 위치를 찾지 못해 실패할 수 있습니다.
npm_as_app() {
  runuser -u "$APP_USER" -- env HOME="/var/lib/$APP_USER" \
    sh -c 'cd "$1" && shift && exec npm "$@"' _ "$APP_DIR" "$@"
}

if [ -f "$APP_DIR/package-lock.json" ]; then
  npm_as_app ci --no-audit --no-fund
else
  npm_as_app install --no-audit --no-fund
fi

npm_as_app run build

# vite 등 빌드에만 쓰이는 패키지는 여기서 걷어냅니다.
# (그래서 서비스는 npm start 가 아니라 node 를 직접 실행합니다. npm start 는
#  prestart 로 빌드를 다시 돌리려 해서 vite 가 없으면 기동에 실패합니다.)
npm_as_app prune --omit=dev --no-audit --no-fund

[ -f "$APP_DIR/dist/index.html" ] || die "빌드 결과물이 없습니다. 위 npm 출력을 확인해주세요."
info "빌드 완료: $APP_DIR/dist"

# ------------------------------------------------------------------ 환경 설정

ENV_FILE="$APP_DIR/.env"
step "환경 설정 파일을 씁니다 ($ENV_FILE)"
{
  echo "# BuildContest 실행 설정 — 고치고 나면 sudo systemctl restart $APP_NAME"
  echo "NODE_ENV=production"
  echo "PORT=$APP_PORT"
  echo "# 터널/프록시를 통해서만 들어오게 합니다. 직접 노출하려면 0.0.0.0 으로 바꾸세요."
  echo "HOST=127.0.0.1"
  echo "BUILDCONTEST_DATA_DIR=$APP_DIR/data"
  echo "# 프록시가 붙여주는 접속자 IP와 https 정보를 신뢰합니다."
  echo "# 프록시 없이 직접 노출한다면 반드시 지우세요. IP 위조가 가능해집니다."
  echo "BUILDCONTEST_TRUST_PROXY=1"
  if [ -n "$DOMAIN" ]; then
    echo "BUILDCONTEST_PUBLIC_ORIGIN=https://$DOMAIN"
  else
    echo "# BUILDCONTEST_PUBLIC_ORIGIN=https://공개도메인"
  fi
} > "$ENV_FILE"
chown root:"$APP_USER" "$ENV_FILE"
chmod 640 "$ENV_FILE"
info "완료"

# --------------------------------------------------------------- systemd 서비스

step "systemd 서비스를 등록합니다"

# ProtectHome 은 홈 디렉터리를 가립니다. 설치 위치가 /home 아래면 앱이 자기 파일을
# 못 읽게 되므로 그때만 끕니다.
protect_home=true
case "$APP_DIR" in /home/*|/root/*) protect_home=false ;; esac

cat > "/etc/systemd/system/$APP_NAME.service" <<UNIT
[Unit]
Description=BuildContest — 마인크래프트 건축 공모전 웹
Documentation=https://github.com/dariring/buildcontest
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
ExecStart=$(command -v node) $APP_DIR/src/server/index.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$APP_NAME

# --- 권한 최소화 ---
NoNewPrivileges=true
PrivateTmp=true
PrivateDevices=true
ProtectSystem=strict
ProtectHome=$protect_home
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true
RestrictRealtime=true
RestrictNamespaces=true
LockPersonality=true
CapabilityBoundingSet=
AmbientCapabilities=
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
# 앱이 쓰기를 하는 곳은 데이터 폴더뿐입니다.
ReadWritePaths=$APP_DIR/data
# 참고: Node 는 JIT 때문에 실행 가능한 메모리가 필요하므로
# MemoryDenyWriteExecute 는 켜지 않습니다. 켜면 기동하지 못합니다.

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable "$APP_NAME" >/dev/null 2>&1
systemctl restart "$APP_NAME"
sleep 2

if systemctl is-active --quiet "$APP_NAME"; then
  info "서비스가 실행 중입니다"
else
  warn "서비스가 뜨지 않았습니다. 아래 로그를 확인해주세요."
  journalctl -u "$APP_NAME" -n 30 --no-pager || true
  die "설치를 마치지 못했습니다."
fi

# 실제로 응답하는지까지 확인합니다.
if curl -fsS -o /dev/null --max-time 10 "http://127.0.0.1:$APP_PORT/api/state"; then
  info "http://127.0.0.1:$APP_PORT 응답 확인"
else
  warn "포트 $APP_PORT 가 아직 응답하지 않습니다. journalctl -u $APP_NAME -f 로 확인해주세요."
fi

# ------------------------------------------------------------------ cloudflared

if [ "$SKIP_CLOUDFLARED" -eq 0 ]; then
  step "Cloudflare Tunnel"

  if ! command -v cloudflared >/dev/null 2>&1; then
    info "cloudflared 를 설치합니다"
    mkdir -p /usr/share/keyrings
    curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
      -o /usr/share/keyrings/cloudflare-main.gpg
    echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main" \
      > /etc/apt/sources.list.d/cloudflared.list
    apt-get update -qq
    apt-get install -y -qq cloudflared >/dev/null
    info "설치된 버전: $(cloudflared --version 2>/dev/null | head -1)"
  else
    info "이미 설치되어 있습니다: $(cloudflared --version 2>/dev/null | head -1)"
  fi

  if [ -n "$CF_TOKEN" ]; then
    info "커넥터를 등록합니다"
    cloudflared service install "$CF_TOKEN"
    info "완료. Zero Trust 대시보드에서 Public hostname 을 아래로 연결해주세요."
    info "  ${DOMAIN:-<공개 도메인>}  ->  http://127.0.0.1:$APP_PORT"
  else
    cat <<CFHELP

    커넥터 토큰을 주지 않아 연결은 건너뛰었습니다. 둘 중 하나로 이어가시면 됩니다.

    [대시보드 방식 — 간단합니다]
      1. Cloudflare Zero Trust → Networks → Tunnels → Create a tunnel
      2. 나온 토큰으로:  sudo cloudflared service install <토큰>
      3. Public hostname 에 ${DOMAIN:-<공개 도메인>} → http://127.0.0.1:$APP_PORT 연결

    [설정 파일 방식]
      sudo cloudflared tunnel login
      sudo cloudflared tunnel create $APP_NAME
      sudo cloudflared tunnel route dns $APP_NAME ${DOMAIN:-<공개 도메인>}
      # /etc/cloudflared/config.yml 에 아래를 적고
      #   ingress:
      #     - hostname: ${DOMAIN:-<공개 도메인>}
      #       service: http://127.0.0.1:$APP_PORT
      #     - service: http_status:404
      sudo cloudflared service install

    주의: ingress 에 httpHostHeader 는 넣지 마세요. 출처 검사가 정상 요청까지 막습니다.
CFHELP
  fi
fi

# --------------------------------------------------------------------- 마무리

cat <<DONE

${C_OK}설치가 끝났습니다.${C_OFF}

  서비스 상태   sudo systemctl status $APP_NAME
  실시간 로그   sudo journalctl -u $APP_NAME -f
  재시작        sudo systemctl restart $APP_NAME
  설정 수정     sudo nano $ENV_FILE  (수정 후 재시작)
  업데이트      sudo $APP_DIR/scripts/install.sh --domain ${DOMAIN:-<도메인>}

${C_DIM}남은 것${C_OFF}
  1. https://${DOMAIN:-<공개 도메인>}/admin 에 접속해 관리자 비밀번호를 정하세요.
     ${C_WARN}먼저 접속한 사람이 관리자가 됩니다. 터널을 연결한 직후 바로 진행하세요.${C_OFF}
  2. Discord Developer Portal → OAuth2 → Redirects 에 등록:
     https://${DOMAIN:-<공개 도메인>}/api/auth/callback
  3. 어드민 패널에서 디스코드 토큰·채널 ID·연동 API 를 채워주세요.

${C_DIM}데이터는 $APP_DIR/data 에 있습니다. 서버를 옮길 땐 이 폴더만 통째로 복사하면 됩니다.${C_OFF}
DONE
