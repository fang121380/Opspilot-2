import httpx
import pytest

from app.agent.llm import LLMProviderError, OpenAICompatibleProvider


@pytest.mark.asyncio
async def test_openai_compatible_provider_sends_structured_chat_request() -> None:
    captured: httpx.Request | None = None

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal captured
        captured = request
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": "基于证据，建议继续人工核查。"}}]},
        )

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    provider = OpenAICompatibleProvider(
        base_url="https://llm.example.test/v1",
        api_key="test-key",
        model="test-model",
        client=client,
    )

    result = await provider.complete(
        system_prompt="你是 SRE 分析助手。",
        user_prompt='{"summary":"5xx rate elevated","evidence_ids":["http-5xx-rate"]}',
    )

    assert captured is not None
    assert captured.method == "POST"
    assert captured.url.path == "/v1/chat/completions"
    assert captured.headers["authorization"] == "Bearer test-key"
    assert result == "基于证据，建议继续人工核查。"
    await client.aclose()


@pytest.mark.asyncio
async def test_provider_rejects_malformed_model_response() -> None:
    client = httpx.AsyncClient(
        transport=httpx.MockTransport(lambda request: httpx.Response(200, json={"choices": []}))
    )
    provider = OpenAICompatibleProvider(
        base_url="https://llm.example.test", api_key="test-key", model="test-model", client=client
    )

    with pytest.raises(LLMProviderError, match="missing assistant content"):
        await provider.complete(system_prompt="system", user_prompt="user")

    await client.aclose()


@pytest.mark.asyncio
async def test_provider_does_not_leak_api_key_in_error() -> None:
    client = httpx.AsyncClient(
        transport=httpx.MockTransport(lambda request: httpx.Response(401, text="invalid"))
    )
    provider = OpenAICompatibleProvider(
        base_url="https://llm.example.test",
        api_key="super-secret",
        model="test-model",
        client=client,
    )

    with pytest.raises(LLMProviderError) as error:
        await provider.complete(system_prompt="system", user_prompt="user")

    assert "super-secret" not in str(error.value)
    await client.aclose()
