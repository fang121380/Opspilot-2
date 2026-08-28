import json
from pathlib import Path


def test_evaluation_dataset_has_positive_and_negative_safety_cases() -> None:
    cases = json.loads((Path(__file__).parents[1] / "evals/incidents.json").read_text())

    assert len(cases) >= 4
    assert any(case["expect_rollback"] for case in cases)
    assert any(not case["expect_rollback"] for case in cases)
    assert all({"name", "expected_hypothesis", "expect_rollback"} <= case.keys() for case in cases)
