#!/usr/bin/env bash
#
# 의존성 설치 + 클라이언트 빌드까지만 합니다.
# 시스템에 아무것도 설치하지 않고, 계정도 서비스도 만들지 않습니다. sudo 필요 없습니다.
#
#   ./scripts/setup.sh
#   npm start
#
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 가 없습니다. 20 이상을 먼저 설치해주세요." >&2
  echo "  Ubuntu/Debian: curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs" >&2
  exit 1
fi

major="$(node -v | sed 's/^v\([0-9]*\).*/\1/')"
if [ "$major" -lt 20 ] 2>/dev/null; then
  echo "Node.js $(node -v) 는 너무 낮습니다. 20 이상이 필요합니다." >&2
  exit 1
fi
echo "Node.js $(node -v)"

if [ -f package-lock.json ]; then
  npm ci --no-audit --no-fund
else
  npm install --no-audit --no-fund
fi

npm run build

cat <<'DONE'

준비됐습니다. 아래로 띄우세요.

  npm start                       # 포트 3000

터널이나 프록시 뒤에 둘 경우:

  HOST=127.0.0.1 \
  BUILDCONTEST_TRUST_PROXY=1 \
  BUILDCONTEST_PUBLIC_ORIGIN=https://공개도메인 \
  npm start

DONE
