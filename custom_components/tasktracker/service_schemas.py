"""Voluptuous schemas for TaskTracker Home Assistant services."""

from __future__ import annotations

import voluptuous as vol
from homeassistant.helpers import config_validation as cv

# Service schemas
COMPLETE_TASK_SCHEMA = vol.Schema(
    {
        vol.Required("task_id"): cv.positive_int,
        vol.Optional("completed_by"): cv.string,
        vol.Optional("notes"): cv.string,
    }
)


COMPLETE_TASK_BY_NAME_SCHEMA = vol.Schema(
    {
        vol.Required("name"): cv.string,
        vol.Optional("completed_by"): cv.string,
        vol.Optional("notes"): cv.string,
        vol.Optional("completed_at"): cv.string,
        vol.Optional("event_type"): vol.In(["task_completed", "leftover_disposed"]),
    }
)


CREATE_LEFTOVER_SCHEMA = vol.Schema(
    {
        vol.Required("name"): cv.string,
        vol.Optional("assigned_users"): vol.All(cv.ensure_list, [cv.string]),
        vol.Optional("shelf_life_days"): cv.positive_int,
        vol.Optional("days_ago"): cv.positive_int,
    }
)


CREATE_ADHOC_TASK_SCHEMA = vol.Schema(
    {
        vol.Required("name"): cv.string,
        vol.Optional("assigned_users"): vol.All(cv.ensure_list, [cv.string]),
        vol.Optional("duration_minutes"): cv.positive_int,
        vol.Optional("priority"): vol.All(cv.positive_int, vol.Range(min=1, max=5)),
    }
)


QUERY_TASK_SCHEMA = vol.Schema(
    {
        vol.Required("name"): cv.string,
        vol.Optional("question_type"): vol.In(
            ["safe_to_eat", "how_old", "notes", "general"]
        ),
    }
)


GET_RECOMMENDED_TASKS_SCHEMA = vol.Schema(
    {
        vol.Optional("username"): cv.string,
        vol.Required("available_minutes"): cv.positive_int,
    }
)


GET_AVAILABLE_TASKS_SCHEMA = vol.Schema(
    {
        vol.Optional("username"): cv.string,
        vol.Optional("available_minutes"): cv.positive_int,
        vol.Optional("upcoming_days"): cv.positive_int,
    }
)


GET_RECENT_COMPLETIONS_SCHEMA = vol.Schema(
    {
        vol.Optional("username"): cv.string,
        vol.Optional("days"): cv.positive_int,
        vol.Optional("limit"): cv.positive_int,
    }
)


LIST_LEFTOVERS_SCHEMA = vol.Schema(
    {
        vol.Optional("username"): cv.string,
    }
)


GET_ALL_TASKS_SCHEMA = vol.Schema(
    {
        vol.Optional("thin"): cv.boolean,
        vol.Optional("username"): cv.string,
    }
)


# Task nudge schema for nested validation
TASK_NUDGE_SCHEMA = vol.Schema(
    {
        vol.Optional("id"): cv.positive_int,
        vol.Required("trigger_type"): vol.In(
            ["on_due", "on_overdue", "time_of_day", "after_due_delay", "overdue_threshold"]
        ),
        vol.Optional("trigger_config"): dict,
        vol.Optional("priority"): vol.All(cv.positive_int, vol.Range(min=1, max=10)),
        vol.Optional("is_active"): cv.boolean,
        vol.Optional("custom_message"): cv.string,
    }
)

