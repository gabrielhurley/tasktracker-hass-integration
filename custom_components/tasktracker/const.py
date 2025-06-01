"""Constants for the TaskTracker integration."""

from typing import Final

# Integration domain
DOMAIN: Final = "tasktracker"

URL_BASE = "/tasktracker"
JSMODULES = [
    {
        "name": "TaskTracker Recommended Tasks Card",
        "filename": "tasktracker-recommended-tasks-card.js",
        "version": "1.0.0",
    },
    {
        "name": "TaskTracker Leftovers Card",
        "filename": "tasktracker-leftovers-card.js",
        "version": "1.0.0",
    },
    {
        "name": "TaskTracker Recent Tasks Card",
        "filename": "tasktracker-recent-tasks-card.js",
        "version": "1.0.0",
    },
    {
        "name": "TaskTracker Available Tasks Card",
        "filename": "tasktracker-available-tasks-card.js",
        "version": "1.0.0",
    },
    {
        "name": "TaskTracker Complete Task Card",
        "filename": "tasktracker-complete-task-card.js",
        "version": "1.0.0",
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

# API endpoints
ENDPOINT_COMPLETE_TASK: Final = "/api/complete-task/"
ENDPOINT_COMPLETE_TASK_BY_NAME: Final = "/api/complete-task-by-name/"
ENDPOINT_CREATE_LEFTOVER: Final = "/api/create-leftover/"
ENDPOINT_CREATE_ADHOC_TASK: Final = "/api/create-adhoc-task/"
ENDPOINT_QUERY_TASK: Final = "/api/task-query/"
ENDPOINT_RECOMMENDED_TASKS: Final = "/api/recommended-tasks/"
ENDPOINT_AVAILABLE_TASKS: Final = "/api/available-tasks/"
ENDPOINT_RECENT_COMPLETIONS: Final = "/api/recent-completions/"
ENDPOINT_LIST_LEFTOVERS: Final = "/api/list-leftovers/"
ENDPOINT_ALL_TASKS: Final = "/api/tasks/"

# Default values
DEFAULT_SCAN_INTERVAL: Final = 300  # 5 minutes

# Card types for frontend registration
CARD_TYPE_RECOMMENDED_TASKS: Final = "tasktracker-recommended-tasks-card"
CARD_TYPE_LEFTOVERS: Final = "tasktracker-leftovers-card"
CARD_TYPE_RECENT_TASKS: Final = "tasktracker-recent-tasks-card"
CARD_TYPE_AVAILABLE_TASKS: Final = "tasktracker-available-tasks-card"
CARD_TYPE_COMPLETE_TASK: Final = "tasktracker-complete-task-card"
