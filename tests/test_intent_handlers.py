"""Test intent handlers for TaskTracker."""

import pytest
from unittest.mock import Mock, AsyncMock
from homeassistant.core import HomeAssistant
from homeassistant.helpers.intent import IntentResponse

from custom_components.tasktracker import TaskTrackerIntentHandler
from custom_components.tasktracker.api import TaskTrackerAPI


@pytest.fixture
def mock_hass():
    """Create a mock Home Assistant instance."""
    hass = Mock(spec=HomeAssistant)
    hass.data = {
        "tasktracker": {
            "test_entry": {
                "api": Mock(spec=TaskTrackerAPI),
                "config": {},
            }
        }
    }
    return hass


@pytest.fixture
def mock_intent_obj():
    """Create a mock intent object."""
    intent_obj = Mock()
    intent_obj.language = "en"
    intent_obj.slots = {}
    return intent_obj


def test_intent_handler_initialization(mock_hass):
    """Test that intent handler can be initialized."""
    handler = TaskTrackerIntentHandler(mock_hass, "AddLeftover")
    assert handler.hass == mock_hass
    assert handler.intent_type == "AddLeftover"


@pytest.mark.asyncio
async def test_add_leftover_intent(mock_hass, mock_intent_obj):
    """Test AddLeftover intent handling."""
    # Setup
    handler = TaskTrackerIntentHandler(mock_hass, "AddLeftover")
    mock_intent_obj.slots = {"leftover_name": {"value": "pizza"}}

    # Mock API response
    api_mock = mock_hass.data["tasktracker"]["test_entry"]["api"]
    api_mock.create_leftover = AsyncMock(
        return_value={
            "status": 200,
            "content": {"message": "Leftover created successfully"},
        }
    )

    # Execute
    response = await handler.async_handle(mock_intent_obj)

    # Verify
    assert isinstance(response, IntentResponse)
    api_mock.create_leftover.assert_called_once()


@pytest.mark.asyncio
async def test_unknown_intent_type(mock_hass, mock_intent_obj):
    """Test handling of unknown intent types."""
    handler = TaskTrackerIntentHandler(mock_hass, "UnknownIntent")

    response = await handler.async_handle(mock_intent_obj)

    assert isinstance(response, IntentResponse)


@pytest.mark.asyncio
async def test_missing_api(mock_intent_obj):
    """Test handling when API is not available."""
    hass = Mock(spec=HomeAssistant)
    hass.data = {}

    handler = TaskTrackerIntentHandler(hass, "AddLeftover")

    response = await handler.async_handle(mock_intent_obj)

    assert isinstance(response, IntentResponse)
