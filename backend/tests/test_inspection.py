import json
from types import SimpleNamespace
from typing import Callable
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient
from google.genai import errors

from app import main
from app.services import vision


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("GEMINI_API_KEY", "test-api-key")
    monkeypatch.delenv("GEMINI_MODEL", raising=False)
    return TestClient(main.app)


@pytest.mark.parametrize(
    (
        "model_result",
        "expected_tracking",
        "expected_destination",
        "expected_city",
        "expected_country",
        "expected_issues",
    ),
    [
        (
            {
                "tracking_number": "1Z999AA10123456784",
                "destination": "Portland, OR, USA",
                "destination_city": "Portland",
                "destination_country": "USA",
                "issues": [],
            },
            "1Z999AA10123456784",
            "Portland, OR, USA",
            "Portland",
            "USA",
            [],
        ),
        (
            {
                "tracking_number": None,
                "destination": "Portland, OR, USA",
                "destination_city": None,
                "destination_country": "USA",
                "issues": ["LABEL_BLURRED"],
            },
            None,
            "Portland, OR, USA",
            None,
            "USA",
            ["LABEL_BLURRED"],
        ),
        (
            {
                "tracking_number": None,
                "destination": "Portland, OR, USA",
                "destination_city": "Portland",
                "destination_country": "USA",
                "issues": ["LABEL_UNREADABLE"],
            },
            None,
            "Portland, OR, USA",
            "Portland",
            "USA",
            ["LABEL_UNREADABLE"],
        ),
        (
            {
                "tracking_number": None,
                "destination": "Portland, OR, USA",
                "destination_city": "Portland",
                "destination_country": "USA",
                "issues": ["TRACKING_NUMBER_MISSING"],
            },
            None,
            "Portland, OR, USA",
            "Portland",
            "USA",
            ["TRACKING_NUMBER_MISSING"],
        ),
        (
            {
                "tracking_number": "1Z999AA10123456784",
                "destination": None,
                "destination_city": None,
                "destination_country": None,
                "issues": ["DESTINATION_MISSING"],
            },
            "1Z999AA10123456784",
            None,
            None,
            None,
            ["DESTINATION_MISSING"],
        ),
        (
            {
                "tracking_number": None,
                "destination": None,
                "destination_city": None,
                "destination_country": None,
                "issues": ["LABEL_NOT_FOUND"],
            },
            None,
            None,
            None,
            None,
            ["LABEL_NOT_FOUND"],
        ),
    ],
    ids=[
        "valid-label",
        "blurry-label",
        "partially-unreadable-label",
        "missing-tracking-number",
        "missing-destination",
        "non-shipping-label-image",
    ],
)
def test_analyze_endpoint_returns_structured_label_analysis(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    model_result: dict[str, object],
    expected_tracking: str | None,
    expected_destination: str | None,
    expected_city: str | None,
    expected_country: str | None,
    expected_issues: list[str],
) -> None:
    generate_content = AsyncMock(
        return_value=SimpleNamespace(text=json.dumps(model_result))
    )

    class MockAsyncClient:
        models = SimpleNamespace(generate_content=generate_content)

        async def __aenter__(self) -> "MockAsyncClient":
            return self

        async def __aexit__(self, *args: object) -> None:
            return None

    monkeypatch.setattr(
        vision.genai,
        "Client",
        lambda **kwargs: SimpleNamespace(aio=MockAsyncClient()),
    )

    response = client.post(
        "/inspection/analyze",
        files={"image": ("label.jpg", b"\xff\xd8\xfftest-image", "image/jpeg")},
    )

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {
        "package_id",
        "tracking_number",
        "destination",
        "destination_city",
        "destination_country",
        "issues",
        "confidence",
        "decision",
    }
    assert body["tracking_number"] == expected_tracking
    assert body["destination"] == expected_destination
    assert body["destination_city"] == expected_city
    assert body["destination_country"] == expected_country
    assert body["issues"] == expected_issues
    assert body["confidence"] is None
    assert body["decision"]["action"] == "MANUAL_REVIEW"
    assert body["decision"]["lane"] == "REVIEW"
    assert generate_content.await_count == 1
    request = generate_content.await_args.kwargs
    assert request["model"] == "gemini-3.8-flash"
    assert request["contents"][0].inline_data.mime_type == "image/jpeg"
    assert request["contents"][0].inline_data.data == b"\xff\xd8\xfftest-image"
    config = request["config"]
    assert config.response_mime_type == "application/json"
    schema = config.response_schema.model_dump(exclude_unset=True, by_alias=True)
    assert schema["type"] == "OBJECT"
    assert schema["properties"]["tracking_number"]["nullable"] is True
    assert schema["properties"]["destination"]["nullable"] is True
    assert schema["properties"]["destination_city"]["nullable"] is True
    assert schema["properties"]["destination_country"]["nullable"] is True
    assert "additionalProperties" not in schema
    assert "anyOf" not in json.dumps(schema)
    prompt = request["contents"][1]
    assert "Never guess, infer, complete, or invent" in prompt
    assert "Return null for each field" in prompt
    assert "do not flag them as mismatched solely because their formats differ" in prompt
    assert "include LABEL_NOT_FOUND" in prompt
    assert "Include LABEL_UNREADABLE" in prompt
    assert "report only observable problems" in prompt


