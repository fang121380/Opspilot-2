from pathlib import Path

SCRIPT = (Path(__file__).parents[1] / "scripts/kind-demo.sh").read_text()


def test_kind_demo_pins_opspilot_context() -> None:
    assert 'CONTEXT="kind-${CLUSTER_NAME}"' in SCRIPT
    assert 'kubectl --context "$CONTEXT" "$@"' in SCRIPT


def test_kind_demo_has_no_unscoped_runtime_kubectl_calls() -> None:
    runtime_lines = [
        line.strip()
        for line in SCRIPT.splitlines()
        if line.strip().startswith("kubectl") and not line.strip().startswith("kubectl --context")
    ]
    assert runtime_lines == []
