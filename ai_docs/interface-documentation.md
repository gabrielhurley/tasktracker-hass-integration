# Home Assistant TaskTracker Interface Documentation

## Overview

The Home Assistant interface for TaskTracker provides a comprehensive multi-modal task management system that integrates visual dashboard controls, voice commands, and automated workflows. It connects to the Django TaskTracker API to provide real-time task management capabilities for multiple users.

## Architecture

### **Data Integration Layer**

#### REST Sensors (`rest-sensors.yaml`)
Polls TaskTracker API every 5 minutes to maintain real-time data:

- **`sensor.recommended_tasks_sara`** & **`sensor.recommended_tasks_gabriel`**: 
  - Fetches personalized task recommendations based on available time
  - Uses `input_number.available_task_minutes_*` for time filtering
  - Provides spoken responses for voice interaction
  
- **`sensor.all_tasks`**: 
  - Retrieves all tasks (thin view for performance)
  - Used for task name lookups and dropdown population
  
- **`sensor.available_tasks`**: 
  - Gets overdue tasks with 1-day upcoming window
  - Used for broader task availability checking
  
- **`sensor.recently_completed_tasks`**: 
  - Tracks recent completions (7-day window)
  - Enables completion history display
  
- **`sensor.leftovers`**: 
  - Monitors leftover food items with expiration tracking
  - Provides overdue counts for food safety

#### REST Commands (`rest-commands.yaml`)
Provides action capabilities to TaskTracker API:

- **`complete_task`**: Cross-task-type completion using fuzzy name matching
- **`create_leftover`**: Creates new leftover items with shelf life
- **`create_adhoc_task`**: Creates one-off tasks with priority/duration
- **`query_task`**: Queries tasks with question-specific responses

### **Helper Entities**

#### Input Controls
- **`input_number.available_task_minutes_sara`** & **`input_number.available_task_minutes_gabriel`**: Time sliders for filtering task recommendations by available time
- **`input_select.available_tasks_to_complete`**: Dropdown populated with all RecurringTask names for manual completion selection

#### Calculated Values
- **`number.recent_minutes_spent_on_tasks_gabriel`** & **`number.recent_minutes_spent_on_tasks_sara`**: Stores calculated time spent on recent tasks per user

#### Modal Context Storage
- **`input_text.current_task_person`**: Stores which user's tasks are being viewed in modal
- **`input_number.current_task_index_*`**: Tracks which task index is selected in modal
- **`input_text.current_task_completion_notes`**: Stores completion notes for modal workflow
- **`input_text.complete_task_api_last_error`**: Error display for failed API calls

## User Interface Components

### **Main Dashboard (`task-dashboard.yaml`)**

#### Personal Task Sections
Each user (Sara & Gabriel) has dedicated dashboard sections with:

**Time Control**:
- Mushroom number card with slider for setting available minutes
- Dynamically updates recommended task queries

**Task Recommendation Cards**:
- Up to 3 recommended tasks displayed as conditional cards
- Each card shows:
  - Task name with completion notes indicator (*)
  - Duration and priority information
  - Click action opens detailed modal popup

#### Task Cards Behavior
- **Conditional Display**: Only appear when recommendations exist
- **Dynamic Content**: Updates based on API sensor data
- **Interactive**: Click opens task details modal for completion

### **Modal Interfaces**

#### Task Details Modal (`available-tasks.yaml` lines 115-196)
Comprehensive task information display:

**Task Information**:
- Name, duration, priority, frequency
- Last completion timestamp
- Task notes and last completion notes

**Interactive Elements**:
- Completion notes input field
- "Mark as Complete" button with browser popup management
- Error display for failed completions

**Workflow**:
- Opens via task card click with context (user, task index)
- Provides completion workflow with notes
- Closes automatically after successful completion

#### Leftovers Modal (`leftovers.yaml`)
Food safety management interface:

**Categories**:
- **"Still Good"**: Leftovers within shelf life
- **"Too Old"**: Expired leftovers requiring disposal

**Display**:
- Shows leftover name and age using time_since filter
- Categorizes by due_date comparison to current time
- Handles empty states gracefully

### **Voice Command System**

#### Natural Language Processing (`custom_sentences/en/tasks.yaml`)
Supports multiple interaction patterns:

**Task Completion**:
- `"I completed [the task] {task_name}"`
- `"I'm throwing out the leftover {task_name}"`
- `"{task_completed_by} completed [the task] {task_name}"`

**Task Queries**:
- `"What can {person} do in {time} minutes"`
- `"Tell me more about {task_name}"`
- `"What should {person} work on for {time} minutes"`

#### Intent Processing (`intent-scripts.yaml`)
Sophisticated voice command handling:

**Parameter Management**:
- Handles missing parameters gracefully
- Maps Home Assistant user IDs to TaskTracker usernames
- Provides meaningful error responses

**Response Generation**:
- Uses API-provided spoken responses
- Handles different HTTP status codes appropriately
- Provides context-aware feedback

### **Automation Layer**

