"""
TaskTracker API client for Home Assistant integration.

Talks to the unified (v2) TaskTracker API using a household-scoped API key.

The v2 API differs from the legacy surface this integration grew up on in
three ways this client papers over so the rest of the integration (service
handlers, cards, events) is unaffected:

- Every request must act on behalf of a household member (``acting_user``).
  Calls that have a username use it; calls that don't fall back to the
  configured default user (the first mapped user).
- Responses are flat payloads (``{...resource, user_context}``) and
  ``spoken_response`` is opt-in via ``?spoken=true``. HA is a voice-capable
  client, so this client always opts in and re-wraps payloads into the legacy
  ``{"success": True, "data": {...}, "spoken_response": ...}`` envelope.
- Task types are lowercase slugs in URLs (``recurring``, ``adhoc``,
  ``selfcare``, ``leftover``); the integration historically used the service
  names (``RecurringTask`` etc.), so both are accepted.
"""

from __future__ import annotations

import logging
from typing import Any

import aiohttp

from .const import (
    ENDPOINT_AUTH_VERIFY,
    ENDPOINT_COMPLETIONS,
    ENDPOINT_COMPLETIONS_BY_NAME,
    ENDPOINT_DAILY_PLAN,
    ENDPOINT_DAILY_PLAN_ENCOURAGEMENT,
    ENDPOINT_DAILY_STATE,
    ENDPOINT_GOALS,
    ENDPOINT_LEFTOVERS,
    ENDPOINT_RECOMMENDATIONS,
    ENDPOINT_TASKS,
    ENDPOINT_TASKS_FROM_DESCRIPTION,
    ENDPOINT_TASKS_QUERY,
)

_LOGGER = logging.getLogger(__name__)

# Legacy service-layer task type names -> v2 URL slugs.
TASK_TYPE_SLUGS = {
    "RecurringTask": "recurring",
    "AdHocTask": "adhoc",
    "SelfCareTask": "selfcare",
    "Leftover": "leftover",
}


def _slugify_task_type(task_type: str | None) -> str:
    """Accept both legacy names ('RecurringTask') and v2 slugs ('recurring')."""
    if task_type in TASK_TYPE_SLUGS:
        return TASK_TYPE_SLUGS[task_type]
    return (task_type or "").lower()


def _to_legacy_envelope(payload: Any) -> dict[str, Any]:
    """Re-wrap a v2 payload into the legacy response envelope."""
    if not isinstance(payload, dict):
        return {"success": True, "data": payload}
    data = dict(payload)
    spoken = data.pop("spoken_response", None)
    user_context = data.pop("user_context", None)
    result: dict[str, Any] = {"success": True, "data": data}
    if spoken is not None:
        result["spoken_response"] = spoken
    if user_context is not None:
        result["user_context"] = user_context
    return result


class TaskTrackerAPIError(Exception):
    """Exception raised for API errors."""


