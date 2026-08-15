#!/usr/bin/env bash
# Install the skills in this repo into ~/.claude/skills/.
#
#   ./install.sh          symlink each skill (git pull keeps them updated)
#   ./install.sh --copy   copy each skill instead of linking
set -euo pipefail

MODE=link
[ "${1:-}" = "--copy" ] && MODE=copy

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$REPO_DIR/skills"
DEST="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"

mkdir -p "$DEST"

for path in "$SRC"/*/; do
    name="$(basename "$path")"
    target="$DEST/$name"

    # Only replace what we own: our own symlink, or a copy we installed before.
    if [ -e "$target" ] || [ -L "$target" ]; then
        if [ -L "$target" ] && [ "$(readlink "$target")" = "${path%/}" ]; then
            :  # already linked here
        elif [ -f "$target/.installed-from-claude-skills" ] || [ -L "$target" ]; then
            :  # ours to replace
        else
            echo "skip  $name (unmanaged directory already at $target)" >&2
            continue
        fi
        rm -rf "$target"
    fi

    if [ "$MODE" = link ]; then
        ln -s "${path%/}" "$target"
        echo "link  $name"
    else
        cp -R "${path%/}" "$target"
        touch "$target/.installed-from-claude-skills"
        echo "copy  $name"
    fi
done

echo
echo "Installed into $DEST — restart Claude Code to pick them up."
