#!/usr/bin/env bash
# =============================================================================
# new-task-worktree.sh — Worktree por card, com preflight
# =============================================================================
# Card T-04. Cria uma git worktree isolada para um card ou tarefa PREP,
# provisiona os insumos gitignorados via symlink, e roda o preflight com
# valores conhecidos.
#
# Uso:
#   new-task-worktree.sh create <ID> [--base <branch>]
#
# Formatos de ID aceitos:
#   <FASE>-<NN>    ex.: F1-01, T-04, W1-03
#   PREP-<slug>    ex.: PREP-w1, PREP-teste
#
# IDs da trilha de infra (I-01 a I-04) são recusados — eles rodam
# diretamente no branch de integração.
#
# Opções:
#   --base <branch>  Branch a partir do qual criar a worktree
#                     (padrão: branch atual)
#
# Comportamento de erro:
#   Se o preflight falhar, o script sai com exit 1 e a worktree permanece
#   em disco para inspeção. Nenhum caminho de erro tenta remover a worktree
#   de dentro dela mesma.
# =============================================================================

set -euo pipefail

# --- helpers -----------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

die() {
    echo "ERROR: $*" >&2
    exit 1
}

usage() {
    sed -n '2,22p' "$0"
    exit 1
}

# --- parse args --------------------------------------------------------------

CMD="${1:-}"
shift 2>/dev/null || true
[ "$CMD" = "create" ] || usage

ID="${1:-}"
shift 2>/dev/null || true
[ -n "$ID" ] || usage

BASE_BRANCH=""
while [ $# -gt 0 ]; do
    case "$1" in
        --base)
            BASE_BRANCH="${2:-}"
            [ -n "$BASE_BRANCH" ] || die "--base requires a branch name"
            shift 2
            ;;
        -h|--help) usage ;;
        *) die "Unknown option: $1" ;;
    esac
done

# --- validate ID -------------------------------------------------------------

# Accepted: <LETTER><optional-digits>-<two-digit-number> or PREP-<slug>
if ! [[ "$ID" =~ ^[A-Z][0-9]*-[0-9]{2}$ ]] && ! [[ "$ID" =~ ^PREP-[a-z0-9][a-z0-9-]*$ ]]; then
    die "Invalid ID format: '$ID'
  Expected: <FASE>-<NN> (e.g., F1-01, T-04, W1-03)
         or: PREP-<slug> (e.g., PREP-w1, PREP-teste)"
fi

# Reject infra trail IDs (I-01 through I-04)
if [[ "$ID" =~ ^I-[0-9]{2}$ ]]; then
    die "'$ID' is an infra trail card.
  Infra cards (I-01, I-02, I-03, I-04) run directly on the integration
  branch, not in a worktree. They provision the environment — toolchain,
  gate, CI, hooks — that all worktrees depend on. Running them in a
  worktree would defeat the purpose: the worktree would not have the
  infrastructure the card is supposed to create."
fi

# --- determine base branch ---------------------------------------------------

cd "$REPO_ROOT"

if [ -z "$BASE_BRANCH" ]; then
    BASE_BRANCH="$(git branch --show-current)"
    [ -n "$BASE_BRANCH" ] || die "Could not determine current branch (are you in a detached HEAD?)"
fi

# Verify base branch exists
git rev-parse --verify "$BASE_BRANCH" >/dev/null 2>&1 || \
    die "Base branch '$BASE_BRANCH' does not exist"

# --- create worktree ---------------------------------------------------------

WORKTREE_PATH="$REPO_ROOT/../wt-$ID"
BRANCH_NAME="card/$ID"

echo "=== Creating worktree for $ID ==="
echo "  Base branch : $BASE_BRANCH"
echo "  Worktree    : $WORKTREE_PATH"
echo "  Branch      : $BRANCH_NAME"

# If a stale worktree or branch exists, clean it up (from the main repo —
# never from inside the worktree itself).
if [ -d "$WORKTREE_PATH" ]; then
    echo "  (removing stale worktree at $WORKTREE_PATH)"
    git worktree remove --force "$WORKTREE_PATH" 2>/dev/null || true
