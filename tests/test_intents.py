"""Test intent files for TaskTracker."""

import os
from pathlib import Path

import pytest
import yaml


def test_intent_files_exist() -> None:
    """Test that all intent files exist."""
    intents_dir = "custom_components/tasktracker/intents"
    expected_files = [
        "CompleteTask.yaml",
        "AddLeftover.yaml",
        "AddAdHocTask.yaml",
        "QueryTaskStatus.yaml",
        "GetTaskDetails.yaml",
        "GetRecommendedTasksForPersonAndTime.yaml",
        "GetRecommendedTasksForPerson.yaml",
    ]

    for file in expected_files:
        assert Path(intents_dir, file).exists(), f"Intent file {file} does not exist"


def test_sentence_file_exists() -> None:
    """Test that sentence file exists."""
    sentences_file = "custom_components/tasktracker/sentences.yaml"
    assert Path(sentences_file).exists(), "Sentence file does not exist"


def test_intent_files_valid_yaml() -> None:
    """Test that all intent files contain valid YAML."""
    intents_dir = "custom_components/tasktracker/intents"

    for filename in Path(intents_dir).glob("*.yaml"):
        with filename.open("r", encoding="utf-8") as f:
            try:
                yaml.safe_load(f)
            except yaml.YAMLError as e:
                pytest.fail(f"Invalid YAML in {filename}: {e}")


def test_sentence_file_valid_yaml() -> None:
    """Test that sentence file contains valid YAML."""
    sentences_file = "custom_components/tasktracker/sentences.yaml"

    with Path(sentences_file).open("r", encoding="utf-8") as f:
        try:
            data = yaml.safe_load(f)
            assert "language" in data, "Sentence file missing language field"
            assert "intents" in data, "Sentence file missing intents field"
            assert "lists" in data, "Sentence file missing lists field"
        except yaml.YAMLError as e:
            pytest.fail(f"Invalid YAML in sentence file: {e}")


def test_voice_setup_function_exists() -> None:
    """Test that voice setup function exists and can be imported."""
    from custom_components.tasktracker import _setup_voice_sentences

    assert callable(_setup_voice_sentences), "Voice setup function should be callable"
