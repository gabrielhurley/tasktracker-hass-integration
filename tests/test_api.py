"""Tests for TaskTracker API client (unified v2 API).

The client targets the v2 API (flat payloads, acting_user, spoken opt-in) and
re-wraps responses into the legacy {'success', 'data', 'spoken_response'}
envelope that the rest of the integration consumes. These tests mock v2
payloads and assert both the outgoing request shape and the envelope.
"""

from unittest.mock import AsyncMock

import pytest
from aiohttp import ClientError, ClientSession

from custom_components.tasktracker.api import TaskTrackerAPI, TaskTrackerAPIError

USER_CONTEXT = {
    "username": "testuser",
    "timezone": "America/Los_Angeles",
    "current_logical_date": "2026-07-18",
}


def make_api(default_username: str | None = None) -> TaskTrackerAPI:
    session = AsyncMock(spec=ClientSession)
    return TaskTrackerAPI(
        session=session,
        host="https://test.example.com",
        api_key="test-api-key",
        default_username=default_username,
    )


def mock_v2_response(api: TaskTrackerAPI, payload: dict, status: int = 200) -> None:
    mock_response = AsyncMock()
    mock_response.status = status
    mock_response.json.return_value = payload
    api.session.request.return_value.__aenter__.return_value = mock_response


def last_request(api: TaskTrackerAPI):
    """Return (method, url, params, json) of the last request."""
    call = api.session.request.call_args
    return call.args[0], call.args[1], call.kwargs["params"], call.kwargs["json"]


