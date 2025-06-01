# TaskTracker Home Assistant Integration

A comprehensive Home Assistant integration for task management that provides real-time task recommendations, multi-user support, and custom dashboard cards.

## Overview

TaskTracker is a task management system with deep Home Assistant integration, offering voice commands, intelligent task recommendations, and interactive dashboard components.

## Features

- **Multi-user task tracking** with user context detection
- **Real-time task recommendations** with time-based filtering
- **Cross-task-type completion** (RecurringTask, AdHocTask, Leftover)
- **Voice command integration** through Home Assistant services
- **Custom Lovelace cards** for dashboard building
- **Leftover management** with expiration tracking

## Integration Setup

### Installation

1. Install via HACS (Home Assistant Community Store)
2. Restart Home Assistant
3. Add integration through **Settings > Integrations > Add Integration**
4. Search for "TaskTracker"

### Configuration

- **Host**: TaskTracker API endpoint (default: `https://tasks.thornhill.cloud`)
- **API Key**: Your TaskTracker API authentication key
- **User Mapping**: Configure Home Assistant user IDs to TaskTracker usernames

## Available Services

### Task Completion
- `tasktracker.complete_task` - Complete task by ID
- `tasktracker.complete_task_by_name` - Complete task by name

### Task Creation
- `tasktracker.create_adhoc_task` - Create one-time tasks with priority/duration
- `tasktracker.create_leftover` - Track food leftovers with expiration

### Task Discovery
- `tasktracker.get_recommended_tasks` - Get AI-recommended tasks based on available time
- `tasktracker.get_available_tasks` - List all available tasks with filters
- `tasktracker.get_recent_completions` - View recently completed tasks
- `tasktracker.list_leftovers` - List tracked leftovers

### Task Intelligence
- `tasktracker.query_task` - Ask questions about tasks (safety, age, notes)

## Frontend Cards

Four custom Lovelace cards provide rich dashboard integration:

### 1. Recommended Tasks Card (`tasktracker-recommended-tasks-card`)
- Displays AI-recommended tasks based on available time
- Real-time filtering and completion actions
- User-specific recommendations

### 2. Available Tasks Card (`tasktracker-available-tasks-card`)
- Shows all available tasks with filters
- Supports time-based filtering
- Direct task completion interface

### 3. Recent Tasks Card (`tasktracker-recent-tasks-card`)
- Lists recently completed tasks
- Configurable time range
- User activity tracking

### 4. Leftovers Card (`tasktracker-leftovers-card`)
- Manages food leftovers with expiration tracking
- Safety indicators and age calculations
- Quick leftover creation and queries

## Voice Integration

All services support voice commands through Home Assistant's voice assistant, enabling natural language task management like:
- "Complete the trash task"
- "What leftovers do I have?"
- "Create a new task to fix the sink"

## Technical Details

- **Integration Type**: Service-based cloud polling
- **Requirements**: aiohttp>=3.8.0
- **Home Assistant**: Requires 2025.5.0+
- **HACS Compatible**: Version 2.0.1+
