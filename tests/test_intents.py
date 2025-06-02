"""Test TaskTracker intent handlers."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from custom_components.tasktracker.intents import (
    AddLeftoverIntentHandler,
    CompleteTaskIntentHandler,
    AddAdHocTaskIntentHandler,
    QueryTaskStatusIntentHandler,
    GetRecommendedTasksForPersonIntentHandler,
    async_register_intents,
    INTENT_HANDLERS,
)
from custom_components.tasktracker.const import DOMAIN


@pytest.fixture
def mock_hass():
    """Mock Home Assistant."""
    hass = MagicMock()
    hass.data = {
        DOMAIN: {
            "test_entry": {
                "api": AsyncMock(),
                "config": {},
            }
        }
    }
    return hass


@pytest.fixture
def mock_intent_obj():
    """Mock intent object."""
    intent_obj = MagicMock()
    intent_obj.language = "en"
    intent_obj.slots = {}
    return intent_obj


class TestIntentHandlers:
    """Test individual intent handlers."""

    async def test_add_leftover_intent_missing_name(self, mock_hass, mock_intent_obj):
        """Test AddLeftover intent with missing leftover name."""
        handler = AddLeftoverIntentHandler(mock_hass)
        mock_intent_obj.slots = {}

        response = await handler.async_handle(mock_intent_obj)

        # Check that response contains expected message
        assert hasattr(response, "speech")

    async def test_add_leftover_intent_success(self, mock_hass, mock_intent_obj):
        """Test AddLeftover intent with successful creation."""
        handler = AddLeftoverIntentHandler(mock_hass)
        mock_intent_obj.slots = {
            "leftover_name": {"value": "pizza"},
            "leftover_assigned_to": {"value": "john"},
            "leftover_shelf_life": {"value": "3"},
        }

        # Mock successful API response
        api_mock = mock_hass.data[DOMAIN]["test_entry"]["api"]
        api_mock.create_leftover.return_value = {
            "success": True,
            "spoken_response": "Pizza leftover added successfully",
        }

        response = await handler.async_handle(mock_intent_obj)

        # Verify API was called correctly
        api_mock.create_leftover.assert_called_once_with(
            name="pizza",
            assigned_to="john",
            shelf_life_days=3,
            days_ago=None,
        )
        assert hasattr(response, "speech")

    async def test_complete_task_intent_missing_name(self, mock_hass, mock_intent_obj):
        """Test CompleteTask intent with missing task name."""
        handler = CompleteTaskIntentHandler(mock_hass)
        mock_intent_obj.slots = {}

        response = await handler.async_handle(mock_intent_obj)

        assert hasattr(response, "speech")

    async def test_complete_task_intent_success(self, mock_hass, mock_intent_obj):
        """Test CompleteTask intent with successful completion."""
        handler = CompleteTaskIntentHandler(mock_hass)
        mock_intent_obj.slots = {
            "task_name": {"value": "clean kitchen"},
            "task_completed_by": {"value": "jane"},
        }

        # Mock successful API response
        api_mock = mock_hass.data[DOMAIN]["test_entry"]["api"]
        api_mock.complete_task_by_name.return_value = {
            "success": True,
            "spoken_response": "Task clean kitchen completed successfully",
        }

        response = await handler.async_handle(mock_intent_obj)

        api_mock.complete_task_by_name.assert_called_once_with(
            name="clean kitchen",
            assigned_to="jane",
        )
        assert hasattr(response, "speech")

    async def test_get_recommended_tasks_success(self, mock_hass, mock_intent_obj):
        """Test GetRecommendedTasksForPerson intent with successful response."""
        handler = GetRecommendedTasksForPersonIntentHandler(mock_hass)
        mock_intent_obj.slots = {
            "person": {"value": "alice"},
        }

        # Mock successful API response
        api_mock = mock_hass.data[DOMAIN]["test_entry"]["api"]
        api_mock.get_recommended_tasks.return_value = {
            "success": True,
            "data": {
                "items": [
                    {"name": "wash dishes"},
                    {"name": "vacuum living room"},
                    {"name": "water plants"},
                ]
            },
        }

        response = await handler.async_handle(mock_intent_obj)

        api_mock.get_recommended_tasks.assert_called_once_with(
            assigned_to="alice",
            available_minutes=60,
        )
        assert hasattr(response, "speech")

    async def test_api_not_available(self, mock_intent_obj):
        """Test intent handler when API is not available."""
        # Mock hass without API data
        hass_no_api = MagicMock()
        hass_no_api.data = {DOMAIN: {}}

        handler = AddLeftoverIntentHandler(hass_no_api)
        response = await handler.async_handle(mock_intent_obj)

        assert hasattr(response, "speech")


class TestIntentRegistration:
    """Test intent registration functionality."""

    def test_intent_handlers_registry(self):
        """Test that all intent handlers are in the registry."""
        assert len(INTENT_HANDLERS) == 7

        # Check that all handlers have unique intent types
        intent_types = [handler.intent_type for handler in INTENT_HANDLERS]
        assert len(intent_types) == len(set(intent_types))

    async def test_async_register_intents(self, mock_hass):
        """Test that async_register_intents calls registration for all handlers."""
        with patch(
            "custom_components.tasktracker.intents.async_register"
        ) as mock_register:
            await async_register_intents(mock_hass)

            # Should register all 7 intent handlers
            assert mock_register.call_count == 7
