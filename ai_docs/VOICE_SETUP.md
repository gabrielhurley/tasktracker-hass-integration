# TaskTracker Voice Assistant Setup

TaskTracker automatically installs voice sentences during integration setup, but you may need to manually copy them in some cases.

## Automatic Installation

When you install or restart the TaskTracker integration, it will automatically:

1. Copy the voice sentences to `config/custom_sentences/en/tasktracker.yaml`
2. Create the directory structure if it doesn't exist
3. Skip copying if the file is already up to date
4. Log the installation status

**After installation, restart Home Assistant to enable voice commands.**

## Manual Installation (Fallback)

If automatic installation fails (due to permissions or other issues), manually copy the sentences:

**From:** `custom_components/tasktracker/sentences.yaml`
**To:** `config/custom_sentences/en/tasktracker.yaml`

### Using File Editor Add-on:
1. Install the "File Editor" add-on if not already installed
2. Open File Editor
3. Create the directory structure: `custom_sentences/en/`
4. Copy the contents of `custom_components/tasktracker/sentences.yaml`
5. Save as `custom_sentences/en/tasktracker.yaml`

### Using SSH/Terminal:
```bash
mkdir -p config/custom_sentences/en/
cp custom_components/tasktracker/sentences.yaml config/custom_sentences/en/tasktracker.yaml
```

## Testing Voice Commands

Go to **Settings > Voice assistants > Assist** and try commands like:
- "I completed the task clean kitchen"
- "What tasks can Gabriel do in 30 minutes"
- "Add leftover pizza"

## Debug Issues

If commands don't work:

1. **Check logs** for TaskTracker voice setup messages
2. **Verify file exists** at `config/custom_sentences/en/tasktracker.yaml`
3. **Test in Developer Tools > Assist** to check sentence parsing
4. **Verify conversation agent** is set to "Home Assistant" (not ChatGPT)
5. **Ensure integration is loaded** - TaskTracker services should be available

## Available Voice Commands

- **Complete tasks:** "I completed [the task] {task_name}"
- **Get recommendations:** "What [tasks] can {person} do in {time} minutes"
- **Add leftovers:** "Add leftover {leftover_name}"
- **Create tasks:** "I need to {task_name}"
- **Query status:** "Is [the] leftover {task_name} still good"
- **Get details:** "Tell me more about {task_name}"

## Troubleshooting

**"Unknown intent" errors:** Ensure sentences file exists and HA is restarted after installation.

**"Unexpected error during intent recognition":** Check conversation dependency is loaded and sentences file syntax is valid.

**Commands not understood:** Verify your assistant language matches the sentence file language (en).

**Permission denied:** Check HA logs for permission errors and use manual installation method.