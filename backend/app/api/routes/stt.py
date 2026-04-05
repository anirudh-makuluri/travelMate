from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException, Request, status

from app.services.elevenlabs_tts import elevenlabsSTTBytes


router = APIRouter(prefix="/api/v1/stt", tags=["stt"])


@router.post("/transcribe")
async def transcribe_audio(
    request: Request,
    content_type: str | None = Header(default=None),
) -> dict[str, str]:
    audio_bytes = await request.body()
    if not audio_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Audio payload is empty.",
        )

    normalized_content_type = (content_type or "audio/webm").split(";", 1)[0].strip()
    filename = _filename_for_content_type(normalized_content_type)

    try:
        transcript = await elevenlabsSTTBytes(
            audio_bytes=audio_bytes,
            filename=filename,
            content_type=normalized_content_type,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    return {"text": transcript}


def _filename_for_content_type(content_type: str) -> str:
    return {
        "audio/webm": "recording.webm",
        "audio/mp4": "recording.m4a",
        "audio/mpeg": "recording.mp3",
        "audio/wav": "recording.wav",
        "audio/ogg": "recording.ogg",
        "audio/flac": "recording.flac",
    }.get(content_type, "recording.webm")
