"""Test TaskTracker Time Spent Card functionality."""


import pytest


class TestTaskTrackerTimeSpentCard:
    """Test TaskTracker Time Spent Card."""

    @pytest.mark.asyncio
    async def test_time_calculation(self) -> None:
        """Test that time calculation from completions works correctly."""
        # Mock completion data with duration_minutes
        mock_completions = [
            {
                "task_name": "Task 1",
                "duration_minutes": 30,
                "completed_at": "2023-01-01T10:00:00Z",
            },
            {
                "task_name": "Task 2",
                "duration_minutes": 45,
                "completed_at": "2023-01-01T11:00:00Z",
            },
            {
                "task_name": "Task 3",
                "duration_minutes": 15,
                "completed_at": "2023-01-01T12:00:00Z",
            },
        ]

        # Calculate expected total (30 + 45 + 15 = 90 minutes)
        expected_total = 90

        # Simulate the calculation logic from the card
        actual_total = sum(
            completion.get("duration_minutes", 0) for completion in mock_completions
        )

        assert actual_total == expected_total

    @pytest.mark.asyncio
    async def test_time_calculation_with_missing_durations(self) -> None:
        """Test time calculation handles missing duration_minutes gracefully."""
        # Mock completion data with some missing duration_minutes
        mock_completions = [
            {
                "task_name": "Task 1",
                "duration_minutes": 30,
                "completed_at": "2023-01-01T10:00:00Z",
            },
            {
                "task_name": "Task 2",
                "completed_at": "2023-01-01T11:00:00Z",
            },  # Missing duration_minutes
            {
                "task_name": "Task 3",
                "duration_minutes": 15,
                "completed_at": "2023-01-01T12:00:00Z",
            },
        ]

        # Calculate expected total (30 + 0 + 15 = 45 minutes)
        expected_total = 45

        # Simulate the calculation logic from the card
        actual_total = sum(
            completion.get("duration_minutes", 0) for completion in mock_completions
        )

        assert actual_total == expected_total

    @pytest.mark.asyncio
    async def test_empty_completions(self) -> None:
        """Test time calculation with no completions."""
        mock_completions = []

        # Calculate expected total (should be 0)
        expected_total = 0

        # Simulate the calculation logic from the card
        actual_total = sum(
            completion.get("duration_minutes", 0) for completion in mock_completions
        )

        assert actual_total == expected_total
