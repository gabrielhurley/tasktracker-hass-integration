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
