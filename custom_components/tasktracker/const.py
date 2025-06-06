"""Constants for the TaskTracker integration."""

from typing import Final

# Version
VERSION: Final = "1.0.7"

# Integration domain
DOMAIN: Final = "tasktracker"

URL_BASE = "/tasktracker"
JSMODULES = [
    {
        "name": "TaskTracker Recommended Tasks Card",
        "filename": "tasktracker-recommended-tasks-card.js",
        "version": VERSION,
    },
    {
        "name": "TaskTracker Leftovers Card",
        "filename": "tasktracker-leftovers-card.js",
        "version": VERSION,
    },
    {
        "name": "TaskTracker Recent Tasks Card",
        "filename": "tasktracker-recent-tasks-card.js",
        "version": VERSION,
    },
    {
        "name": "TaskTracker Available Tasks Card",
        "filename": "tasktracker-available-tasks-card.js",
        "version": VERSION,
    },
    {
        "name": "TaskTracker Complete Task Card",
        "filename": "tasktracker-complete-task-card.js",
        "version": VERSION,
    },
    {
        "name": "TaskTracker Time Spent Card",
        "filename": "tasktracker-time-spent-card.js",
        "version": VERSION,
    },
]

# Configuration keys
CONF_HOST: Final = "host"
CONF_API_KEY: Final = "api_key"
CONF_USERS: Final = "users"
CONF_HA_USER_ID: Final = "ha_user_id"
CONF_TASKTRACKER_USERNAME: Final = "tasktracker_username"

# Service names
SERVICE_COMPLETE_TASK: Final = "complete_task"
SERVICE_COMPLETE_TASK_BY_NAME: Final = "complete_task_by_name"
SERVICE_CREATE_LEFTOVER: Final = "create_leftover"
SERVICE_CREATE_ADHOC_TASK: Final = "create_adhoc_task"
SERVICE_QUERY_TASK: Final = "query_task"
SERVICE_GET_RECOMMENDED_TASKS: Final = "get_recommended_tasks"
SERVICE_GET_AVAILABLE_TASKS: Final = "get_available_tasks"
SERVICE_GET_RECENT_COMPLETIONS: Final = "get_recent_completions"
SERVICE_LIST_LEFTOVERS: Final = "list_leftovers"
SERVICE_GET_ALL_TASKS: Final = "get_all_tasks"
SERVICE_GET_AVAILABLE_USERS: Final = "get_available_users"
SERVICE_UPDATE_TASK: Final = "update_task"

# API endpoints
ENDPOINT_COMPLETE_TASK: Final = "/api/completions/complete_task/"
ENDPOINT_COMPLETE_TASK_BY_NAME: Final = "/api/completions/complete_task_by_name/"
ENDPOINT_CREATE_LEFTOVER: Final = "/api/tasks/create-leftover/"
ENDPOINT_CREATE_ADHOC_TASK: Final = "/api/tasks/create-adhoc-task/"
ENDPOINT_QUERY_TASK: Final = "/api/tasks/task-query/"
ENDPOINT_RECOMMENDED_TASKS: Final = "/api/recommendations/recommended-tasks/"
ENDPOINT_AVAILABLE_TASKS: Final = "/api/tasks/available-tasks/"
ENDPOINT_RECENT_COMPLETIONS: Final = "/api/completions/recent_completions/"
ENDPOINT_LIST_LEFTOVERS: Final = "/api/leftovers/list-leftovers/"
ENDPOINT_ALL_TASKS: Final = "/api/tasks/all-tasks/"
ENDPOINT_UPDATE_TASK: Final = "/api/tasks/update-task/"

# Default values
DEFAULT_SCAN_INTERVAL: Final = 300  # 5 minutes
