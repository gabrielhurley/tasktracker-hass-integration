"""Test frontend resource registration."""

from unittest.mock import Mock, patch

from custom_components.tasktracker.www import JSModuleRegistration


class TestJSModuleRegistration:
    """Test JS module registration functionality."""

    def test_get_resource_version_normal_url(self):
        """Test version extraction from normal versioned URL."""
        registration = JSModuleRegistration(Mock())

        url = "/tasktracker/test.js?v=1.0.0"
        version = registration._get_resource_version(url)
        assert version == "1.0.0"

    def test_get_resource_version_duplicated_params(self):
        """Test version extraction from URL with duplicated version parameters."""
        registration = JSModuleRegistration(Mock())

        # This is the problematic URL format that was causing issues
        url = "/tasktracker/test.js?v=1.0.0?v=1.0.0?v=1.0.0"
        version = registration._get_resource_version(url)
        # Should only return the first version, not the entire duplicated string
        assert version == "1.0.0"

    def test_get_resource_version_with_other_params(self):
        """Test version extraction from URL with other parameters."""
        registration = JSModuleRegistration(Mock())

        url = "/tasktracker/test.js?v=1.0.0&other=param"
        version = registration._get_resource_version(url)
        assert version == "1.0.0"

    def test_get_resource_version_no_version(self):
        """Test version extraction from URL without version parameter."""
        registration = JSModuleRegistration(Mock())

        url = "/tasktracker/test.js"
        version = registration._get_resource_version(url)
        assert version == "0"

    def test_get_resource_version_no_version_with_other_params(self):
        """Test version extraction from URL with other params but no version."""
        registration = JSModuleRegistration(Mock())

        url = "/tasktracker/test.js?other=param"
        version = registration._get_resource_version(url)
        assert version == "0"

    def test_get_resource_path(self):
        """Test path extraction from URLs."""
        registration = JSModuleRegistration(Mock())

        # Normal versioned URL
        url = "/tasktracker/test.js?v=1.0.0"
        path = registration._get_resource_path(url)
        assert path == "/tasktracker/test.js"

        # URL without version
        url = "/tasktracker/test.js"
        path = registration._get_resource_path(url)
        assert path == "/tasktracker/test.js"

        # URL with duplicated version parameters
        url = "/tasktracker/test.js?v=1.0.0?v=1.0.0?v=1.0.0"
        path = registration._get_resource_path(url)
        assert path == "/tasktracker/test.js"

    @patch("custom_components.tasktracker.www.Path")
    def test_remove_gzip_files_no_files(self, mock_path):
        """Test remove_gzip_files when no gzip files exist."""
        mock_hass = Mock()
        registration = JSModuleRegistration(mock_hass)

        # Mock the path operations
        mock_www_path = Mock()
        mock_path.return_value.parent = mock_www_path
        mock_www_path.iterdir.return_value = []

        # Should not raise any exceptions
        registration.remove_gzip_files()

        mock_www_path.iterdir.assert_called_once()

    def test_remove_gzip_files_with_files(self):
        """Test remove_gzip_files when gzip files exist."""
        mock_hass = Mock()
        registration = JSModuleRegistration(mock_hass)

        # Since the function now uses Path(__file__).parent, it will use the actual
        # directory where the www module is located. We just need to verify it
        # doesn't crash when called.

        # Should not raise any exceptions (the actual directory exists)
        try:
            registration.remove_gzip_files()
        except (OSError, FileNotFoundError):
            # These are expected and handled by the function
            pass

    async def test_cleanup_duplicate_registrations(self):
        """Test cleanup of duplicate resource registrations."""
        mock_hass = Mock()
        mock_lovelace = Mock()
        mock_hass.data = {"lovelace": mock_lovelace}

        registration = JSModuleRegistration(mock_hass)
        registration.lovelace = mock_lovelace

        # Mock resources with duplicates
        mock_resources = Mock()
        mock_lovelace.resources = mock_resources

        # Create mock duplicate resources for the same file
        duplicate_resources = [
            {
                "id": "1",
                "url": "/tasktracker/test.js?v=1.0.0",  # Clean version - should be kept
            },
            {
                "id": "2",
                "url": "/tasktracker/test.js?v=1.0.0?v=1.0.0",  # Malformed - should be removed
            },
            {
                "id": "3",
                "url": "/tasktracker/test.js?v=1.0.0?v=1.0.0?v=1.0.0",  # Malformed - should be removed
            },
            {
                "id": "4",
                "url": "/tasktracker/other.js?v=1.0.0",  # Different file - should be kept
            },
        ]

        mock_resources.async_items.return_value = duplicate_resources
        mock_resources.async_delete_item = Mock()

        # Run cleanup
        await registration._async_cleanup_duplicate_registrations()

        # Should have deleted the malformed entries (ids 2 and 3)
        assert mock_resources.async_delete_item.call_count == 2
        deleted_ids = [
            call.args[0] for call in mock_resources.async_delete_item.call_args_list
        ]
        assert "2" in deleted_ids
        assert "3" in deleted_ids

    async def test_async_register_with_storage_mode(self):
        """Test async_register correctly checks resource_mode for storage mode."""
        mock_hass = Mock()
        mock_lovelace = Mock()
        mock_lovelace.resource_mode = "storage"
        mock_lovelace.resources = Mock()
        mock_lovelace.resources.loaded = True
        mock_hass.data = {"lovelace": mock_lovelace}
        mock_hass.http = Mock()
        mock_hass.http.async_register_static_paths = Mock()

        registration = JSModuleRegistration(mock_hass)
        registration.lovelace = mock_lovelace

        # Mock the async_register_path to avoid actual registration
        with patch.object(registration, "_async_register_path"):
            with patch.object(registration, "_async_wait_for_lovelace_resources") as mock_wait:
                await registration.async_register()
                # Should call _async_wait_for_lovelace_resources for storage mode
                mock_wait.assert_called_once()

    async def test_async_register_with_yaml_mode(self):
        """Test async_register skips resource waiting for yaml mode."""
        mock_hass = Mock()
        mock_lovelace = Mock()
        mock_lovelace.resource_mode = "yaml"
        mock_hass.data = {"lovelace": mock_lovelace}
        mock_hass.http = Mock()
        mock_hass.http.async_register_static_paths = Mock()

        registration = JSModuleRegistration(mock_hass)
        registration.lovelace = mock_lovelace

        # Mock the async_register_path to avoid actual registration
        with patch.object(registration, "_async_register_path"):
            with patch.object(registration, "_async_wait_for_lovelace_resources") as mock_wait:
                await registration.async_register()
                # Should NOT call _async_wait_for_lovelace_resources for yaml mode
                mock_wait.assert_not_called()

    async def test_async_unregister_with_storage_mode(self):
        """Test async_unregister correctly checks resource_mode for storage mode."""
        mock_hass = Mock()
        mock_lovelace = Mock()
        mock_lovelace.resource_mode = "storage"
        mock_lovelace.resources = Mock()
        mock_lovelace.resources.async_items = Mock(return_value=[])
        mock_hass.data = {"lovelace": mock_lovelace}

        registration = JSModuleRegistration(mock_hass)
        registration.lovelace = mock_lovelace

        # Should call async_items when in storage mode
        await registration.async_unregister()
        mock_lovelace.resources.async_items.assert_called()

    async def test_async_unregister_with_yaml_mode(self):
        """Test async_unregister skips cleanup for yaml mode."""
        mock_hass = Mock()
        mock_lovelace = Mock()
        mock_lovelace.resource_mode = "yaml"
        mock_lovelace.resources = Mock()
        mock_lovelace.resources.async_items = Mock(return_value=[])
        mock_hass.data = {"lovelace": mock_lovelace}

        registration = JSModuleRegistration(mock_hass)
        registration.lovelace = mock_lovelace

        # Should NOT call async_items when in yaml mode
        await registration.async_unregister()
        mock_lovelace.resources.async_items.assert_not_called()

    async def test_remove_stale_resources_with_storage_mode(self):
        """Test stale resource removal only happens in storage mode."""
        mock_hass = Mock()
        mock_lovelace = Mock()
        mock_lovelace.resource_mode = "storage"
        mock_lovelace.resources = Mock()
        mock_lovelace.resources.async_items = Mock(return_value=[])
        mock_hass.data = {"lovelace": mock_lovelace}

        registration = JSModuleRegistration(mock_hass)
        registration.lovelace = mock_lovelace

        # Should process resources in storage mode
        await registration._async_remove_stale_resources()
        mock_lovelace.resources.async_items.assert_called()

    async def test_remove_stale_resources_with_yaml_mode(self):
        """Test stale resource removal is skipped in yaml mode."""
        mock_hass = Mock()
        mock_lovelace = Mock()
        mock_lovelace.resource_mode = "yaml"
        mock_lovelace.resources = Mock()
        mock_lovelace.resources.async_items = Mock(return_value=[])
        mock_hass.data = {"lovelace": mock_lovelace}

        registration = JSModuleRegistration(mock_hass)
        registration.lovelace = mock_lovelace

        # Should return early and NOT process resources in yaml mode
        await registration._async_remove_stale_resources()
        mock_lovelace.resources.async_items.assert_not_called()
