"""Run launcher scripts against fake tools; never create or delete a cluster."""

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
WINDOWS = ROOT / "learning-lab/windows"
POWERSHELL = shutil.which("powershell") or shutil.which("pwsh")


def run_powershell(source, env=None):
    if not POWERSHELL:
        pytest.skip("PowerShell is not installed")
    return subprocess.run(
        [POWERSHELL, "-NoProfile", "-NonInteractive", "-Command", source],
        text=True,
        encoding="utf-8",
        errors="replace",
        capture_output=True,
        timeout=30,
        env=env,
    )


@pytest.mark.parametrize("script", sorted(WINDOWS.glob("*.ps1")), ids=lambda p: p.name)
def test_windows_launcher_parses_with_windows_powershell_encoding(script):
    result = run_powershell(f"""
        $tokens = $null; $errors = $null
        [System.Management.Automation.Language.Parser]::ParseFile(
            '{script.as_posix()}', [ref]$tokens, [ref]$errors) | Out-Null
        if ($errors.Count) {{ $errors | Out-String | Write-Output; exit 1 }}
    """)
    assert result.returncode == 0, result.stdout + result.stderr


def invoke_launcher(tmp_path, script, *, failure="", arguments="", scenario=""):
    log = tmp_path / "commands.jsonl"
    env = dict(
        os.environ, LAB_TEST_LOG=str(log), LAB_TEST_FAILURE=failure, LAB_TEST_SCENARIO=scenario
    )
    setup = """
        $ErrorActionPreference = 'Stop'
        function Record-Tool($name, $values) {
            @{tool=$name; arguments=@($values)} | ConvertTo-Json -Compress |
                Add-Content -LiteralPath $env:LAB_TEST_LOG -Encoding UTF8
            $global:LASTEXITCODE = 0
            if ($env:LAB_TEST_FAILURE -eq $name) { $global:LASTEXITCODE = 7 }
            if ($env:LAB_TEST_FAILURE -eq ($name + '-apply') -and $values -contains 'apply') {
                $global:LASTEXITCODE = 7
            }
        }
        function global:kubectl { Record-Tool 'kubectl' $args; 'kubectl v1.34.0' }
        function global:kind {
            Record-Tool 'kind' $args
            if ($args[0] -eq 'get') { 'k8s-lab' } else { 'kind v0.29.0' }
        }
        function global:docker { Record-Tool 'docker' $args; 'Docker version 28' }
        function global:node { Record-Tool 'node' $args; 'v22.18.0' }
        function global:npm { Record-Tool 'npm' $args; '10.9.0' }
        function global:python { Record-Tool 'python' $args; 'Python 3.12.0' }
        function global:winget {
            Record-Tool 'winget' $args
            $global:TestWingetCalls++
            if ($env:LAB_TEST_SCENARIO -like 'winget-current*') {
                $global:LASTEXITCODE = -1978335189
                if ($env:LAB_TEST_SCENARIO -eq 'winget-current-then-fail' -and
                    $global:TestWingetCalls -gt 1) { $global:LASTEXITCODE = 7 }
            }
        }
        function global:wsl { Record-Tool 'wsl' $args }
        function global:Start-Process {
            Record-Tool 'Start-Process' $args
            $global:TestStarted = $true
            [PSCustomObject]@{Id=123; HasExited=$false}
        }
        function global:Invoke-RestMethod {
            if ($env:LAB_TEST_SCENARIO -eq 'broken-proxy' -and "$args" -match '5173') {
                throw 'Proxy unavailable'
            }
            @{ok=$true; service='learning-lab-bridge'}
        }
        function global:Invoke-WebRequest {
            if ($env:LAB_TEST_SCENARIO -eq 'start-ui' -and -not $global:TestStarted) {
                throw 'UI not listening'
            }
            @{StatusCode=200; Content='<!doctype html><title>OpsPilot</title>'}
        }
        function global:Get-NetTCPConnection { [PSCustomObject]@{LocalAddress='0.0.0.0'} }
    """
    result = run_powershell(setup + f"\n& '{(WINDOWS / script).as_posix()}' {arguments}", env)
    calls = (
        [json.loads(line) for line in log.read_text(encoding="utf-8-sig").splitlines()]
        if log.exists()
        else []
    )
    return result, calls


