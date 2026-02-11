#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BIN="${NOTEPUB_BIN:-notepub}"
CFG="${NOTEPUB_CONFIG:-./config.yaml}"
RULES="${NOTEPUB_RULES:-./rules.yaml}"
ART="./.notepub/artifacts"
OUT="./dist"

BASE_URL="$(awk -F'"' '/base_url:/ {print $2; exit}' "$CFG")"
BASE_URL="${BASE_URL%/}"

if ! command -v "$BIN" >/dev/null 2>&1; then
  echo "notepub binary not found: $BIN"
  echo "Set NOTEPUB_BIN, for example:"
  echo "  NOTEPUB_BIN=/path/to/notepub $0"
  exit 1
fi

echo "[1/4] index/build"
"$BIN" index --config "$CFG" --rules "$RULES"
"$BIN" build --config "$CFG" --rules "$RULES" --artifacts "$ART" --dist "$OUT"

echo "[2/4] copy llms files"
if [[ -f "$OUT/assets/llms.txt" ]]; then
  cp "$OUT/assets/llms.txt" "$OUT/llms.txt"
fi
if [[ -f "$OUT/assets/llms-full.txt" ]]; then
  cp "$OUT/assets/llms-full.txt" "$OUT/llms-full.txt"
fi

echo "[3/4] normalize robots"
if [[ -f "$OUT/robots.txt" ]]; then
  awk '!/^LLM: /' "$OUT/robots.txt" > "$OUT/robots.txt.tmp"
  {
    cat "$OUT/robots.txt.tmp"
    echo "LLM: ${BASE_URL}/llms.txt"
  } > "$OUT/robots.txt"
  rm -f "$OUT/robots.txt.tmp"
fi

echo "[4/4] done -> $OUT"
