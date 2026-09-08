"""Exercise the Windows updater with fake tools, without touching live services."""

import json
import os
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
POWERSHELL = shutil.which("powershell") or shutil.which("pwsh")
pytestmark = pytest.mark.skipif(not POWERSHELL, reason="PowerShell is not installed")

SETUP = r"""
$ErrorActionPreference = 'Stop'
function Record($tool, $values) {
    @{tool=$tool; arguments=@($values)} | ConvertTo-Json -Compress -Depth 5 |
        Add-Content -LiteralPath $env:LAB_UPDATE_LOG -Encoding UTF8
}
function global:git { throw 'Git must be delegated to the checked updater' }
function global:node { throw 'Node must run as a background process' }
function global:docker { throw 'Update must not require Docker' }
function global:kind { throw 'Update must not provision a cluster' }
function global:kubectl { throw 'Update must not change learning resources' }
function global:python {
    Record 'update' $args
    # The lock must already cover the repository update, not just npm.
    $probe = $null
    try {
        $probe = [IO.File]::Open($env:LAB_LOCK_PATH, 'OpenOrCreate', 'ReadWrite', 'None')
    } catch [IO.IOException] { }
    if ($null -ne $probe) { $probe.Dispose(); throw 'Update lock was not held' }
    $global:LASTEXITCODE = 0
    if ($env:LAB_UPDATE_SCENARIO -eq 'fetch-failure') { $global:LASTEXITCODE = 7 }
}
function global:npm.cmd {
    Record 'npm' $args
    $global:LASTEXITCODE = 0
    if ($env:LAB_UPDATE_SCENARIO -eq 'npm-failure') { $global:LASTEXITCODE = 7 }
}
function global:Get-NetTCPConnection {
    if ($env:LAB_UPDATE_SCENARIO -in @('foreign', 'owned', 'pid-reused')) {
        [PSCustomObject]@{LocalPort=5173; OwningProcess=4242}
        [PSCustomObject]@{LocalPort=8787; OwningProcess=4243}
    }
}
function global:Get-CimInstance {
    param($ClassName, $Filter)
    if ($Filter -match '4242') {
        $global:UiLookups++
        $created = 'original'
        if ($env:LAB_UPDATE_SCENARIO -eq 'pid-reused' -and $global:UiLookups -gt 1) {
            $created = 'replacement'
        }
        [PSCustomObject]@{
            ProcessId=4242; Name='node.exe'; CreationDate=$created
            CommandLine=('node "' + $env:LAB_UI_SCRIPT + '" --port 5173')
        }
    } else {
        $script = $env:LAB_API_SCRIPT
        if ($env:LAB_UPDATE_SCENARIO -eq 'foreign') { $script += '.other-checkout' }
        [PSCustomObject]@{
            ProcessId=4243; Name='python.exe'; CreationDate='original'
            CommandLine=('python "' + $script + '"')
        }
    }
}
function global:Stop-Process { Record 'stop' $args }
function global:Start-Process {
    Record 'start' $args
    [PSCustomObject]@{Id=123; HasExited=($env:LAB_UPDATE_SCENARIO -eq 'startup-failure')}
}
function global:Invoke-WebRequest {
    @{StatusCode=200; Content='<!doctype html><title>OpsPilot</title>'}
}
function global:Invoke-RestMethod {
    if ($env:LAB_UPDATE_SCENARIO -eq 'proxy-failure' -and "$args" -match '5173') {
        throw 'Proxy unavailable'
    }
    @{ok=$true; service='learning-lab-bridge'}
}
"""


