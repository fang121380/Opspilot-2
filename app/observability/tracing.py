from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from uuid import uuid4

from opentelemetry import trace

tracer = trace.get_tracer("opspilot-2")


@contextmanager
def traced(name: str) -> Iterator[trace.Span]:
    """创建一个可选导出的 Span；未配置 SDK 时由 OpenTelemetry 自动空操作。"""

    with tracer.start_as_current_span(name) as span:
        yield span


def current_trace_id() -> str:
    span_context = trace.get_current_span().get_span_context()
    if not span_context.is_valid:
        # 无 SDK/Collector 时仍提供每次操作唯一的本地关联字段。
        return uuid4().hex
    return format(span_context.trace_id, "032x")


def configure_console_tracing() -> None:
    """显式启用本地控制台导出；生产环境应通过 OTLP 配置 Collector。"""

    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter

    provider = TracerProvider(resource=Resource.create({"service.name": "opspilot-2"}))
    provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))
    trace.set_tracer_provider(provider)
