"""Test intent handlers for TaskTracker."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from homeassistant.helpers.intent import IntentResponse

from custom_components.tasktracker.const import DOMAIN
from custom_components.tasktracker.intents import (
    AddAdHocTaskIntentHandler,
    AddLeftoverIntentHandler,
    BaseTaskTrackerIntentHandler,
    CompleteTaskIntentHandler,
    GetRecommendedTasksForPersonAndTimeIntentHandler,
    GetRecommendedTasksForPersonIntentHandler,
    GetTaskDetailsIntentHandler,
    QueryTaskStatusIntentHandler,
)


@pytest.fixture
def mock_hass() -> MagicMock:
    """Create a mock Home Assistant instance."""
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
    """Create a mock intent object."""
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


class TestBaseTaskTrackerIntentHandler:
    """Test the base intent handler class."""

    def test_base_handler_initialization(self, mock_hass: MagicMock) -> None:
        """Test that base handler can be initialized."""
        handler = BaseTaskTrackerIntentHandler(mock_hass)
        assert handler.hass == mock_hass
        assert handler.intent_type == ""

    def test_get_api_success(self, mock_hass: MagicMock) -> None:
        """Test _get_api method returns API when available."""
        handler = BaseTaskTrackerIntentHandler(mock_hass)
        api = handler._get_api()  # noqa: SLF001
        assert api is not None
        assert api == mock_hass.data[DOMAIN]["test_entry"]["api"]

    def test_get_api_missing(self) -> None:
        """Test _get_api method returns None when API is not available."""
        hass_no_api = MagicMock()
        hass_no_api.data = {DOMAIN: {}}
        handler = BaseTaskTrackerIntentHandler(hass_no_api)
        api = handler._get_api()  # noqa: SLF001
        assert api is None

    async def test_async_handle_api_not_found(self, mock_intent_obj: MagicMock) -> None:
        """Test async_handle when API is not found."""
        hass_no_api = MagicMock()
        hass_no_api.data = {DOMAIN: {}}
        handler = BaseTaskTrackerIntentHandler(hass_no_api)

        response = await handler.async_handle(mock_intent_obj)

        assert isinstance(response, IntentResponse)
        speech_text = get_speech_text(response)
        assert "TaskTracker API is not available" in speech_text

    async def test_async_handle_exception_handling(
        self, mock_hass: MagicMock, mock_intent_obj: MagicMock
    ) -> None:
        """Test async_handle exception handling."""

        # Create a handler that raises an exception in _handle_intent
        class TestHandler(BaseTaskTrackerIntentHandler):
            intent_type = "TestIntent"

            async def _handle_intent(
                self, intent_obj: MagicMock, api: MagicMock
            ) -> None:
                err = "Test exception"
                raise ValueError(err)

        handler = TestHandler(mock_hass)
        response = await handler.async_handle(mock_intent_obj)

        assert isinstance(response, IntentResponse)
        speech_text = get_speech_text(response)
        assert "Error handling TestIntent: Test exception" in speech_text


class TestSpecificIntentHandlers:
    """Test specific intent handler implementations."""

    def test_handler_intent_types(self) -> None:
        """Test that each handler has the correct intent_type."""
        assert AddLeftoverIntentHandler.intent_type == "AddLeftover"
        assert CompleteTaskIntentHandler.intent_type == "CompleteTask"
        assert AddAdHocTaskIntentHandler.intent_type == "AddAdHocTask"
        assert QueryTaskStatusIntentHandler.intent_type == "QueryTaskStatus"
        assert GetTaskDetailsIntentHandler.intent_type == "GetTaskDetails"
        assert (
            GetRecommendedTasksForPersonIntentHandler.intent_type
            == "GetRecommendedTasksForPerson"
        )
        assert (
            GetRecommendedTasksForPersonAndTimeIntentHandler.intent_type
            == "GetRecommendedTasksForPersonAndTime"
        )

    async def test_add_leftover_handler_success(
        self, mock_hass: MagicMock, mock_intent_obj: MagicMock
    ) -> None:
        """Test AddLeftoverIntentHandler with successful creation."""
        handler = AddLeftoverIntentHandler(mock_hass)
        mock_intent_obj.slots = {
            "leftover_name": {"value": "spaghetti"},
            "leftover_assigned_to": {"value": "mike"},
        }

        # Mock successful API response
        api_mock = mock_hass.data[DOMAIN]["test_entry"]["api"]
        api_mock.create_leftover.return_value = {
            "success": True,
            "spoken_response": "Spaghetti leftover added successfully",
            "data": {},
        }

        response = await handler.async_handle(mock_intent_obj)

        assert isinstance(response, IntentResponse)
        api_mock.create_leftover.assert_called_once_with(
            name="spaghetti",
            assigned_users=["mike"],
            shelf_life_days=None,
            days_ago=None,
        )
        speech_text = get_speech_text(response)
        assert "Spaghetti leftover added successfully" in speech_text
        # Verify event was fired
        mock_hass.bus.fire.assert_called_once_with(
            "tasktracker_leftover_created",
            {
                "leftover_name": "spaghetti",
                "assigned_users": ["mike"],
                "shelf_life_days": None,
                "days_ago": None,
                "creation_data": {},
            },
        )

    async def test_complete_task_handler_success(
        self, mock_hass: MagicMock, mock_intent_obj: MagicMock
    ) -> None:
        """Test CompleteTaskIntentHandler with successful completion."""
        handler = CompleteTaskIntentHandler(mock_hass)
        mock_intent_obj.slots = {
            "task_name": {"value": "vacuum"},
            "task_completed_by": {"value": "sarah"},
        }

        # Mock successful API response
        api_mock = mock_hass.data[DOMAIN]["test_entry"]["api"]
        api_mock.complete_task_by_name.return_value = {
            "success": True,
            "spoken_response": "Task vacuum completed successfully",
            "data": {},
        }

        response = await handler.async_handle(mock_intent_obj)

        assert isinstance(response, IntentResponse)
        api_mock.complete_task_by_name.assert_called_once_with(
            name="vacuum",
            completed_by="sarah",
        )
        speech_text = get_speech_text(response)
        assert "Task vacuum completed successfully" in speech_text
        # Verify event was fired
        mock_hass.bus.fire.assert_called_once_with(
            "tasktracker_task_completed",
            {
                "task_name": "vacuum",
                "username": "sarah",
                "notes": None,
                "completion_data": {},
                "assigned_users": [],  # May be empty if task not found in coordinator
            },
        )

    async def test_add_adhoc_task_handler_success(
        self, mock_hass: MagicMock, mock_intent_obj: MagicMock
    ) -> None:
        """Test AddAdHocTaskIntentHandler with successful creation."""
        handler = AddAdHocTaskIntentHandler(mock_hass)
        mock_intent_obj.slots = {
            "task_name": {"value": "fix door"},
            "task_assigned_to": {"value": "tom"},
            "task_duration": {"value": "45"},
            "task_priority": {"value": "1"},
        }

        # Mock successful API response
        api_mock = mock_hass.data[DOMAIN]["test_entry"]["api"]
        api_mock.create_adhoc_task.return_value = {
            "success": True,
            "spoken_response": "Task Fix door created successfully",
            "data": {},
        }

        response = await handler.async_handle(mock_intent_obj)

        assert isinstance(response, IntentResponse)
        api_mock.create_adhoc_task.assert_called_once_with(
            name="Fix door",
            assigned_users=["tom"],
            duration_minutes=45,
            priority=1,
        )
        speech_text = get_speech_text(response)
        assert "Task Fix door created successfully" in speech_text
        # Verify event was fired
        mock_hass.bus.fire.assert_called_once()

    async def test_query_task_status_handler_success(
        self, mock_hass: MagicMock, mock_intent_obj: MagicMock
    ) -> None:
        """Test QueryTaskStatusIntentHandler with successful query."""
        handler = QueryTaskStatusIntentHandler(mock_hass)
        mock_intent_obj.slots = {
            "task_name": {"value": "cleaning"},
            "question_type": {"value": "progress"},
        }

        # Mock successful API response
        api_mock = mock_hass.data[DOMAIN]["test_entry"]["api"]
        api_mock.query_task.return_value = {
            "success": True,
            "spoken_response": "The cleaning task is 50% complete",
        }

        response = await handler.async_handle(mock_intent_obj)

        assert isinstance(response, IntentResponse)
        api_mock.query_task.assert_called_once_with(
            name="cleaning",
            question_type="progress",
        )
        speech_text = get_speech_text(response)
        assert "The cleaning task is 50% complete" in speech_text

    async def test_get_task_details_handler_inherits_query_logic(
        self, mock_hass: MagicMock, mock_intent_obj: MagicMock
    ) -> None:
        """Test GetTaskDetailsIntentHandler inherits QueryTaskStatus logic."""
        handler = GetTaskDetailsIntentHandler(mock_hass)
        mock_intent_obj.slots = {
            "task_name": {"value": "shopping"},
        }

        # Mock successful API response
        api_mock = mock_hass.data[DOMAIN]["test_entry"]["api"]
        api_mock.query_task.return_value = {
            "success": True,
            "spoken_response": "The shopping task takes 30 minutes",
        }

        response = await handler.async_handle(mock_intent_obj)

        assert isinstance(response, IntentResponse)
        # Should use "general" as default question_type
        api_mock.query_task.assert_called_once_with(
            name="shopping",
            question_type="general",
        )
        speech_text = get_speech_text(response)
        assert "The shopping task takes 30 minutes" in speech_text

    async def test_get_recommended_tasks_handler_success(
        self, mock_hass: MagicMock, mock_intent_obj: MagicMock
    ) -> None:
        """Test GetRecommendedTasksForPersonIntentHandler with successful response."""
        handler = GetRecommendedTasksForPersonIntentHandler(mock_hass)
        mock_intent_obj.slots = {
            "person": {"value": "david"},
        }

        # Mock successful API response
        api_mock = mock_hass.data[DOMAIN]["test_entry"]["api"]
        api_mock.get_recommended_tasks.return_value = {
            "success": True,
            "data": {
                "items": [
                    {"name": "organize desk"},
                    {"name": "call mom"},
                ]
            },
        }

        response = await handler.async_handle(mock_intent_obj)

        assert isinstance(response, IntentResponse)
        api_mock.get_recommended_tasks.assert_called_once_with(
            username="david",
            available_minutes=60,
        )
        speech_text = get_speech_text(response)
        assert "david can work on: organize desk, call mom" in speech_text

    async def test_get_recommended_tasks_with_time_handler_success(
        self, mock_hass: MagicMock, mock_intent_obj: MagicMock
    ) -> None:
        """Test GetRecommendedTasksForPersonAndTimeIntentHandler with successful response."""  # noqa: E501
        handler = GetRecommendedTasksForPersonAndTimeIntentHandler(mock_hass)
        mock_intent_obj.slots = {
            "person": {"value": "emma"},
            "available_time": {"value": "20"},
        }

        # Mock successful API response
        api_mock = mock_hass.data[DOMAIN]["test_entry"]["api"]
        api_mock.get_recommended_tasks.return_value = {
            "success": True,
            "data": {
                "items": [
                    {"name": "quick tidy"},
                ]
            },
        }

        response = await handler.async_handle(mock_intent_obj)

        assert isinstance(response, IntentResponse)
        api_mock.get_recommended_tasks.assert_called_once_with(
            username="emma",
            available_minutes=20,
        )
        speech_text = get_speech_text(response)
        assert "emma can work on: quick tidy" in speech_text

    @patch("custom_components.tasktracker.intents.get_user_context")
    async def test_handler_uses_user_context_fallback(
        self,
        mock_get_user_context: MagicMock,
        mock_hass: MagicMock,
        mock_intent_obj: MagicMock,
    ) -> None:
        """Test that handlers fall back to user context when slots are missing."""
        mock_get_user_context.return_value = "context_user"

        handler = CompleteTaskIntentHandler(mock_hass)
        mock_intent_obj.slots = {
            "task_name": {"value": "test task"},
            # task_completed_by is missing, should use user context
        }

        # Mock successful API response
        api_mock = mock_hass.data[DOMAIN]["test_entry"]["api"]
        api_mock.complete_task_by_name.return_value = {
            "success": True,
            "spoken_response": "Task completed",
            "data": {},
        }

        await handler.async_handle(mock_intent_obj)

        # Should use the user context value
        api_mock.complete_task_by_name.assert_called_once_with(
            name="test task",
            completed_by="context_user",
        )
        mock_get_user_context.assert_called_once_with(mock_hass, "test_user")

    async def test_handler_api_error_response(
        self, mock_hass: MagicMock, mock_intent_obj: MagicMock
    ) -> None:
        """Test handler response when API returns error."""
        handler = AddLeftoverIntentHandler(mock_hass)
        mock_intent_obj.slots = {
            "leftover_name": {"value": "bread"},
            "leftover_assigned_to": {"value": "user"},
        }

        # Mock API error response
        api_mock = mock_hass.data[DOMAIN]["test_entry"]["api"]
        api_mock.create_leftover.return_value = {
            "success": False,
            "message": "Network error occurred",
        }

        response = await handler.async_handle(mock_intent_obj)

        assert isinstance(response, IntentResponse)
        speech_text = get_speech_text(response)
        assert (
            "There was an error adding the leftover: Network error occurred"
            in speech_text
        )


class TestAddLeftoverDaysAgoParser:
    """Test the days_ago parsing logic in AddLeftoverIntentHandler."""

    def test_parse_yesterday(self, mock_hass: MagicMock) -> None:
        """Test parsing 'yesterday' returns 1."""
        handler = AddLeftoverIntentHandler(mock_hass)
        assert handler._parse_days_ago("yesterday") == 1  # noqa: SLF001
        assert handler._parse_days_ago("Yesterday") == 1  # noqa: SLF001
        assert handler._parse_days_ago("YESTERDAY") == 1  # noqa: SLF001

    def test_parse_numeric_values(self, mock_hass: MagicMock) -> None:
        """Test parsing numeric string values."""
        handler = AddLeftoverIntentHandler(mock_hass)
        assert handler._parse_days_ago("1") == 1  # noqa: SLF001
        assert handler._parse_days_ago("2") == 2  # noqa: SLF001
        assert handler._parse_days_ago("7") == 7  # noqa: SLF001
        assert handler._parse_days_ago("14") == 14  # noqa: SLF001

    def test_parse_word_numbers(self, mock_hass: MagicMock) -> None:
        """Test parsing spelled-out number words."""
        handler = AddLeftoverIntentHandler(mock_hass)
        assert handler._parse_days_ago("one") == 1  # noqa: SLF001
        assert handler._parse_days_ago("two") == 2  # noqa: SLF001
        assert handler._parse_days_ago("three") == 3  # noqa: SLF001
        assert handler._parse_days_ago("five") == 5  # noqa: SLF001
        assert handler._parse_days_ago("ten") == 10  # noqa: SLF001
        assert handler._parse_days_ago("fourteen") == 14  # noqa: SLF001

    def test_parse_word_numbers_case_insensitive(self, mock_hass: MagicMock) -> None:
        """Test parsing spelled-out numbers is case insensitive."""
        handler = AddLeftoverIntentHandler(mock_hass)
        assert handler._parse_days_ago("Two") == 2  # noqa: SLF001
        assert handler._parse_days_ago("THREE") == 3  # noqa: SLF001
        assert handler._parse_days_ago("FiVe") == 5  # noqa: SLF001

    def test_parse_empty_or_none(self, mock_hass: MagicMock) -> None:
        """Test parsing empty or None values."""
        handler = AddLeftoverIntentHandler(mock_hass)
        assert handler._parse_days_ago("") is None  # noqa: SLF001
        assert handler._parse_days_ago(None) is None  # noqa: SLF001

    def test_parse_unknown_word(self, mock_hass: MagicMock) -> None:
        """Test parsing unknown word returns None."""
        handler = AddLeftoverIntentHandler(mock_hass)
        assert handler._parse_days_ago("fifteen") is None  # noqa: SLF001
        assert handler._parse_days_ago("unknown") is None  # noqa: SLF001

    def test_parse_dict_value(self, mock_hass: MagicMock) -> None:
        """Test parsing dict values (from static slot values)."""
        handler = AddLeftoverIntentHandler(mock_hass)
        # Dict with value key (from static YAML slot values)
        assert handler._parse_days_ago({"value": "yesterday"}) == 1  # noqa: SLF001
        assert handler._parse_days_ago({"value": "2"}) == 2  # noqa: SLF001
        assert handler._parse_days_ago({"value": "three"}) == 3  # noqa: SLF001
        # Empty dict or dict without value
        assert handler._parse_days_ago({}) is None  # noqa: SLF001
        assert handler._parse_days_ago({"other": "key"}) is None  # noqa: SLF001

    def test_parse_integer_values(self, mock_hass: MagicMock) -> None:
        """Test parsing integer values (Home Assistant NLP conversion)."""
        handler = AddLeftoverIntentHandler(mock_hass)
        # Home Assistant may convert "two" to 2 (int)
        assert handler._parse_days_ago(1) == 1  # noqa: SLF001
        assert handler._parse_days_ago(2) == 2  # noqa: SLF001
        assert handler._parse_days_ago(7) == 7  # noqa: SLF001
        assert handler._parse_days_ago(14) == 14  # noqa: SLF001

    def test_parse_float_values(self, mock_hass: MagicMock) -> None:
        """Test parsing float values (Home Assistant NLP conversion)."""
        handler = AddLeftoverIntentHandler(mock_hass)
        assert handler._parse_days_ago(2.0) == 2  # noqa: SLF001
        assert handler._parse_days_ago(3.0) == 3  # noqa: SLF001
        assert handler._parse_days_ago(5.5) == 5  # noqa: SLF001

    def test_parse_nested_dict_with_int(self, mock_hass: MagicMock) -> None:
        """Test parsing dict containing integer value."""
        handler = AddLeftoverIntentHandler(mock_hass)
        # Dict with integer value (NLP converted)
        assert handler._parse_days_ago({"value": 2}) == 2  # noqa: SLF001
        assert handler._parse_days_ago({"value": 5}) == 5  # noqa: SLF001

    def test_parse_nested_dict_with_float(self, mock_hass: MagicMock) -> None:
        """Test parsing dict containing float value."""
        handler = AddLeftoverIntentHandler(mock_hass)
        assert handler._parse_days_ago({"value": 2.0}) == 2  # noqa: SLF001
        assert handler._parse_days_ago({"value": 3.5}) == 3  # noqa: SLF001

    def test_parse_empty_string(self, mock_hass: MagicMock) -> None:
        """Test parsing empty or whitespace strings."""
        handler = AddLeftoverIntentHandler(mock_hass)
        assert handler._parse_days_ago("") is None  # noqa: SLF001
        assert handler._parse_days_ago("   ") is None  # noqa: SLF001
        assert handler._parse_days_ago("\t\n") is None  # noqa: SLF001

    def test_parse_invalid_types(self, mock_hass: MagicMock) -> None:
        """Test parsing invalid or unexpected types."""
        handler = AddLeftoverIntentHandler(mock_hass)
        # These should return None gracefully
        assert handler._parse_days_ago([]) is None  # noqa: SLF001
        assert handler._parse_days_ago(True) is None  # noqa: SLF001
        assert handler._parse_days_ago(object()) is None  # noqa: SLF001

    async def test_add_leftover_with_yesterday(
        self, mock_hass: MagicMock, mock_intent_obj: MagicMock
    ) -> None:
        """Test AddLeftover intent with 'yesterday' days_ago value."""
        handler = AddLeftoverIntentHandler(mock_hass)
        mock_intent_obj.slots = {
            "leftover_name": {"value": "chicken"},
            "leftover_assigned_to": {"value": "alice"},
            "days_ago": {"value": "yesterday"},
        }

        # Mock successful API response
        api_mock = mock_hass.data[DOMAIN]["test_entry"]["api"]
        api_mock.create_leftover.return_value = {
            "success": True,
            "spoken_response": "Chicken leftover added successfully",
            "data": {},
        }

        response = await handler.async_handle(mock_intent_obj)

        assert isinstance(response, IntentResponse)
        api_mock.create_leftover.assert_called_once_with(
            name="chicken",
            assigned_users=["alice"],
            shelf_life_days=None,
            days_ago=1,  # yesterday should be converted to 1
        )

    async def test_add_leftover_with_word_number(
        self, mock_hass: MagicMock, mock_intent_obj: MagicMock
    ) -> None:
        """Test AddLeftover intent with spelled-out number days_ago value."""
        handler = AddLeftoverIntentHandler(mock_hass)
        mock_intent_obj.slots = {
            "leftover_name": {"value": "pizza"},
            "leftover_assigned_to": {"value": "bob"},
            "days_ago": {"value": "three"},
        }

        # Mock successful API response
        api_mock = mock_hass.data[DOMAIN]["test_entry"]["api"]
        api_mock.create_leftover.return_value = {
            "success": True,
            "spoken_response": "Pizza leftover added successfully",
            "data": {},
        }

        response = await handler.async_handle(mock_intent_obj)

        assert isinstance(response, IntentResponse)
        api_mock.create_leftover.assert_called_once_with(
            name="pizza",
            assigned_users=["bob"],
            shelf_life_days=None,
            days_ago=3,  # "three" should be converted to 3
        )

    async def test_add_leftover_with_numeric_days_ago(
        self, mock_hass: MagicMock, mock_intent_obj: MagicMock
    ) -> None:
        """Test AddLeftover intent with numeric days_ago value."""
        handler = AddLeftoverIntentHandler(mock_hass)
        mock_intent_obj.slots = {
            "leftover_name": {"value": "soup"},
            "leftover_assigned_to": {"value": "charlie"},
            "days_ago": {"value": "5"},
        }

        # Mock successful API response
        api_mock = mock_hass.data[DOMAIN]["test_entry"]["api"]
        api_mock.create_leftover.return_value = {
            "success": True,
            "spoken_response": "Soup leftover added successfully",
            "data": {},
        }

        response = await handler.async_handle(mock_intent_obj)

        assert isinstance(response, IntentResponse)
        api_mock.create_leftover.assert_called_once_with(
            name="soup",
            assigned_users=["charlie"],
            shelf_life_days=None,
            days_ago=5,  # numeric value should be preserved
        )
