"""Tests for TaskTracker services."""

from unittest.mock import AsyncMock, patch

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.tasktracker.api import TaskTrackerAPIError
from custom_components.tasktracker.const import (
    DOMAIN,
    SERVICE_COMPLETE_TASK,
    SERVICE_COMPLETE_TASK_BY_NAME,
    SERVICE_CREATE_ADHOC_TASK,
    SERVICE_CREATE_LEFTOVER,
    SERVICE_GET_ALL_TASKS,
    SERVICE_GET_AVAILABLE_TASKS,
    SERVICE_GET_AVAILABLE_USERS,
    SERVICE_GET_RECENT_COMPLETIONS,
    SERVICE_GET_RECOMMENDED_TASKS,
    SERVICE_LIST_LEFTOVERS,
    SERVICE_QUERY_TASK,
)


class TestTaskTrackerServices:
    """Test TaskTracker services."""

    @pytest.fixture
    def setup_integration(
        self, hass: HomeAssistant, mock_config_entry: MockConfigEntry
    ) -> AsyncMock:
        """Set up the integration for testing."""
        mock_config_entry.add_to_hass(hass)

        # Mock API
        mock_api = AsyncMock()
        hass.data[DOMAIN] = {
            mock_config_entry.entry_id: {
                "api": mock_api,
                "config": mock_config_entry.data,
            }
        }
        return mock_api

    @pytest.mark.asyncio
    async def test_complete_task_service(
        self, hass: HomeAssistant, setup_integration: AsyncMock
    ) -> None:
        """Test complete_task service."""
        mock_api = setup_integration
        mock_api.complete_task.return_value = {
            "status": "success",
            "message": "Task completed successfully",
        }

        with patch(
            "custom_components.tasktracker.services.get_tasktracker_username_for_ha_user"
        ) as mock_get_user:
            mock_get_user.return_value = "testuser"

            # Register the service
            from custom_components.tasktracker.services import async_setup_services

            await async_setup_services(hass, mock_api, {})

            # Call the service
            await hass.services.async_call(
                DOMAIN,
                SERVICE_COMPLETE_TASK,
                {"task_id": 123, "notes": "Completed via test"},
                blocking=True,
                return_response=True,
            )

            # Verify API was called
            mock_api.complete_task.assert_called_once_with(
                task_id=123, assigned_to="testuser", notes="Completed via test"
            )

    @pytest.mark.asyncio
    async def test_complete_task_service_with_username(
        self, hass: HomeAssistant, setup_integration: AsyncMock
    ) -> None:
        """Test complete_task service with explicit username."""
        mock_api = setup_integration
        mock_api.complete_task.return_value = {
            "status": "success",
            "message": "Task completed successfully",
        }

        from custom_components.tasktracker.services import async_setup_services

        await async_setup_services(hass, mock_api, {})

        # Call the service with explicit username
        await hass.services.async_call(
            DOMAIN,
            SERVICE_COMPLETE_TASK,
            {
                "task_id": 123,
                "assigned_to": "explicituser",
                "notes": "Completed via test",
            },
            blocking=True,
            return_response=True,
        )

        # Verify API was called with explicit username
        mock_api.complete_task.assert_called_once_with(
            task_id=123, assigned_to="explicituser", notes="Completed via test"
        )

    @pytest.mark.asyncio
    async def test_complete_task_by_name_service(
        self, hass: HomeAssistant, setup_integration: AsyncMock
    ) -> None:
        """Test complete_task_by_name service."""
        mock_api = setup_integration
        mock_api.complete_task_by_name.return_value = {
            "status": "success",
            "message": "Task completed by name successfully",
        }

        with patch(
            "custom_components.tasktracker.services.get_tasktracker_username_for_ha_user"
        ) as mock_get_user:
            mock_get_user.return_value = "testuser"

            from custom_components.tasktracker.services import async_setup_services

            await async_setup_services(hass, mock_api, {})

            # Call the service
            await hass.services.async_call(
                DOMAIN,
                SERVICE_COMPLETE_TASK_BY_NAME,
                {"name": "Test Task", "notes": "Completed by name"},
                blocking=True,
                return_response=True,
            )

            # Verify API was called
            mock_api.complete_task_by_name.assert_called_once_with(
                name="Test Task", assigned_to="testuser", notes="Completed by name"
            )

    @pytest.mark.asyncio
    async def test_create_leftover_service(
        self, hass: HomeAssistant, setup_integration: AsyncMock
    ) -> None:
        """Test create_leftover service."""
        mock_api = setup_integration
        mock_api.create_leftover.return_value = {
            "status": "success",
            "data": {"id": 456, "name": "leftover pizza"},
        }

        with patch(
            "custom_components.tasktracker.services.get_tasktracker_username_for_ha_user"
        ) as mock_get_user:
            mock_get_user.return_value = "testuser"

            # Register the service
            from custom_components.tasktracker.services import async_setup_services

            await async_setup_services(hass, mock_api, {})

            # Call the service
            await hass.services.async_call(
                DOMAIN,
                SERVICE_CREATE_LEFTOVER,
                {"name": "leftover pizza", "shelf_life_days": 3},
                blocking=True,
                return_response=True,
            )

            # Verify API was called
            mock_api.create_leftover.assert_called_once_with(
                name="leftover pizza",
                assigned_to=None,
                shelf_life_days=3,
                days_ago=None,
            )

    @pytest.mark.asyncio
    async def test_create_leftover_service_with_all_params(
        self, hass: HomeAssistant, setup_integration: AsyncMock
    ) -> None:
        """Test create_leftover service with all parameters."""
        mock_api = setup_integration
        mock_api.create_leftover.return_value = {
            "status": "success",
            "data": {"id": 456, "name": "leftover pizza"},
        }

        from custom_components.tasktracker.services import async_setup_services

        await async_setup_services(hass, mock_api, {})

        # Call the service with all parameters
        await hass.services.async_call(
            DOMAIN,
            SERVICE_CREATE_LEFTOVER,
            {
                "name": "leftover pizza",
                "assigned_to": "testuser",
                "shelf_life_days": 3,
                "days_ago": 1,
            },
            blocking=True,
            return_response=True,
        )

        # Verify API was called with all parameters
        mock_api.create_leftover.assert_called_once_with(
            name="leftover pizza",
            assigned_to="testuser",
            shelf_life_days=3,
            days_ago=1,
        )

    @pytest.mark.asyncio
    async def test_create_adhoc_task_service(
        self, hass: HomeAssistant, setup_integration: AsyncMock
    ) -> None:
        """Test create_adhoc_task service."""
        mock_api = setup_integration
        mock_api.create_adhoc_task.return_value = {
            "status": "success",
            "data": {"id": 789, "name": "adhoc task"},
        }

        with patch(
            "custom_components.tasktracker.services.get_tasktracker_username_for_ha_user"
        ) as mock_get_user:
            mock_get_user.return_value = "testuser"

            from custom_components.tasktracker.services import async_setup_services

            await async_setup_services(hass, mock_api, {})

            # Call the service
            await hass.services.async_call(
                DOMAIN,
                SERVICE_CREATE_ADHOC_TASK,
                {"name": "adhoc task", "duration_minutes": 30, "priority": 3},
                blocking=True,
                return_response=True,
            )

            # Verify API was called
            mock_api.create_adhoc_task.assert_called_once_with(
                name="adhoc task",
                assigned_to="testuser",
                duration_minutes=30,
                priority=3,
            )

    @pytest.mark.asyncio
    async def test_query_task_service(
        self, hass: HomeAssistant, setup_integration: AsyncMock
    ) -> None:
        """Test query_task service."""
        mock_api = setup_integration
        mock_api.query_task.return_value = {
            "status": "success",
            "data": {"name": "Test Task", "safe_to_eat": True},
        }

        from custom_components.tasktracker.services import async_setup_services

        await async_setup_services(hass, mock_api, {})

        # Call the service
        await hass.services.async_call(
            DOMAIN,
            SERVICE_QUERY_TASK,
            {"name": "Test Task", "question_type": "safe_to_eat"},
            blocking=True,
        )

        # Verify API was called
        mock_api.query_task.assert_called_once_with(
            name="Test Task", question_type="safe_to_eat"
        )

    @pytest.mark.asyncio
    async def test_get_recommended_tasks_service(
        self, hass: HomeAssistant, setup_integration: AsyncMock
    ) -> None:
        """Test get_recommended_tasks service."""
        mock_api = setup_integration
        mock_api.get_recommended_tasks.return_value = {
            "status": "success",
            "data": {
                "tasks": [
                    {"id": 1, "name": "Quick task", "duration": 15},
                    {"id": 2, "name": "Medium task", "duration": 30},
                ]
            },
        }

        with patch(
            "custom_components.tasktracker.services.get_tasktracker_username_for_ha_user"
        ) as mock_get_user:
            mock_get_user.return_value = "testuser"

            # Register the service
            from custom_components.tasktracker.services import async_setup_services

            await async_setup_services(hass, mock_api, {})

            # Call the service
            await hass.services.async_call(
                DOMAIN,
                SERVICE_GET_RECOMMENDED_TASKS,
                {"available_minutes": 30},
                blocking=True,
                return_response=True,
            )

            # Verify API was called
            mock_api.get_recommended_tasks.assert_called_once_with(
                assigned_to="testuser", available_minutes=30
            )

    @pytest.mark.asyncio
    async def test_get_available_tasks_service(
        self, hass: HomeAssistant, setup_integration: AsyncMock
    ) -> None:
        """Test get_available_tasks service."""
        mock_api = setup_integration
        mock_api.get_available_tasks.return_value = {
            "status": "success",
            "data": {"tasks": [{"id": 1, "name": "Available task"}]},
        }

        from custom_components.tasktracker.services import async_setup_services

        await async_setup_services(hass, mock_api, {})

        # Call the service
        await hass.services.async_call(
            DOMAIN,
            SERVICE_GET_AVAILABLE_TASKS,
            {"assigned_to": "testuser", "available_minutes": 45, "upcoming_days": 7},
            blocking=True,
            return_response=True,
        )

        # Verify API was called
        mock_api.get_available_tasks.assert_called_once_with(
            assigned_to="testuser", available_minutes=45, upcoming_days=7
        )

    @pytest.mark.asyncio
    async def test_get_recent_completions_service(
        self, hass: HomeAssistant, setup_integration: AsyncMock
    ) -> None:
        """Test get_recent_completions service."""
        mock_api = setup_integration
        mock_api.get_recent_completions.return_value = {
            "status": "success",
            "data": {"completions": [{"id": 1, "name": "Completed task"}]},
        }

        from custom_components.tasktracker.services import async_setup_services

        await async_setup_services(hass, mock_api, {})

        # Call the service
        await hass.services.async_call(
            DOMAIN,
            SERVICE_GET_RECENT_COMPLETIONS,
            {"assigned_to": "testuser", "days": 7, "limit": 10},
            blocking=True,
            return_response=True,
        )

        # Verify API was called
        mock_api.get_recent_completions.assert_called_once_with(
            assigned_to="testuser", days=7, limit=10
        )

    @pytest.mark.asyncio
    async def test_list_leftovers_service(
        self, hass: HomeAssistant, setup_integration: AsyncMock
    ) -> None:
        """Test list_leftovers service."""
        mock_api = setup_integration
        mock_api.list_leftovers.return_value = {
            "status": "success",
            "data": {"leftovers": [{"id": 1, "name": "leftover pizza"}]},
        }

        from custom_components.tasktracker.services import async_setup_services

        await async_setup_services(hass, mock_api, {})

        # Call the service
        response = await hass.services.async_call(
            DOMAIN,
            SERVICE_LIST_LEFTOVERS,
            {},
            blocking=True,
            return_response=True,
        )

        # Verify API was called and response is returned
        mock_api.list_leftovers.assert_called_once()
        assert response is not None
        assert response["status"] == "success"

    @pytest.mark.asyncio
    async def test_get_all_tasks_service(
        self, hass: HomeAssistant, setup_integration: AsyncMock
    ) -> None:
        """Test get_all_tasks service with thin parameter."""
        mock_api = setup_integration
        mock_api.get_all_tasks.return_value = {
            "status": "success",
            "data": {"tasks": [{"id": 1, "name": "test task"}]},
        }

        from custom_components.tasktracker.services import async_setup_services

        await async_setup_services(hass, mock_api, {})

        # Call the service with thin parameter
        response = await hass.services.async_call(
            DOMAIN,
            SERVICE_GET_ALL_TASKS,
            {"thin": True},
            blocking=True,
            return_response=True,
        )

        # Verify API was called with thin=True and response is returned
        mock_api.get_all_tasks.assert_called_once_with(thin=True, assigned_to=None)
        assert response is not None
        assert response["status"] == "success"

    @pytest.mark.asyncio
    async def test_get_all_tasks_service_no_params(
        self, hass: HomeAssistant, setup_integration: AsyncMock
    ) -> None:
        """Test get_all_tasks service without parameters."""
        mock_api = setup_integration
        mock_api.get_all_tasks.return_value = {
            "status": "success",
            "data": {"tasks": [{"id": 1, "name": "test task"}]},
        }

        from custom_components.tasktracker.services import async_setup_services

        await async_setup_services(hass, mock_api, {})

        # Call the service without parameters
        response = await hass.services.async_call(
            DOMAIN,
            SERVICE_GET_ALL_TASKS,
            {},
            blocking=True,
            return_response=True,
        )

        # Verify API was called with thin=False (default) and assigned_to=None and response is returned
        mock_api.get_all_tasks.assert_called_once_with(thin=False, assigned_to=None)
        assert response is not None
        assert response["status"] == "success"

    @pytest.mark.asyncio
    async def test_service_missing_user_context(
        self, hass: HomeAssistant, setup_integration: AsyncMock
    ) -> None:
        """Test service behavior when user context is missing."""
        mock_api = setup_integration

        with patch(
            "custom_components.tasktracker.services.get_tasktracker_username_for_ha_user"
        ) as mock_get_user:
            mock_get_user.return_value = None

            # Register the service
            from custom_components.tasktracker.services import async_setup_services

            await async_setup_services(hass, mock_api, {})

            # Call the service - should raise validation error
            with pytest.raises(TaskTrackerAPIError):
                await hass.services.async_call(
                    DOMAIN,
                    SERVICE_COMPLETE_TASK,
                    {"task_id": 123},
                    blocking=True,
                    return_response=True,
                )

    @pytest.mark.asyncio
    async def test_service_api_error(
        self, hass: HomeAssistant, setup_integration: AsyncMock
    ) -> None:
        """Test service behavior when API returns an error."""
        mock_api = setup_integration
        mock_api.complete_task.return_value = {
            "status": "error",
            "message": "Task not found",
        }

        with patch(
            "custom_components.tasktracker.services.get_tasktracker_username_for_ha_user"
        ) as mock_get_user:
            mock_get_user.return_value = "testuser"

            # Register the service
            from custom_components.tasktracker.services import async_setup_services

            await async_setup_services(hass, mock_api, {})

            # Call the service - API error should not necessarily raise an exception
            await hass.services.async_call(
                DOMAIN,
                SERVICE_COMPLETE_TASK,
                {"task_id": 999},
                blocking=True,
                return_response=True,
            )

    @pytest.mark.asyncio
    async def test_service_api_exception_handling(
        self, hass: HomeAssistant, setup_integration: AsyncMock
    ) -> None:
        """Test service behavior when API raises exceptions."""
        mock_api = setup_integration
        mock_api.complete_task.side_effect = TaskTrackerAPIError("API Error")

        with patch(
            "custom_components.tasktracker.services.get_tasktracker_username_for_ha_user"
        ) as mock_get_user:
            mock_get_user.return_value = "testuser"

            from custom_components.tasktracker.services import async_setup_services

            await async_setup_services(hass, mock_api, {})

            # Call the service - should raise the API error
            with pytest.raises(TaskTrackerAPIError):
                await hass.services.async_call(
                    DOMAIN,
                    SERVICE_COMPLETE_TASK,
                    {"task_id": 123},
                    blocking=True,
                    return_response=True,
                )

    @pytest.mark.asyncio
    async def test_service_unexpected_exception_handling(
        self, hass: HomeAssistant, setup_integration: AsyncMock
    ) -> None:
        """Test service behavior when unexpected exceptions occur."""
        mock_api = setup_integration
        mock_api.complete_task.side_effect = ValueError("Unexpected error")

        with patch(
            "custom_components.tasktracker.services.get_tasktracker_username_for_ha_user"
        ) as mock_get_user:
            mock_get_user.return_value = "testuser"

            from custom_components.tasktracker.services import async_setup_services

            await async_setup_services(hass, mock_api, {})

            # Call the service - should raise the unexpected error
            with pytest.raises(ValueError):  # noqa: PT011
                await hass.services.async_call(
                    DOMAIN,
                    SERVICE_COMPLETE_TASK,
                    {"task_id": 123},
                    blocking=True,
                    return_response=True,
                )

    @pytest.mark.asyncio
    async def test_async_unload_services(
        self, hass: HomeAssistant, setup_integration: AsyncMock
    ) -> None:
        """Test unloading services."""
        mock_api = setup_integration

        from custom_components.tasktracker.services import (
            async_setup_services,
            async_unload_services,
        )

        # Setup services first
        await async_setup_services(hass, mock_api, {})

        # Verify services are registered
        assert hass.services.has_service(DOMAIN, SERVICE_COMPLETE_TASK)
        assert hass.services.has_service(DOMAIN, SERVICE_CREATE_LEFTOVER)

        # Unload services
        await async_unload_services(hass)

        # Verify services are unregistered
        assert not hass.services.has_service(DOMAIN, SERVICE_COMPLETE_TASK)
        assert not hass.services.has_service(DOMAIN, SERVICE_CREATE_LEFTOVER)

    @pytest.mark.asyncio
    async def test_get_available_users_service_uses_current_config(
        self, hass: HomeAssistant, setup_integration: AsyncMock
    ) -> None:
        """Test that get_available_users service uses current config, not setup config."""  # noqa: E501
        mock_api = setup_integration

        # Initial config with no users
        initial_config = {"users": []}

        # Setup services with initial config
        from custom_components.tasktracker.services import async_setup_services

        await async_setup_services(hass, mock_api, initial_config)

        # Now update the config in the existing hass.data entry
        # The setup_integration fixture already created an entry, so we update it
        for entry_data in hass.data[DOMAIN].values():
            entry_data["config"] = {
                "users": [
                    {"ha_user_id": "user1", "tasktracker_username": "testuser1"},
                    {"ha_user_id": "user2", "tasktracker_username": "testuser2"},
                ]
            }
            break  # Update the first (and only) entry

        # Call the service
        response = await hass.services.async_call(
            DOMAIN,
            SERVICE_GET_AVAILABLE_USERS,
            {},
            blocking=True,
            return_response=True,
        )

        # Should return users from the updated config, not the initial empty config
        assert response is not None
        assert response.get("users") == ["testuser1", "testuser2"]
