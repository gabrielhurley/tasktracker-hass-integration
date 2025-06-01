# TaskTracker Integration Tests

This directory contains unit tests for the TaskTracker Home Assistant integration using the `pytest-homeassistant-custom-component` package.

## Setup

1. Install test dependencies:
   ```bash
   pip install -r requirements-test.txt
   ```

2. Run tests:
   ```bash
   pytest
   ```

3. Run tests with coverage:
   ```bash
   pytest --cov=custom_components.tasktracker --cov-report=html
   ```

## Test Structure

### `conftest.py`
Contains shared fixtures and configuration for all tests:
- `auto_enable_custom_integrations`: Enables custom integrations for testing
- `mock_config_entry`: Creates a mock configuration entry
- `mock_api_response`: Provides sample API response data

### `test_api.py`
Tests for the TaskTracker API client (`custom_components.tasktracker.api`):
- HTTP request formation and headers
- Task completion methods
- Task creation methods
- Task query methods
- Error handling (network errors, API errors)
- Response validation

### `test_init.py`
Tests for integration setup and teardown (`custom_components.tasktracker.__init__`):
- Integration setup success/failure
- Config entry loading/unloading
- Service registration
- Frontend resource registration
- Data structure validation

### `test_config_flow.py`
Tests for configuration flow (`custom_components.tasktracker.config_flow`):
- User form display and validation
- API connection testing
- Authentication validation
- Error handling for invalid credentials
- Options flow testing

### `test_services.py`
Tests for Home Assistant services (`custom_components.tasktracker.services`):
- Service registration and execution
- User context resolution
- API method invocation
- Error handling and validation
- Service response handling

### `test_utils.py`
Tests for utility functions (`custom_components.tasktracker.utils`):
- User context mapping
- Time and duration formatting
- API response validation
- Helper function behavior

## Test Coverage

The tests cover:

### ✅ Core Functionality
- API client HTTP communication
- Integration setup/teardown
- Configuration flow validation
- Service registration and execution
- User context mapping

### ✅ Error Handling
- Network connection failures
- API authentication errors
- Invalid user configurations
- Malformed API responses
- Missing user context

### ✅ Edge Cases
- Empty responses
- Invalid data formats
- Missing configuration
- Service call failures

## Running Specific Tests

Run a specific test file:
```bash
pytest tests/test_api.py
```

Run a specific test method:
```bash
pytest tests/test_api.py::TestTaskTrackerAPI::test_complete_task_success
```

Run tests with specific markers:
```bash
pytest -m asyncio  # Run only async tests
```

## Mock Strategy

Tests use the following mocking approach:
- **API responses**: Mocked using `AsyncMock` and `aioresponses`
- **Home Assistant core**: Uses fixtures from `pytest-homeassistant-custom-component`
- **External dependencies**: Patched at the module level
- **Configuration**: Mock config entries with test data

## Test Data

Test fixtures use realistic data structures matching the actual TaskTracker API:
- Task objects with IDs, names, durations
- User mappings between HA users and TaskTracker usernames
- API responses with proper status/data structure
- Error responses with appropriate error messages

## Continuous Integration

These tests are designed to run in CI environments and support:
- Parallel execution
- Coverage reporting
- Detailed failure output
- Async test handling