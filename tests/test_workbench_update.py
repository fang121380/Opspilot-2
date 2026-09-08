"""Exercise updates against local Git remotes without network or user repositories."""

import importlib.util
import subprocess
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[1] / "learning-lab/scripts/update-workbench.py"
ORIGIN = "https://github.com/fang121380/Opspilot-2.git"


def git(root, *args):
    return subprocess.run(
        ["git", "-C", str(root), *args],
        check=True,
        capture_output=True,
        text=True,
        timeout=15,
    ).stdout.strip()


def commit_file(root, name, content):
    path = root / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    git(root, "add", "--", name)
    git(root, "commit", "-m", f"Update {name}")
    return git(root, "rev-parse", "HEAD")


@pytest.fixture
def updater():
    spec = importlib.util.spec_from_file_location("workbench_update", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def repositories(tmp_path, monkeypatch):
    monkeypatch.setenv("GIT_CONFIG_NOSYSTEM", "1")
    monkeypatch.setenv("GIT_CONFIG_GLOBAL", str(tmp_path / "unused-gitconfig"))
    monkeypatch.setenv("GIT_AUTHOR_NAME", "Workbench Test")
    monkeypatch.setenv("GIT_AUTHOR_EMAIL", "workbench@example.invalid")
    monkeypatch.setenv("GIT_COMMITTER_NAME", "Workbench Test")
    monkeypatch.setenv("GIT_COMMITTER_EMAIL", "workbench@example.invalid")
    remote = tmp_path / "remote.git"
    seed = tmp_path / "publisher"
    local = tmp_path / "workbench"
    remote.mkdir()
    seed.mkdir()
    git(remote, "init", "--bare", "--initial-branch=main")
    git(seed, "init", "--initial-branch=main")
    commit_file(seed, "lesson.md", "Original lesson\n")
    commit_file(seed, "notes.md", "Original notes\n")
    git(seed, "remote", "add", "origin", str(remote))
    git(seed, "push", "-u", "origin", "main")
    git(tmp_path, "clone", str(remote), str(local))
    git(local, "remote", "set-url", "origin", ORIGIN)
    git(local, "config", f"url.{remote}.insteadOf", ORIGIN)
    return local, seed


def publish(seed, name="lesson.md", content="Updated lesson\n"):
    revision = commit_file(seed, name, content)
    git(seed, "push", "origin", "main")
    return revision


def assert_rejected_without_changing_worktree(updater, local):
    before = git(local, "rev-parse", "HEAD")
    status = git(local, "status", "--porcelain=v1", "--untracked-files=all")
    diff = git(local, "diff", "HEAD", "--binary")
    stash = git(local, "stash", "list")
    with pytest.raises(updater.UpdateError):
        updater.update_repository(local)
    assert git(local, "rev-parse", "HEAD") == before
    assert git(local, "status", "--porcelain=v1", "--untracked-files=all") == status
    assert git(local, "diff", "HEAD", "--binary") == diff
    assert git(local, "stash", "list") == stash


def test_update_fast_forwards_to_published_revision(updater, repositories):
    local, seed = repositories
    before = git(local, "rev-parse", "HEAD")
    after = publish(seed)
    assert updater.update_repository(local) == (before, after)
    assert git(local, "rev-parse", "HEAD") == after
    assert (local / "lesson.md").read_text() == "Updated lesson\n"


def test_no_new_commits_is_a_no_op(updater, repositories):
    local, _ = repositories
    before = git(local, "rev-parse", "HEAD")
    assert updater.update_repository(local) == (before, before)
    assert git(local, "status", "--porcelain") == ""


@pytest.mark.parametrize("staged", [False, True])
def test_update_preserves_unrelated_local_edits(updater, repositories, staged):
    local, seed = repositories
    (local / "notes.md").write_text("My unfinished notes\n")
    if staged:
        git(local, "add", "notes.md")
    (local / "personal.txt").write_text("Local only\n")
    status = git(local, "status", "--porcelain=v1", "--untracked-files=all")
    after = publish(seed)
    updater.update_repository(local)
    assert git(local, "rev-parse", "HEAD") == after
    assert (local / "notes.md").read_text() == "My unfinished notes\n"
    assert (local / "personal.txt").read_text() == "Local only\n"
    assert git(local, "status", "--porcelain=v1", "--untracked-files=all") == status
    assert git(local, "stash", "list") == ""


@pytest.mark.parametrize("staged", [False, True])
def test_changed_remote_file_rejects_overlapping_local_edit(updater, repositories, staged):
    local, seed = repositories
    (local / "lesson.md").write_text("My unfinished lesson\n")
    if staged:
        git(local, "add", "lesson.md")
    publish(seed)
    assert_rejected_without_changing_worktree(updater, local)
    assert (local / "lesson.md").read_text() == "My unfinished lesson\n"


@pytest.mark.parametrize(
    ("local_name", "remote_name"),
    [("draft.md", "draft.md"), ("draft", "draft/lesson.md"), ("draft/notes.md", "draft")],
)
def test_remote_addition_preserves_conflicting_untracked_file(
    updater, repositories, local_name, remote_name
):
    local, seed = repositories
    path = local / local_name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("Uncommitted local work\n")
    publish(seed, remote_name, "Published work\n")
    assert_rejected_without_changing_worktree(updater, local)
    assert path.read_text() == "Uncommitted local work\n"


def test_wrong_branch_is_preserved(updater, repositories):
    local, seed = repositories
    git(local, "switch", "-c", "codex/unfinished")
    publish(seed)
    assert_rejected_without_changing_worktree(updater, local)
    assert git(local, "branch", "--show-current") == "codex/unfinished"


def test_wrong_remote_is_rejected(updater, repositories):
    local, _ = repositories
    git(local, "remote", "set-url", "origin", "https://github.com/example/unrelated.git")
    assert_rejected_without_changing_worktree(updater, local)


def test_local_commit_ahead_of_remote_is_preserved(updater, repositories):
    local, _ = repositories
    commit_file(local, "local.md", "Unpublished commit\n")
    assert_rejected_without_changing_worktree(updater, local)
    assert (local / "local.md").read_text() == "Unpublished commit\n"


def test_diverged_history_is_preserved(updater, repositories):
    local, seed = repositories
    commit_file(local, "local.md", "Unpublished commit\n")
    publish(seed)
    assert_rejected_without_changing_worktree(updater, local)
    assert (local / "local.md").read_text() == "Unpublished commit\n"
