#!/usr/bin/env bash
#
# 최신 소스를 받아 다시 빌드합니다.
# 시스템에 아무것도 설치하지 않고, 돌고 있는 서버도 건드리지 않습니다. sudo 필요 없습니다.
#
#   ./scripts/update.sh
#   (그다음 tmux 에서 서버를 직접 재시작)
#
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

BRANCH="${1:-}"

git rev-parse --git-dir >/dev/null 2>&1 || {
  echo "git 저장소가 아닙니다. 수동으로 받은 소스라면 새로 clone 해주세요." >&2
  exit 1
}

# 고친 파일이 있으면 멈춥니다. 말없이 덮어쓰면 안 됩니다.
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "커밋하지 않은 변경이 있습니다:" >&2
  git status --short >&2
  echo >&2
  echo "먼저 정리한 뒤 다시 실행해주세요." >&2
  echo "  보관하기: git stash" >&2
  echo "  버리기  : git checkout ." >&2
  exit 1
fi

[ -n "$BRANCH" ] || BRANCH="$(git rev-parse --abbrev-ref HEAD)"
before="$(git rev-parse HEAD)"
lock_before="$(git hash-object package-lock.json 2>/dev/null || echo none)"

echo "[1/3] $BRANCH 최신 소스를 받습니다"
git pull --ff-only origin "$BRANCH"
after="$(git rev-parse HEAD)"

if [ "$before" = "$after" ]; then
  echo "      이미 최신입니다. 빌드만 다시 합니다."
else
  echo
  git --no-pager log --oneline --no-decorate "$before..$after" | sed 's/^/      /'
  echo
fi

# package-lock 이 그대로면 의존성 설치를 건너뛰어 시간을 아낍니다.
lock_after="$(git hash-object package-lock.json 2>/dev/null || echo none)"
if [ "$lock_before" = "$lock_after" ] && [ -d node_modules ]; then
  echo "[2/3] 의존성 변경 없음 — 건너뜁니다"
else
  echo "[2/3] 의존성을 설치합니다"
  if [ -f package-lock.json ]; then
    npm ci --no-audit --no-fund
  else
    npm install --no-audit --no-fund
  fi
fi

echo "[3/3] 클라이언트를 빌드합니다"
npm run build

cat <<'DONE'

빌드까지 끝났습니다. 이제 서버를 재시작해주세요.

  tmux attach -t contest     # 붙어서 Ctrl+C 로 끄고 다시 npm start

재시작은 선택이 아니라 필수입니다.
서버는 켜질 때 dist/index.html 을 한 번만 읽어둡니다. 빌드하면 정적 파일 이름의
해시가 바뀌는데, 재시작하지 않으면 이전 이름을 계속 내려보내서 화면이 깨집니다.
DONE
