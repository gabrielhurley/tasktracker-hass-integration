"""Constants for the TaskTracker integration."""

import json
from pathlib import Path
from typing import Final

# Read version from manifest.json
_manifest_path = Path(__file__).parent / "manifest.json"
with Path(_manifest_path).open() as f:
    _manifest = json.load(f)
VERSION: Final = _manifest["version"]

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
    {
        "name": "TaskTracker Daily Plan Card",
        "filename": "tasktracker-daily-plan-card.js",
        "version": VERSION,
    },
    {
        "name": "TaskTracker Daily State Card",
        "filename": "tasktracker-daily-state-card.js",
        "version": VERSION,
    },
    {
        "name": "TaskTracker Daily Encouragement Card",
        "filename": "tasktracker-encouragement-card.js",
        "version": VERSION,
    },
    {
        "name": "TaskTracker Create Task Card",
        "filename": "tasktracker-create-task-card.js",
        "version": VERSION,
    },
    {
        "name": "TaskTracker Goals Card",
        "filename": "tasktracker-goals-card.js",
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
SERVICE_DELETE_COMPLETION: Final = "delete_completion"
SERVICE_UPDATE_COMPLETION: Final = "update_completion"
SERVICE_GET_DAILY_PLAN: Final = "get_daily_plan"
SERVICE_GET_DAILY_PLAN_ENCOURAGEMENT: Final = "get_daily_plan_encouragement"
SERVICE_GET_DAILY_STATE: Final = "get_daily_state"
SERVICE_SET_DAILY_STATE: Final = "set_daily_state"
SERVICE_CREATE_TASK_FROM_DESCRIPTION: Final = "create_task_from_description"
SERVICE_DELETE_TASK: Final = "delete_task"
SERVICE_INVALIDATE_CACHE: Final = "invalidate_cache"
SERVICE_LIST_GOALS: Final = "list_goals"
SERVICE_CREATE_GOAL: Final = "create_goal"
SERVICE_UPDATE_GOAL: Final = "update_goal"
SERVICE_DELETE_GOAL: Final = "delete_goal"
SERVICE_LIST_GOAL_TASKS: Final = "list_goal_tasks"
SERVICE_ASSOCIATE_TASK_WITH_GOAL: Final = "associate_task_with_goal"
SERVICE_REMOVE_TASK_FROM_GOAL: Final = "remove_task_from_goal"

# Event names
EVENT_DAILY_PLAN: Final = "tasktracker_daily_plan"
EVENT_DAILY_STATE_SET: Final = "tasktracker_daily_state_set"
EVENT_TASK_COMPLETED: Final = "tasktracker_task_completed"
EVENT_TASK_CREATED: Final = "tasktracker_task_created"
EVENT_TASK_UPDATED: Final = "tasktracker_task_updated"
EVENT_TASK_DELETED: Final = "tasktracker_task_deleted"
EVENT_LEFTOVER_CREATED: Final = "tasktracker_leftover_created"
EVENT_LEFTOVER_DISPOSED: Final = "tasktracker_leftover_disposed"
EVENT_COMPLETION_DELETED: Final = "tasktracker_completion_deleted"
EVENT_COMPLETION_UPDATED: Final = "tasktracker_completion_updated"
EVENT_GOAL_CREATED: Final = "tasktracker_goal_created"
EVENT_GOAL_UPDATED: Final = "tasktracker_goal_updated"
EVENT_GOAL_DELETED: Final = "tasktracker_goal_deleted"

# All events that should be accessible to non-admin users
TASKTRACKER_EVENTS: Final = [
    EVENT_DAILY_PLAN,
    EVENT_DAILY_STATE_SET,
    EVENT_TASK_COMPLETED,
    EVENT_TASK_CREATED,
    EVENT_TASK_UPDATED,
    EVENT_TASK_DELETED,
    EVENT_LEFTOVER_CREATED,
    EVENT_LEFTOVER_DISPOSED,
    EVENT_COMPLETION_DELETED,
    EVENT_COMPLETION_UPDATED,
    EVENT_GOAL_CREATED,
    EVENT_GOAL_UPDATED,
    EVENT_GOAL_DELETED,
]

# API endpoints
ENDPOINT_COMPLETE_TASK: Final = "/api/completions/complete_task/"
ENDPOINT_COMPLETE_TASK_BY_NAME: Final = "/api/completions/complete_task_by_name/"
ENDPOINT_CREATE_LEFTOVER: Final = "/api/leftovers/create-leftover/"
ENDPOINT_CREATE_ADHOC_TASK: Final = "/api/tasks/create-adhoc-task/"
ENDPOINT_QUERY_TASK: Final = "/api/tasks/task-query/"
ENDPOINT_RECOMMENDED_TASKS: Final = "/api/recommendations/recommended-tasks/"
ENDPOINT_AVAILABLE_TASKS: Final = "/api/tasks/available-tasks/"
ENDPOINT_RECENT_COMPLETIONS: Final = "/api/completions/recent_completions/"
ENDPOINT_LIST_LEFTOVERS: Final = "/api/leftovers/list-leftovers/"
ENDPOINT_ALL_TASKS: Final = "/api/tasks/all-tasks/"
ENDPOINT_UPDATE_TASK: Final = "/api/tasks/update-task/"
ENDPOINT_DELETE_COMPLETION: Final = "/api/completions/delete_completion/"
ENDPOINT_UPDATE_COMPLETION: Final = "/api/completions/update_completion/"

# New API endpoints
ENDPOINT_DAILY_PLAN: Final = "/api/daily-plan/"
ENDPOINT_DAILY_PLAN_ENCOURAGEMENT: Final = "/api/daily-plan/encouragement/"
ENDPOINT_DAILY_STATE: Final = "/api/daily-state/"
ENDPOINT_CREATE_TASK_FROM_DESCRIPTION: Final = (
    "/api/tasks/create-task-from-description/"
)
ENDPOINT_DELETE_TASK: Final = "/api/tasks/delete-task/"

# Goal endpoints
ENDPOINT_GOALS_LIST: Final = "/api/goals/list-goals/"
ENDPOINT_GOALS_CREATE: Final = "/api/goals/create-goal/"
ENDPOINT_GOALS_GET: Final = "/api/goals/get-goal/"
ENDPOINT_GOALS_UPDATE: Final = "/api/goals/update-goal/"
ENDPOINT_GOALS_DELETE: Final = "/api/goals/delete-goal/"
ENDPOINT_GOALS_LIST_TASKS: Final = "/api/goals/list-goal-tasks/"
ENDPOINT_GOALS_ASSOCIATE_TASK: Final = "/api/goals/associate-task/"
ENDPOINT_GOALS_REMOVE_TASK: Final = "/api/goals/remove-task-association/"

# Default values
DEFAULT_SCAN_INTERVAL: Final = 300  # 5 minutes

# Cache configuration (TTL in seconds)
CACHE_TTL_ENCOURAGEMENT: Final = 300  # 5 minutes - pull-only, no background refresh
CACHE_TTL_RECOMMENDED_TASKS: Final = 300  # 5 minutes
CACHE_TTL_AVAILABLE_TASKS: Final = 300  # 5 minutes
CACHE_TTL_LEFTOVERS: Final = 300  # 5 minutes
CACHE_TTL_RECENT_COMPLETIONS: Final = 300  # 5 minutes
CACHE_TTL_ALL_TASKS: Final = 300  # 5 minutes

# Coordinator configuration
COORDINATOR_UPDATE_INTERVAL_DAILY_PLAN: Final = 180  # 3 minutes

# Additional cache TTLs
CACHE_TTL_AVAILABLE_USERS: Final = 600  # 10 minutes - config changes are rare
CACHE_TTL_DAILY_STATE: Final = 300  # 5 minutes
CACHE_TTL_GOALS: Final = 300  # 5 minutes
