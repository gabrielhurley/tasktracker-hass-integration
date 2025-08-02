# TaskTracker Home Assistant Integration Tests

This directory contains both Python and JavaScript tests for the TaskTracker Home Assistant integration.

## Python Tests

The majority of tests are written in Python using pytest and test the backend Home Assistant integration functionality.

### Running Python Tests

```bash
# Activate virtual environment
source .venv/bin/activate

# Install test dependencies
pip install -r requirements-test.txt

# Run all Python tests
python run_tests.py

# Run specific test file
pytest tests/test_services.py -v

# Run with coverage
pytest --cov=custom_components.tasktracker --cov-report=html
```

## JavaScript Tests

JavaScript tests focus on frontend utility functions and ensure consistent behavior across TaskTracker cards.

### Setup

```bash
# Install Node.js dependencies (from project root)
cd /path/to/tasktracker-hass-integration
npm install
```

### Running JavaScript Tests

```bash
# Run all JavaScript tests
npm test

# Run specific test file
npm run test:tasktracker-utils

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### Test Coverage

The JavaScript tests specifically cover:

- **TaskTrackerUtils.getTaskBorderStyle()** - Ensures consistent border color coding across all cards
- **API data prioritization** - Tests that API-provided overdue info takes precedence over calculated values
- **Overdue severity handling** - Validates color gradations for different severity levels
- **Edge cases** - Missing fields, null values, and malformed data
- **Regression testing** - Prevents specific bugs from reoccurring

### Test Files

- `tasktracker-utils.test.js` - Tests for TaskTracker utility functions

## Continuous Integration

Both Python and JavaScript tests should be run before submitting pull requests:

```bash
# Run all tests
python run_tests.py && npm test
```

## Adding New Tests

### Python Tests
Follow the existing patterns in the test files. Use pytest fixtures and mock Home Assistant components appropriately.

### JavaScript Tests
Use Jest test framework and follow the existing structure:
- Organize tests in `describe()` blocks by functionality
- Use clear, descriptive test names
- Include both positive and negative test cases
- Test edge cases and error conditions