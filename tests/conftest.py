"""Fixtures for TaskTracker integration tests."""

from collections.abc import Generator
from typing import Any

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.tasktracker.const import DOMAIN


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(
    enable_custom_integrations: bool,
) -> Generator[None]:
    """Enable custom integrations defined in the test dir."""
    yield  # noqa: PT022


@pytest.fixture
def mock_config_entry() -> MockConfigEntry:
    """Create a mock config entry for testing."""
    return MockConfigEntry(
        domain=DOMAIN,
        data={
            "host": "https://test.example.com",
            "api_key": "test-api-key",
            "users": [
                {"ha_user_id": "test-user-1", "tasktracker_username": "testuser1"}
            ],
        },
        entry_id="test",
        title="TaskTracker Test",
    )


@pytest.fixture
def mock_api_response() -> dict[str, Any]:
    """Mock API response data."""
    return {
        "status": "success",
        "message": "Operation completed",
        "data": {"task_id": 123, "name": "Test Task", "completed": True},
    }
