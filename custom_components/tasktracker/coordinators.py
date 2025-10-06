"""Data update coordinators for TaskTracker integration."""

from __future__ import annotations

import logging
from datetime import timedelta
from typing import TYPE_CHECKING, Any

from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

    from .api import TaskTrackerAPI

_LOGGER = logging.getLogger(__name__)


class TaskTrackerCoordinator(DataUpdateCoordinator):
    """Base coordinator for TaskTracker data."""

    def __init__(
        self,
        hass: HomeAssistant,
        api: TaskTrackerAPI,
        username: str,
        endpoint_name: str,
        update_interval: timedelta,
    ) -> None:
        """Initialize the coordinator."""
        super().__init__(
            hass,
            _LOGGER,
            name=f"TaskTracker {endpoint_name} ({username})",
            update_interval=update_interval,
        )
        self.api = api
        self.username = username
        self.endpoint_name = endpoint_name


class DailyPlanCoordinator(TaskTrackerCoordinator):
    """Coordinator for daily plan data with background refresh."""

    def __init__(
        self, hass: HomeAssistant, api: TaskTrackerAPI, username: str
    ) -> None:
        """Initialize the daily plan coordinator."""
        super().__init__(
            hass,
            api,
            username,
            "Daily Plan",
            update_interval=timedelta(seconds=180),  # 3 minutes
        )
        self.select_recommended = False
        self.fair_weather = None

    async def _async_update_data(self) -> dict[str, Any]:
        """Fetch data from API."""
        try:
            result = await self.api.get_daily_plan(
                username=self.username,
                select_recommended=self.select_recommended,
                fair_weather=self.fair_weather,
            )
            if result and result.get("success"):
                _LOGGER.debug(
                    "Successfully updated daily plan for %s", self.username
                )
                return result
            error_msg = f"API returned error: {result}"
            _LOGGER.warning(
                "Failed to update daily plan for %s: %s", self.username, error_msg
            )
            raise UpdateFailed(error_msg)
        except UpdateFailed:
            # Re-raise UpdateFailed exceptions
            raise
        except Exception as err:
            error_msg = f"Error fetching daily plan: {err}"
            _LOGGER.warning(
                "Failed to update daily plan for %s: %s", self.username, err
            )
            raise UpdateFailed(error_msg) from err
