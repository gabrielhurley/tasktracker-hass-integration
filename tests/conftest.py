"""Fixtures for TaskTracker integration tests."""

from collections.abc import Generator
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.tasktracker.const import DOMAIN


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(
    enable_custom_integrations: bool,
) -> Generator[None]:
    """Enable custom integrations defined in the test dir."""
    yield  # noqa: PT022


@pytest.fixture(autouse=True)
def mock_conversation_dependency():
    """Mock the conversation component to prevent test failures."""
    with patch("homeassistant.setup.async_setup_component") as mock_setup:
        # Mock successful setup for conversation component
        async def setup_side_effect(hass, domain, config):
            if domain == "conversation":
                # Mock successful conversation setup
                return True
            # Call the original function for other components
            return await mock_setup.__wrapped__(hass, domain, config)

        mock_setup.side_effect = setup_side_effect
        yield mock_setup


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
