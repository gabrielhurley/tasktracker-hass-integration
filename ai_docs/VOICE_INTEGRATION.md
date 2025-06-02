# Voice Integration for TaskTracker

This integration now supports voice commands through Home Assistant's voice assistant functionality. You can speak commands to manage tasks and leftovers.

## Supported Voice Commands

### Complete Tasks

- "I completed [the task] {task_name}"
- "I'm getting rid of [the] leftover {task_name} [in|from] [the fridge]"
- "I'm throwing out [the] leftover {task_name} [in|from] [the fridge]"
- "{task_completed_by} completed [the task] {task_name}"

Examples:
- "I completed take out trash"
- "I'm throwing out the leftover pizza"
- "Gabriel completed vacuum living room"

### Add Leftovers

- "Add leftover {leftover_name}"
- "I'm adding [leftover] {leftover_name} to the fridge"
- "I'm putting [leftover] {leftover_name} in the fridge"
- "There [is|are] leftover[s] [of] {leftover_name}"

Examples:
- "Add leftover pizza"
- "I'm putting leftover pasta in the fridge"
- "There are leftovers of chicken"

### Add Tasks

- "I need to {task_name}"
- "Remind me to {task_name}"
- "Add [a|the] task [called|named] {task_name}"
- "Remind {task_assigned_to} to {task_name}"

Examples:
- "I need to buy groceries"
- "Remind me to call mom"
- "Remind Sara to water plants"

### Query Task Status

- "Is [the] [leftover] {task_name} [still] good"
- "How old is [the] [leftover] {task_name}"
- "What are the notes for [the task] {task_name}"
- "Status of {task_name}"

Examples:
- "Is the leftover pizza still good"
- "How old is the leftover soup"
- "What are the notes for vacuum living room"

### Get Recommended Tasks

- "What [tasks] [can|should] {person} do [today]"
- "What [tasks] [can|should] {person} do in {time} minutes"

Examples:
- "What tasks can Gabriel do today"
- "What should Sara do in 30 minutes"

### Get Task Details

- "What does {task_name} entail"
- "Tell me more about {task_name}"
- "What are the details of {task_name}"

Examples:
- "What does vacuum living room entail"
- "Tell me more about grocery shopping"

## Setup

1. The intent and sentence files are automatically loaded when the integration is installed
2. Ensure you have a voice assistant configured in Home Assistant (like Assist)
3. The integration will use your configured user mapping to determine who is making the request

## File Structure

```
custom_components/tasktracker/
├── intents/
│   ├── CompleteTask.yaml
│   ├── AddLeftover.yaml
│   ├── AddAdHocTask.yaml
│   ├── QueryTaskStatus.yaml
│   ├── GetTaskDetails.yaml
│   ├── GetRecommendedTasksForPersonAndTime.yaml
│   └── GetRecommendedTasksForPerson.yaml
└── sentences/
    └── en/
        └── tasktracker.yaml
```

## How It Works

1. When you speak a command, Home Assistant's voice assistant matches it against the sentence patterns
2. The matched intent is executed, calling the appropriate TaskTracker service
3. The service returns a response that is spoken back to you
4. User mapping is handled automatically based on your Home Assistant user ID

## Supported Parameters

- **task_name**: Name of the task (wildcard matching)
- **task_completed_by**: Person who completed the task (wildcard matching)
- **leftover_name**: Name of the leftover food (wildcard matching)
- **task_assigned_to**: Person assigned to the task (wildcard matching)
- **task_duration**: Duration in minutes (wildcard matching)
- **task_priority**: Priority level (high/medium/low mapped to 1/2/3)
- **person**: Person name for task queries (wildcard matching)
- **time**: Time in minutes (wildcard matching)
- **days_ago**: Number of days ago (range 1-30)
- **question_type**: Type of question (safe_to_eat, how_old, notes, general)

## Testing

Run the intent tests to verify everything is working:

```bash
python -m pytest tests/test_intents.py -v
```