def test_prerequisites_use_supported_kubectl_client_version(tmp_path):
    result, calls = invoke_launcher(tmp_path, "Check-Prerequisites.ps1")
    assert result.returncode == 0, result.stdout + result.stderr
    kubectl_calls = [call["arguments"] for call in calls if call["tool"] == "kubectl"]
    assert kubectl_calls == [["version", "--client"]]


def test_failed_version_command_marks_prerequisites_incomplete(tmp_path):
    result, _ = invoke_launcher(tmp_path, "Check-Prerequisites.ps1", failure="node")
    assert result.returncode != 0


def test_status_never_changes_default_context(tmp_path):
    result, calls = invoke_launcher(tmp_path, "Get-LabStatus.ps1")
    assert result.returncode == 0, result.stdout + result.stderr
    assert calls
    assert all(call["arguments"][:2] == ["--context", "kind-k8s-lab"] for call in calls)
    assert all("use-context" not in call["arguments"] for call in calls)


def test_status_stops_after_first_failed_cluster_command(tmp_path):
    result, calls = invoke_launcher(tmp_path, "Get-LabStatus.ps1", failure="kubectl")
    assert result.returncode != 0
    assert len(calls) == 1


@pytest.mark.parametrize("script", ["Install-Tools.ps1", "Install-All.ps1"])
def test_installers_stop_after_native_install_failure(tmp_path, script):
    result, calls = invoke_launcher(
        tmp_path,
        script,
        failure="winget",
        arguments=("-SkipWsl" if script == "Install-All.ps1" else ""),
    )
    assert result.returncode != 0
    assert len([call for call in calls if call["tool"] == "winget"]) == 1


@pytest.mark.parametrize("script", ["Install-Tools.ps1", "Install-All.ps1"])
def test_installers_continue_when_packages_are_already_current(tmp_path, script):
    result, calls = invoke_launcher(
        tmp_path,
        script,
        scenario="winget-current",
        arguments="-SkipWsl" if script == "Install-All.ps1" else "",
    )
    assert result.returncode == 0, result.stdout + result.stderr
    installed = [call["arguments"][2] for call in calls if call["tool"] == "winget"]
    packages = [
        "Git.Git",
        "Kubernetes.kind",
        "Kubernetes.kubectl",
        "OpenJS.NodeJS.LTS",
        "Python.Python.3.12",
    ]
    if script == "Install-All.ps1":
        packages.insert(0, "Docker.DockerDesktop")
    assert installed == packages


@pytest.mark.parametrize("script", ["Install-Tools.ps1", "Install-All.ps1"])
def test_installers_still_stop_on_failure_after_an_already_current_package(tmp_path, script):
    result, calls = invoke_launcher(
        tmp_path,
        script,
        scenario="winget-current-then-fail",
        arguments="-SkipWsl" if script == "Install-All.ps1" else "",
    )
    assert result.returncode != 0
    assert len([call for call in calls if call["tool"] == "winget"]) == 2


def test_stop_does_not_report_success_when_kind_fails(tmp_path):
    result, calls = invoke_launcher(tmp_path, "Stop-LearningLab.ps1", failure="kind")
    assert result.returncode != 0
    assert len(calls) == 1


def test_start_uses_explicit_context_for_all_cluster_operations(tmp_path):
    result, calls = invoke_launcher(tmp_path, "Start-LearningLab.ps1")
    assert result.returncode == 0, result.stdout + result.stderr
    cluster_calls = [
        call["arguments"]
        for call in calls
        if call["tool"] == "kubectl" and "version" not in call["arguments"]
    ]
    assert cluster_calls
    assert all(args[:2] == ["--context", "kind-k8s-lab"] for args in cluster_calls)


def test_failed_apply_stops_before_rollout_and_ui_launch(tmp_path):
    result, calls = invoke_launcher(
        tmp_path, "Start-LearningLab.ps1", failure="kubectl-apply", arguments="-StartUi"
    )
    assert result.returncode != 0
    assert not any("rollout" in call["arguments"] for call in calls)
    assert not any(call["tool"] == "Start-Process" for call in calls)