#### Dynamic Updates (`automations/`)
**Available Tasks Automation**:
- Triggers on sensor state changes and Home Assistant startup
- Updates `input_select.available_tasks_to_complete` options
- Maintains synchronized dropdown lists

**Time-Based Updates**:
- Responds to available time changes
- Triggers sensor updates when time parameters change

#### Script-Based Workflows (`scripts/`)

**Task Completion (`complete_task.yaml`)**:
- Multi-source parameter resolution (voice, modal, manual)
- API error handling with user feedback
- Sensor refresh after successful completion
- Modal management (close on completion)

**Task Lookup (`lookup_task_by_name.yaml`)**:
- Local task search using cached sensor data
- Speaks task notes and completion notes
- Handles "no match" scenarios gracefully

**Modal Management**:
- Context-aware modal opening with user/task parameters
- State management for modal workflows

## User Interaction Patterns

### **Multi-Modal Task Management**
1. **Visual Planning**: Users set available time, view filtered recommendations
2. **Voice Completion**: Natural language task completion with confirmation
3. **Modal Details**: Click for comprehensive task information and completion
4. **Manual Selection**: Dropdown-based task selection for edge cases

### **Cross-Task-Type Operations**
- Single interface handles RecurringTasks, AdHocTasks, and Leftovers
- Fuzzy matching enables natural language interaction
- Consistent completion workflow across task types

### **Real-Time Synchronization**
- 5-minute API polling keeps data current
- Immediate UI updates after task completion
- Automatic sensor refresh on state changes

### **Error Handling & Feedback**
- Graceful handling of API failures
- User-friendly error messages
- Voice feedback for all operations
- Visual error indicators in modals

## Technical Implementation

### **User Management**
- **Current Approach**: Manual username mapping between Home Assistant and TaskTracker
- **User IDs**: Home Assistant user IDs mapped to TaskTracker usernames (sara/gabriel)
- **Future Consideration**: Automated user synchronization

### **Voice Integration**
- **Platform**: Home Assistant's built-in "Assist" functionality
- **Processing**: Intent-based natural language understanding
- **Feedback**: Spoken responses using TaskTracker API responses

### **Performance Optimizations**
- **Thin API Calls**: Uses `thin=True` parameter for efficiency
- **Conditional Updates**: Smart refresh triggers only when needed
- **Local Caching**: Sensor data cached for immediate lookup operations

### **Data Flow**
1. **Sensors** poll TaskTracker API every 5 minutes
2. **Helper entities** store user preferences and UI state
3. **Dashboard** displays filtered, personalized task recommendations
4. **Voice/UI actions** trigger REST commands to TaskTracker API
5. **Automations** refresh relevant sensors after state changes
6. **Modals** provide detailed interaction workflows

## Integration Points

### **TaskTracker API Endpoints Used**
- `/api/recommended-tasks/` - Time-filtered task recommendations
- `/api/tasks/?thin=True` - Lightweight task list for dropdowns
- `/api/available-tasks/?upcoming_days=1` - Overdue task checking
- `/api/recent-completions/?days=7` - Completion history
- `/api/list-leftovers/` - Leftover management
- `/api/complete-task-by-name/` - Cross-task-type completion
- `/api/create-leftover/` - Leftover creation
- `/api/create-adhoc-task/` - Ad-hoc task creation
- `/api/task-query/` - Question-specific task queries

### **Authentication**
- API key authentication using `!secret tasks_api_key`
- Consistent authentication across all REST operations

This Home Assistant interface successfully creates a sophisticated, user-friendly task management system that leverages both visual and voice interaction patterns while maintaining real-time synchronization with the Django TaskTracker backend.

---

## Custom Component Architecture

### **Overview**
To address the limitations of the current entity-based approach, a custom Home Assistant integration has been designed that provides:

- **Clean Configuration**: User mapping without hardcoded usernames
- **Fewer Entities**: Direct API integration without numerous helper entities
- **Reusable Components**: Modular cards for flexible dashboard building
- **Voice Integration**: Seamless integration with Home Assistant's Assist
- **User Context Detection**: Automatic user identification where possible

### **Integration Structure**

```
homeassistant/custom_components/tasktracker/
├── manifest.json              # Integration metadata and requirements
├── __init__.py                # Integration setup and frontend registration
├── config_flow.py             # Configuration UI flow with user mapping
├── const.py                   # Constants, endpoints, and service definitions
├── api.py                     # TaskTracker API client with async support
├── services.py                # Home Assistant services for voice/automation
├── utils.py                   # User mapping and utility functions
└── www/                       # Frontend card implementations
    ├── tasktracker-recommended-tasks-card.js    # Main task card with time slider
    ├── tasktracker-leftovers-card.js           # Leftover management card
    ├── tasktracker-recent-tasks-card.js        # Completion history card
    └── tasktracker-available-tasks-card.js     # Available/overdue tasks card
```

### **Key Components**

#### **Integration Backend (`__init__.py`)**
- Sets up API client with configuration-based user mapping
- Registers Home Assistant services for TaskTracker operations
- Handles frontend resource registration for custom cards
- Manages integration lifecycle (setup/teardown)

