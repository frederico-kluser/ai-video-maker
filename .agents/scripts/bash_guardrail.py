#!/usr/bin/env python3
"""
Bash guardrail: allowlist-based security gate.

Blocks dangerous commands by default-deny on dangerous primitives.
Only explicitly safe patterns are allowed for commands involving rm, sudo, dd, etc.

Exit codes: 0 = allow, 2 = block

Design principle: allowlist (not denylist).
The reference implementation's denylist misses rm -rf /, rm -rf ~, and sudo rm -rf /.
This implementation starts from "block dangerous primitives" and only allows
explicitly safe patterns for those primitives.
"""

import re
import sys

# ---------------------------------------------------------------------------
# Commands that trigger allowlist scrutiny
# When a command contains any of these primitives, it must match an explicit
# safe pattern — otherwise it is blocked.
# ---------------------------------------------------------------------------
DANGEROUS_PRIMITIVES = [
    "rm ",
    "sudo ",
    "dd ",
    "mkfs.",
    "> /dev/sd",
    "> /dev/hd",
    "> /dev/nvme",
    "> /dev/mmc",
    "chmod 777",
    "chmod -R 777",
    "chown ",
    "mv / ",
    "mv ~ ",
    ":(){ :|:& };:",  # fork bomb
]

# ---------------------------------------------------------------------------
# Allowlist patterns for 'rm' commands
# Only these patterns are safe. Everything else with 'rm' is blocked.
# ---------------------------------------------------------------------------
RM_SAFE_PATTERNS = [
    # Single file/dir removal with optional flags (no trailing / or ~)
    r"^rm\s+(-[a-zA-Z]*\s+)?['\"]?[.\w][.\w/-]*['\"]?$",
    # Common safe directories
    r"^rm\s+-rf\s+node_modules/?$",
    r"^rm\s+-rf\s+\.claude/worktrees/[\w.-]+/?$",
    r"^rm\s+-rf\s+__pycache__/?$",
    r"^rm\s+-rf\s+\.pytest_cache/?$",
    r"^rm\s+-rf\s+dist/?$",
    r"^rm\s+-rf\s+build/?$",
    r"^rm\s+-rf\s+\.tox/?$",
    r"^rm\s+-rf\s+\.venv/?$",
    r"^rm\s+-rf\s+venv/?$",
    r"^rm\s+-rf\s+\.next/?$",
    r"^rm\s+-rf\s+out/?$",
    r"^rm\s+-rf\s+\.cache/?$",
    r"^rm\s+-rf\s+coverage/?$",
    r"^rm\s+-rf\s+tmp/?$",
    r"^rm\s+-rf\s+temp/?$",
    r"^rm\s+-rf\s+\.turbo/?$",
    r"^rm\s+-rf\s+\.parcel-cache/?$",
    r"^rm\s+-rf\s+\.output/?$",
    r"^rm\s+-rf\s+\.nuxt/?$",
    r"^rm\s+-rf\s+\.svelte-kit/?$",
    # Common safe file patterns
    r"^rm\s+-f\s+\.\w+$",
    r"^rm\s+-rf\s+\.git/worktrees/[\w.-]+/?$",
    # Remove with find piped to rm (common cleanup pattern)
    r"^rm\s+-rf\s+\$\(find\s+\.\s+-name\s+['\"]\*\.\w+['\"]\)$",
]

# ---------------------------------------------------------------------------
# Allowlist patterns for 'sudo' commands
# By default, ALL sudo is blocked unless explicitly allowed here.
# ---------------------------------------------------------------------------
SUDO_SAFE_PATTERNS = [
    # No sudo commands are allowed by default
    # Add specific safe patterns here if needed, e.g.:
    # r"^sudo\s+apt-get\s+update$",
]