@pytest.mark.parametrize(
    ("arguments", "host"),
    [
        ("-StartUi", "127.0.0.1"),
        ("-StartUi -Lan", "0.0.0.0"),
    ],
)
def test_ui_process_is_hidden_and_lan_requires_opt_in(tmp_path, arguments, host):
    import base64

    result, calls = invoke_launcher(
        tmp_path, "Start-LearningLab.ps1", arguments=arguments, scenario="start-ui"
    )
    assert result.returncode == 0, result.stdout + result.stderr
    launch = next(call["arguments"] for call in calls if call["tool"] == "Start-Process")
    assert launch[launch.index("-WindowStyle") + 1] == "Hidden"
    process_args = launch[launch.index("-ArgumentList") + 1]
    command = base64.b64decode(process_args[-1]).decode("utf-16-le")
    assert f"--host {host}" in command and "--strictPort" in command
    if host == "0.0.0.0":
        assert "Android" in result.stdout


def test_existing_ui_with_broken_proxy_is_not_reported_ready(tmp_path):
    result, calls = invoke_launcher(
        tmp_path, "Start-LearningLab.ps1", arguments="-StartUi -StartApi", scenario="broken-proxy"
    )
    assert result.returncode != 0
    assert "proxy" in result.stderr
    assert not any(call["tool"] == "Start-Process" for call in calls)


def test_macos_launcher_rejects_unknown_options_before_starting_services():
    git_bash = Path("C:/Program Files/Git/bin/bash.exe")
    bash = str(git_bash) if git_bash.exists() else shutil.which("bash")
    if not bash:
        pytest.skip("Bash is not installed")
    script = ROOT / "learning-lab/scripts/open-workbench-macos.sh"
    # Export fake services: a valid running UI prevents the old launcher from spawning anything.
    source = """
        curl() { printf '%s' '{"ok":true,"service":"learning-lab-bridge"}'; }
        open() { return 0; }
        export -f curl open
        bash "$1" --unsupported-option
    """
    result = subprocess.run(
        [bash, "-c", source, "test", script.as_posix()], capture_output=True, text=True, timeout=10
    )
    assert result.returncode != 0
    assert "Usage" in result.stderr


