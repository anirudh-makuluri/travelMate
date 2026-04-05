from __future__ import annotations

import asyncio
import base64
import json
from typing import Any
from urllib.parse import urlencode

import websockets
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.config import get_settings


router = APIRouter(prefix="/api/v1/stt", tags=["stt"])


@router.websocket("/stream")
async def realtime_stt_stream(websocket: WebSocket) -> None:
    settings = get_settings()
    await websocket.accept()

    api_key = settings.elevenlabs_api_key_value
    if not api_key:
        await websocket.send_json(
            {
                "message_type": "error",
                "detail": "ELEVENLABS_API_KEY is not configured.",
            }
        )
        await websocket.close(code=1011)
        return

    query_params = websocket.query_params
    model_id = query_params.get("model_id") or settings.elevenlabs_realtime_model_id
    audio_format = query_params.get("audio_format") or "pcm_16000"
    language_code = query_params.get("language_code")
    include_timestamps = _read_bool(query_params.get("include_timestamps"), default=True)
    include_language_detection = _read_bool(
        query_params.get("include_language_detection"),
        default=False,
    )
    commit_strategy = query_params.get("commit_strategy") or "manual"
    enable_logging = _read_bool(query_params.get("enable_logging"), default=True)
    sample_rate = int(query_params.get("sample_rate") or "16000")

    upstream_query = {
        "model_id": model_id,
        "audio_format": audio_format,
        "include_timestamps": str(include_timestamps).lower(),
        "include_language_detection": str(include_language_detection).lower(),
        "commit_strategy": commit_strategy,
        "enable_logging": str(enable_logging).lower(),
    }
    if language_code:
        upstream_query["language_code"] = language_code

    upstream_url = (
        f"wss://api.elevenlabs.io/v1/speech-to-text/realtime?"
        f"{urlencode(upstream_query)}"
    )

    latest_committed_text = ""
    pending_close_after_commit = False
    stop_event = asyncio.Event()

    async with websockets.connect(
        upstream_url,
        additional_headers={"xi-api-key": api_key},
    ) as upstream_ws:

        async def forward_client_audio() -> None:
            nonlocal latest_committed_text, pending_close_after_commit
            try:
                while True:
                    message = await websocket.receive()
                    message_type = message.get("type")
                    if message_type == "websocket.disconnect":
                        break

                    if message.get("bytes") is not None:
                        audio_bytes = message["bytes"]
                        commit = False
                        previous_text = latest_committed_text or None
                        payload = {
                            "message_type": "input_audio_chunk",
                            "audio_base_64": base64.b64encode(audio_bytes).decode("ascii"),
                            "commit": commit,
                            "sample_rate": sample_rate,
                        }
                        if previous_text:
                            payload["previous_text"] = previous_text
                        await upstream_ws.send(json.dumps(payload))
                        continue

                    text = message.get("text")
                    if text is None:
                        continue

                    payload = _parse_json_message(text)
                    if payload.get("type") == "commit" or payload.get("commit") is True:
                        commit_payload: dict[str, Any] = {
                            "message_type": "input_audio_chunk",
                            "audio_base_64": payload.get("audio_base_64", ""),
                            "commit": True,
                            "sample_rate": int(payload.get("sample_rate") or sample_rate),
                        }
                        if payload.get("previous_text"):
                            commit_payload["previous_text"] = str(payload["previous_text"])
                        elif latest_committed_text:
                            commit_payload["previous_text"] = latest_committed_text
                        await upstream_ws.send(json.dumps(commit_payload))
                        if payload.get("close_after_commit") is True:
                            # Keep upstream relay alive so we can forward the final transcript
                            # before shutting down the bridge.
                            pending_close_after_commit = True
                        continue

                    if payload.get("audio_base_64"):
                        forwarded_payload = {
                            "message_type": "input_audio_chunk",
                            "audio_base_64": str(payload["audio_base_64"]),
                            "commit": bool(payload.get("commit", False)),
                            "sample_rate": int(payload.get("sample_rate") or sample_rate),
                        }
                        if payload.get("previous_text"):
                            forwarded_payload["previous_text"] = str(payload["previous_text"])
                        elif latest_committed_text:
                            forwarded_payload["previous_text"] = latest_committed_text
                        await upstream_ws.send(json.dumps(forwarded_payload))
            except WebSocketDisconnect:
                stop_event.set()
            except Exception as exc:
                await websocket.send_json(
                    {
                        "message_type": "error",
                        "detail": f"Client audio relay failed: {exc}",
                    }
                )
                stop_event.set()

        async def forward_upstream_events() -> None:
            nonlocal latest_committed_text, pending_close_after_commit
            try:
                async for raw_message in upstream_ws:
                    event = _parse_json_message(raw_message)
                    message_type = event.get("message_type")
                    if message_type == "committed_transcript":
                        latest_committed_text = str(event.get("text") or "")
                        await websocket.send_json(event)
                        if pending_close_after_commit:
                            stop_event.set()
                        continue
                    elif message_type == "committed_transcript_with_timestamps":
                        latest_committed_text = str(event.get("text") or "")
                        await websocket.send_json(event)
                        if pending_close_after_commit:
                            stop_event.set()
                        continue
                    await websocket.send_json(event)
            except Exception as exc:
                await websocket.send_json(
                    {
                        "message_type": "error",
                        "detail": f"ElevenLabs realtime relay failed: {exc}",
                    }
                )
                stop_event.set()

        audio_task = asyncio.create_task(forward_client_audio())
        upstream_task = asyncio.create_task(forward_upstream_events())

        done, pending = await asyncio.wait(
            {audio_task, upstream_task, asyncio.create_task(stop_event.wait())},
            return_when=asyncio.FIRST_COMPLETED,
        )

        for task in pending:
            task.cancel()
        await asyncio.gather(*pending, return_exceptions=True)


def _parse_json_message(message: Any) -> dict[str, Any]:
    if isinstance(message, dict):
        return message
    if isinstance(message, str):
        try:
            parsed = json.loads(message)
        except json.JSONDecodeError:
            return {}
        if isinstance(parsed, dict):
            return parsed
    return {}


def _read_bool(value: str | None, *, default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}