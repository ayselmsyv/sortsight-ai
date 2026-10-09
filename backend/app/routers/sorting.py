
from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.routing import decide_sorting

router = APIRouter(prefix="/api/sorting", tags=["Sorting"])


class PackageInspection(BaseModel):
    package_id: str
    tracking_number: str | None = None
    destination: str | None = None
    issues: list[str] = Field(default_factory=list)
    confidence: float | None = None


@router.post("/decide")
def sort_package(package: PackageInspection):
    result = decide_sorting(package.model_dump())
    return {
        "package_id": package.package_id,
        "destination": package.destination,
        "status": result["action"],
        "decision": result,
    }


@router.get("/health")
def sorting_health():
    return {"status": "ok", "service": "sorting"}
