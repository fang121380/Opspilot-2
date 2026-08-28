from __future__ import annotations

from typing import Protocol

import httpx


class LLMProviderError(RuntimeError):
    """Raised when an LLM provider cannot return a safe text response."""


class LLMProvider(Protocol):
    async def complete(self, *, system_prompt: str, user_prompt: str) -> str: ...


class OpenAICompatibleProvider:
    """调用 OpenAI-compatible Chat Completions API 的最小适配器。

    该类只负责文本生成。它不接收工具、不执行动作，也不会把 API Key 写入异常消息。
    调用方应先做日志脱敏，并将模型输出视为不可信文本。
    """

    def __init__(
        self,
        *,
        base_url: str,
        api_key: str,
        model: str,
        client: httpx.AsyncClient,
    ) -> None:
        self._endpoint = base_url.rstrip("/") + "/chat/completions"
        self._api_key = api_key
        self._model = model
        self._client = client

    async def complete(self, *, system_prompt: str, user_prompt: str) -> str:
        try:
            response = await self._client.post(
                self._endpoint,
                headers={"Authorization": f"Bearer {self._api_key}"},
                json={
                    "model": self._model,
                    "temperature": 0,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                },
                timeout=30.0,
            )
        except httpx.HTTPError as error:
            raise LLMProviderError(f"LLM request failed: {type(error).__name__}") from error

        if response.status_code < 200 or response.status_code >= 300:
            raise LLMProviderError(f"LLM provider returned HTTP {response.status_code}")

        try:
            content = response.json()["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError, ValueError) as error:
            raise LLMProviderError("LLM response has missing assistant content") from error
        if not isinstance(content, str) or not content.strip():
            raise LLMProviderError("LLM response has empty assistant content")
        return content
