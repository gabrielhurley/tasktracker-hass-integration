"""TaskTracker API client for Home Assistant integration."""

from __future__ import annotations

import logging
from typing import Any

import aiohttp

from .const import (
    ENDPOINT_ALL_TASKS,
    ENDPOINT_AVAILABLE_TASKS,
    ENDPOINT_COMPLETE_TASK,
    ENDPOINT_COMPLETE_TASK_BY_NAME,
    ENDPOINT_CREATE_ADHOC_TASK,
    ENDPOINT_CREATE_LEFTOVER,
    ENDPOINT_CREATE_TASK_FROM_DESCRIPTION,
    ENDPOINT_DAILY_PLAN,
    ENDPOINT_DAILY_PLAN_ENCOURAGEMENT,
    ENDPOINT_DAILY_STATE,
    ENDPOINT_DELETE_COMPLETION,
    ENDPOINT_DELETE_TASK,
    ENDPOINT_LIST_LEFTOVERS,
    ENDPOINT_QUERY_TASK,
    ENDPOINT_RECENT_COMPLETIONS,
    ENDPOINT_RECOMMENDED_TASKS,
    ENDPOINT_UPDATE_COMPLETION,
    ENDPOINT_UPDATE_TASK,
)

_LOGGER = logging.getLogger(__name__)


class TaskTrackerAPIError(Exception):
    """Exception raised for API errors."""


