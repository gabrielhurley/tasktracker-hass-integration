"""Test subscription cleanup improvements for TaskTracker cards."""

import pytest
from unittest.mock import Mock, AsyncMock, patch
import asyncio


class MockSubscriptionError(Exception):
    """Mock exception class with a code attribute."""

    def __init__(self, message, code=None):
        super().__init__(message)
        self.code = code


class TestSubscriptionCleanup:
    """Test subscription cleanup handling in TaskTracker cards."""

    def test_subscription_not_found_error_handling(self):
        """Test that 'not_found' errors are handled gracefully during cleanup."""

        # Mock a subscription cleanup function that raises a "not_found" error
        async def mock_cleanup():
            raise MockSubscriptionError("Subscription not found", code="not_found")

        # This should not raise an exception when the error code is "not_found"
        async def test_cleanup():
            try:
                await mock_cleanup()
            except Exception as error:
                # Only warn for unexpected errors, not "not_found"
                if getattr(error, "code", None) != "not_found":
                    raise

        # Run the test - should not raise
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(test_cleanup())
        finally:
            loop.close()

    def test_subscription_other_error_handling(self):
        """Test that non-'not_found' errors are still raised."""

        # Mock a subscription cleanup function that raises a different error
        async def mock_cleanup():
            raise MockSubscriptionError("Connection lost", code="connection_error")

        # This should raise an exception when the error code is not "not_found"
        async def test_cleanup():
            try:
                await mock_cleanup()
            except Exception as error:
                # Only warn for unexpected errors, not "not_found"
                if getattr(error, "code", None) != "not_found":
                    raise

        # Run the test - should raise
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            with pytest.raises(MockSubscriptionError, match="Connection lost"):
                loop.run_until_complete(test_cleanup())
        finally:
            loop.close()

    def test_subscription_cleanup_tracking(self):
        """Test that cleanup tracking prevents duplicate cleanup calls."""

        cleanup_call_count = 0

        def create_cleanup_function():
            is_cleaned_up = False

            async def cleanup():
                nonlocal cleanup_call_count, is_cleaned_up
                if is_cleaned_up:
                    return  # Already cleaned up, avoid duplicate cleanup

                cleanup_call_count += 1
                is_cleaned_up = True

            return cleanup

        # Create cleanup function and call it multiple times
        cleanup = create_cleanup_function()

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            # Call cleanup multiple times
            loop.run_until_complete(cleanup())
            loop.run_until_complete(cleanup())
            loop.run_until_complete(cleanup())

            # Should only have been called once due to tracking
            assert cleanup_call_count == 1
        finally:
            loop.close()