#### **Configuration Flow (`config_flow.py`)**
- **Step 1**: API connection validation (host, API key)
- **Step 2**: User mapping configuration (HA user ID → TaskTracker username)
- **Options Flow**: Runtime configuration updates
- **Auto-detection**: HA user dropdown with manual entry fallback

#### **API Client (`api.py`)**
- **Async HTTP**: aiohttp-based API client with error handling
- **Method Coverage**: All TaskTracker endpoints with proper typing
- **Error Handling**: TaskTrackerAPIError with meaningful messages
- **Authentication**: API key header management

#### **Services (`services.py`)**
- **Voice Commands**: Services callable from intent scripts
- **User Context**: Automatic username resolution from HA user context
- **API Integration**: Direct API calls without entity intermediaries
- **Validation**: Voluptuous schemas for service parameters

#### **Utility Functions (`utils.py`)**
- **User Mapping**: Bidirectional HA ↔ TaskTracker username resolution
- **Context Detection**: Framework for future user context identification
- **Formatting Helpers**: Duration, priority, and time formatting
- **Integration Data**: Helper for accessing integration state

### **Frontend Cards**

#### **Recommended Tasks Card**
```yaml
type: custom:tasktracker-recommended-tasks-card
user: gabriel                    # Optional: overrides auto-detection
default_minutes: 60             # Initial time slider value
show_completion_notes: true     # Enable notes input in modal
```

**Features**:
- **Time Slider**: Dynamic filtering by available minutes
- **Task List**: Up to 3 recommended tasks with priority/duration
- **Modal Popup**: Task details with completion form
- **Real-time API**: Direct calls to `/api/recommended-tasks/`
- **User Context**: Auto-detection or explicit configuration

#### **Leftovers Card**
```yaml
type: custom:tasktracker-leftovers-card
show_disposal_actions: true     # Enable quick disposal buttons
categorize_by_safety: true      # Group by good/expired
```

**Features**:
- **Safety Categories**: Visual grouping by expiration status
- **Age Display**: Human-readable leftover age
- **Quick Actions**: One-click disposal functionality
- **Real-time API**: Direct calls to `/api/list-leftovers/`

#### **Recent Tasks Card**
```yaml
type: custom:tasktracker-recent-tasks-card
days: 7                         # Completion history range
limit: 10                       # Maximum completions to show
show_notes: true               # Display completion notes
```

#### **Available Tasks Card**
```yaml
type: custom:tasktracker-available-tasks-card
upcoming_days: 1               # Include tasks due within days
highlight_overdue: true        # Visual emphasis for overdue tasks
show_completion_actions: true  # Enable quick completion buttons
```

### **Configuration Example**

#### **Integration Setup**
```yaml
# Configured via UI in Settings > Integrations > Add Integration > TaskTracker
tasktracker:
  host: "https://tasks.thornhill.cloud"
  api_key: !secret tasks_api_key
  users:
    - ha_user_id: "f280c1dbf07d4371a07257dc64bb133a"
      tasktracker_username: "gabriel"
    - ha_user_id: "abc123def456ghi789"
      tasktracker_username: "sara"
```

#### **Dashboard Usage**
```yaml
views:
  - title: Tasks
    cards:
      - type: custom:tasktracker-recommended-tasks-card
        # Auto-detects current user from HA context
      
      - type: custom:tasktracker-leftovers-card
        show_disposal_actions: true
      
      - type: horizontal-stack
        cards:
          - type: custom:tasktracker-recent-tasks-card
            days: 3
            limit: 5
          - type: custom:tasktracker-available-tasks-card
            upcoming_days: 2
```

### **Voice Command Integration**

#### **Services Available**
- `tasktracker.complete_task_by_name` - Complete any task type by name
- `tasktracker.create_leftover` - Add leftover with shelf life
- `tasktracker.create_adhoc_task` - Create one-off task
- `tasktracker.query_task` - Get task information with spoken response
- `tasktracker.get_recommended_tasks` - Fetch personalized recommendations

#### **Intent Script Example**
```yaml
intent_script:
  CompleteTask:
    action:
      - service: tasktracker.complete_task_by_name
        data:
          name: "{{ task_name }}"
          # username auto-detected from context
          notes: "{{ task_notes | default('') }}"
        response_variable: result
    speech:
      text: "{{ result.spoken_response }}"
```

### **Migration Benefits**

**Eliminates Current Issues**:
- ❌ Hardcoded usernames in entity IDs
- ❌ Duplicated configuration per user
- ❌ Complex helper entity management
- ❌ Hacky modal triggering via scripts
- ❌ REST command template complexity

**Provides Clean Architecture**:
- ✅ Configuration-based user mapping
- ✅ Real-time API calls without entity overhead
- ✅ Modular, reusable card components
- ✅ Simplified voice command handling
- ✅ User context auto-detection capability
- ✅ Standard Home Assistant integration patterns

This custom component approach transforms the TaskTracker interface from a collection of workarounds into a proper, maintainable Home Assistant integration while preserving all existing functionality and improving user experience.