class TaskTrackerAPI:
    """TaskTracker API client."""

    def __init__(
        self,
        session: aiohttp.ClientSession,
        host: str,
        api_key: str,
        default_username: str | None = None,
    ) -> None:
        """Initialize the API client."""
        self.session = session
        self.host = host.rstrip("/")
        self.api_key = api_key
        self.default_username = default_username

    def _get_headers(self) -> dict[str, str]:
        """Get request headers with API key."""
        return {
            "X-API-Key": self.api_key,
            "Content-Type": "application/json",
        }

    async def _request(  # noqa: PLR0913
        self,
        method: str,
        endpoint: str,
        params: dict[str, Any] | None = None,
        data: dict[str, Any] | None = None,
        acting_user: str | None = None,
        wrap: bool = True,  # noqa: FBT001, FBT002
    ) -> dict[str, Any]:
        """Make an API request and re-wrap the response in the legacy envelope."""
        url = f"{self.host}{endpoint}"
        headers = self._get_headers()

        # Query params must be strings for aiohttp; drop unset values.
        query: dict[str, str] = {}
        for key, value in (params or {}).items():
            if value is None:
                continue
            if isinstance(value, bool):
                query[key] = str(value).lower()
            else:
                query[key] = str(value)
        query.setdefault("spoken", "true")
        acting = acting_user or self.default_username
        if acting:
            query.setdefault("acting_user", acting)

        _LOGGER.debug("Making %s request to %s", method, url)

        try:
            async with self.session.request(
                method, url, headers=headers, params=query, json=data
            ) as response:
                response_data = await response.json()

                if response.status >= 400:  # noqa: PLR2004
                    _LOGGER.error(
                        "API request failed: %s %s - Status: %s, Response: %s",
                        method,
                        url,
                        response.status,
                        response_data,
                    )
                    message = None
                    if isinstance(response_data, dict):
                        message = response_data.get("error")
                    msg = (
                        f"API request failed with status {response.status}: "
                        f"{message or response_data}"
                    )
                    raise TaskTrackerAPIError(msg)

                _LOGGER.debug("API request successful: %s", response_data)
                return _to_legacy_envelope(response_data) if wrap else response_data

        except aiohttp.ClientError as ex:
            _LOGGER.exception("Network error during API request")
            msg = f"Network error: {ex}"
            raise TaskTrackerAPIError(msg) from ex

    # Connection / credential validation
    async def verify_connection(self) -> dict[str, Any]:
        """Validate the host and API key (works before any users are mapped)."""
        return await self._request("GET", ENDPOINT_AUTH_VERIFY, wrap=False)

    # Task completion methods
    async def complete_task(
        self,
        task_id: int,
        task_type: str,
        completed_by: str,
        notes: str | None = None,
        completed_at: str | None = None,
    ) -> dict[str, Any]:
        """
        Complete a task by ID.

        Args:
            task_id: The ID of the task to complete.
            task_type: The type of task (RecurringTask, SelfCareTask, or AdHocTask).
            completed_by: Username of the person completing the task.
            notes: Optional notes about the completion.
            completed_at: Optional ISO timestamp of when the task was completed.

        Returns:
            API response dictionary.

        """
        data: dict[str, Any] = {
            "task_id": task_id,
            "task_type": _slugify_task_type(task_type),
        }
        if notes:
            data["notes"] = notes
        if completed_at:
            data["completed_at"] = completed_at

        return await self._request(
            "POST", ENDPOINT_COMPLETIONS, data=data, acting_user=completed_by
        )

    async def complete_task_by_name(
        self,
        name: str,
        completed_by: str,
        notes: str | None = None,
        completed_at: str | None = None,
    ) -> dict[str, Any]:
        """Complete a task by name (supports fuzzy matching across all task types)."""
        data: dict[str, Any] = {"name": name}
        if notes:
            data["notes"] = notes
        if completed_at:
            data["completed_at"] = completed_at

        return await self._request(
            "POST", ENDPOINT_COMPLETIONS_BY_NAME, data=data, acting_user=completed_by
        )

    # Task creation methods
    async def create_leftover(
        self,
        name: str,
        assigned_users: list[str] | None = None,
        shelf_life_days: int | None = None,
        days_ago: int | None = None,
    ) -> dict[str, Any]:
        """Create a new leftover."""
        data: dict[str, Any] = {"name": name}
        if assigned_users:
            data["assigned_users"] = assigned_users
        if shelf_life_days is not None:
            data["shelf_life_days"] = shelf_life_days
        if days_ago is not None:
            data["days_ago"] = days_ago

        acting_user = assigned_users[0] if assigned_users else None
        return await self._request(
            "POST", ENDPOINT_LEFTOVERS, data=data, acting_user=acting_user
        )

    async def create_adhoc_task(
        self,
        name: str,
        assigned_users: list[str],
        duration_minutes: int | None = None,
        priority: int | None = None,
    ) -> dict[str, Any]:
        """Create a new ad-hoc task."""
        data: dict[str, Any] = {
            "name": name,
            "assigned_users": assigned_users,
        }
        if duration_minutes is not None:
            data["duration_minutes"] = duration_minutes
        if priority is not None:
            data["priority"] = priority

        acting_user = assigned_users[0] if assigned_users else None
        return await self._request(
            "POST", f"{ENDPOINT_TASKS}adhoc/", data=data, acting_user=acting_user
        )

    # Task update methods
    async def update_task(
        self,
        task_id: str,
        task_type: str,
        **kwargs: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Update a task's details.

        Supports all task fields including task_nudges.
        task_nudges should be a list of dicts with keys:
        - id (optional, for updates)
        - trigger_type (required)
        - trigger_config (optional dict)
        - priority (optional, default 5)
        - is_active (optional, default True)
        - custom_message (optional)
        """
        slug = _slugify_task_type(task_type)
        return await self._request(
            "PATCH", f"{ENDPOINT_TASKS}{slug}/{task_id}/", data=dict(kwargs)
        )

    async def create_task_from_description(
        self,
        task_type: str,
        task_description: str,
        assigned_users: list[str],
    ) -> dict[str, Any]:
        """Create a task from a natural-language description using AI on the server."""
        data: dict[str, Any] = {
            "task_type": _slugify_task_type(task_type),
            "description": task_description,
            "assigned_users": assigned_users,
        }
        acting_user = assigned_users[0] if assigned_users else None
        return await self._request(
            "POST", ENDPOINT_TASKS_FROM_DESCRIPTION, data=data, acting_user=acting_user
        )

    async def delete_task(
        self,
        task_id: int,
        task_type: str,
        assigned_to: str | None = None,
    ) -> dict[str, Any]:
        """Delete a task by id and type."""
        slug = _slugify_task_type(task_type)
        return await self._request(
            "DELETE", f"{ENDPOINT_TASKS}{slug}/{task_id}/", acting_user=assigned_to
        )

    # Task query methods
    async def query_task(
        self, name: str, question_type: str | None = None
    ) -> dict[str, Any]:
        """Query a task with question-specific response."""
        params: dict[str, Any] = {"name": name}
        if question_type:
            params["question_type"] = question_type

        return await self._request("GET", ENDPOINT_TASKS_QUERY, params=params)

    async def get_recommended_tasks(
        self, username: str, available_minutes: int
    ) -> dict[str, Any]:
        """Get recommended tasks for a user."""
        params = {"available_minutes": available_minutes}

        return await self._request(
            "GET", ENDPOINT_RECOMMENDATIONS, params=params, acting_user=username
        )

    async def get_available_tasks(
        self,
        username: str | None = None,
        available_minutes: int | None = None,
        upcoming_days: int | None = None,
    ) -> dict[str, Any]:
        """Get available tasks (household-wide when no username is given)."""
        params: dict[str, Any] = {"view": "available"}
        if not username:
            params["scope"] = "household"
        if available_minutes is not None:
            params["available_minutes"] = available_minutes
        if upcoming_days is not None:
            params["upcoming_days"] = upcoming_days

        return await self._request(
            "GET", ENDPOINT_TASKS, params=params, acting_user=username
        )

    async def get_recent_completions(
        self,
        username: str | None = None,
        days: int | None = None,
        limit: int | None = None,
    ) -> dict[str, Any]:
        """Get recent task completions (household-wide when no username is given)."""
        params: dict[str, Any] = {}
        if not username:
            params["scope"] = "household"
        if days is not None:
            params["days"] = days
        if limit is not None:
            params["limit"] = limit

        return await self._request(
            "GET", ENDPOINT_COMPLETIONS, params=params, acting_user=username
        )

    async def list_leftovers(self, username: str | None = None) -> dict[str, Any]:
        """List leftovers (the whole household's unless a username is given)."""
        params: dict[str, Any] = {}
        if username:
            params["scope"] = "mine"

        return await self._request(
            "GET", ENDPOINT_LEFTOVERS, params=params, acting_user=username
        )

    async def get_all_tasks(
        self,
        thin: bool = False,  # noqa: FBT001, FBT002
        username: str | None = None,
    ) -> dict[str, Any]:
        """Get all tasks (household-wide when no username is given)."""
        params: dict[str, Any] = {"thin": thin}
        if not username:
            params["scope"] = "household"

        return await self._request(
            "GET", ENDPOINT_TASKS, params=params, acting_user=username
        )

    # Completion editing methods
    async def delete_completion(
        self, completion_id: int, task_type: str | None = None
    ) -> dict[str, Any]:
        """Delete/undo a completion record."""
        # Legacy behavior: no task_type means a recurring-task completion.
        slug = _slugify_task_type(task_type) if task_type else "recurring"
        return await self._request(
            "DELETE", f"{ENDPOINT_COMPLETIONS}{slug}/{completion_id}/"
        )

    async def update_completion(
        self,
        completion_id: int,
        completed_by: str | None = None,
        notes: str | None = None,
        completed_at: str | None = None,
    ) -> dict[str, Any]:
        """Update a completion record (recurring-task completions only)."""
        data: dict[str, Any] = {}

        if completed_by is not None:
            data["completed_by"] = completed_by
        if notes is not None:
            data["notes"] = notes
        if completed_at is not None:
            data["completed_at"] = completed_at

        return await self._request(
            "PATCH", f"{ENDPOINT_COMPLETIONS}recurring/{completion_id}/", data=data
        )

    # Daily Plan & Daily State

    async def get_daily_plan(
        self,
        username: str | None,
        fair_weather: bool | None = None,
        select_recommended: bool | None = None,
    ) -> dict[str, Any]:
        """Retrieve the daily plan for a user."""
        params: dict[str, Any] = {}
        if fair_weather is not None:
            params["fair_weather"] = fair_weather
        if select_recommended is not None:
            params["select_recommended"] = select_recommended

        return await self._request(
            "GET", ENDPOINT_DAILY_PLAN, params=params, acting_user=username
        )

    async def get_daily_plan_encouragement(
        self, username: str | None
    ) -> dict[str, Any]:
        """Retrieve AI-powered encouragement for the daily plan."""
        return await self._request(
            "GET", ENDPOINT_DAILY_PLAN_ENCOURAGEMENT, acting_user=username
        )

    async def get_daily_state(self, username: str) -> dict[str, Any]:
        """Retrieve the daily state for a user."""
        result = await self._request(
            "GET", ENDPOINT_DAILY_STATE, acting_user=username
        )
        # Legacy shape: data is the state object itself (or None when unset).
        result["data"] = result.get("data", {}).get("state")
        return result

    async def set_daily_state(  # noqa: PLR0913
        self,
        username: str,
        energy: int | None = None,
        motivation: int | None = None,
        focus: int | None = None,
        pain: int | None = None,
        mood: int | None = None,
        free_time: int | None = None,
        is_sick: bool | None = None,
    ) -> dict[str, Any]:
        """Set/update the daily state for a user."""
        data: dict[str, Any] = {}

        if energy is not None:
            data["energy"] = energy
        if motivation is not None:
            data["motivation"] = motivation
        if focus is not None:
            data["focus"] = focus
        if pain is not None:
            data["pain"] = pain
        if mood is not None:
            data["mood"] = mood
        if free_time is not None:
            data["free_time"] = free_time
        if is_sick is not None:
            data["is_sick"] = is_sick

        result = await self._request(
            "PUT", ENDPOINT_DAILY_STATE, data=data, acting_user=username
        )
        # Legacy shape: data is the state object itself.
        result["data"] = result.get("data", {}).get("state")
        return result

    # Goal management methods
    async def list_goals(self, username: str) -> dict[str, Any]:
        """List all goals for a specific user."""
        return await self._request("GET", ENDPOINT_GOALS, acting_user=username)

    async def create_goal(
        self,
        username: str,
        name: str,
        description: str | None = None,
        is_active: bool = True,  # noqa: FBT001, FBT002
        priority: int = 2,
    ) -> dict[str, Any]:
        """Create a new goal."""
        data: dict[str, Any] = {
            "name": name,
            "is_active": is_active,
            "priority": priority,
        }
        if description:
            data["description"] = description
        return await self._request(
            "POST", ENDPOINT_GOALS, data=data, acting_user=username
        )

    async def update_goal(  # noqa: PLR0913
        self,
        username: str,
        goal_id: int,
        name: str | None = None,
        description: str | None = None,
        is_active: bool | None = None,
        priority: int | None = None,
    ) -> dict[str, Any]:
        """Update an existing goal."""
        data: dict[str, Any] = {}
        if name is not None:
            data["name"] = name
        if description is not None:
            data["description"] = description
        if is_active is not None:
            data["is_active"] = is_active
        if priority is not None:
            data["priority"] = priority

        return await self._request(
            "PATCH", f"{ENDPOINT_GOALS}{goal_id}/", data=data, acting_user=username
        )

    async def delete_goal(self, username: str, goal_id: int) -> dict[str, Any]:
        """Delete a goal."""
        return await self._request(
            "DELETE", f"{ENDPOINT_GOALS}{goal_id}/", acting_user=username
        )

    async def list_goal_tasks(self, username: str, goal_id: int) -> dict[str, Any]:
        """List all tasks associated with a goal."""
        result = await self._request(
            "GET", f"{ENDPOINT_GOALS}{goal_id}/", acting_user=username
        )
        # The goal detail's task rows use v2 field names; the cards (and the
        # legacy list-goal-tasks response) expect association rows.
        items = [
            {
                "id": task["association_id"],
                "task_name": task["name"],
                "task_object_id": task["task_id"],
                "task_type": task["task_type"],
            }
            for task in result.get("data", {}).get("tasks", [])
        ]
        result["data"] = {"items": items, "count": len(items)}
        return result

    async def associate_task_with_goal(
        self,
        username: str,
        goal_id: int,
        task_type: str,
        task_id: int,
    ) -> dict[str, Any]:
        """Associate a task with a goal."""
        data = {
            "task_type": _slugify_task_type(task_type),
            "task_id": task_id,
        }
        return await self._request(
            "POST", f"{ENDPOINT_GOALS}{goal_id}/tasks/", data=data, acting_user=username
        )

    async def remove_task_from_goal(
        self,
        username: str,
        goal_id: int,
        association_id: int,
    ) -> dict[str, Any]:
        """Remove a task association from a goal."""
        return await self._request(
            "DELETE",
            f"{ENDPOINT_GOALS}{goal_id}/tasks/{association_id}/",
            acting_user=username,
        )
