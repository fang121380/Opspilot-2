from app.local_demo import run_demo


def test_local_demo_runs_full_safe_remediation_flow(capsys) -> None:
    output = run_demo()
    assert "Recent deployment regression" in output
    assert "演示：已请求回滚 demo/checkout" in output
    assert "incident.created" in output
    assert "approval.granted" in output
    assert "remediation.executed" in output
