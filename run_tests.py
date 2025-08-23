#!/usr/bin/env python3
"""Simple test runner for TaskTracker integration tests."""

import subprocess
import sys
from pathlib import Path


def run_tests() -> int:
    """Run the test suite with coverage."""
    # Check if we're in the right directory
    if not Path("custom_components/tasktracker").exists():
        print("❌ Error: Run this script from the project root directory")  # noqa: T201
        sys.exit(1)

    # Check if test requirements are installed
    try:
        import pytest  # noqa: F401
        import pytest_homeassistant_custom_component  # noqa: F401
    except ImportError as e:
        print(  # noqa: T201
            "Error: Missing test dependencies. Run: pip install -r requirements-test.txt"
        )
        print(f"   Missing: {e.name}")  # noqa: T201
        sys.exit(1)

    print("🧪 Running TaskTracker integration tests...")  # noqa: T201

    # Run pytest with coverage
    cmd = [
        sys.executable,
        "-m",
        "pytest",
        "tests/",
        "--cov=custom_components.tasktracker",
        "--cov-report=term-missing",
        "--cov-report=html:htmlcov",
        "-v",
    ]

    try:
        subprocess.run(cmd, check=True)  # noqa: S603
        print("\n✅ All tests passed!")  # noqa: T201
        print("📊 Coverage report generated in htmlcov/index.html")  # noqa: T201
        retval = 0
    except subprocess.CalledProcessError:
        print("\n❌ Some tests failed. Check output above.")  # noqa: T201
        retval = 1

    return retval


if __name__ == "__main__":
    sys.exit(run_tests())
