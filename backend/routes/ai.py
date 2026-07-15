"""AI echo endpoint — POST /api/ai/echo using GPT-4o via emergentintegrations."""
from __future__ import annotations

import logging
import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from auth.deps import get_current_user
from models.user import UserPublic

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ai", tags=["ai"])


class EchoRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=4000)


class EchoResponse(BaseModel):
    reply: str


@router.post("/echo", response_model=EchoResponse)
async def echo(payload: EchoRequest, current_user: UserPublic = Depends(get_current_user)):
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY not configured")

    # Import lazily so a mis-configured env doesn't crash the whole app at boot
    from emergentintegrations.llm.chat import LlmChat, UserMessage  # type: ignore

    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"echo-{current_user.id}-{uuid.uuid4().hex[:8]}",
            system_message="You are a concise assistant. Reply in 1-3 sentences.",
        ).with_model("openai", "gpt-4o")

        reply = await chat.send_message(UserMessage(text=payload.prompt))
    except Exception as exc:
        logger.exception("GPT-4o call failed")
        raise HTTPException(status_code=502, detail=f"LLM call failed: {exc}") from exc

    text = reply if isinstance(reply, str) else getattr(reply, "content", str(reply))
    if not text:
        raise HTTPException(status_code=502, detail="Empty reply from LLM")
    return EchoResponse(reply=text)