@pytest.mark.parametrize(
    ("action", "cluster_exists", "operation_count"),
    [
        ("up", True, 2),
        ("up", False, 2),
        ("status", True, 2),
        ("open", True, 1),
        ("down", True, 0),
    ],
)
def test_shell_lab_actions_use_explicit_context(tmp_path, action, cluster_exists, operation_count):
    git_bash = Path("C:/Program Files/Git/bin/bash.exe")
    bash = str(git_bash) if git_bash.exists() else shutil.which("bash")
    if not bash:
        pytest.skip("Bash is not installed")
    mock_bin = tmp_path / "bin"
    mock_bin.mkdir()
    log = tmp_path / "commands.tsv"
    fake_tool = """#!/usr/bin/env bash
        tool="${0##*/}"
        { printf '%s' "$tool"; printf '\\t%s' "$@"; printf '\\n'; } >> "$LAB_TEST_LOG"
        if [[ "$1" == 'version' || "$1" == '--version' ]]; then echo 'test version'; exit 0; fi
        if [[ "$tool" == 'kind' && "$1" == 'get' && "$LAB_TEST_EXISTS" == 1 ]]; then
            echo 'k8s-lab'
        fi
        exit 0
    """
    for name in ("docker", "kind", "kubectl"):
        tool = mock_bin / name
        tool.write_text(fake_tool, encoding="utf-8", newline="\n")
        tool.chmod(0o755)
    source = 'export PATH="$(cd "$1" && pwd):$PATH"; bash "$2" "$3"'
    result = subprocess.run(
        [
            bash,
            "-c",
            source,
            "test",
            mock_bin.as_posix(),
            (ROOT / "learning-lab/scripts/lab.sh").as_posix(),
            action,
        ],
        env=dict(
            os.environ, LAB_TEST_LOG=log.as_posix(), LAB_TEST_EXISTS="1" if cluster_exists else "0"
        ),
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=15,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    calls = [line.split("\t") for line in log.read_text().splitlines()]
    cluster_calls = [
        args[1:]
        for args in calls
        if args[0] == "kubectl" and args[1] not in {"version", "--version"}
    ]
    assert all(args[:2] == ["--context", "kind-k8s-lab"] for args in cluster_calls)
    assert len(cluster_calls) == operation_count
    if action == "up":
        assert cluster_calls[0][2:4] == ["apply", "-f"]
        assert cluster_calls[1][2:] == [
            "-n",
            "learning",
            "rollout",
            "status",
            "deployment/hello-web",
            "--timeout=90s",
        ]
        assert (
            ["kind", "create", "cluster", "--name", "k8s-lab", "--wait", "90s"] in calls
        ) is not cluster_exists
    elif action == "status":
        assert cluster_calls[0][2:] == ["get", "nodes"]
        assert cluster_calls[1][2:] == ["-n", "learning", "get", "deploy,pods,svc", "-o", "wide"]
    elif action == "open":
        assert cluster_calls[0][2:] == [
            "-n",
            "learning",
            "port-forward",
            "svc/hello-web",
            "8088:80",
        ]
    else:
        assert ["kind", "delete", "cluster", "--name", "k8s-lab"] in calls


@pytest.mark.parametrize("proxy_ready", [True, False])
def test_macos_only_opens_existing_ui_when_its_bridge_proxy_is_healthy(tmp_path, proxy_ready):
    git_bash = Path("C:/Program Files/Git/bin/bash.exe")
    bash = str(git_bash) if git_bash.exists() else shutil.which("bash")
    if not bash:
        pytest.skip("Bash is not installed")
    script = ROOT / "learning-lab/scripts/open-workbench-macos.sh"
    opened = tmp_path / "opened.txt"
    source = """
        python3() { "$LAB_TEST_PYTHON" "$@"; }
        curl() {
            local url="${!#}"
            case "$url" in
                */lab-api/health)
                    [[ "$LAB_TEST_PROXY" == 'ready' ]] || return 22
                    printf '%s' '{"ok":true,"service":"learning-lab-bridge"}' ;;
                */health) printf '%s' '{"ok":true,"service":"learning-lab-bridge"}' ;;
                *) printf '%s' '<!doctype html><title>Opspilot</title>' ;;
            esac
        }
        open() { printf '%s' "$1" > "$LAB_TEST_OPENED"; }
        osascript() { return 0; }
        export -f python3 curl open osascript
        bash "$1"
    """
    result = subprocess.run(
        [bash, "-c", source, "test", script.as_posix()],
        env=dict(
            os.environ,
            LAB_TEST_PYTHON=Path(sys.executable).as_posix(),
            LAB_TEST_PROXY="ready" if proxy_ready else "broken",
            LAB_TEST_OPENED=opened.as_posix(),
        ),
        capture_output=True,
        text=True,
        timeout=15,
    )
    assert (result.returncode == 0) is proxy_ready, result.stdout + result.stderr
    assert opened.exists() is proxy_ready
    if proxy_ready:
        assert opened.read_text() == "http://127.0.0.1:5173/"


def test_vite_guards_reject_writes_and_unlisted_routes_in_dev_and_preview(tmp_path):
    node = shutil.which("node")
    ui = ROOT / "learning-lab/ui"
    if not node or not (ui / "node_modules/vite").exists():
        pytest.skip("Install learning-lab/ui dependencies to check Vite middleware")
    # Load the real config with Vite, then exercise both registered HTTP guards.
    source = """
        import assert from 'node:assert/strict';
        import { loadConfigFromFile } from 'vite';
        const loaded = await loadConfigFromFile({command:'serve',mode:'development'});
        const config = loaded.config;
        assert.equal(config.server.host, '127.0.0.1');
        assert.equal(config.preview.host, '127.0.0.1');
        assert.equal(config.server.strictPort, true);
        assert.equal(config.preview.strictPort, true);
        for (const section of [config.server, config.preview]) {
            assert.equal(section.proxy['/lab-api'].target, 'http://127.0.0.1:8787');
            assert.equal(section.proxy['/opspilot-api'].target, 'http://127.0.0.1:8000');
        }
        const guard = config.plugins.flat().find(p => p?.name === 'read-only-workbench-api');
        assert.ok(guard, 'same-origin read-only guard must be registered');
        const audit = '/opspilot-api/incidents/123e4567-e89b-12d3-a456-426614174000/audit';
        for (const hook of ['configureServer','configurePreviewServer']) {
            let middleware;
            guard[hook]({middlewares:{use(fn){middleware=fn;}}});
            assert.ok(middleware);
            for (const [method,url,allowed] of [
                ['GET','/',true], ['GET','/lab-api/?query=resources',true],
                ['GET','/lab-api/health',true], ['GET','/opspilot-api/health',true],
                ['GET','/opspilot-api/incidents',true], ['GET',audit,true],
                ['POST','/lab-api/?query=resources',false], ['DELETE',audit,false],
                ['POST','/opspilot-api/incidents',false],
                ['GET','/opspilot-api/incidents/private/audit',false],
                ['GET','/opspilot-api/docs',false], ['GET','/opspilot-api/health?x=1',false],
                ['GET','/opspilot-api/incidents/../health',false],
                ['GET','/lab-api/anything',false], ['GET','/lab-api/?query=logs&cmd=delete',false],
                ['GET','/lab-api/?query=logs&query=nodes',false],
                ['GET','/opspilot-api/health??',false],
            ]) {
                let next=false, ended=false;
                const response={setHeader(){},end(){ended=true;},statusCode:200};
                middleware({method,url},response,()=>{next=true;});
                assert.equal(next,allowed, `${hook}: ${method} ${url}`);
                assert.equal(ended,!allowed);
            }
        }
    """
    result = subprocess.run(
        [node, "--input-type=module", "-e", source],
        cwd=ui,
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_real_vite_dev_and_preview_proxy_only_forward_allowed_get_requests(tmp_path):
    node = shutil.which("node")
    ui = ROOT / "learning-lab/ui"
    if not node or not (ui / "node_modules/vite").exists():
        pytest.skip("Install learning-lab/ui dependencies to check HTTP proxies")
    source = """
        import assert from 'node:assert/strict';
        import http from 'node:http';
        import {createServer,preview} from 'vite';
        const calls=[];
        const upstream=http.createServer((req,res)=>{
            calls.push({method:req.method,path:req.url});
            res.setHeader('Content-Type','application/json');
            res.end(JSON.stringify({path:req.url}));
        });
        await new Promise(resolve=>upstream.listen(0,'127.0.0.1',resolve));
        const target=`http://127.0.0.1:${upstream.address().port}`;
        process.env.LAB_API_TARGET=target;
        process.env.OPSPILOT_API_TARGET=target;
        try {
                for (const mode of ['dev','preview']) {
                    const reservation=http.createServer();
                    await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));
                    const port=reservation.address().port;
                    await new Promise(resolve=>reservation.close(resolve));
                    const app=mode==='dev'
                        ? await createServer({server:{port},cacheDir:process.env.LAB_TEST_DIST,
                                              optimizeDeps:{noDiscovery:true,include:[]}})
                        : await preview({preview:{port},build:{outDir:process.env.LAB_TEST_DIST}});
                try {
                    if(mode==='dev') await app.listen();
                    const base=`http://127.0.0.1:${app.httpServer.address().port}`;
                    for(const [path,forwarded] of [
                        ['/lab-api/?query=resources','/?query=resources'],
                        ['/lab-api/health','/health'],
                        ['/opspilot-api/incidents','/incidents'],
                        ['/opspilot-api/incidents/123e4567-e89b-12d3-a456-426614174000/audit',
                         '/incidents/123e4567-e89b-12d3-a456-426614174000/audit'],
                    ]) {
                        const response=await fetch(base+path);
                        assert.equal(response.status,200);
                        assert.deepEqual(await response.json(),{path:forwarded});
                        assert.deepEqual(calls.at(-1),{method:'GET',path:forwarded});
                    }
                    const before=calls.length;
                    for(const [method,path] of [
                        ['POST','/opspilot-api/incidents'],['DELETE','/lab-api/?query=logs'],
                        ['GET','/opspilot-api/docs'],['GET','/lab-api/?query=logs&namespace=default'],
                    ]) {
                        const response=await fetch(base+path,{method});
                        assert.ok([403,405].includes(response.status));
                        assert.equal((await response.json()).ok,false);
                    }
                    assert.equal(calls.length,before,'denied requests must not reach upstream');
                } finally {
                    app.httpServer.closeAllConnections();
                    if(mode==='dev') await app.close();
                    else await new Promise(resolve=>app.httpServer.close(resolve));
                }
            }
        } finally {
            upstream.closeAllConnections();
            await new Promise(resolve=>upstream.close(resolve));
        }
    """
    result = subprocess.run(
        [node, "--input-type=module", "-e", source],
        cwd=ui,
        env=dict(os.environ, LAB_TEST_DIST=str(tmp_path)),
        capture_output=True,
        text=True,
        timeout=45,
    )
    assert result.returncode == 0, result.stdout + result.stderr
