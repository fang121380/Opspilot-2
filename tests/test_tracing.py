from app.observability.tracing import current_trace_id, traced


def test_traced_context_exposes_a_trace_id_even_with_default_noop_provider() -> None:
    with traced("test.operation"):
        trace_id = current_trace_id()
        second_trace_id = current_trace_id()

    assert isinstance(trace_id, str)
    assert len(trace_id) == 32
    assert trace_id != second_trace_id