def test_analyze_endpoint_uses_configured_gemini_model(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("GEMINI_MODEL", "configured-gemini-model")
    generate_content = AsyncMock(
        return_value=SimpleNamespace(
            text=json.dumps(
                {
                    "tracking_number": None,
                    "destination": None,
                    "destination_city": None,
                    "destination_country": None,
                    "issues": [],
                }
            )
        )
    )

    class MockAsyncClient:
        models = SimpleNamespace(generate_content=generate_content)

        async def __aenter__(self) -> "MockAsyncClient":
            return self

        async def __aexit__(self, *args: object) -> None:
            return None

    monkeypatch.setattr(
        vision.genai,
        "Client",
        lambda **kwargs: SimpleNamespace(aio=MockAsyncClient()),
    )

    response = client.post(
        "/inspection/analyze",
        files={"image": ("label.jpg", b"\xff\xd8\xfftest-image", "image/jpeg")},
    )

    assert response.status_code == 200
    assert generate_content.await_args.kwargs["model"] == "configured-gemini-model"


def test_analyze_endpoint_sends_ai_failures_to_manual_review(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fail_analysis(image: bytes, mime_type: str) -> vision.LabelAnalysis:
        raise vision.VisionAnalysisError("unavailable")

    monkeypatch.setattr(vision, "analyze_label", fail_analysis)

    response = client.post(
        "/inspection/analyze",
        files={"image": ("label.jpg", b"\xff\xd8\xfftest-image", "image/jpeg")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["tracking_number"] is None
    assert body["destination"] is None
    assert body["destination_city"] is None
    assert body["destination_country"] is None
    assert body["issues"] == ["AI_ANALYSIS_UNAVAILABLE"]
    assert body["decision"]["action"] == "MANUAL_REVIEW"


@pytest.mark.parametrize(
    "failure_factory",
    [
        lambda: errors.APIError(
            code=403,
            response_json={"error": {"message": "test-api-key must not be exposed"}},
        ),
        lambda: TimeoutError("test-api-key must not be exposed"),
    ],
    ids=["invalid-api-key", "timeout"],
)
def test_upstream_failures_do_not_expose_secrets(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    failure_factory: Callable[[], Exception],
) -> None:
    generate_content = AsyncMock(side_effect=failure_factory())

    class MockAsyncClient:
        models = SimpleNamespace(generate_content=generate_content)

        async def __aenter__(self) -> "MockAsyncClient":
            return self

        async def __aexit__(self, *args: object) -> None:
            return None

    monkeypatch.setattr(
        vision.genai,
        "Client",
        lambda **kwargs: SimpleNamespace(aio=MockAsyncClient()),
    )

    response = client.post(
        "/inspection/analyze",
        files={"image": ("label.jpg", b"\xff\xd8\xfftest-image", "image/jpeg")},
    )

    assert response.status_code == 200
    assert "test-api-key" not in response.text
    assert response.json()["issues"] == ["AI_ANALYSIS_UNAVAILABLE"]
    assert response.json()["decision"]["action"] == "MANUAL_REVIEW"


def test_bad_gemini_request_logs_sanitized_error_and_uses_manual_review(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    generate_content = AsyncMock(
        side_effect=errors.APIError(
            code=400,
            response_json={
                "error": {
                    "code": 400,
                    "message": (
                        "Invalid response schema; test-api-key must not be exposed"
                    ),
                }
            },
        )
    )

    class MockAsyncClient:
        models = SimpleNamespace(generate_content=generate_content)

        async def __aenter__(self) -> "MockAsyncClient":
            return self

        async def __aexit__(self, *args: object) -> None:
            return None

    monkeypatch.setattr(
        vision.genai,
        "Client",
        lambda **kwargs: SimpleNamespace(aio=MockAsyncClient()),
    )

    with caplog.at_level("WARNING", logger=vision.__name__):
        response = client.post(
            "/inspection/analyze",
            files={"image": ("label.jpg", b"\xff\xd8\xfftest-image", "image/jpeg")},
        )

    assert response.status_code == 200
    assert response.json()["issues"] == ["AI_ANALYSIS_UNAVAILABLE"]
    assert response.json()["decision"]["action"] == "MANUAL_REVIEW"
    assert "400" in caplog.text
    assert "Invalid response schema" in caplog.text
    assert "test-api-key" not in caplog.text
