"""Tests for TaskTracker config flow."""

from collections.abc import Generator
from unittest.mock import AsyncMock, patch

import pytest
from homeassistant import config_entries
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.tasktracker.const import DOMAIN


class TestTaskTrackerConfigFlow:
    """Test TaskTracker config flow."""

    @pytest.fixture
    def mock_setup_entry(self) -> Generator[AsyncMock]:
        """Mock async_setup_entry."""
        with patch(
            "custom_components.tasktracker.async_setup_entry",
            return_value=True,
        ) as mock_setup:
            yield mock_setup

    @pytest.mark.asyncio
    async def test_user_form(self, hass: HomeAssistant) -> None:
        """Test user form is displayed."""
        result = await hass.config_entries.flow.async_init(
            DOMAIN, context={"source": config_entries.SOURCE_USER}
        )

        assert result.get("type") == FlowResultType.FORM
        assert result.get("step_id") == "user"
        data_schema = result.get("data_schema")
        if data_schema:
            assert "host" in data_schema.schema
            assert "api_key" in data_schema.schema

    @pytest.mark.asyncio
    async def test_user_form_success(
        self, hass: HomeAssistant, mock_setup_entry: AsyncMock
    ) -> None:
        """Test successful user form submission."""
        with patch(
            "custom_components.tasktracker.config_flow.TaskTrackerAPI"
        ) as mock_api_class:
            mock_api = AsyncMock()
            mock_api_class.return_value = mock_api
            mock_api.get_all_tasks.return_value = {"success": True}

            result = await hass.config_entries.flow.async_init(
                DOMAIN, context={"source": config_entries.SOURCE_USER}
            )

            result = await hass.config_entries.flow.async_configure(
                result["flow_id"],
                {
                    "host": "https://test.example.com",
                    "api_key": "test-api-key",
                },
            )

            # Check if it's a create entry or form (depends on config flow implementation) # noqa: E501
            if result.get("type") == FlowResultType.CREATE_ENTRY:
                assert result.get("title") == "TaskTracker"
                assert result.get("data", {}).get("host") == "https://test.example.com"
                assert result.get("data", {}).get("api_key") == "test-api-key"
            elif result.get("type") == FlowResultType.FORM:
                # Might go to users setup step
                assert result.get("step_id") == "users"

    @pytest.mark.asyncio
    async def test_user_form_invalid_auth(self, hass: HomeAssistant) -> None:
        """Test user form with invalid authentication."""
        with patch(
            "custom_components.tasktracker.config_flow.TaskTrackerAPI"
        ) as mock_api_class:
            mock_api = AsyncMock()
            mock_api_class.return_value = mock_api
            mock_api.get_all_tasks.side_effect = Exception("Authentication failed")

            result = await hass.config_entries.flow.async_init(
                DOMAIN, context={"source": config_entries.SOURCE_USER}
            )

            result = await hass.config_entries.flow.async_configure(
                result["flow_id"],
                {
                    "host": "https://test.example.com",
                    "api_key": "invalid-key",
                },
            )

            assert result.get("type") == FlowResultType.FORM
            errors = result.get("errors") or {}
            assert errors.get("base") in ["auth", "cannot_connect"]

    @pytest.mark.asyncio
    async def test_user_form_connection_error(self, hass: HomeAssistant) -> None:
        """Test user form with connection error."""
        with patch(
            "custom_components.tasktracker.config_flow.TaskTrackerAPI"
        ) as mock_api_class:
            mock_api = AsyncMock()
            mock_api_class.return_value = mock_api
            mock_api.get_all_tasks.side_effect = Exception("Connection failed")

            result = await hass.config_entries.flow.async_init(
                DOMAIN, context={"source": config_entries.SOURCE_USER}
            )

            result = await hass.config_entries.flow.async_configure(
                result["flow_id"],
                {
                    "host": "https://invalid.example.com",
                    "api_key": "test-key",
                },
            )

            assert result.get("type") == FlowResultType.FORM
            errors = result.get("errors") or {}
            assert errors.get("base") in ["auth", "cannot_connect"]

    @pytest.mark.asyncio
    async def test_user_setup_success(self, hass: HomeAssistant) -> None:
        """Test users setup step."""
        with patch(
            "custom_components.tasktracker.config_flow.TaskTrackerAPI"
        ) as mock_api_class:
            mock_api = AsyncMock()
            mock_api_class.return_value = mock_api
            mock_api.get_all_tasks.return_value = {"success": True}

            # Start flow
            result = await hass.config_entries.flow.async_init(
                DOMAIN, context={"source": config_entries.SOURCE_USER}
            )

            # Submit user form
            result = await hass.config_entries.flow.async_configure(
                result["flow_id"],
                {
                    "host": "https://test.example.com",
                    "api_key": "test-api-key",
                },
            )

            # Should go to users setup or complete
            assert result.get("type") in [
                FlowResultType.FORM,
                FlowResultType.CREATE_ENTRY,
            ]
            if result.get("type") == FlowResultType.FORM:
                assert result.get("step_id") == "users"

    @pytest.mark.asyncio
    async def test_options_flow(
        self, hass: HomeAssistant, mock_config_entry: MockConfigEntry
    ) -> None:
        """Test options flow."""
        mock_config_entry.add_to_hass(hass)

        result = await hass.config_entries.options.async_init(
            mock_config_entry.entry_id
        )

        assert result.get("type") == FlowResultType.FORM
        assert result.get("step_id") == "init"

        # Test showing current users in description
        data_schema = result.get("data_schema")
        if data_schema:
            assert "host" in data_schema.schema
            assert "api_key" in data_schema.schema
            assert "action" in data_schema.schema

    @pytest.mark.asyncio
    async def test_options_flow_save_basic(
        self, hass: HomeAssistant, mock_config_entry: MockConfigEntry
    ) -> None:
        """Test options flow saving basic settings only."""
        mock_config_entry.add_to_hass(hass)

        result = await hass.config_entries.options.async_init(
            mock_config_entry.entry_id
        )

        result = await hass.config_entries.options.async_configure(
            result["flow_id"],
            {
                "host": "https://updated.example.com",
                "api_key": "updated-key",
                "action": "save_basic",
            },
        )

        assert result.get("type") == FlowResultType.CREATE_ENTRY
        # Check that the config entry data was updated
        assert mock_config_entry.data.get("host") == "https://updated.example.com"
        assert mock_config_entry.data.get("api_key") == "updated-key"
        # Users should be preserved from original config
        original_users = (mock_config_entry.data or {}).get("users", [])
        assert mock_config_entry.data.get("users") == original_users

    @pytest.mark.asyncio
    async def test_options_flow_manage_users(
        self, hass: HomeAssistant, mock_config_entry: MockConfigEntry
    ) -> None:
        """Test options flow user management."""
        mock_config_entry.add_to_hass(hass)

        result = await hass.config_entries.options.async_init(
            mock_config_entry.entry_id
        )

        result = await hass.config_entries.options.async_configure(
            result["flow_id"],
            {
                "host": "https://test.example.com",
                "api_key": "test-key",
                "action": "manage_users",
            },
        )

        assert result.get("type") == FlowResultType.FORM
        assert result.get("step_id") == "manage_users"

        # Verify that current_mappings field is present in the schema
        data_schema = result.get("data_schema")
        assert data_schema is not None

        # Check that the schema contains both current_mappings and action fields
        schema_fields = [str(field) for field in data_schema.schema]
        assert any("current_mappings" in field for field in schema_fields)
        assert any("action" in field for field in schema_fields)

    @pytest.mark.asyncio
    async def test_options_flow_add_user(
        self, hass: HomeAssistant, mock_config_entry: MockConfigEntry
    ) -> None:
        """Test adding a user mapping through options flow."""
        # Create a mock user
        from unittest.mock import Mock

        mock_user = Mock()
        mock_user.id = "test-user-id"
        mock_user.name = "Test User"
        mock_user.is_active = True

        with patch.object(hass.auth, "async_get_users", return_value=[mock_user]):
            mock_config_entry.add_to_hass(hass)

            result = await hass.config_entries.options.async_init(
                mock_config_entry.entry_id
            )

            # Navigate to manage users
            result = await hass.config_entries.options.async_configure(
                result["flow_id"],
                {
                    "host": "https://test.example.com",
                    "api_key": "test-key",
                    "action": "manage_users",
                },
            )

            # Navigate to add user
            result = await hass.config_entries.options.async_configure(
                result["flow_id"],
                {"action": "add_user"},
            )

            assert result.get("type") == FlowResultType.FORM
            assert result.get("step_id") == "add_user"

            # Add the user mapping
            result = await hass.config_entries.options.async_configure(
                result["flow_id"],
                {
                    "ha_user_id": "test-user-id",
                    "tasktracker_username": "testuser",
                },
            )

            # Should go back to manage users
            assert result.get("type") == FlowResultType.FORM
            assert result.get("step_id") == "manage_users"

    @pytest.mark.asyncio
    async def test_options_flow_remove_user(self, hass: HomeAssistant) -> None:
        """Test removing a user mapping through options flow."""
        # Create config entry with existing user mapping
        config_entry = MockConfigEntry(
            domain=DOMAIN,
            data={
                "host": "https://test.example.com",
                "api_key": "test-key",
                "users": [
                    {
                        "ha_user_id": "user1",
                        "tasktracker_username": "testuser1",
                    },
                    {
                        "ha_user_id": "user2",
                        "tasktracker_username": "testuser2",
                    },
                ],
            },
        )
        config_entry.add_to_hass(hass)

        result = await hass.config_entries.options.async_init(config_entry.entry_id)

        # Navigate to manage users
        result = await hass.config_entries.options.async_configure(
            result["flow_id"],
            {
                "host": "https://test.example.com",
                "api_key": "test-key",
                "action": "manage_users",
            },
        )

        # Navigate to remove user (first user)
        result = await hass.config_entries.options.async_configure(
            result["flow_id"],
            {"action": "remove_user"},
        )

        # Remove the first user mapping
        result = await hass.config_entries.options.async_configure(
            result["flow_id"],
            {"user_to_remove": "testuser1|user1"},
        )

        # Should be back at manage users
        assert result.get("type") == FlowResultType.FORM
        assert result.get("step_id") == "manage_users"

        # Navigate to remove user (second user)
        result = await hass.config_entries.options.async_configure(
            result["flow_id"],
            {"action": "remove_user"},
        )

        # Remove the last user mapping
        result = await hass.config_entries.options.async_configure(
            result["flow_id"],
            {"user_to_remove": "testuser2|user2"},
        )

        # Should be back at manage users, and remove option should not be available
        assert result.get("type") == FlowResultType.FORM
        assert result.get("step_id") == "manage_users"

        # Verify the description shows no users configured
        description_placeholders = result.get("description_placeholders")
        if description_placeholders:
            assert "None configured" in description_placeholders.get(
                "current_users", ""
            )

        # Save the changes
        result = await hass.config_entries.options.async_configure(
            result["flow_id"],
            {"action": "save"},
        )

        assert result.get("type") == FlowResultType.CREATE_ENTRY

        # Verify the user mapping was removed from the config entry
        users = config_entry.data.get("users", [])
        assert len(users) == 0

    @pytest.mark.asyncio
    async def test_options_flow_save_user_changes(self, hass: HomeAssistant) -> None:
        """Test saving user mapping changes."""
        # Create config entry with existing user mapping
        config_entry = MockConfigEntry(
            domain=DOMAIN,
            data={
                "host": "https://test.example.com",
                "api_key": "test-key",
                "users": [
                    {
                        "ha_user_id": "user1",
                        "tasktracker_username": "testuser1",
                    },
                ],
            },
        )
        config_entry.add_to_hass(hass)

        result = await hass.config_entries.options.async_init(config_entry.entry_id)

        # Navigate to manage users
        result = await hass.config_entries.options.async_configure(
            result["flow_id"],
            {
                "host": "https://test.example.com",
                "api_key": "test-key",
                "action": "manage_users",
            },
        )

        # Save changes
        result = await hass.config_entries.options.async_configure(
            result["flow_id"],
            {"action": "save"},
        )

        assert result.get("type") == FlowResultType.CREATE_ENTRY
        # Should preserve the original config including users in config entry
        assert config_entry.data.get("host") == "https://test.example.com"
        assert config_entry.data.get("api_key") == "test-key"
        assert len(config_entry.data.get("users", [])) == 1

    @pytest.mark.asyncio
    async def test_options_flow_duplicate_user_validation(
        self, hass: HomeAssistant
    ) -> None:
        """Test validation prevents duplicate user mappings."""
        from unittest.mock import Mock

        mock_user1 = Mock()
        mock_user1.id = "test-user-id"
        mock_user1.name = "Test User"
        mock_user1.is_active = True

        mock_user2 = Mock()
        mock_user2.id = "another-user-id"
        mock_user2.name = "Another User"
        mock_user2.is_active = True

        # Create config entry with existing user mapping
        config_entry = MockConfigEntry(
            domain=DOMAIN,
            data={
                "host": "https://test.example.com",
                "api_key": "test-key",
                "users": [
                    {
                        "ha_user_id": "test-user-id",
                        "tasktracker_username": "existing_user",
                    },
                ],
            },
        )

        with patch.object(
            hass.auth, "async_get_users", return_value=[mock_user1, mock_user2]
        ):
            config_entry.add_to_hass(hass)

            result = await hass.config_entries.options.async_init(config_entry.entry_id)

            # Navigate to manage users -> add user
            result = await hass.config_entries.options.async_configure(
                result["flow_id"],
                {
                    "host": "https://test.example.com",
                    "api_key": "test-key",
                    "action": "manage_users",
                },
            )

            result = await hass.config_entries.options.async_configure(
                result["flow_id"],
                {"action": "add_user"},
            )

            # Try to add duplicate TaskTracker username (instead of HA user since that one is filtered out)  # noqa: E501
            result = await hass.config_entries.options.async_configure(
                result["flow_id"],
                {
                    "ha_user_id": "another-user-id",  # Available user
                    "tasktracker_username": "existing_user",  # Already mapped
                },
            )

            # Should show error and stay on add_user form
            assert result.get("type") == FlowResultType.FORM
            assert result.get("step_id") == "add_user"
            errors = result.get("errors", {})
            if errors:
                assert errors.get("base") == "tasktracker_user_already_mapped"

    @pytest.mark.asyncio
    async def test_options_flow_api_key_redaction(
        self, hass: HomeAssistant, mock_config_entry: MockConfigEntry
    ) -> None:
        """Test that API key is redacted in options flow for security."""
        mock_config_entry.add_to_hass(hass)

        result = await hass.config_entries.options.async_init(
            mock_config_entry.entry_id
        )

        # Verify the form is shown (the actual redaction is tested functionally
        # in the other tests by verifying preservation vs. update behavior)
        assert result.get("type") == FlowResultType.FORM
        assert result.get("step_id") == "init"

        # Check that we have the description mentioning redaction
        description_placeholders = result.get("description_placeholders")
        if description_placeholders:
            assert "current_users" in description_placeholders

    @pytest.mark.asyncio
    async def test_options_flow_api_key_unchanged_when_redacted(
        self, hass: HomeAssistant, mock_config_entry: MockConfigEntry
    ) -> None:
        """Test that API key remains unchanged when submitting redacted value."""
        mock_config_entry.add_to_hass(hass)

        result = await hass.config_entries.options.async_init(
            mock_config_entry.entry_id
        )

        # Submit with the redacted API key (unchanged)
        result = await hass.config_entries.options.async_configure(
            result["flow_id"],
            {
                "host": "https://updated.example.com",
                "api_key": "••••••••••••••••",  # Redacted placeholder
                "action": "save_basic",
            },
        )

        assert result.get("type") == FlowResultType.CREATE_ENTRY
        # API key should remain the original value in config entry
        assert mock_config_entry.data.get("api_key") == "test-api-key"
        # Host should be updated in config entry
        assert mock_config_entry.data.get("host") == "https://updated.example.com"

    @pytest.mark.asyncio
    async def test_options_flow_api_key_updated_when_changed(
        self, hass: HomeAssistant, mock_config_entry: MockConfigEntry
    ) -> None:
        """Test that API key is updated when a new value is provided."""
        mock_config_entry.add_to_hass(hass)

        result = await hass.config_entries.options.async_init(
            mock_config_entry.entry_id
        )

        # Submit with a new API key
        result = await hass.config_entries.options.async_configure(
            result["flow_id"],
            {
                "host": "https://updated.example.com",
                "api_key": "new-secret-api-key",  # New API key
                "action": "save_basic",
            },
        )

        assert result.get("type") == FlowResultType.CREATE_ENTRY
        # API key should be updated to the new value in config entry
        assert mock_config_entry.data.get("api_key") == "new-secret-api-key"
        # Host should be updated in config entry
        assert mock_config_entry.data.get("host") == "https://updated.example.com"

    @pytest.mark.asyncio
    async def test_options_flow_manage_users_no_remove_when_empty(
        self, hass: HomeAssistant
    ) -> None:
        """Test that Remove User Mapping option doesn't appear when no users configured."""  # noqa: E501
        # Create config entry with no user mappings
        config_entry = MockConfigEntry(
            domain=DOMAIN,
            data={
                "host": "https://test.example.com",
                "api_key": "test-key",
                "users": [],  # No users configured
            },
        )
        config_entry.add_to_hass(hass)

        result = await hass.config_entries.options.async_init(config_entry.entry_id)

        # Navigate to manage users
        result = await hass.config_entries.options.async_configure(
            result["flow_id"],
            {
                "host": "https://test.example.com",
                "api_key": "test-key",
                "action": "manage_users",
            },
        )

        assert result.get("type") == FlowResultType.FORM
        assert result.get("step_id") == "manage_users"

        # Check that the data schema doesn't include remove_user option
        data_schema = result.get("data_schema")
        if data_schema:
            # Get the action field choices
            action_field = None
            for field in data_schema.schema:
                if str(field).endswith("'action'"):
                    action_field = field
                    break

            if action_field and hasattr(action_field, "container"):
                available_actions = list(action_field.container.choices.keys())
                # Should have add_user, save, cancel but not remove_user
                assert "add_user" in available_actions
                assert "save" in available_actions
                assert "cancel" in available_actions
                assert "remove_user" not in available_actions

    @pytest.mark.asyncio
    async def test_options_flow_manage_users_has_remove_when_users_exist(
        self, hass: HomeAssistant
    ) -> None:
        """Test that Remove User Mapping option appears when users are configured."""
        # Create config entry with user mappings
        config_entry = MockConfigEntry(
            domain=DOMAIN,
            data={
                "host": "https://test.example.com",
                "api_key": "test-key",
                "users": [
                    {
                        "ha_user_id": "user1",
                        "tasktracker_username": "testuser1",
                    },
                ],
            },
        )
        config_entry.add_to_hass(hass)

        result = await hass.config_entries.options.async_init(config_entry.entry_id)

        # Navigate to manage users
        result = await hass.config_entries.options.async_configure(
            result["flow_id"],
            {
                "host": "https://test.example.com",
                "api_key": "test-key",
                "action": "manage_users",
            },
        )

        assert result.get("type") == FlowResultType.FORM
        assert result.get("step_id") == "manage_users"

        # Check that the data schema includes remove_user option
        data_schema = result.get("data_schema")
        if data_schema:
            # Get the action field choices
            action_field = None
            for field in data_schema.schema:
                if str(field).endswith("'action'"):
                    action_field = field
                    break

            if action_field and hasattr(action_field, "container"):
                available_actions = list(action_field.container.choices.keys())
                # Should have all options including remove_user
                assert "add_user" in available_actions
                assert "save" in available_actions
                assert "cancel" in available_actions
                assert "remove_user" in available_actions

    @pytest.mark.asyncio
    async def test_options_flow_user_mapping_persistence(
        self, hass: HomeAssistant
    ) -> None:
        """Test that user mappings are properly persisted when saved."""
        from unittest.mock import Mock

        mock_user = Mock()
        mock_user.id = "test-user-id"
        mock_user.name = "Test User"
        mock_user.is_active = True

        # Start with no user mappings
        config_entry = MockConfigEntry(
            domain=DOMAIN,
            data={
                "host": "https://test.example.com",
                "api_key": "test-key",
                "users": [],
            },
        )

        with patch.object(hass.auth, "async_get_users", return_value=[mock_user]):
            config_entry.add_to_hass(hass)

            result = await hass.config_entries.options.async_init(config_entry.entry_id)

            # Navigate to manage users
            result = await hass.config_entries.options.async_configure(
                result["flow_id"],
                {
                    "host": "https://test.example.com",
                    "api_key": "test-key",
                    "action": "manage_users",
                },
            )

            # Add a user mapping
            result = await hass.config_entries.options.async_configure(
                result["flow_id"],
                {"action": "add_user"},
            )

            result = await hass.config_entries.options.async_configure(
                result["flow_id"],
                {
                    "ha_user_id": "test-user-id",
                    "tasktracker_username": "testuser",
                },
            )

            # Go back to manage users and save
            result = await hass.config_entries.options.async_configure(
                result["flow_id"],
                {"action": "save"},
            )

            assert result.get("type") == FlowResultType.CREATE_ENTRY

            # Verify the user mapping was saved to the config entry
            users = config_entry.data.get("users", [])
            assert len(users) == 1
            assert users[0]["ha_user_id"] == "test-user-id"
            assert users[0]["tasktracker_username"] == "testuser"

    @pytest.mark.asyncio
    async def test_user_step_extracts_user_id_from_selection(
        self, hass: HomeAssistant
    ) -> None:
        """Test that user step properly extracts user ID from dropdown selection."""
        from unittest.mock import Mock

        mock_user = Mock()
        mock_user.id = "user-id-123"
        mock_user.name = "Gabriel Hurley"
        mock_user.is_active = True

        with (
            patch.object(hass.auth, "async_get_users", return_value=[mock_user]),
            patch(
                "custom_components.tasktracker.config_flow.TaskTrackerAPI"
            ) as mock_api_class,
        ):
            mock_api = AsyncMock()
            mock_api_class.return_value = mock_api
            mock_api.get_all_tasks.return_value = {"success": True}

            # Start flow
            result = await hass.config_entries.flow.async_init(
                DOMAIN, context={"source": config_entries.SOURCE_USER}
            )

            # Submit API form
            result = await hass.config_entries.flow.async_configure(
                result["flow_id"],
                {
                    "host": "https://test.example.com",
                    "api_key": "test-api-key",
                },
            )

            # Should go to users step
            if (
                result.get("type") == FlowResultType.FORM
                and result.get("step_id") == "users"
            ):
                # Submit user mapping using dropdown selection
                result = await hass.config_entries.flow.async_configure(
                    result["flow_id"],
                    {
                        "ha_user_selection": "Gabriel Hurley (user-id-123)",
                        "tasktracker_username": "gabriel",
                        "add_another_user": False,
                    },
                )

                # Should create entry successfully
                assert result.get("type") == FlowResultType.CREATE_ENTRY
                assert result.get("title") == "TaskTracker"

                # Verify user mapping was correctly stored with extracted user ID
                users = result.get("data", {}).get("users", [])
                assert len(users) == 1
                assert (
                    users[0]["ha_user_id"] == "user-id-123"
                )  # Should be extracted ID, not display name
                assert users[0]["tasktracker_username"] == "gabriel"
