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
    ENDPOINT_LIST_LEFTOVERS,
    ENDPOINT_QUERY_TASK,
    ENDPOINT_RECENT_COMPLETIONS,
    ENDPOINT_RECOMMENDED_TASKS,
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
        self, task_id: int, completed_by: str, notes: str | None = None
    ) -> dict[str, Any]:
        """Complete a task by ID."""
        data: dict[str, Any] = {
            "task_id": task_id,
            "task_type": "recurring",  # Default task type, may need to be configurable
            "completed_by": completed_by,
        }
        if notes:
            data["notes"] = notes

        return await self._request("POST", ENDPOINT_COMPLETE_TASK, data=data)

    async def complete_task_by_name(
        self, name: str, completed_by: str, notes: str | None = None
    ) -> dict[str, Any]:
        """Complete a task by name (supports fuzzy matching across all task types)."""
        data: dict[str, Any] = {
            "name": name,
            "completed_by": completed_by,
        }
        if notes:
            data["notes"] = notes

        return await self._request("POST", ENDPOINT_COMPLETE_TASK_BY_NAME, data=data)

    # Task creation methods
    async def create_leftover(
        self,
        name: str,
        assigned_to: str | None = None,
        shelf_life_days: int | None = None,
        days_ago: int | None = None,
    ) -> dict[str, Any]:
        """Create a new leftover."""
        data: dict[str, Any] = {"name": name}
        if assigned_to:
            data["assigned_to"] = assigned_to
        if shelf_life_days is not None:
            data["shelf_life_days"] = str(shelf_life_days)
        if days_ago is not None:
            data["days_ago"] = str(days_ago)

        return await self._request("POST", ENDPOINT_CREATE_LEFTOVER, data=data)

    async def create_adhoc_task(
        self,
        name: str,
        assigned_to: str,
        duration_minutes: int | None = None,
        priority: int | None = None,
    ) -> dict[str, Any]:
        """Create a new ad-hoc task."""
        data: dict[str, Any] = {
            "name": name,
            "assigned_to": assigned_to,
        }
        if duration_minutes is not None:
            data["duration_minutes"] = duration_minutes
        if priority is not None:
            data["priority"] = priority

        return await self._request("POST", ENDPOINT_CREATE_ADHOC_TASK, data=data)

    # Task update methods
    async def update_task(
        self,
        task_id: int,
        task_type: str,
        assigned_to: str,
        duration_minutes: int | None = None,
        priority: int | None = None,
        next_due: str | None = None,
        frequency_days: int | None = None,
        name: str | None = None,
        notes: str | None = None,
    ) -> dict[str, Any]:
        """Update a task's details."""
        data: dict[str, Any] = {
            "task_id": task_id,
            "task_type": task_type,
            "assigned_to": assigned_to,
        }

        if duration_minutes is not None:
            data["duration_minutes"] = duration_minutes
        if priority is not None:
            data["priority"] = priority
        if next_due is not None:
            data["next_due"] = next_due
        if frequency_days is not None:
            data["frequency_days"] = frequency_days
        if name is not None:
            data["name"] = name
        if notes is not None:
            data["notes"] = notes

        return await self._request("POST", ENDPOINT_UPDATE_TASK, data=data)

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
        self, assigned_to: str, available_minutes: int
    ) -> dict[str, Any]:
        """Get recommended tasks for a user."""
        params = {
            "assigned_to": assigned_to,
            "available_minutes": available_minutes,
        }

        return await self._request("GET", ENDPOINT_RECOMMENDED_TASKS, params=params)

    async def get_available_tasks(
        self,
        assigned_to: str | None = None,
        available_minutes: int | None = None,
        upcoming_days: int | None = None,
    ) -> dict[str, Any]:
        """Get available tasks."""
        params: dict[str, Any] = {}
        if assigned_to:
            params["assigned_to"] = assigned_to
        if available_minutes is not None:
            params["available_minutes"] = available_minutes
        if upcoming_days is not None:
            params["upcoming_days"] = upcoming_days

        return await self._request("GET", ENDPOINT_AVAILABLE_TASKS, params=params)

    async def get_recent_completions(
        self,
        assigned_to: str | None = None,
        days: int | None = None,
        limit: int | None = None,
    ) -> dict[str, Any]:
        """Get recent task completions."""
        params: dict[str, Any] = {}
        if assigned_to:
            params["assigned_to"] = assigned_to
        if days is not None:
            params["days"] = days
        if limit is not None:
            params["limit"] = limit

        return await self._request("GET", ENDPOINT_RECENT_COMPLETIONS, params=params)

    async def list_leftovers(self, assigned_to: str | None = None) -> dict[str, Any]:
        """List all leftovers."""
        params: dict[str, Any] = {}
        if assigned_to:
            params["assigned_to"] = assigned_to

        return await self._request("GET", ENDPOINT_LIST_LEFTOVERS, params=params)

    async def get_all_tasks(
        self,
        thin: bool = False,  # noqa: FBT001, FBT002
        assigned_to: str | None = None,
    ) -> dict[str, Any]:
        """Get all tasks."""
        params: dict[str, Any] = {}
        params["thin"] = str(thin).lower()  # Convert boolean to lowercase string
        if assigned_to:
            params["assigned_to"] = assigned_to

        return await self._request("GET", ENDPOINT_ALL_TASKS, params=params)
