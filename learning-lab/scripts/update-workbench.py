#!/usr/bin/env python3
"""Fast-forward this checkout without stashing, discarding, or uploading user edits."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


class UpdateError(RuntimeError):
    pass


def git(root: Path, *args: str, timeout: int = 30) -> str:
    env = dict(os.environ, GIT_TERMINAL_PROMPT="0", GCM_INTERACTIVE="Never")
    env.setdefault("GIT_SSH_COMMAND", "ssh -o BatchMode=yes -o ConnectTimeout=15")
    try:
        result = subprocess.run(
            ["git", *args], cwd=root, env=env, capture_output=True,
            text=True, timeout=timeout, check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        message = f"Git failed or timed out ({type(error).__name__}). Retry later."
        raise UpdateError(message) from error
    if result.returncode:
        raise UpdateError(result.stderr.strip() or f"Git command failed: {args[0]}")
    return result.stdout.strip() if "-z" not in args else result.stdout


def overlaps(left: str, right: str) -> bool:
    return left == right or left.startswith(right + "/") or right.startswith(left + "/")


def update_repository(root: Path) -> tuple[str, str]:
    root = root.resolve()
    if Path(git(root, "rev-parse", "--show-toplevel")).resolve() != root:
        raise UpdateError("Run the updater from the repository root.")
    origin = git(root, "config", "--get", "remote.origin.url").rstrip("/")
    if origin.removesuffix(".git") not in {
        "git@github.com:fang121380/Opspilot-2",
        "https://github.com/fang121380/Opspilot-2",
        "ssh://git@github.com/fang121380/Opspilot-2",
    }:
        raise UpdateError("Origin must be fang121380/Opspilot-2. No files were changed.")
    if git(root, "branch", "--show-current") != "main":
        raise UpdateError("Automatic updates require the main branch. No checkout was performed.")
    for marker in ("MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "rebase-merge", "rebase-apply"):
        marker_path = Path(git(root, "rev-parse", "--git-path", marker))
        if (root / marker_path).exists():
            raise UpdateError("Finish the existing Git operation before updating.")
    before = git(root, "rev-parse", "HEAD")
    print("Checking GitHub main (timeout: 60 seconds)...", flush=True)
    git(root, "fetch", "--no-tags", "origin", "main", timeout=60)
    after = git(root, "rev-parse", "FETCH_HEAD")
    if before == after:
        return before, after
    try:
        git(root, "merge-base", "--is-ancestor", before, after)
    except UpdateError as error:
        raise UpdateError(
            "Local commits are ahead of or diverged from GitHub. "
            "Ask Codex to review and merge them; automatic update stopped."
        ) from error
    incoming = git(root, "diff", "--name-only", "-z", before, after).split("\0")
    dirty = git(root, "diff", "--name-only", "-z", "HEAD").split("\0")
    dirty += git(root, "ls-files", "--others", "--exclude-standard", "-z").split("\0")
    conflicts = {a for a in incoming if a and any(b and overlaps(a, b) for b in dirty)}
    # Git can overwrite ignored files while merging new tracked files. Protect them too.
    tracked = set(git(root, "ls-files", "-z").split("\0"))
    for name in incoming:
        if name and name not in tracked and os.path.lexists(root / name):
            conflicts.add(name)
    if conflicts:
        raise UpdateError(
            "Local files overlap incoming changes; nothing was overwritten:\n"
            + "\n".join(sorted(conflicts))
            + "\nAsk Codex to review these files before merging."
        )
    git(root, "merge", "--ff-only", after)
    return before, git(root, "rev-parse", "HEAD")


def main() -> int:
    root = Path(__file__).resolve().parents[2]
    try:
        before, after = update_repository(root)
    except UpdateError as error:
        print(f"UPDATE STOPPED: {error}", file=sys.stderr)
        return 1
    print(f"Code ready: {before[:8]} -> {after[:8]}. Local edits were preserved.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