UPDATE_TASK_SCHEMA = vol.Schema(
    {
        vol.Required("task_id"): cv.string,
        vol.Required("task_type"): vol.In(
            ["RecurringTask", "AdHocTask", "SelfCareTask"]
        ),
        vol.Optional("assigned_users"): vol.All(cv.ensure_list, [cv.string]),
        # BaseTask fields
        vol.Optional("name"): cv.string,
        vol.Optional("priority"): vol.All(cv.positive_int, vol.Range(min=1, max=3)),
        vol.Optional("notes"): cv.string,
        vol.Optional("is_active"): cv.boolean,
        vol.Optional("overdue_severity"): vol.All(
            cv.positive_int, vol.Range(min=1, max=3)
        ),
        # DurationMixin field
        vol.Optional("duration_minutes"): cv.positive_int,
        # FrequencyMixin fields (RecurringTask, SelfCareTask)
        vol.Optional("frequency_value"): cv.positive_int,
        vol.Optional("frequency_unit"): vol.In(
            ["days", "weeks", "months", "years", "minutes", "hours"]
        ),
        vol.Optional("next_due"): cv.string,
        # TaskFitMixin fields
        vol.Optional("energy_cost"): vol.All(cv.positive_int, vol.Range(min=1, max=5)),
        vol.Optional("focus_cost"): vol.All(cv.positive_int, vol.Range(min=1, max=5)),
        vol.Optional("pain_cost"): vol.All(cv.positive_int, vol.Range(min=0, max=5)),
        vol.Optional("motivation_boost"): vol.All(int, vol.Range(min=-5, max=5)),
        vol.Optional("satisfaction"): vol.All(cv.positive_int, vol.Range(min=0, max=5)),
        vol.Optional("impact"): vol.All(cv.positive_int, vol.Range(min=0, max=5)),
        vol.Optional("suitable_after_hours"): vol.In(
            ["yes", "if_necessary", "absolutely_not"]
        ),
        # DayOfWeekConstraintMixin field
        vol.Optional("allowed_days"): vol.All(
            cv.ensure_list, [vol.All(int, vol.Range(min=0, max=6))]
        ),
        # FairWeatherConstraintMixin field
        vol.Optional("requires_fair_weather"): cv.boolean,
        # SelfCareTask specific fields
        vol.Optional("level"): vol.All(cv.positive_int, vol.Range(min=1, max=3)),
        vol.Optional("required_occurrences"): cv.positive_int,
        # Tags field
        vol.Optional("tags"): vol.All(cv.ensure_list, [cv.string]),
        # Task nudges field
        vol.Optional("task_nudges"): vol.All(cv.ensure_list, [TASK_NUDGE_SCHEMA]),
    }
)


DELETE_COMPLETION_SCHEMA = vol.Schema(
    {
        vol.Required("completion_id"): cv.positive_int,
    }
)


UPDATE_COMPLETION_SCHEMA = vol.Schema(
    {
        vol.Required("completion_id"): cv.positive_int,
        vol.Optional("completed_by"): cv.string,
        vol.Optional("notes"): cv.string,
        vol.Optional("completed_at"): cv.string,
    }
)


CREATE_TASK_FROM_DESCRIPTION_SCHEMA = vol.Schema(
    {
        vol.Required("task_type"): vol.In(
            ["RecurringTask", "AdHocTask", "SelfCareTask"]
        ),
        vol.Required("task_description"): cv.string,
        vol.Optional("assigned_users"): vol.All(cv.ensure_list, [cv.string]),
    }
)


GET_DAILY_PLAN_SCHEMA = vol.Schema(
    {
        vol.Optional("username"): cv.string,
        vol.Optional("fair_weather"): cv.boolean,
        vol.Optional("select_recommended"): cv.boolean,
    }
)


GET_DAILY_PLAN_ENCOURAGEMENT_SCHEMA = vol.Schema(
    {
        vol.Optional("username"): cv.string,
    }
)


GET_DAILY_STATE_SCHEMA = vol.Schema(
    {
        vol.Optional("username"): cv.string,
    }
)


SET_DAILY_STATE_SCHEMA = vol.Schema(
    {
        vol.Optional("username"): cv.string,
        vol.Optional("energy"): vol.All(cv.positive_int, vol.Range(min=1, max=5)),
        vol.Optional("motivation"): vol.All(cv.positive_int, vol.Range(min=1, max=5)),
        vol.Optional("focus"): vol.All(cv.positive_int, vol.Range(min=1, max=5)),
        vol.Optional("pain"): vol.All(cv.positive_int, vol.Range(min=1, max=5)),
        vol.Optional("mood"): vol.All(int, vol.Range(min=-2, max=2)),
        vol.Optional("free_time"): vol.All(cv.positive_int, vol.Range(min=1, max=5)),
        vol.Optional("is_sick"): cv.boolean,
    }
)


DELETE_TASK_SCHEMA = vol.Schema(
    {
        vol.Required("task_id"): cv.positive_int,
        vol.Required("task_type"): vol.In(
            ["RecurringTask", "AdHocTask", "SelfCareTask"]
        ),
    }
)
