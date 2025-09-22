import { handleActionError, ensureServiceSuccess } from './error-handling.js';
import { showSuccess, showError } from './toast.js';

export async function completeTask(hass, taskName, username, notes, completed_at = null) {
  try {
    const params = { name: taskName };
    if (username) params.completed_by = username;
    if (notes) params.notes = notes;
    if (completed_at) params.completed_at = completed_at;
    const response = await hass.callService('tasktracker', 'complete_task_by_name', params, {}, true, true);
    const data = ensureServiceSuccess(response);
    showSuccess('Task completed successfully');
    return data;
  } catch (error) {
    showError('Failed to complete task');
    return handleActionError('Failed to complete task', error);
  }
}

export async function deleteCompletion(hass, completionId) {
  try {
    const response = await hass.callService('tasktracker', 'delete_completion', { completion_id: completionId }, {}, true, true);
    const data = ensureServiceSuccess(response);
    showSuccess('Completion deleted successfully');
    return data;
  } catch (error) {
    showError('Failed to delete completion');
    return handleActionError('Failed to delete completion', error);
  }
}

export async function updateCompletion(hass, completionId, updates) {
  try {
    const params = { completion_id: completionId, ...updates };
    const response = await hass.callService('tasktracker', 'update_completion', params, {}, true, true);
    const data = ensureServiceSuccess(response);
    showSuccess('Completion updated successfully');
    return data;
  } catch (error) {
    showError('Failed to update completion');
    return handleActionError('Failed to update completion', error);
  }
}

export async function updateTask(hass, taskId, taskType, assignedUsers, updates) {
  try {
    const serviceData = { task_id: taskId, task_type: taskType, ...updates };
    // Only set assignedUsers if it's not already in updates (to avoid overwriting new assignments)
    if (assignedUsers && !('assigned_users' in updates)) {
      serviceData.assigned_users = assignedUsers;
    }
    const response = await hass.callService('tasktracker', 'update_task', serviceData, {}, true, true);
    const data = ensureServiceSuccess(response);
    return data;
  } catch (error) {
    return handleActionError('Failed to update task', error);
  }
}

export async function snoozeTask(hass, task, snoozeUntil, assignedUsers, refreshCallback = null) {
  try {
    const response = await hass.callService('tasktracker', 'update_task', {
      task_id: task.id || task.task_id,
      task_type: task.task_type,
      assigned_users: assignedUsers,
      next_due: snoozeUntil,
    }, {}, true, true);
    const data = ensureServiceSuccess(response);
    showSuccess('Task snoozed');
    if (refreshCallback) setTimeout(() => refreshCallback(), 100);
    return true;
  } catch (error) {
    showError('Failed to snooze task');
    return false;
  }
}

export async function disposeLeftover(hass, leftoverName, username, notes) {
  try {
    const serviceData = { name: leftoverName, event_type: 'leftover_disposed' };
    if (username) serviceData.username = username;
    if (notes) serviceData.notes = notes;
    const response = await hass.callService('tasktracker', 'complete_task_by_name', serviceData, {}, true, true);
    const data = ensureServiceSuccess(response);
    return data;
  } catch (error) {
    return handleActionError('Failed to dispose leftover', error);
  }
}

export async function createTaskFromDescription(hass, taskType, taskDescription, assignedUsers) {
  try {
    const params = { task_type: taskType, task_description: taskDescription };
    if (assignedUsers) params.assigned_users = assignedUsers;
    const response = await hass.callService('tasktracker', 'create_task_from_description', params, {}, true, true);
    const data = ensureServiceSuccess(response);
    showSuccess('Task created');
    return data;
  } catch (error) {
    showError('Failed to create task');
    return handleActionError('Failed to create task', error);
  }
}

export async function deleteTask(hass, taskId, taskType) {
  try {
    const params = { task_id: taskId, task_type: taskType };
    const response = await hass.callService('tasktracker', 'delete_task', params, {}, true, true);
    const data = ensureServiceSuccess(response);
    showSuccess('Task deleted');
    return data;
  } catch (error) {
    showError('Failed to delete task');
    return handleActionError('Failed to delete task', error);
  }
}