class TaskTrackerAPI:
    """TaskTracker API client."""

    def __init__(self, session: aiohttp.ClientSession, host: str, api_key: str) -> None:
        """Initialize the API client."""
        self.session = session
        self.host = host.rstrip("/")
        self.api_key = api_key

    def _get_headers(self) -> dict[str, str]:
        """Get request headers with API key."""
        return {
            "X-API-Key": self.api_key,
            "Content-Type": "application/json",
        }

    async def _request(
        self,
        method: str,
        endpoint: str,
        params: dict[str, Any] | None = None,
        data: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Make an API request."""
        url = f"{self.host}{endpoint}"
        headers = self._get_headers()

        _LOGGER.debug("Making %s request to %s", method, url)

        try:
            async with self.session.request(
                method, url, headers=headers, params=params, json=data
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
                    msg = (
                        f"API request failed with status {response.status}: "
                        f"{response_data}"
                    )
                    raise TaskTrackerAPIError(msg)

                _LOGGER.debug("API request successful: %s", response_data)
                return response_data

        except aiohttp.ClientError as ex:
            _LOGGER.exception("Network error during API request")
            msg = f"Network error: {ex}"
            raise TaskTrackerAPIError(msg) from ex

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
            "task_type": task_type,
            "completed_by": completed_by,
        }
        if notes:
            data["notes"] = notes
        if completed_at:
            data["completed_at"] = completed_at

        return await self._request("POST", ENDPOINT_COMPLETE_TASK, data=data)

    async def complete_task_by_name(
        self,
        name: str,
        completed_by: str,
        notes: str | None = None,
        completed_at: str | None = None,
    ) -> dict[str, Any]:
        """Complete a task by name (supports fuzzy matching across all task types)."""
        data: dict[str, Any] = {
            "name": name,
            "completed_by": completed_by,
        }
        if notes:
            data["notes"] = notes
        if completed_at:
            data["completed_at"] = completed_at

        return await self._request("POST", ENDPOINT_COMPLETE_TASK_BY_NAME, data=data)

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
            data["shelf_life_days"] = str(shelf_life_days)
        if days_ago is not None:
            data["days_ago"] = str(days_ago)

        return await self._request("POST", ENDPOINT_CREATE_LEFTOVER, data=data)

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

        return await self._request("POST", ENDPOINT_CREATE_ADHOC_TASK, data=data)

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
        data: dict[str, Any] = {
            "task_id": task_id,
            "task_type": task_type,
            **kwargs,
        }
        return await self._request("POST", ENDPOINT_UPDATE_TASK, data=data)

    async def create_task_from_description(
        self,
        task_type: str,
        task_description: str,
        assigned_users: list[str],
    ) -> dict[str, Any]:
        """Create a task from a natural-language description using AI on the server."""
        data: dict[str, Any] = {
            "task_type": task_type,
            "task_description": task_description,
            "assigned_users": assigned_users,
        }
        return await self._request(
            "POST", ENDPOINT_CREATE_TASK_FROM_DESCRIPTION, data=data
        )

    async def delete_task(
        self,
        task_id: int,
        task_type: str,
    ) -> dict[str, Any]:
        """Delete a task by id and type."""
        data: dict[str, Any] = {
            "task_id": task_id,
            "task_type": task_type,
        }
        return await self._request("POST", ENDPOINT_DELETE_TASK, data=data)

    # Task query methods
    async def query_task(
        self, name: str, question_type: str | None = None
    ) -> dict[str, Any]:
        """Query a task with question-specific response."""
        params = {"name": name}
        if question_type:
            params["question_type"] = question_type

        return await self._request("GET", ENDPOINT_QUERY_TASK, params=params)

    async def get_recommended_tasks(
        self, username: str, available_minutes: int
    ) -> dict[str, Any]:
        """Get recommended tasks for a user."""
        params = {
            "assigned_to": username,
            "available_minutes": available_minutes,
        }

        return await self._request("GET", ENDPOINT_RECOMMENDED_TASKS, params=params)

    async def get_available_tasks(
        self,
        username: str | None = None,
        available_minutes: int | None = None,
        upcoming_days: int | None = None,
    ) -> dict[str, Any]:
        """Get available tasks."""
        params: dict[str, Any] = {}
        if username:
            params["assigned_to"] = username
        if available_minutes is not None:
            params["available_minutes"] = available_minutes
        if upcoming_days is not None:
            params["upcoming_days"] = upcoming_days

        return await self._request("GET", ENDPOINT_AVAILABLE_TASKS, params=params)

    async def get_recent_completions(
        self,
        username: str | None = None,
        days: int | None = None,
        limit: int | None = None,
    ) -> dict[str, Any]:
        """Get recent task completions."""
        params: dict[str, Any] = {}
        if username:
            params["assigned_to"] = username
        if days is not None:
            params["days"] = days
        if limit is not None:
            params["limit"] = limit

        return await self._request("GET", ENDPOINT_RECENT_COMPLETIONS, params=params)

    async def list_leftovers(self, username: str | None = None) -> dict[str, Any]:
        """List all leftovers."""
        params: dict[str, Any] = {}
        if username:
            params["assigned_to"] = username

        return await self._request("GET", ENDPOINT_LIST_LEFTOVERS, params=params)

    async def get_all_tasks(
        self,
        thin: bool = False,  # noqa: FBT001, FBT002
        username: str | None = None,
    ) -> dict[str, Any]:
        """Get all tasks with optional filtering."""
        params: dict[str, Any] = {"thin": str(thin).lower()}
        if username:
            params["assigned_to"] = username

        return await self._request("GET", ENDPOINT_ALL_TASKS, params=params)

    # Completion editing methods
    async def delete_completion(self, completion_id: int) -> dict[str, Any]:
        """Delete/undo a completion record."""
        data = {"completion_id": completion_id}
        return await self._request("POST", ENDPOINT_DELETE_COMPLETION, data=data)

    async def update_completion(
        self,
        completion_id: int,
        completed_by: str | None = None,
        notes: str | None = None,
        completed_at: str | None = None,
    ) -> dict[str, Any]:
        """Update a completion record."""
        data: dict[str, Any] = {"completion_id": completion_id}

        if completed_by is not None:
            data["completed_by"] = completed_by
        if notes is not None:
            data["notes"] = notes
        if completed_at is not None:
            data["completed_at"] = completed_at

        return await self._request("POST", ENDPOINT_UPDATE_COMPLETION, data=data)

    # Daily Plan & Daily State

    async def get_daily_plan(
        self,
        username: str | None,
        fair_weather: bool | None = None,
        select_recommended: bool | None = None,
    ) -> dict[str, Any]:
        """Retrieve the daily plan for a user."""
        params: dict[str, Any] = {}
        if username:
            params["username"] = username
        if fair_weather is not None:
            params["fair_weather"] = str(fair_weather).lower()
        if select_recommended is not None:
            params["select_recommended"] = str(select_recommended).lower()

        return await self._request("GET", ENDPOINT_DAILY_PLAN, params=params)

    async def get_daily_plan_encouragement(
        self, username: str | None
    ) -> dict[str, Any]:
        """Retrieve AI-powered encouragement for the daily plan."""
        params: dict[str, Any] = {}
        if username:
            params["username"] = username

        return await self._request(
            "GET", ENDPOINT_DAILY_PLAN_ENCOURAGEMENT, params=params
        )

    async def get_daily_state(self, username: str) -> dict[str, Any]:
        """Retrieve the daily state for a user."""
        params = {"username": username}
        return await self._request("GET", ENDPOINT_DAILY_STATE, params=params)

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
        data: dict[str, Any] = {"username": username}

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

        return await self._request("POST", ENDPOINT_DAILY_STATE, data=data)
