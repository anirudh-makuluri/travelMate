from __future__ import annotations

import re
from pathlib import Path
from typing import Final

import httpx

from app.core.config import get_settings


DEFAULT_OUTPUT_DIR: Final[Path] = Path("generated_audio")


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", value.strip().lower())
    slug = re.sub(r"_+", "_", slug).strip("_")
    return slug or "audio"


async def elevenlabsTTS(text: str, output_path: str | Path | None = None) -> Path:
    settings = get_settings()
    api_key = settings.elevenlabs_api_key_value
    if not api_key:
        raise ValueError(
            "ELEVENLABS_API_KEY is not configured. Add it to your .env file before calling elevenlabsTTS()."
        )

    target_path = Path(output_path) if output_path is not None else DEFAULT_OUTPUT_DIR / f"{_slugify(text)}.mp3"
    target_path.parent.mkdir(parents=True, exist_ok=True)

    url = f"{settings.elevenlabs_base_url}/text-to-speech/{settings.elevenlabs_voice_id}"
    payload = {
        "text": text,
        "model_id": settings.elevenlabs_model_id,
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75,
            "style": 0.0,
            "use_speaker_boost": True,
        },
    }
    headers = {
        "xi-api-key": api_key,
        "accept": "audio/mpeg",
        "content-type": "application/json",
    }

    timeout = httpx.Timeout(settings.elevenlabs_request_timeout_seconds)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(url, json=payload, headers=headers)

    if response.is_error:
        raise RuntimeError(
            f"ElevenLabs request failed with {response.status_code}: {response.text}"
        )

    target_path.write_bytes(response.content)
    return target_path


# Example usage:
# async def main() -> None:
#     input_path = Path("temp_tts_input.txt")
#     text = input_path.read_text(encoding="utf-8").strip()
#     output_path = Path("temp_output") / "temp_tts_test.mp3"

#     generated_path = await elevenlabsTTS(text, output_path=output_path)
#     print(f"Generated audio: {generated_path.resolve()}")


async def elevenlabsMusic(theme: str, output_path: str | Path | None = None) -> Path:
    settings = get_settings()
    api_key = settings.elevenlabs_api_key_value
    if not api_key:
        raise ValueError(
            "ELEVENLABS_API_KEY is not configured. Add it to your .env file before calling elevenlabsMusic()."
        )

    cleaned_theme = theme.strip()
    if not cleaned_theme:
        raise ValueError("Theme cannot be empty when calling elevenlabsMusic().")

    target_path = (
        Path(output_path)
        if output_path is not None
        else DEFAULT_OUTPUT_DIR / f"{_slugify(cleaned_theme)}.mp3"
    )
    target_path.parent.mkdir(parents=True, exist_ok=True)

    prompt = (
        "Create an original, high-quality instrumental music track inspired by this theme: "
        f"{cleaned_theme}. Focus on mood, atmosphere, instrumentation, and cinematic energy. "
        "Do not imitate any existing song, artist, or copyrighted melody."
    )
    url = f"{settings.elevenlabs_base_url}/music"
    headers = {
        "xi-api-key": api_key,
        "accept": "audio/mpeg",
        "content-type": "application/json",
    }
    params = {
        "output_format": "mp3_22050_32",
    }
    payload = {
        "prompt": prompt,
        "music_length_ms": settings.elevenlabs_music_default_length_ms,
        "model_id": settings.elevenlabs_music_model_id,
        "force_instrumental": True,
    }

    timeout = httpx.Timeout(settings.elevenlabs_request_timeout_seconds)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(url, params=params, json=payload, headers=headers)

    if response.is_error:
        raise RuntimeError(
            f"ElevenLabs music request failed with {response.status_code}: {response.text}"
        )

    target_path.write_bytes(response.content)
    return target_path


async def elevenlabsSTT(audio_path: str | Path) -> str:
    settings = get_settings()
    api_key = settings.elevenlabs_api_key_value
    if not api_key:
        raise ValueError(
            "ELEVENLABS_API_KEY is not configured. Add it to your .env file before calling elevenlabsSTT()."
        )

    source_path = Path(audio_path)
    if not source_path.exists():
        raise FileNotFoundError(f"Audio file not found: {source_path}")

    return await elevenlabsSTTBytes(
        audio_bytes=source_path.read_bytes(),
        filename=source_path.name,
        content_type=_mime_type_for_audio(source_path),
    )


async def elevenlabsSTTBytes(
    *,
    audio_bytes: bytes,
    filename: str = "recording.webm",
    content_type: str = "audio/webm",
) -> str:
    settings = get_settings()
    api_key = settings.elevenlabs_api_key_value
    if not api_key:
        raise ValueError(
            "ELEVENLABS_API_KEY is not configured. Add it to your .env file before calling elevenlabsSTTBytes()."
        )
    if not audio_bytes:
        raise ValueError("Audio payload is empty.")

    url = f"{settings.elevenlabs_base_url}/speech-to-text"
    headers = {
        "xi-api-key": api_key,
        "accept": "application/json",
    }
    files = {
        "file": (
            filename,
            audio_bytes,
            content_type,
        ),
    }
    data = {"model_id": settings.elevenlabs_stt_model_id}

    timeout = httpx.Timeout(settings.elevenlabs_request_timeout_seconds)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(url, headers=headers, data=data, files=files)

    if response.is_error:
        raise RuntimeError(
            f"ElevenLabs speech-to-text request failed with {response.status_code}: {response.text}"
        )

    payload = response.json()
    transcript = payload.get("text")
    if not isinstance(transcript, str) or not transcript.strip():
        raise RuntimeError("ElevenLabs speech-to-text response did not include transcript text.")

    return transcript.strip()


def _mime_type_for_audio(path: Path) -> str:
    return {
        ".mp3": "audio/mpeg",
        ".m4a": "audio/mp4",
        ".mp4": "audio/mp4",
        ".wav": "audio/wav",
        ".webm": "audio/webm",
        ".ogg": "audio/ogg",
        ".flac": "audio/flac",
    }.get(path.suffix.lower(), "application/octet-stream")
