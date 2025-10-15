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
    SERVICE_CREATE_TASK_FROM_DESCRIPTION,
    SERVICE_GET_ALL_TASKS,
    SERVICE_GET_AVAILABLE_TASKS,
    SERVICE_GET_AVAILABLE_USERS,
    SERVICE_GET_DAILY_PLAN_ENCOURAGEMENT,
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
            "success": True,
            "spoken_response": "Task completed successfully",
            "data": {"completion": {"task_id": 123}},
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
                {
                    "task_id": 123,
                    "task_type": "RecurringTask",
                    "notes": "Completed via test",
                },
                blocking=True,
                return_response=True,
            )

            # Verify API was called
            mock_api.complete_task.assert_called_once_with(
                task_id=123,
                task_type="RecurringTask",
                completed_by="testuser",
                notes="Completed via test",
                completed_at=None,
            )

    @pytest.mark.asyncio
    async def test_complete_task_service_with_username(
        self, hass: HomeAssistant, setup_integration: AsyncMock
    ) -> None:
        """Test complete_task service with explicit username."""
        mock_api = setup_integration
        mock_api.complete_task.return_value = {
            "success": True,
            "spoken_response": "Task completed successfully",
            "data": {"completion": {"task_id": 123}},
        }

        from custom_components.tasktracker.services import async_setup_services

        await async_setup_services(hass, mock_api, {})

        # Call the service with explicit username
        await hass.services.async_call(
            DOMAIN,
            SERVICE_COMPLETE_TASK,
            {
                "task_id": 123,
                "task_type": "RecurringTask",
                "completed_by": "explicituser",
                "notes": "Completed via test",
            },
            blocking=True,
            return_response=True,
        )

        # Verify API was called with explicit username
        mock_api.complete_task.assert_called_once_with(
            task_id=123,
            task_type="RecurringTask",
            completed_by="explicituser",
            notes="Completed via test",
            completed_at=None,
        )

    @pytest.mark.asyncio
    async def test_complete_task_by_name_service(
        self, hass: HomeAssistant, setup_integration: AsyncMock
    ) -> None:
        """Test complete_task_by_name service."""
        mock_api = setup_integration
        mock_api.complete_task_by_name.return_value = {
            "success": True,
            "spoken_response": "Task completed by name successfully",
            "data": {"completion": {"name": "Test Task"}},
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
                name="Test Task", completed_by="testuser", notes="Completed by name", completed_at=None
            )

    @pytest.mark.asyncio
    async def test_complete_task_by_name_without_username_uses_user_mapping(
        self, hass: HomeAssistant, setup_integration: AsyncMock
    ) -> None:
        """Test complete_task_by_name service without username uses user mapping."""
        mock_api = setup_integration
        mock_api.complete_task_by_name.return_value = {
            "success": True,
            "spoken_response": "Task completed by name successfully",
            "data": {"completion": {"name": "Test Task"}},
        }

        with patch(
            "custom_components.tasktracker.services.get_tasktracker_username_for_ha_user"
        ) as mock_get_user:
            mock_get_user.return_value = "mapped_user"

            from custom_components.tasktracker.services import async_setup_services

            await async_setup_services(hass, mock_api, {})

            # Call the service without username
            await hass.services.async_call(
                DOMAIN,
                SERVICE_COMPLETE_TASK_BY_NAME,
                {"name": "Test Task", "notes": "Completed without username"},
                blocking=True,
                return_response=True,
            )

            # Verify user mapping function was called
            mock_get_user.assert_called_once()

            # Verify API was called with mapped username
            mock_api.complete_task_by_name.assert_called_once_with(
                name="Test Task",
                completed_by="mapped_user",
                notes="Completed without username",
                completed_at=None,
            )

    @pytest.mark.asyncio
    async def test_complete_task_by_name_service_with_completed_at(
        self, hass: HomeAssistant, setup_integration: AsyncMock
    ) -> None:
        """Test complete_task_by_name service with completed_at parameter."""
        mock_api = setup_integration
        mock_api.complete_task_by_name.return_value = {
            "success": True,
            "spoken_response": "Task completed by name successfully",
            "data": {"completion": {"name": "Test Task"}},
        }

        with patch(
            "custom_components.tasktracker.services.get_tasktracker_username_for_ha_user"
        ) as mock_get_user:
            mock_get_user.return_value = "testuser"

            from custom_components.tasktracker.services import async_setup_services

            await async_setup_services(hass, mock_api, {})

            # Call the service with completed_at
            await hass.services.async_call(
                DOMAIN,
                SERVICE_COMPLETE_TASK_BY_NAME,
                {
                    "name": "Test Task",
                    "notes": "Completed in the past",
                    "completed_at": "2024-01-15T14:30:00",
                },
                blocking=True,
                return_response=True,
            )

            # Verify API was called with completed_at
            mock_api.complete_task_by_name.assert_called_once_with(
                name="Test Task",
                completed_by="testuser",
                notes="Completed in the past",
                completed_at="2024-01-15T14:30:00",
            )

    @pytest.mark.asyncio
    async def test_create_leftover_service(
        self, hass: HomeAssistant, setup_integration: AsyncMock
    ) -> None:
        """Test create_leftover service."""
        mock_api = setup_integration
        mock_api.create_leftover.return_value = {
            "success": True,
            "spoken_response": "Leftover created successfully",
            "data": {"leftover": {"id": 456, "name": "leftover pizza"}},
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
                assigned_users=None,
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
            "success": True,
            "spoken_response": "Leftover created successfully",
            "data": {"leftover": {"id": 456, "name": "leftover pizza"}},
        }

        from custom_components.tasktracker.services import async_setup_services

        await async_setup_services(hass, mock_api, {})

        # Call the service with all parameters
        await hass.services.async_call(
            DOMAIN,
            SERVICE_CREATE_LEFTOVER,
            {
                "name": "leftover pizza",
                "assigned_users": ["testuser"],
                "shelf_life_days": 3,
                "days_ago": 1,
            },
            blocking=True,
            return_response=True,
        )

        # Verify API was called with all parameters
        mock_api.create_leftover.assert_called_once_with(
            name="leftover pizza",
            assigned_users=["testuser"],
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
            "success": True,
            "spoken_response": "Task created successfully",
            "data": {"task": {"id": 789, "name": "adhoc task"}},
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
                assigned_users=["testuser"],
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
            "success": True,
            "spoken_response": "Task queried successfully",
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
            "success": True,
            "spoken_response": "Recommended tasks retrieved successfully",
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
                username="testuser", available_minutes=30
            )

    @pytest.mark.asyncio
    async def test_get_recommended_tasks_service_without_username_uses_user_mapping(
        self, hass: HomeAssistant, setup_integration: AsyncMock
    ) -> None:
        """Test get_recommended_tasks service without username uses user mapping."""
        mock_api = setup_integration
        mock_api.get_recommended_tasks.return_value = {
            "success": True,
            "data": {"items": [{"name": "Test Task", "priority": 2}]},
        }

        with patch(
            "custom_components.tasktracker.services.get_tasktracker_username_for_ha_user"
        ) as mock_get_user:
            mock_get_user.return_value = "mapped_user"

            from custom_components.tasktracker.services import async_setup_services

            await async_setup_services(hass, mock_api, {})

            # Call the service without username
            await hass.services.async_call(
                DOMAIN,
                SERVICE_GET_RECOMMENDED_TASKS,
                {"available_minutes": 30},
                blocking=True,
                return_response=True,
            )

            # Verify user mapping function was called
            mock_get_user.assert_called_once()

            # Verify API was called with mapped username
            mock_api.get_recommended_tasks.assert_called_once_with(
                username="mapped_user", available_minutes=30
            )

    @pytest.mark.asyncio
    async def test_get_available_tasks_service(
        self, hass: HomeAssistant, setup_integration: AsyncMock
    ) -> None:
        """Test get_available_tasks service."""
        mock_api = setup_integration
        mock_api.get_available_tasks.return_value = {
            "success": True,
            "spoken_response": "Available tasks retrieved successfully",
            "data": {"tasks": [{"id": 1, "name": "Available task"}]},
        }

        from custom_components.tasktracker.services import async_setup_services

        await async_setup_services(hass, mock_api, {})

        # Call the service
        await hass.services.async_call(
            DOMAIN,
            SERVICE_GET_AVAILABLE_TASKS,
            {"username": "testuser", "available_minutes": 45, "upcoming_days": 7},
            blocking=True,
            return_response=True,
        )

        # Verify API was called
        mock_api.get_available_tasks.assert_called_once_with(
            username="testuser", available_minutes=45, upcoming_days=7
        )

    @pytest.mark.asyncio
    async def test_get_recent_completions_service(
        self, hass: HomeAssistant, setup_integration: AsyncMock
    ) -> None:
        """Test get_recent_completions service."""
        mock_api = setup_integration
        mock_api.get_recent_completions.return_value = {
            "success": True,
            "spoken_response": "Recent completions retrieved successfully",
            "data": {"completions": [{"id": 1, "name": "Completed task"}]},
        }

        from custom_components.tasktracker.services import async_setup_services

        await async_setup_services(hass, mock_api, {})

        # Call the service
        await hass.services.async_call(
            DOMAIN,
            SERVICE_GET_RECENT_COMPLETIONS,
            {"username": "testuser", "days": 7, "limit": 10},
            blocking=True,
            return_response=True,
        )

        # Verify API was called
        mock_api.get_recent_completions.assert_called_once_with(
            username="testuser", days=7, limit=10
        )

    @pytest.mark.asyncio
    async def test_list_leftovers_service(
        self, hass: HomeAssistant, setup_integration: AsyncMock
    ) -> None:
        """Test list_leftovers service."""
        mock_api = setup_integration
        mock_api.list_leftovers.return_value = {
            "success": True,
            "spoken_response": "Leftovers retrieved successfully",
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
        assert response["success"] is True

    @pytest.mark.asyncio
    async def test_get_all_tasks_service(
        self, hass: HomeAssistant, setup_integration: AsyncMock
    ) -> None:
        """Test get_all_tasks service with thin parameter."""
        mock_api = setup_integration
        mock_api.get_all_tasks.return_value = {
            "success": True,
            "spoken_response": "All tasks retrieved successfully",
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
        mock_api.get_all_tasks.assert_called_once_with(thin=True, username=None)
        assert response is not None
        assert response["success"] is True

    @pytest.mark.asyncio
    async def test_get_all_tasks_service_no_params(
        self, hass: HomeAssistant, setup_integration: AsyncMock
    ) -> None:
        """Test get_all_tasks service without parameters."""
        mock_api = setup_integration
        mock_api.get_all_tasks.return_value = {
            "success": True,
            "spoken_response": "All tasks retrieved successfully",
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

        # Verify API was called with thin=False (default) and username=None
        # and response is returned
        mock_api.get_all_tasks.assert_called_once_with(thin=False, username=None)
        assert response is not None
        assert response["success"] is True

    @pytest.mark.asyncio
    async def test_create_task_from_description_uses_user_mapping(
        self, hass: HomeAssistant, setup_integration: AsyncMock
    ) -> None:
        """Test creating a task from description uses HA→TaskTracker user mapping when not provided."""
        mock_api = setup_integration
        mock_api.create_task_from_description.return_value = {
            "success": True,
            "spoken_response": "Task created",
            "data": {"task": {"id": 42, "name": "Do dishes", "task_type": "RecurringTask"}},
        }

        with patch(
            "custom_components.tasktracker.services.get_tasktracker_username_for_ha_user"
        ) as mock_get_user:
            mock_get_user.return_value = "mapped_user"

            from custom_components.tasktracker.services import async_setup_services
            await async_setup_services(hass, mock_api, {})

            await hass.services.async_call(
                DOMAIN,
                SERVICE_CREATE_TASK_FROM_DESCRIPTION,
                {"task_type": "RecurringTask", "task_description": "Do dishes every night"},
                blocking=True,
                return_response=True,
            )

            mock_api.create_task_from_description.assert_called_once_with(
                task_type="RecurringTask",
                task_description="Do dishes every night",
                assigned_users=["mapped_user"],
            )

    @pytest.mark.asyncio
    async def test_create_task_from_description_with_explicit_user(
        self, hass: HomeAssistant, setup_integration: AsyncMock
    ) -> None:
        """Test creating a task from description with explicit assigned_users passes through to API."""
        mock_api = setup_integration
        mock_api.create_task_from_description.return_value = {
            "success": True,
            "spoken_response": "Task created",
            "data": {"task": {"id": 43, "name": "Stretch", "task_type": "SelfCareTask"}},
        }

        from custom_components.tasktracker.services import async_setup_services
        await async_setup_services(hass, mock_api, {})

        await hass.services.async_call(
            DOMAIN,
            SERVICE_CREATE_TASK_FROM_DESCRIPTION,
            {
                "task_type": "SelfCareTask",
                "task_description": "Stretch in the morning",
                "assigned_users": ["alice"],
            },
            blocking=True,
            return_response=True,
        )

        mock_api.create_task_from_description.assert_called_once_with(
            task_type="SelfCareTask",
            task_description="Stretch in the morning",
            assigned_users=["alice"],
        )

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
                    {"task_id": 123, "task_type": "RecurringTask"},
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
            "success": False,
            "spoken_response": "Task not found",
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
                {"task_id": 999, "task_type": "RecurringTask"},
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
                    {"task_id": 123, "task_type": "RecurringTask"},
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
                    {"task_id": 123, "task_type": "RecurringTask"},
                    blocking=True,
                    return_response=True,
                )

    @pytest.mark.asyncio
    async def test_get_daily_plan_encouragement_service(
        self, hass: HomeAssistant, setup_integration: AsyncMock
    ) -> None:
        """Test get_daily_plan_encouragement service."""
        mock_api = setup_integration
        mock_api.get_daily_plan_encouragement.return_value = {
            "success": True,
            "spoken_response": "You're doing great! Keep it up!",
            "data": {
                "encouragement": "You're doing great! Keep it up!",
                "task_count": 3,
                "using_defaults": False,
            },
        }

        from custom_components.tasktracker.services import async_setup_services

        await async_setup_services(hass, mock_api, {})

        # Call the service
        result = await hass.services.async_call(
            DOMAIN,
            SERVICE_GET_DAILY_PLAN_ENCOURAGEMENT,
            {"username": "testuser"},
            blocking=True,
            return_response=True,
        )

        # Verify the result
        assert result["success"] is True
        assert result["spoken_response"] == "You're doing great! Keep it up!"
        assert result["data"]["encouragement"] == "You're doing great! Keep it up!"

        # Verify API was called
        mock_api.get_daily_plan_encouragement.assert_called_once_with(username="testuser")

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
        assert isinstance(response, dict)
        data = response.get("data")
        assert isinstance(data, dict)
        assert data.get("users") == ["testuser1", "testuser2"]
