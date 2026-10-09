import asyncio
import logging
import os
import re
from pathlib import Path

import httpx
from dotenv import load_dotenv
from google import genai
from google.genai import errors, types
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

logger = logging.getLogger(__name__)

DEFAULT_MODEL_NAME = "gemini-3.8-flash"
REQUEST_TIMEOUT_SECONDS = 20
GEMINI_TIMEOUT_MILLISECONDS = REQUEST_TIMEOUT_SECONDS * 1000

load_dotenv(dotenv_path=Path(__file__).resolve().parents[2] / ".env")


class LabelAnalysis(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    tracking_number: str | None = Field(
        description="Tracking number exactly as visible on the shipping label, or null."
    )
    destination: str | None = Field(
        description="Shipping destination exactly as visible on the label, or null."
    )
    destination_city: str | None = Field(
        description="Destination city explicitly visible on the label, or null."
    )
    destination_country: str | None = Field(
        description="Destination country explicitly visible on the label, or null."
    )
    issues: list[str] = Field(
        description=(
            "Observable label problems only, such as missing information, blur, "
            "damage, obstruction, or unreadable text."
        )
    )

    confidence: float | None = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description=(
            "Model-estimated confidence in the readability and accuracy "
            "of extracted label information, from 0 to 1. "
            "Return null when confidence cannot be estimated."
        ),
    )

    @field_validator(
        "tracking_number",
        "destination",
        "destination_city",
        "destination_country",
        mode="before",
    )
    @classmethod
    def normalize_blank_values(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip():
            return None
        return value


LABEL_ANALYSIS_SCHEMA = types.Schema(
    type=types.Type.OBJECT,
    properties={
        "tracking_number": types.Schema(type=types.Type.STRING, nullable=True),
        "destination": types.Schema(type=types.Type.STRING, nullable=True),
        "destination_city": types.Schema(type=types.Type.STRING, nullable=True),
        "destination_country": types.Schema(type=types.Type.STRING, nullable=True),
        "issues": types.Schema(
            type=types.Type.ARRAY,
            items=types.Schema(type=types.Type.STRING),
        ),
        "confidence": types.Schema(
            type=types.Type.NUMBER,
            nullable=True,
        ),
    },
    required=[
        "tracking_number",
        "destination",
        "destination_city",
        "destination_country",
        "issues",
        "confidence",
    ],
    property_ordering=[
        "tracking_number",
        "destination",
        "destination_city",
        "destination_country",
        "issues",
        "confidence",
    ],
)


class VisionAnalysisError(Exception):
    """A safe-to-report failure while analyzing an image with Gemini."""


PROMPT = """Inspect this image for a shipping label and return only information
that is clearly visible in the image.

Extract:
- tracking_number: the human-readable tracking number printed on the label,
  exactly as shown.
- destination: the full destination address exactly as printed.
- destination_city and destination_country: only when each is explicitly
  readable on the label.

Never guess, infer, complete, or invent any value. Return null for each field
that is absent or cannot be read reliably, and preserve other fields that are
readable. Read the destination from the recipient/destination address, not from
the sender, return address, or origin.

Treat printed tracking text and barcode digits as separate evidence. Do not use
barcode digits to fill in an absent or unreadable printed tracking number, and
do not flag them as mismatched solely because their formats differ.

In issues, report only observable problems on the label. Include
TRACKING_NUMBER_MISSING or DESTINATION_MISSING when that information is absent.
Include LABEL_UNREADABLE when blur, damage, or obstruction prevents reading
label information; if only some fields are unreadable, return null only for
those fields. Include LABEL_BLURRED when the label is visibly blurry.

If no shipping label is present, return null for all extracted fields and
include LABEL_NOT_FOUND in issues. Do not report suspected data inconsistencies,
routing concerns, or issues inferred from information outside the image. If the
label is readable and has no visible problems, return an empty issues list.

Also return confidence as a number between 0 and 1 representing your
estimated confidence in the accuracy and readability of the extracted
information. Use lower confidence for unclear or partially readable labels.
Return null if confidence cannot be estimated.

This is a model-estimated confidence score, not a calibrated probability.
Never fabricate missing label information to increase confidence."""


async def analyze_label(image: bytes, mime_type: str) -> LabelAnalysis:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.error("Gemini image analysis skipped because GEMINI_API_KEY is not configured")
        raise VisionAnalysisError("Gemini API key is not configured")

    try:
        async with asyncio.timeout(REQUEST_TIMEOUT_SECONDS):
            async with genai.Client(
                api_key=api_key,
                http_options=types.HttpOptions(
                    timeout=GEMINI_TIMEOUT_MILLISECONDS
                ),
            ).aio as client:
                response = await client.models.generate_content(
                    model=os.getenv("GEMINI_MODEL", DEFAULT_MODEL_NAME),
                    contents=[
                        types.Part.from_bytes(data=image, mime_type=mime_type),
                        PROMPT,
                    ],
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=LABEL_ANALYSIS_SCHEMA,
                        temperature=0,
                    ),
                )
    except TimeoutError:
        logger.warning("Gemini image analysis timed out")
        raise VisionAnalysisError("Gemini image analysis timed out") from None
    except errors.APIError as error:
        message = " ".join((error.message or "No error message provided").split())
        message = message.replace(api_key, "[REDACTED]")
        message = re.sub(
            r"\bAIza[0-9A-Za-z_-]{20,}\b",
            "[REDACTED]",
            message,
        )
        logger.warning(
            "Gemini API request failed with code %s: %s",
            error.code,
            message[:500],
        )
        raise VisionAnalysisError("Gemini image analysis failed") from None
    except httpx.HTTPError as error:
        logger.warning(
            "Gemini image analysis encountered an HTTP transport failure (%s)",
            type(error).__name__,
        )
        raise VisionAnalysisError("Gemini image analysis failed") from None

    if not response.text:
        logger.warning("Gemini returned an empty image analysis response")
        raise VisionAnalysisError("Gemini returned no image analysis")

    try:
        return LabelAnalysis.model_validate_json(response.text)
    except ValidationError:
        logger.warning("Gemini returned an invalid structured image analysis response")
        raise VisionAnalysisError("Gemini returned an invalid image analysis") from None