class TestTaskTrackerAPI:
    """Test TaskTracker API client."""

    @pytest.fixture
    def api_client(self) -> TaskTrackerAPI:
        """Create API client for testing."""
        return make_api()

    def test_headers_formation(self, api_client: TaskTrackerAPI) -> None:
        """Test that headers are correctly formed."""
        headers = api_client._get_headers()  # noqa: SLF001
        assert headers["X-API-Key"] == "test-api-key"
        assert headers["Content-Type"] == "application/json"

    @pytest.mark.asyncio
    async def test_complete_task_success(self, api_client: TaskTrackerAPI) -> None:
        """Task completion targets v2 and re-wraps into the legacy envelope."""
        mock_v2_response(
            api_client,
            {
                "completion": {"task_id": 123, "completed": True},
                "spoken_response": "Task completed successfully",
                "user_context": USER_CONTEXT,
            },
            status=201,
        )

        result = await api_client.complete_task(
            task_id=123,
            task_type="RecurringTask",
            completed_by="testuser",
            notes="Test completion",
        )

        assert result["success"] is True
        assert result["data"]["completion"]["task_id"] == 123
        assert result["spoken_response"] == "Task completed successfully"
        assert result["user_context"]["username"] == "testuser"

        method, url, params, json_data = last_request(api_client)
        assert method == "POST"
        assert url == "https://test.example.com/api/v2/completions/"
        assert params["acting_user"] == "testuser"
        assert params["spoken"] == "true"
        # Task type is sent as a v2 slug.
        assert json_data == {
            "task_id": 123,
            "task_type": "recurring",
            "notes": "Test completion",
        }

    @pytest.mark.asyncio
    async def test_complete_task_by_name_success(
        self, api_client: TaskTrackerAPI
    ) -> None:
        """Test successful task completion by name."""
        mock_v2_response(
            api_client,
            {
                "completion": {"name": "trash", "completed": True},
                "spoken_response": "Task completed successfully",
                "user_context": USER_CONTEXT,
            },
            status=201,
        )

        result = await api_client.complete_task_by_name(
            name="trash", completed_by="testuser"
        )

        assert result["success"] is True
        assert result["data"]["completion"]["name"] == "trash"

        method, url, params, json_data = last_request(api_client)
        assert method == "POST"
        assert url == "https://test.example.com/api/v2/completions/by-name/"
        assert params["acting_user"] == "testuser"
        assert json_data == {"name": "trash"}

    @pytest.mark.asyncio
    async def test_create_leftover_success(self, api_client: TaskTrackerAPI) -> None:
        """Test successful leftover creation."""
        mock_v2_response(
            api_client,
            {"leftover": {"id": 456, "name": "pizza"}, "user_context": USER_CONTEXT},
            status=201,
        )

        result = await api_client.create_leftover(
            name="pizza", assigned_users=["testuser"], shelf_life_days=3
        )

        assert result["success"] is True
        assert result["data"]["leftover"]["name"] == "pizza"

        method, url, params, json_data = last_request(api_client)
        assert method == "POST"
        assert url == "https://test.example.com/api/v2/leftovers/"
        # First assignee acts for the request.
        assert params["acting_user"] == "testuser"
        assert json_data == {
            "name": "pizza",
            "assigned_users": ["testuser"],
            "shelf_life_days": 3,
        }

    @pytest.mark.asyncio
    async def test_create_leftover_minimal_params(
        self, api_client: TaskTrackerAPI
    ) -> None:
        """Leftover creation with no assignees has no acting_user to send."""
        mock_v2_response(
            api_client,
            {"leftover": {"id": 456, "name": "pizza"}},
            status=201,
        )

        result = await api_client.create_leftover(name="pizza")

        assert result["success"] is True
        _, _, params, json_data = last_request(api_client)
        assert "acting_user" not in params
        assert json_data == {"name": "pizza"}

    @pytest.mark.asyncio
    async def test_create_adhoc_task_success(self, api_client: TaskTrackerAPI) -> None:
        """Ad-hoc creation posts to the typed v2 task collection."""
        mock_v2_response(
            api_client,
            {"task": {"id": 789, "name": "adhoc task"}},
            status=201,
        )

        result = await api_client.create_adhoc_task(
            name="adhoc task", assigned_users=["testuser"], duration_minutes=30
        )

        assert result["success"] is True
        assert result["data"]["task"]["name"] == "adhoc task"

        method, url, params, json_data = last_request(api_client)
        assert method == "POST"
        assert url == "https://test.example.com/api/v2/tasks/adhoc/"
        assert params["acting_user"] == "testuser"
        assert json_data == {
            "name": "adhoc task",
            "assigned_users": ["testuser"],
            "duration_minutes": 30,
        }

    @pytest.mark.asyncio
    async def test_update_task_patches_typed_detail_route(
        self, api_client: TaskTrackerAPI
    ) -> None:
        """update_task issues a PATCH against the v2 detail route."""
        mock_v2_response(api_client, {"task": {"id": 42, "name": "renamed"}})

        result = await api_client.update_task(
            task_id=42, task_type="SelfCareTask", name="renamed", priority=1
        )

        assert result["success"] is True
        method, url, _, json_data = last_request(api_client)
        assert method == "PATCH"
        assert url == "https://test.example.com/api/v2/tasks/selfcare/42/"
        assert json_data == {"name": "renamed", "priority": 1}

    @pytest.mark.asyncio
    async def test_delete_task_uses_delete_verb(
        self, api_client: TaskTrackerAPI
    ) -> None:
        """delete_task issues a DELETE and acts as the provided user."""
        mock_v2_response(api_client, {"message": "deleted"})

        result = await api_client.delete_task(
            task_id=7, task_type="AdHocTask", assigned_to="testuser"
        )

        assert result["success"] is True
        method, url, params, _ = last_request(api_client)
        assert method == "DELETE"
        assert url == "https://test.example.com/api/v2/tasks/adhoc/7/"
        assert params["acting_user"] == "testuser"

    @pytest.mark.asyncio
    async def test_get_recommended_tasks_success(
        self, api_client: TaskTrackerAPI
    ) -> None:
        """Test successful recommended tasks retrieval."""
        mock_v2_response(
            api_client,
            {
                "items": [
                    {"id": 1, "name": "Quick task", "duration": 15},
                    {"id": 2, "name": "Medium task", "duration": 30},
                ],
                "count": 2,
                "spoken_response": "Found 2 recommended tasks",
            },
        )

        result = await api_client.get_recommended_tasks(
            username="testuser", available_minutes=30
        )

        assert result["success"] is True
        assert len(result["data"]["items"]) == 2

        method, url, params, _ = last_request(api_client)
        assert method == "GET"
        assert url == "https://test.example.com/api/v2/recommendations/"
        assert params["acting_user"] == "testuser"
        assert params["available_minutes"] == "30"

    @pytest.mark.asyncio
    async def test_get_available_tasks_success(
        self, api_client: TaskTrackerAPI
    ) -> None:
        """Available tasks for a user use view=available scoped to that user."""
        mock_v2_response(
            api_client, {"items": [{"id": 1, "name": "Task 1"}], "count": 1}
        )

        result = await api_client.get_available_tasks(username="testuser")

        assert result["success"] is True
        assert len(result["data"]["items"]) == 1

        _, url, params, _ = last_request(api_client)
        assert url == "https://test.example.com/api/v2/tasks/"
        assert params["view"] == "available"
        assert params["acting_user"] == "testuser"
        assert "scope" not in params

    @pytest.mark.asyncio
    async def test_get_available_tasks_no_params(
        self, api_client: TaskTrackerAPI
    ) -> None:
        """Without a username, available tasks are household-wide."""
        mock_v2_response(api_client, {"items": [], "count": 0})

        result = await api_client.get_available_tasks()

        assert result["success"] is True
        _, _, params, _ = last_request(api_client)
        assert params["view"] == "available"
        assert params["scope"] == "household"

    @pytest.mark.asyncio
    async def test_get_recent_completions_success(
        self, api_client: TaskTrackerAPI
    ) -> None:
        """Test successful recent completions retrieval."""
        mock_v2_response(
            api_client,
            {"items": [{"id": 1, "task_name": "Completed Task"}], "count": 1},
        )

        result = await api_client.get_recent_completions(username="testuser", limit=10)

        assert result["success"] is True
        assert len(result["data"]["items"]) == 1

        _, url, params, _ = last_request(api_client)
        assert url == "https://test.example.com/api/v2/completions/"
        assert params["acting_user"] == "testuser"
        assert params["limit"] == "10"
        assert "scope" not in params

    @pytest.mark.asyncio
    async def test_get_recent_completions_no_params(
        self, api_client: TaskTrackerAPI
    ) -> None:
        """Without a username, recent completions are household-wide."""
        mock_v2_response(api_client, {"items": [], "count": 0})

        result = await api_client.get_recent_completions()

        assert result["success"] is True
        _, _, params, _ = last_request(api_client)
        assert params["scope"] == "household"

    @pytest.mark.asyncio
    async def test_list_leftovers_success(self, api_client: TaskTrackerAPI) -> None:
        """Without a username, the whole household inventory is listed."""
        mock_v2_response(
            api_client, {"items": [{"id": 1, "name": "pizza"}], "count": 1}
        )

        result = await api_client.list_leftovers()

        assert result["success"] is True
        assert len(result["data"]["items"]) == 1
        _, url, params, _ = last_request(api_client)
        assert url == "https://test.example.com/api/v2/leftovers/"
        assert "scope" not in params

    @pytest.mark.asyncio
    async def test_list_leftovers_with_username(
        self, api_client: TaskTrackerAPI
    ) -> None:
        """A username limits leftovers to that user's assignments."""
        mock_v2_response(api_client, {"items": [], "count": 0})

        await api_client.list_leftovers(username="testuser")

        _, _, params, _ = last_request(api_client)
        assert params["scope"] == "mine"
        assert params["acting_user"] == "testuser"

    @pytest.mark.asyncio
    async def test_get_all_tasks_no_params(self, api_client: TaskTrackerAPI) -> None:
        """Without a username, all tasks are household-wide."""
        mock_v2_response(api_client, {"items": [], "count": 0})

        result = await api_client.get_all_tasks()

        assert result["success"] is True
        _, url, params, _ = last_request(api_client)
        assert url == "https://test.example.com/api/v2/tasks/"
        assert params["thin"] == "false"
        assert params["scope"] == "household"

    @pytest.mark.asyncio
    async def test_get_all_tasks_with_username(
        self, api_client: TaskTrackerAPI
    ) -> None:
        """Test all tasks with username filter."""
        mock_v2_response(
            api_client, {"items": [{"id": 1, "name": "Task 1"}], "count": 1}
        )

        result = await api_client.get_all_tasks(thin=True, username="testuser")

        assert result["success"] is True
        _, _, params, _ = last_request(api_client)
        assert params["thin"] == "true"
        assert params["acting_user"] == "testuser"
        assert "scope" not in params

    @pytest.mark.asyncio
    async def test_delete_completion_defaults_to_recurring(
        self, api_client: TaskTrackerAPI
    ) -> None:
        """Legacy callers omit task_type for recurring-task completions."""
        mock_v2_response(api_client, {"message": "deleted"})

        result = await api_client.delete_completion(completion_id=11)

        assert result["success"] is True
        method, url, _, _ = last_request(api_client)
        assert method == "DELETE"
        assert url == "https://test.example.com/api/v2/completions/recurring/11/"

    @pytest.mark.asyncio
    async def test_delete_completion_with_task_type(
        self, api_client: TaskTrackerAPI
    ) -> None:
        """Explicit task types are slugified into the completion route."""
        mock_v2_response(api_client, {"message": "deleted"})

        await api_client.delete_completion(completion_id=12, task_type="Leftover")

        _, url, _, _ = last_request(api_client)
        assert url == "https://test.example.com/api/v2/completions/leftover/12/"

    @pytest.mark.asyncio
    async def test_update_completion_patches_recurring_route(
        self, api_client: TaskTrackerAPI
    ) -> None:
        """update_completion PATCHes the recurring completion detail route."""
        mock_v2_response(api_client, {"completion": {"id": 11}})

        result = await api_client.update_completion(
            completion_id=11, completed_by="testuser", notes="fixed"
        )

        assert result["success"] is True
        method, url, _, json_data = last_request(api_client)
        assert method == "PATCH"
        assert url == "https://test.example.com/api/v2/completions/recurring/11/"
        assert json_data == {"completed_by": "testuser", "notes": "fixed"}

    @pytest.mark.asyncio
    async def test_get_daily_plan(self, api_client: TaskTrackerAPI) -> None:
        """Daily plan acts as the user and stringifies boolean params."""
        mock_v2_response(
            api_client,
            {"tasks": [], "self_care": [], "user_context": USER_CONTEXT},
        )

        result = await api_client.get_daily_plan(
            username="testuser", select_recommended=True
        )

        assert result["success"] is True
        assert result["data"] == {"tasks": [], "self_care": []}
        _, url, params, _ = last_request(api_client)
        assert url == "https://test.example.com/api/v2/daily-plan/"
        assert params["acting_user"] == "testuser"
        assert params["select_recommended"] == "true"

    @pytest.mark.asyncio
    async def test_get_daily_state_unwraps_state(
        self, api_client: TaskTrackerAPI
    ) -> None:
        """Daily state responses keep the legacy flat-state data shape."""
        mock_v2_response(
            api_client,
            {"state": {"energy": 4, "motivation": 3}, "user_context": USER_CONTEXT},
        )

        result = await api_client.get_daily_state(username="testuser")

        assert result["success"] is True
        assert result["data"] == {"energy": 4, "motivation": 3}

    @pytest.mark.asyncio
    async def test_get_daily_state_none_when_unset(
        self, api_client: TaskTrackerAPI
    ) -> None:
        """No daily state yet maps to data=None, like the legacy API."""
        mock_v2_response(api_client, {"state": None, "user_context": USER_CONTEXT})

        result = await api_client.get_daily_state(username="testuser")

        assert result["success"] is True
        assert result["data"] is None

    @pytest.mark.asyncio
    async def test_set_daily_state_puts_fields(
        self, api_client: TaskTrackerAPI
    ) -> None:
        """set_daily_state PUTs only the provided fields."""
        mock_v2_response(
            api_client,
            {"state": {"energy": 5, "motivation": 3}, "user_context": USER_CONTEXT},
        )

        result = await api_client.set_daily_state(username="testuser", energy=5)

        assert result["success"] is True
        assert result["data"] == {"energy": 5, "motivation": 3}
        method, url, params, json_data = last_request(api_client)
        assert method == "PUT"
        assert url == "https://test.example.com/api/v2/daily-state/"
        assert params["acting_user"] == "testuser"
        assert json_data == {"energy": 5}

    @pytest.mark.asyncio
    async def test_list_goal_tasks_maps_association_rows(
        self, api_client: TaskTrackerAPI
    ) -> None:
        """Goal-detail task rows are mapped back to legacy association items."""
        mock_v2_response(
            api_client,
            {
                "goal": {"id": 3, "name": "Health"},
                "tasks": [
                    {
                        "association_id": 9,
                        "task_id": 123,
                        "name": "Stretch",
                        "task_type": "RecurringTask",
                    }
                ],
                "user_context": USER_CONTEXT,
            },
        )

        result = await api_client.list_goal_tasks(username="testuser", goal_id=3)

        assert result["success"] is True
        assert result["data"]["count"] == 1
        assert result["data"]["items"] == [
            {
                "id": 9,
                "task_name": "Stretch",
                "task_object_id": 123,
                "task_type": "RecurringTask",
            }
        ]
        _, url, params, _ = last_request(api_client)
        assert url == "https://test.example.com/api/v2/goals/3/"
        assert params["acting_user"] == "testuser"

    @pytest.mark.asyncio
    async def test_associate_task_with_goal(self, api_client: TaskTrackerAPI) -> None:
        """Associations post to the goal's task collection with slug types."""
        mock_v2_response(api_client, {"association": {"id": 9}}, status=201)

        result = await api_client.associate_task_with_goal(
            username="testuser", goal_id=3, task_type="RecurringTask", task_id=123
        )

        assert result["success"] is True
        method, url, _, json_data = last_request(api_client)
        assert method == "POST"
        assert url == "https://test.example.com/api/v2/goals/3/tasks/"
        assert json_data == {"task_type": "recurring", "task_id": 123}

    @pytest.mark.asyncio
    async def test_remove_task_from_goal(self, api_client: TaskTrackerAPI) -> None:
        """Association removal deletes the nested resource."""
        mock_v2_response(api_client, {"message": "removed"})

        result = await api_client.remove_task_from_goal(
            username="testuser", goal_id=3, association_id=9
        )

        assert result["success"] is True
        method, url, _, _ = last_request(api_client)
        assert method == "DELETE"
        assert url == "https://test.example.com/api/v2/goals/3/tasks/9/"

    @pytest.mark.asyncio
    async def test_default_username_fallback(self) -> None:
        """Calls without user context act as the configured default user."""
        api = make_api(default_username="defaultuser")
        mock_v2_response(api, {"task": {"id": 42}})

        await api.update_task(task_id=42, task_type="RecurringTask", name="renamed")

        _, _, params, _ = last_request(api)
        assert params["acting_user"] == "defaultuser"

    @pytest.mark.asyncio
    async def test_explicit_user_overrides_default(self) -> None:
        """A per-call username wins over the configured default."""
        api = make_api(default_username="defaultuser")
        mock_v2_response(api, {"items": [], "count": 0})

        await api.get_recent_completions(username="testuser")

        _, _, params, _ = last_request(api)
        assert params["acting_user"] == "testuser"

    @pytest.mark.asyncio
    async def test_verify_connection_not_wrapped(
        self, api_client: TaskTrackerAPI
    ) -> None:
        """verify_connection returns the raw v2 payload."""
        mock_v2_response(
            api_client, {"ok": True, "auth": "household_key", "household": "Home"}
        )

        result = await api_client.verify_connection()

        assert result == {"ok": True, "auth": "household_key", "household": "Home"}
        _, url, _, _ = last_request(api_client)
        assert url == "https://test.example.com/api/v2/auth/verify/"

    @pytest.mark.asyncio
    async def test_api_error_handling(self, api_client: TaskTrackerAPI) -> None:
        """Test API error handling for non-2xx responses."""
        mock_v2_response(api_client, {"error": "Invalid task ID"}, status=400)

        with pytest.raises(TaskTrackerAPIError) as exc_info:
            await api_client.complete_task(
                task_id=-1, task_type="RecurringTask", completed_by="testuser"
            )

        assert "API request failed with status 400" in str(exc_info.value)
        assert "Invalid task ID" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_api_500_error_handling(self, api_client: TaskTrackerAPI) -> None:
        """Test API 500 error handling."""
        mock_v2_response(api_client, {"error": "Internal Server Error"}, status=500)

        with pytest.raises(TaskTrackerAPIError) as exc_info:
            await api_client.complete_task(
                task_id=123, task_type="RecurringTask", completed_by="testuser"
            )

        assert "API request failed with status 500" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_network_error_handling(self, api_client: TaskTrackerAPI) -> None:
        """Test network error handling."""
        api_client.session.request.side_effect = ClientError("Network error")

        with pytest.raises(TaskTrackerAPIError) as exc_info:
            await api_client.complete_task(
                task_id=123, task_type="RecurringTask", completed_by="testuser"
            )

        assert "Network error" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_query_task_with_question_type(
        self, api_client: TaskTrackerAPI
    ) -> None:
        """Test task query with specific question type."""
        mock_v2_response(
            api_client,
            {
                "task": {"id": 1, "name": "leftover pizza"},
                "spoken_response": "This leftover is still safe to eat",
            },
        )

        result = await api_client.query_task(
            name="leftover pizza", question_type="safe_to_eat"
        )

        assert result["success"] is True
        assert result["spoken_response"] == "This leftover is still safe to eat"
        _, url, params, _ = last_request(api_client)
        assert url == "https://test.example.com/api/v2/tasks/query/"
        assert params["name"] == "leftover pizza"
        assert params["question_type"] == "safe_to_eat"

    @pytest.mark.asyncio
    async def test_query_task_without_question_type(
        self, api_client: TaskTrackerAPI
    ) -> None:
        """Test task query without question type."""
        mock_v2_response(
            api_client,
            {"task": {"id": 1}, "spoken_response": "General information"},
        )

        result = await api_client.query_task(name="leftover pizza")

        assert result["success"] is True
        _, _, params, _ = last_request(api_client)
        assert "question_type" not in params

    def test_host_stripping(self) -> None:
        """Test that trailing slash is stripped from host."""
        session = AsyncMock(spec=ClientSession)
        api = TaskTrackerAPI(
            session=session,
            host="https://test.example.com/",
            api_key="test-key",
        )
        assert api.host == "https://test.example.com"
