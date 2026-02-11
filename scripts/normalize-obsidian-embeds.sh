#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-./content}"

if [[ ! -d "$ROOT_DIR" ]]; then
  echo "normalize-obsidian-embeds: directory not found: $ROOT_DIR"
  exit 1
fi

echo "normalize-obsidian-embeds: scanning $ROOT_DIR"

find "$ROOT_DIR" -type f -name '*.md' -print0 | while IFS= read -r -d '' file; do
  perl -0777 -i -pe '
    s{!\[\[([^\]|]+?\.(?:png|jpe?g|gif|webp|svg|avif|bmp|ico))(?:\#[^\]|]+)?(?:\|([^\]]+))?\]\]}{
      my $path = $1;
      my $alt = defined($2) ? $2 : "";
      $alt =~ s/^\s+|\s+$//g;
      $alt = "" if $alt =~ /^\d+(?:x\d+)?$/;
      "![$alt]($path)"
    }egi;
  ' "$file"
done

echo "normalize-obsidian-embeds: done"
