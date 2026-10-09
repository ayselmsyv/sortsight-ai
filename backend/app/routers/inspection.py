
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.services.vision import VisionAnalysisError, analyze_label
from app.services.routing import decide_sorting

router = APIRouter(prefix="/inspection", tags=["inspection"])

MAX_FILE_SIZE = 5 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}


def _matches_image_format(content: bytes, content_type: str) -> bool:
    if content_type == "image/jpeg":
        return content.startswith(b"\xff\xd8\xff")
    if content_type == "image/png":
        return content.startswith(b"\x89PNG\r\n\x1a\n")
    if content_type == "image/webp":
        return (
            len(content) >= 12
            and content.startswith(b"RIFF")
            and content[8:12] == b"WEBP"
        )
    return False


@router.post("/analyze")
async def analyze_image(image: UploadFile = File(...)) -> dict[str, object]:
    if image.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only JPEG, PNG, and WebP images are allowed",
        )

    content = await image.read(MAX_FILE_SIZE + 1)

    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded image is empty",
        )

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail="The uploaded image must not exceed 5 MB",
        )

    if not _matches_image_format(content, image.content_type):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="The uploaded file is not a valid JPEG, PNG, or WebP image",
        )

    package_id = str(uuid4())

    try:
        analysis = await analyze_label(content, image.content_type)

        tracking_number = analysis.tracking_number
        destination = analysis.destination
        destination_city = analysis.destination_city
        destination_country = analysis.destination_country
        issues = analysis.issues
        confidence = getattr(analysis, "confidence", None)

        if confidence is not None:
            confidence = float(confidence)
            confidence = max(0.0, min(1.0, confidence))

    except VisionAnalysisError:
        tracking_number = None
        destination = None
        destination_city = None
        destination_country = None
        issues = ["AI_ANALYSIS_UNAVAILABLE"]
        confidence = None

    package = {
        "package_id": package_id,
        "tracking_number": tracking_number,
        "destination": destination_city or destination,
        "issues": issues,
        "confidence": confidence,
    }

    if "AI_ANALYSIS_UNAVAILABLE" in issues:
        decision = {
            "action": "MANUAL_REVIEW",
            "lane": "REVIEW",
            "reason": "AI label analysis is unavailable.",
        }
    else:
        decision = decide_sorting(package)

    if decision["action"] == "MANUAL_REVIEW" and decision.get("lane") is None:
        decision["lane"] = "REVIEW"

    return {
        "package_id": package_id,
        "tracking_number": tracking_number,
        "destination": destination,
        "destination_city": destination_city,
        "destination_country": destination_country,
        "issues": issues,
        "confidence": confidence,
        "decision": decision,
    }
