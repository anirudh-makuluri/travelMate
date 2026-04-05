from __future__ import annotations

from typing import Any

import httpx

from app.core.config import Settings


class GoogleAPIError(RuntimeError):
    """Raised when a Google API request fails."""


class BaseGoogleClient:
    def __init__(self, http_client: httpx.AsyncClient, settings: Settings) -> None:
        self.http_client = http_client
        self.settings = settings

    def require_gemini_api_key(self) -> str:
        api_key = self.settings.gemini_api_key_value
        if not api_key:
            raise GoogleAPIError(
                "GEMINI_API_KEY is not configured. Set it in your environment to call Gemini."
            )
        return api_key

    def require_maps_api_key(self) -> str:
        api_key = self.settings.maps_api_key_value
        if not api_key:
            raise GoogleAPIError(
                "MAPS_API_KEY is not configured. Set it in your environment to call Google Maps APIs."
            )
        return api_key

    async def post_json(
        self,
        url: str,
        *,
        json_payload: dict[str, Any],
        headers: dict[str, str] | None = None,
        params: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        try:
            response = await self.http_client.post(
                url,
                json=json_payload,
                headers=headers,
                params=params,
            )
        except httpx.HTTPError as exc:
            raise GoogleAPIError(f"Google API connection failed: {exc}") from exc

        if response.is_error:
            detail = response.text
            raise GoogleAPIError(
                f"Google API request failed with {response.status_code}: {detail}"
            )

        return response.json()
