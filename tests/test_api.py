"""Tests for TaskTracker API client."""

from unittest.mock import AsyncMock

import pytest
from aiohttp import ClientError, ClientSession

from custom_components.tasktracker.api import TaskTrackerAPI, TaskTrackerAPIError


class TestTaskTrackerAPI:
    """Test TaskTracker API client."""

    @pytest.fixture
    def api_client(self) -> TaskTrackerAPI:
        """Create API client for testing."""
        session = AsyncMock(spec=ClientSession)
        return TaskTrackerAPI(
            session=session, host="https://test.example.com", api_key="test-api-key"
        )

    def test_headers_formation(self, api_client: TaskTrackerAPI) -> None:
        """Test that headers are correctly formed."""
        headers = api_client._get_headers()  # noqa: SLF001
        assert headers["X-API-Key"] == "test-api-key"
        assert headers["Content-Type"] == "application/json"

    @pytest.mark.asyncio
    async def test_complete_task_success(self, api_client: TaskTrackerAPI) -> None:
        """Test successful task completion."""
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json.return_value = {
            "status": "success",
            "message": "Task completed",
            "data": {"task_id": 123, "completed": True},
        }

        api_client.session.request.return_value.__aenter__.return_value = mock_response

        result = await api_client.complete_task(
            task_id=123, username="testuser", notes="Test completion"
        )

        assert result["status"] == "success"
        assert result["data"]["task_id"] == 123

        # Verify the request was made correctly
        api_client.session.request.assert_called_once_with(
            "POST",
            "https://test.example.com/api/complete-task/",
            headers={"X-API-Key": "test-api-key", "Content-Type": "application/json"},
            params=None,
            json={"task_id": 123, "username": "testuser", "notes": "Test completion"},
        )

    @pytest.mark.asyncio
    async def test_complete_task_by_name_success(
        self, api_client: TaskTrackerAPI
    ) -> None:
        """Test successful task completion by name."""
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json.return_value = {
            "status": "success",
            "message": "Task completed",
            "data": {"name": "trash", "completed": True},
        }

        api_client.session.request.return_value.__aenter__.return_value = mock_response

        result = await api_client.complete_task_by_name(
            name="trash", username="testuser"
        )

        assert result["status"] == "success"
        assert result["data"]["name"] == "trash"

    @pytest.mark.asyncio
    async def test_create_leftover_success(self, api_client: TaskTrackerAPI) -> None:
        """Test successful leftover creation."""
        mock_response = AsyncMock()
        mock_response.status = 201
        mock_response.json.return_value = {
            "status": "success",
            "message": "Leftover created",
            "data": {"id": 456, "name": "pizza"},
        }

        api_client.session.request.return_value.__aenter__.return_value = mock_response

        result = await api_client.create_leftover(
            name="pizza", assigned_to="testuser", shelf_life_days=3
        )

        assert result["status"] == "success"
        assert result["data"]["name"] == "pizza"

    @pytest.mark.asyncio
    async def test_create_leftover_minimal_params(
        self, api_client: TaskTrackerAPI
    ) -> None:
        """Test leftover creation with minimal parameters."""
        mock_response = AsyncMock()
        mock_response.status = 201
        mock_response.json.return_value = {
            "status": "success",
            "data": {"id": 456, "name": "pizza"},
        }

        api_client.session.request.return_value.__aenter__.return_value = mock_response

        result = await api_client.create_leftover(name="pizza")

        assert result["status"] == "success"
        assert result["data"]["name"] == "pizza"

    @pytest.mark.asyncio
    async def test_create_adhoc_task_success(self, api_client: TaskTrackerAPI) -> None:
        """Test successful adhoc task creation."""
        mock_response = AsyncMock()
        mock_response.status = 201
        mock_response.json.return_value = {
            "status": "success",
            "data": {"id": 789, "name": "adhoc task"},
        }

        api_client.session.request.return_value.__aenter__.return_value = mock_response

        result = await api_client.create_adhoc_task(
            name="adhoc task", username="testuser", duration_minutes=30
        )

        assert result["status"] == "success"
        assert result["data"]["name"] == "adhoc task"

    @pytest.mark.asyncio
    async def test_create_adhoc_task_minimal_params(
        self, api_client: TaskTrackerAPI
    ) -> None:
        """Test adhoc task creation with minimal parameters."""
        mock_response = AsyncMock()
        mock_response.status = 201
        mock_response.json.return_value = {
            "status": "success",
            "data": {"id": 789, "name": "adhoc task"},
        }

        api_client.session.request.return_value.__aenter__.return_value = mock_response

        result = await api_client.create_adhoc_task(
            name="adhoc task", username="testuser"
        )

        assert result["status"] == "success"
        assert result["data"]["name"] == "adhoc task"

    @pytest.mark.asyncio
    async def test_get_recommended_tasks_success(
        self, api_client: TaskTrackerAPI
    ) -> None:
        """Test successful recommended tasks retrieval."""
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json.return_value = {
            "status": "success",
            "data": {
                "tasks": [
                    {"id": 1, "name": "Quick task", "duration": 15},
                    {"id": 2, "name": "Medium task", "duration": 30},
                ]
            },
        }

        api_client.session.request.return_value.__aenter__.return_value = mock_response

        result = await api_client.get_recommended_tasks(
            username="testuser", available_minutes=30
        )

        assert result["status"] == "success"
        assert len(result["data"]["tasks"]) == 2

    @pytest.mark.asyncio
    async def test_get_recommended_tasks_minimal_params(
        self, api_client: TaskTrackerAPI
    ) -> None:
        """Test recommended tasks with minimal parameters."""
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json.return_value = {
            "status": "success",
            "data": {"tasks": []},
        }

        api_client.session.request.return_value.__aenter__.return_value = mock_response

        result = await api_client.get_recommended_tasks(username="testuser")

        assert result["status"] == "success"

    @pytest.mark.asyncio
    async def test_get_available_tasks_success(
        self, api_client: TaskTrackerAPI
    ) -> None:
        """Test successful available tasks retrieval."""
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json.return_value = {
            "status": "success",
            "data": {"tasks": [{"id": 1, "name": "Task 1"}]},
        }

        api_client.session.request.return_value.__aenter__.return_value = mock_response

        result = await api_client.get_available_tasks(username="testuser")

        assert result["status"] == "success"
        assert len(result["data"]["tasks"]) == 1

    @pytest.mark.asyncio
    async def test_get_available_tasks_no_params(
        self, api_client: TaskTrackerAPI
    ) -> None:
        """Test available tasks with no parameters."""
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json.return_value = {
            "status": "success",
            "data": {"tasks": []},
        }

        api_client.session.request.return_value.__aenter__.return_value = mock_response

        result = await api_client.get_available_tasks()

        assert result["status"] == "success"

    @pytest.mark.asyncio
    async def test_get_recent_completions_success(
        self, api_client: TaskTrackerAPI
    ) -> None:
        """Test successful recent completions retrieval."""
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json.return_value = {
            "status": "success",
            "data": {"completions": [{"id": 1, "task_name": "Completed Task"}]},
        }

        api_client.session.request.return_value.__aenter__.return_value = mock_response

        result = await api_client.get_recent_completions(username="testuser", limit=10)

        assert result["status"] == "success"
        assert len(result["data"]["completions"]) == 1

    @pytest.mark.asyncio
    async def test_get_recent_completions_no_params(
        self, api_client: TaskTrackerAPI
    ) -> None:
        """Test recent completions with no parameters."""
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json.return_value = {
            "status": "success",
            "data": {"completions": []},
        }

        api_client.session.request.return_value.__aenter__.return_value = mock_response

        result = await api_client.get_recent_completions()

        assert result["status"] == "success"

    @pytest.mark.asyncio
    async def test_list_leftovers_success(self, api_client: TaskTrackerAPI) -> None:
        """Test successful leftovers listing."""
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json.return_value = {
            "status": "success",
            "data": {"leftovers": [{"id": 1, "name": "pizza"}]},
        }

        api_client.session.request.return_value.__aenter__.return_value = mock_response

        result = await api_client.list_leftovers()

        assert result["status"] == "success"
        assert len(result["data"]["leftovers"]) == 1

    @pytest.mark.asyncio
    async def test_get_all_tasks_success(self, api_client: TaskTrackerAPI) -> None:
        """Test successful all tasks retrieval."""
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json.return_value = {
            "status": "success",
            "data": {"tasks": []},
        }

        api_client.session.request.return_value.__aenter__.return_value = mock_response

        result = await api_client.get_all_tasks(thin=True)

        assert result["status"] == "success"

    @pytest.mark.asyncio
    async def test_get_all_tasks_no_thin(self, api_client: TaskTrackerAPI) -> None:
        """Test all tasks retrieval without thin parameter."""
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json.return_value = {
            "status": "success",
            "data": {"tasks": []},
        }

        api_client.session.request.return_value.__aenter__.return_value = mock_response

        result = await api_client.get_all_tasks()

        assert result["status"] == "success"

    @pytest.mark.asyncio
    async def test_get_all_tasks_thin_param_conversion(
        self, api_client: TaskTrackerAPI
    ) -> None:
        """Test that thin boolean parameter is converted to string for URL compatibility."""  # noqa: E501
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json.return_value = {
            "status": "success",
            "data": {"tasks": []},
        }

        api_client.session.request.return_value.__aenter__.return_value = mock_response

        await api_client.get_all_tasks(thin=True)

        # Verify the call was made with string "true" instead of boolean True
        call_args = api_client.session.request.call_args
        params = call_args[1]["params"]
        assert params == {"thin": "true"}
        assert isinstance(params["thin"], str)

    @pytest.mark.asyncio
    async def test_api_error_handling(self, api_client: TaskTrackerAPI) -> None:
        """Test API error handling for non-2xx responses."""
        mock_response = AsyncMock()
        mock_response.status = 400
        mock_response.json.return_value = {
            "error": "Bad request",
            "message": "Invalid task ID",
        }

        api_client.session.request.return_value.__aenter__.return_value = mock_response

        with pytest.raises(TaskTrackerAPIError) as exc_info:
            await api_client.complete_task(task_id=-1, username="testuser")

        assert "API request failed with status 400" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_api_500_error_handling(self, api_client: TaskTrackerAPI) -> None:
        """Test API 500 error handling."""
        mock_response = AsyncMock()
        mock_response.status = 500
        mock_response.json.return_value = {
            "error": "Internal Server Error",
        }

        api_client.session.request.return_value.__aenter__.return_value = mock_response

        with pytest.raises(TaskTrackerAPIError) as exc_info:
            await api_client.complete_task(task_id=123, username="testuser")

        assert "API request failed with status 500" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_network_error_handling(self, api_client: TaskTrackerAPI) -> None:
        """Test network error handling."""
        api_client.session.request.side_effect = ClientError("Network error")

        with pytest.raises(TaskTrackerAPIError) as exc_info:
            await api_client.complete_task(task_id=123, username="testuser")

        assert "Network error" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_timeout_error_handling(self, api_client: TaskTrackerAPI) -> None:
        """Test timeout error handling."""
        from aiohttp import ClientError

        api_client.session.request.side_effect = ClientError("Request timed out")

        with pytest.raises(TaskTrackerAPIError) as exc_info:
            await api_client.complete_task(task_id=123, username="testuser")

        assert "Network error" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_query_task_with_question_type(
        self, api_client: TaskTrackerAPI
    ) -> None:
        """Test task query with specific question type."""
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json.return_value = {
            "status": "success",
            "data": {"answer": "This leftover is still safe to eat"},
        }

        api_client.session.request.return_value.__aenter__.return_value = mock_response

        result = await api_client.query_task(
            name="leftover pizza", question_type="safety"
        )

        assert result["status"] == "success"
        assert "answer" in result["data"]

    @pytest.mark.asyncio
    async def test_query_task_without_question_type(
        self, api_client: TaskTrackerAPI
    ) -> None:
        """Test task query without question type."""
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json.return_value = {
            "status": "success",
            "data": {"answer": "General information about the task"},
        }

        api_client.session.request.return_value.__aenter__.return_value = mock_response

        result = await api_client.query_task(name="leftover pizza")

        assert result["status"] == "success"

    @pytest.mark.asyncio
    async def test_complete_task_without_notes(
        self, api_client: TaskTrackerAPI
    ) -> None:
        """Test task completion without notes."""
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json.return_value = {
            "status": "success",
            "data": {"task_id": 123, "completed": True},
        }

        api_client.session.request.return_value.__aenter__.return_value = mock_response

        result = await api_client.complete_task(task_id=123, username="testuser")

        assert result["status"] == "success"

    @pytest.mark.asyncio
    async def test_complete_task_by_name_without_notes(
        self, api_client: TaskTrackerAPI
    ) -> None:
        """Test task completion by name without notes."""
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json.return_value = {
            "status": "success",
            "data": {"name": "trash", "completed": True},
        }

        api_client.session.request.return_value.__aenter__.return_value = mock_response

        result = await api_client.complete_task_by_name(
            name="trash", username="testuser"
        )

        assert result["status"] == "success"

    def test_host_stripping(self) -> None:
        """Test that trailing slash is stripped from host."""
        session = AsyncMock(spec=ClientSession)
        api = TaskTrackerAPI(
            session=session,
            host="https://test.example.com/",
            api_key="test-key",
        )
        assert api.host == "https://test.example.com"

    @pytest.mark.asyncio
    async def test_request_with_params_and_data(
        self, api_client: TaskTrackerAPI
    ) -> None:
        """Test request with both params and data."""
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json.return_value = {
            "status": "success",
            "data": {"tasks": []},
        }

        api_client.session.request.return_value.__aenter__.return_value = mock_response

        result = await api_client.get_available_tasks(username="testuser")

        assert result["status"] == "success"