fi
if git branch --list "$BRANCH_NAME" | grep -q .; then
    echo "  (removing stale branch $BRANCH_NAME)"
    git branch -D "$BRANCH_NAME" 2>/dev/null || true
fi

git worktree add -b "$BRANCH_NAME" "$WORKTREE_PATH" "$BASE_BRANCH" || \
    die "Failed to create worktree at $WORKTREE_PATH"

# --- symlink gitignored inputs -----------------------------------------------

echo ""
echo "=== Symlinking gitignored inputs ==="

# The common git dir holds the exclude file that actually works for linked
# worktrees.  Per-worktree excludes under .git/worktrees/<name>/info/exclude
# may not take effect (R15 §7, (1-0)); the safe path is the common dir.
GIT_COMMON_DIR="$(git rev-parse --git-common-dir)"
EXCLUDE_FILE="$GIT_COMMON_DIR/info/exclude"
mkdir -p "$(dirname "$EXCLUDE_FILE")"

# Map: symlink-name (in worktree) -> source-path (in main repo)
declare -A INPUTS=(
    ["node_modules"]="$REPO_ROOT/node_modules"
    [".venv"]="$REPO_ROOT/.venv"
)

# Auto-detect store location.  The store may live at src/store/ (tracked)
# or .cache/store/ (gitignored cache).  Symlink it if the source exists.
STORE_SRC=""
for candidate in "$REPO_ROOT/src/store" "$REPO_ROOT/.cache/store"; do
    if [ -d "$candidate" ] || [ -L "$candidate" ]; then
        STORE_SRC="$candidate"
        break
    fi
done
if [ -n "$STORE_SRC" ]; then
    INPUTS["src/store"]="$STORE_SRC"
fi

symlinked=0
for name in "${!INPUTS[@]}"; do
    target="${INPUTS[$name]}"
    link="$WORKTREE_PATH/$name"

    if [ -e "$target" ] || [ -L "$target" ]; then
        # Ensure parent directory exists in the worktree
        mkdir -p "$(dirname "$link")"
        ln -sfn "$target" "$link"
        echo "  $name -> $target"
        symlinked=$((symlinked + 1))

        # Add to the common exclude file so the symlink is never staged.
        # A .gitignore pattern with trailing slash (node_modules/) does NOT
        # match a symlink — git would track it, and git add -A would stage it
        # with an absolute path.  The exclude file prevents this.
        if ! grep -qxF "$name" "$EXCLUDE_FILE" 2>/dev/null; then
            echo "$name" >> "$EXCLUDE_FILE"
            echo "    (added to $EXCLUDE_FILE)"
        fi
    else
        echo "  SKIP $name (source '$target' not found — expected in skeleton phase)"
    fi
done

if [ "$symlinked" -eq 0 ]; then
    echo "  (no gitignored inputs to symlink — this is normal for the skeleton)"
fi

# --- run preflight -----------------------------------------------------------

echo ""
echo "=== Running preflight ==="
PREFLIGHT="$SCRIPT_DIR/preflight.sh"

if [ -x "$PREFLIGHT" ]; then
    if "$PREFLIGHT" "$WORKTREE_PATH"; then
        echo ""
        echo "=== Worktree ready: $WORKTREE_PATH ==="
    else
        rc=$?
        echo ""
        echo "=== Preflight FAILED (exit $rc) ==="
        echo "  Worktree left for inspection: $WORKTREE_PATH"
        echo "  To remove:"
        echo "    git worktree remove $WORKTREE_PATH"
        echo "    git branch -D $BRANCH_NAME"
        exit 1
    fi
else
    echo "  WARNING: preflight.sh not found or not executable at $PREFLIGHT"
    echo "  Worktree created without preflight verification."
    echo ""
    echo "=== Worktree ready: $WORKTREE_PATH ==="
fi