# ---------------------------------------------------------------------------
# Patterns for reading secrets/env files
# ---------------------------------------------------------------------------
SECRETS_READ_PATTERNS = [
    # Reading .env files
    r"\b(cat|less|head|tail|grep|bat|more|view|nl|od|xxd|hexdump|awk|sed)\s+.*\.env(\b|$)",
    r"\b(cat|less|head|tail|grep|bat|more|view|nl|od|xxd|hexdump|awk|sed)\s+.*\.env\.\w+",
    # Reading secrets directories
    r"\b(cat|less|head|tail|grep|bat|more|view|nl|od|xxd|hexdump|awk|sed)\s+.*secrets?/",
    # Reading credentials
    r"\b(cat|less|head|tail|grep|bat|more|view|nl|od|xxd|hexdump|awk|sed)\s+.*credentials?\b",
    # Reading private keys
    r"\b(cat|less|head|tail|grep|bat|more|view|nl|od|xxd|hexdump|awk|sed)\s+.*\.pem\b",
    r"\b(cat|less|head|tail|grep|bat|more|view|nl|od|xxd|hexdump|awk|sed)\s+.*id_rsa\b",
    r"\b(cat|less|head|tail|grep|bat|more|view|nl|od|xxd|hexdump|awk|sed)\s+.*id_ed25519\b",
    r"\b(cat|less|head|tail|grep|bat|more|view|nl|od|xxd|hexdump|awk|sed)\s+.*id_ecdsa\b",
    # Reading tokens/secrets files
    r"\b(cat|less|head|tail|grep|bat|more|view|nl|od|xxd|hexdump|awk|sed)\s+.*\.token\b",
    r"\b(cat|less|head|tail|grep|bat|more|view|nl|od|xxd|hexdump|awk|sed)\s+.*\.secret\b",
    r"\b(cat|less|head|tail|grep|bat|more|view|nl|od|xxd|hexdump|awk|sed)\s+.*\.key\b",
    # echo/print of secrets
    r"\b(echo|printf?)\s+.*\$(\w*SECRET\w*|\w*TOKEN\w*|\w*PASSWORD\w*|\w*API_KEY\w*)",
    # env command dumping secrets
    r"\b(env|printenv)\s+.*\|\s*grep\s+.*(SECRET|TOKEN|PASSWORD|API_KEY)",
]


def check_rm_allowlist(cmd: str) -> bool:
    """Check if an rm command matches an allowed safe pattern."""
    for pattern in RM_SAFE_PATTERNS:
        if re.search(pattern, cmd, re.IGNORECASE):
            return True
    return False


def check_sudo_allowlist(cmd: str) -> bool:
    """Check if a sudo command matches an allowed safe pattern."""
    for pattern in SUDO_SAFE_PATTERNS:
        if re.search(pattern, cmd, re.IGNORECASE):
            return True
    return False


def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    cmd_stripped = cmd.strip()

    if not cmd_stripped:
        sys.exit(0)

    # ------------------------------------------------------------------
    # Step 1: Check for secrets/env reading (always blocked)
    # ------------------------------------------------------------------
    for pattern in SECRETS_READ_PATTERNS:
        if re.search(pattern, cmd_stripped, re.IGNORECASE):
            print(f"[BashGuard] BLOCKING secrets read attempt")
            print(f"[BashGuard] Command: {cmd_stripped[:200]}")
            sys.exit(2)

    # ------------------------------------------------------------------
    # Step 2: Check for dangerous primitives
    # ------------------------------------------------------------------
    has_dangerous_primitive = False
    matched_primitive = ""

    for primitive in DANGEROUS_PRIMITIVES:
        if primitive in cmd_stripped:
            has_dangerous_primitive = True
            matched_primitive = primitive.strip()
            break

    if not has_dangerous_primitive:
        # No dangerous primitives — allow
        sys.exit(0)

    # ------------------------------------------------------------------
    # Step 3: Allowlist check for dangerous primitives
    # ------------------------------------------------------------------

    # 'rm' commands
    if matched_primitive == "rm":
        if check_rm_allowlist(cmd_stripped):
            sys.exit(0)
        print(f"[BashGuard] BLOCKING rm command: not in allowlist")
        print(f"[BashGuard] Command: {cmd_stripped[:200]}")
        print(f"[BashGuard] rm -rf /, rm -rf ~, and rm -rf on system paths are blocked")
        sys.exit(2)

    # 'sudo' commands
    if matched_primitive == "sudo":
        if check_sudo_allowlist(cmd_stripped):
            sys.exit(0)
        print(f"[BashGuard] BLOCKING sudo command: not in allowlist")
        print(f"[BashGuard] Command: {cmd_stripped[:200]}")
        print(f"[BashGuard] sudo commands are blocked by default")
        sys.exit(2)

    # 'dd' commands
    if matched_primitive == "dd":
        print(f"[BashGuard] BLOCKING dd command: raw device writes not allowed")
        print(f"[BashGuard] Command: {cmd_stripped[:200]}")
        sys.exit(2)

    # 'chmod 777' commands
    if "chmod" in matched_primitive:
        print(f"[BashGuard] BLOCKING chmod 777: world-writable permissions not allowed")
        print(f"[BashGuard] Command: {cmd_stripped[:200]}")
        sys.exit(2)

    # Other dangerous primitives
    print(f"[BashGuard] BLOCKING dangerous primitive: {matched_primitive}")
    print(f"[BashGuard] Command: {cmd_stripped[:200]}")
    sys.exit(2)


if __name__ == "__main__":
    main()