def invoke_update(tmp_path, *, scenario="", arguments="", hold_lock=False, retry=False):
    lab = tmp_path / "checkout with spaces" / "learning-lab"
    windows = lab / "windows"
    windows.mkdir(parents=True)
    (lab / "ui").mkdir()
    (lab / ".workbench-logs").mkdir()
    script = windows / "Update-LearningLab.ps1"
    shutil.copyfile(ROOT / "learning-lab/windows/Update-LearningLab.ps1", script)
    log = tmp_path / "commands.jsonl"
    env = dict(
        os.environ,
        LAB_UPDATE_LOG=str(log),
        LAB_UPDATE_SCENARIO=scenario,
        LAB_UPDATE_SCRIPT=str(script),
        LAB_UI_SCRIPT=str(lab / "ui/node_modules/vite/bin/vite.js"),
        LAB_API_SCRIPT=str(lab / "scripts/lab-api.py"),
        LAB_LOCK_PATH=str(lab / ".workbench-logs/update.lock"),
    )
    execution = ""
    if hold_lock:
        execution += """
        $held = [IO.File]::Open($env:LAB_LOCK_PATH, 'OpenOrCreate', 'ReadWrite', 'None')
        try {
        """
    if retry:
        execution += """
        try { & $env:LAB_UPDATE_SCRIPT } catch { Record 'expected-failure' @() }
        $env:LAB_UPDATE_SCENARIO = ''
        """
    execution += f"\n& $env:LAB_UPDATE_SCRIPT {arguments}\n"
    if hold_lock:
        execution += "} finally { $held.Dispose() }"
    result = subprocess.run(
        [POWERSHELL, "-NoProfile", "-NonInteractive", "-Command", SETUP + execution],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=env,
        timeout=30,
    )
    calls = (
        [json.loads(line) for line in log.read_text(encoding="utf-8-sig").splitlines()]
        if log.exists()
        else []
    )
    return result, calls


@pytest.mark.parametrize(("arguments", "host"), [("", "127.0.0.1"), ("-Lan", "0.0.0.0")])
def test_update_opens_without_docker_and_preserves_host_choice(tmp_path, arguments, host):
    result, calls = invoke_update(tmp_path, arguments=arguments)
    assert result.returncode == 0, result.stdout + result.stderr
    assert [call["arguments"] for call in calls if call["tool"] == "npm"] == [
        ["ci"], ["run", "build"],
    ]
    starts = [call["arguments"] for call in calls if call["tool"] == "start"]
    assert len(starts) == 3
    assert starts[0][starts[0].index("-FilePath") + 1] == "python"
    assert starts[1][starts[1].index("-FilePath") + 1] == "node"
    node_args = starts[1][starts[1].index("-ArgumentList") + 1]
    assert node_args[1:] == ["--host", host, "--port", "5173", "--strictPort"]
    assert node_args[0].startswith('"') and node_args[0].endswith('"')
    assert starts[2] == ["http://127.0.0.1:5173/"]


def test_concurrent_update_exits_before_any_work(tmp_path):
    result, calls = invoke_update(tmp_path, hold_lock=True)
    assert result.returncode != 0
    assert "update lock" in result.stderr
    assert calls == []


@pytest.mark.parametrize("scenario", ["fetch-failure", "npm-failure", "startup-failure"])
def test_failure_releases_update_lock_for_retry(tmp_path, scenario):
    result, calls = invoke_update(tmp_path, scenario=scenario, retry=True)
    assert result.returncode == 0, result.stdout + result.stderr
    assert sum(call["tool"] == "update" for call in calls) == 2
    assert sum(call["tool"] == "expected-failure" for call in calls) == 1


@pytest.mark.parametrize("scenario", ["foreign", "pid-reused"])
def test_unknown_or_reused_process_is_never_stopped(tmp_path, scenario):
    result, calls = invoke_update(tmp_path, scenario=scenario)
    assert result.returncode != 0
    assert not any(call["tool"] in {"stop", "npm", "start"} for call in calls)


def test_owned_service_pids_are_stopped_before_dependency_install(tmp_path):
    result, calls = invoke_update(tmp_path, scenario="owned")
    assert result.returncode == 0, result.stdout + result.stderr
    assert [call["tool"] for call in calls[:4]] == ["update", "stop", "stop", "npm"]
    stops = [call["arguments"] for call in calls if call["tool"] == "stop"]
    assert [args[args.index("-Id") + 1] for args in stops] == [4242, 4243]


def test_fetch_failure_keeps_existing_services_running(tmp_path):
    result, calls = invoke_update(tmp_path, scenario="fetch-failure")
    assert result.returncode != 0
    assert [call["tool"] for call in calls] == ["update"]


def test_broken_proxy_does_not_open_browser_or_report_ready(tmp_path):
    result, calls = invoke_update(tmp_path, scenario="proxy-failure")
    assert result.returncode != 0
    assert "Updated workbench is ready" not in result.stdout
    assert not any(call["arguments"] == ["http://127.0.0.1:5173/"] for call in calls)
