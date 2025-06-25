"""Test TaskTracker intent handlers."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from homeassistant.helpers.intent import IntentResponse

from custom_components.tasktracker.const import DOMAIN
from custom_components.tasktracker.intents import (
    INTENT_HANDLERS,
    AddAdHocTaskIntentHandler,
    AddLeftoverIntentHandler,
    CompleteTaskIntentHandler,
    GetRecommendedTasksForPersonAndTimeIntentHandler,
    GetRecommendedTasksForPersonIntentHandler,
    GetTaskDetailsIntentHandler,
    QueryTaskStatusIntentHandler,
    async_register_intents,
)


@pytest.fixture
def mock_hass() -> MagicMock:
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
    hass.bus = MagicMock()
    return hass


@pytest.fixture
def mock_intent_obj() -> MagicMock:
    """Mock intent object."""
    intent_obj = MagicMock()
    intent_obj.language = "en"
    intent_obj.slots = {}
    intent_obj.context = MagicMock()
    intent_obj.context.user_id = "test_user"
    return intent_obj


def get_speech_text(response: IntentResponse) -> str:
    """Extract speech text from IntentResponse."""
    if hasattr(response, "speech") and isinstance(response.speech, dict):
        return response.speech.get("plain", {}).get("speech", "")
    return str(response.speech) if hasattr(response, "speech") else ""


class TestIntentHandlers:
    """Test individual intent handlers."""

    async def test_add_leftover_intent_missing_name(
        self, mock_hass: MagicMock, mock_intent_obj: MagicMock
    ) -> None:
        """Test AddLeftover intent with missing leftover name."""
        handler = AddLeftoverIntentHandler(mock_hass)
        mock_intent_obj.slots = {}

        response = await handler.async_handle(mock_intent_obj)

        # Check that response contains expected message about missing name
        speech_text = get_speech_text(response)
        assert "Leftover name is required" in speech_text

    async def test_add_leftover_intent_success(
        self, mock_hass: MagicMock, mock_intent_obj: MagicMock
    ) -> None:
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
            "data": {},
        }

        response = await handler.async_handle(mock_intent_obj)

        # Verify API was called correctly
        api_mock.create_leftover.assert_called_once_with(
            name="pizza",
            assigned_to="john",
            shelf_life_days=3,
            days_ago=None,
        )
        speech_text = get_speech_text(response)
        assert "Pizza leftover added successfully" in speech_text
        # Verify event was fired
        mock_hass.bus.fire.assert_called_once()

    async def test_complete_task_intent_missing_name(
        self, mock_hass: MagicMock, mock_intent_obj: MagicMock
    ) -> None:
        """Test CompleteTask intent with missing task name."""
        handler = CompleteTaskIntentHandler(mock_hass)
        mock_intent_obj.slots = {}

        response = await handler.async_handle(mock_intent_obj)

        speech_text = get_speech_text(response)
        # The actual message depends on what's missing first - could be name or user
        assert "required" in speech_text

    async def test_complete_task_intent_success(
        self, mock_hass: MagicMock, mock_intent_obj: MagicMock
    ) -> None:
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
            "data": {},
        }

        response = await handler.async_handle(mock_intent_obj)

        api_mock.complete_task_by_name.assert_called_once_with(
            name="clean kitchen",
            completed_by="jane",
        )
        speech_text = get_speech_text(response)
        assert "Task clean kitchen completed successfully" in speech_text
        # Verify event was fired
        mock_hass.bus.fire.assert_called_once()

    async def test_add_adhoc_task_intent_success(
        self, mock_hass: MagicMock, mock_intent_obj: MagicMock
    ) -> None:
        """Test AddAdHocTask intent with successful creation."""
        handler = AddAdHocTaskIntentHandler(mock_hass)
        mock_intent_obj.slots = {
            "task_name": {"value": "organize closet"},
            "task_assigned_to": {"value": "bob"},
            "task_duration": {"value": "30"},
            "task_priority": {"value": "2"},
        }

        # Mock successful API response
        api_mock = mock_hass.data[DOMAIN]["test_entry"]["api"]
        api_mock.create_adhoc_task.return_value = {
            "success": True,
            "spoken_response": "Task Organize closet created successfully",
            "data": {},
        }

        response = await handler.async_handle(mock_intent_obj)

        api_mock.create_adhoc_task.assert_called_once_with(
            name="Organize closet",
            assigned_to="bob",
            duration_minutes=30,
            priority=2,
        )
        speech_text = get_speech_text(response)
        assert "Task Organize closet created successfully" in speech_text
        # Verify event was fired
        mock_hass.bus.fire.assert_called_once()

    async def test_query_task_status_intent_success(
        self, mock_hass: MagicMock, mock_intent_obj: MagicMock
    ) -> None:
        """Test QueryTaskStatus intent with successful query."""
        handler = QueryTaskStatusIntentHandler(mock_hass)
        mock_intent_obj.slots = {
            "task_name": {"value": "laundry"},
            "question_type": {"value": "status"},
        }

        # Mock successful API response
        api_mock = mock_hass.data[DOMAIN]["test_entry"]["api"]
        api_mock.query_task.return_value = {
            "success": True,
            "spoken_response": "The laundry task is in progress",
        }

        response = await handler.async_handle(mock_intent_obj)

        api_mock.query_task.assert_called_once_with(
            name="laundry",
            question_type="status",
        )
        speech_text = get_speech_text(response)
        assert "The laundry task is in progress" in speech_text

    async def test_get_task_details_intent_success(
        self, mock_hass: MagicMock, mock_intent_obj: MagicMock
    ) -> None:
        """Test GetTaskDetails intent (inherits from QueryTaskStatus)."""
        handler = GetTaskDetailsIntentHandler(mock_hass)
        mock_intent_obj.slots = {
            "task_name": {"value": "dishes"},
        }

        # Mock successful API response
        api_mock = mock_hass.data[DOMAIN]["test_entry"]["api"]
        api_mock.query_task.return_value = {
            "success": True,
            "spoken_response": "The dishes task takes 15 minutes",
        }

        response = await handler.async_handle(mock_intent_obj)

        api_mock.query_task.assert_called_once_with(
            name="dishes",
            question_type="general",
        )
        speech_text = get_speech_text(response)
        assert "The dishes task takes 15 minutes" in speech_text

    async def test_get_recommended_tasks_success(
        self, mock_hass: MagicMock, mock_intent_obj: MagicMock
    ) -> None:
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
        speech_text = get_speech_text(response)
        assert (
            "alice can work on: wash dishes, vacuum living room, water plants"
            in speech_text
        )

    async def test_get_recommended_tasks_with_time_success(
        self, mock_hass: MagicMock, mock_intent_obj: MagicMock
    ) -> None:
        """Test GetRecommendedTasksForPersonAndTime intent with successful response."""
        handler = GetRecommendedTasksForPersonAndTimeIntentHandler(mock_hass)
        mock_intent_obj.slots = {
            "person": {"value": "charlie"},
            "available_time": {"value": "45"},
        }

        # Mock successful API response
        api_mock = mock_hass.data[DOMAIN]["test_entry"]["api"]
        api_mock.get_recommended_tasks.return_value = {
            "success": True,
            "data": {
                "items": [
                    {"name": "quick cleanup"},
                    {"name": "sort mail"},
                ]
            },
        }

        response = await handler.async_handle(mock_intent_obj)

        api_mock.get_recommended_tasks.assert_called_once_with(
            assigned_to="charlie",
            available_minutes=45,
        )
        speech_text = get_speech_text(response)
        assert "charlie can work on: quick cleanup, sort mail" in speech_text

    async def test_api_not_available(self, mock_intent_obj: MagicMock) -> None:
        """Test intent handler when API is not available."""
        # Mock hass without API data
        hass_no_api = MagicMock()
        hass_no_api.data = {DOMAIN: {}}

        handler = AddLeftoverIntentHandler(hass_no_api)
        response = await handler.async_handle(mock_intent_obj)

        speech_text = get_speech_text(response)
        assert "TaskTracker API is not available" in speech_text

    async def test_api_error_handling(
        self, mock_hass: MagicMock, mock_intent_obj: MagicMock
    ) -> None:
        """Test intent handler error handling when API call fails."""
        handler = AddLeftoverIntentHandler(mock_hass)
        mock_intent_obj.slots = {
            "leftover_name": {"value": "pasta"},
            "leftover_assigned_to": {"value": "alice"},
        }

        # Mock API failure
        api_mock = mock_hass.data[DOMAIN]["test_entry"]["api"]
        api_mock.create_leftover.return_value = {
            "success": False,
            "message": "Database connection failed",
        }

        response = await handler.async_handle(mock_intent_obj)

        speech_text = get_speech_text(response)
        assert (
            "There was an error adding the leftover: Database connection failed"
            in speech_text
        )

    @patch("custom_components.tasktracker.intents.get_user_context")
    async def test_missing_user_context(
        self,
        mock_get_user_context: MagicMock,
        mock_hass: MagicMock,
        mock_intent_obj: MagicMock,
    ) -> None:
        """Test intent handler when user context is missing."""
        mock_get_user_context.return_value = None
        handler = CompleteTaskIntentHandler(mock_hass)
        mock_intent_obj.slots = {
            "task_name": {"value": "test task"},
        }

                # Mock the API to return success when called with Anonymous
        api_mock = mock_hass.data[DOMAIN]["test_entry"]["api"]
        api_mock.complete_task_by_name.return_value = {
            "success": True,
            "spoken_response": "Task completed successfully",
            "data": {},
        }

        response = await handler.async_handle(mock_intent_obj)

        # Should have called the API with "Anonymous" as fallback
        api_mock.complete_task_by_name.assert_called_once_with(
            name="test task",
            completed_by="Anonymous",
        )

        speech_text = get_speech_text(response)
        assert "Task completed successfully" in speech_text


class TestIntentRegistration:
    """Test intent registration functionality."""

    def test_intent_handlers_registry(self) -> None:
        """Test that all intent handlers are in the registry."""
        assert len(INTENT_HANDLERS) == 7

        # Check that all handlers have unique intent types
        intent_types = [handler.intent_type for handler in INTENT_HANDLERS]
        assert len(intent_types) == len(set(intent_types))

        # Check expected intent types are present
        expected_types = {
            "AddLeftover",
            "CompleteTask",
            "AddAdHocTask",
            "QueryTaskStatus",
            "GetTaskDetails",
            "GetRecommendedTasksForPerson",
            "GetRecommendedTasksForPersonAndTime",
        }
        assert set(intent_types) == expected_types

    async def test_async_register_intents(self, mock_hass: MagicMock) -> None:
        """Test that async_register_intents calls registration for all handlers."""
        with patch(
            "custom_components.tasktracker.intents.async_register"
        ) as mock_register:
            await async_register_intents(mock_hass)

            # Should register all 7 intent handlers
            assert mock_register.call_count == 7
