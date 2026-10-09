
LANES = {
    "Baku": "LANE_A",
    "Ganja": "LANE_B",
    "Sumqayit": "LANE_C",
}


def decide_sorting(package: dict) -> dict:
    destination = package.get("destination")
    tracking_number = package.get("tracking_number")
    issues = package.get("issues") or []
    confidence = package.get("confidence")

    if not isinstance(issues, list):
        return {
            "action": "MANUAL_REVIEW",
            "lane": None,
            "reason": "Invalid inspection issues",
        }

    if not tracking_number or not destination:
        return {
            "action": "MANUAL_REVIEW",
            "lane": None,
            "reason": "Missing tracking number or destination",
        }

    if issues:
        return {
            "action": "MANUAL_REVIEW",
            "lane": None,
            "reason": "Package has inspection issues",
        }

    if (
        not isinstance(confidence, (int, float))
        or isinstance(confidence, bool)
        or not 0 <= confidence <= 1
    ):
        return {
            "action": "MANUAL_REVIEW",
            "lane": None,
            "reason": "Invalid or unavailable confidence",
        }

    if confidence < 0.85:
        return {
            "action": "MANUAL_REVIEW",
            "lane": None,
            "reason": "Low inspection confidence",
        }

    lane = LANES.get(destination)

    if lane is None:
        return {
            "action": "MANUAL_REVIEW",
            "lane": None,
            "reason": "Unsupported destination",
        }

    return {
        "action": "SORT",
        "lane": lane,
        "reason": "Inspection passed and destination is supported",
    }
