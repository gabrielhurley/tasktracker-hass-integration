export function setupEventListener(hass, eventType, callback) {
  let unsubscribePromise = hass.connection.subscribeEvents(
    (event) => {
      callback(event.data);
    },
    `tasktracker_${eventType}`,
  );
  let isCleanedUp = false;
  return async () => {
    if (isCleanedUp) return;
    try {
      const unsubscribe = await unsubscribePromise;
      if (typeof unsubscribe === 'function') unsubscribe();
    } catch (error) {
      if (error.code !== 'not_found') {
        console.warn('Error cleaning up TaskTracker event listener:', error);
      }
    } finally {
      isCleanedUp = true;
    }
  };
}

export function setupTaskCompletionListener(hass, callback) {
  return setupEventListener(hass, 'task_completed', callback);
}
export function setupLeftoverDisposalListener(hass, callback) {
  return setupEventListener(hass, 'leftover_disposed', callback);
}
export function setupTaskCreationListener(hass, callback) {
  return setupEventListener(hass, 'task_created', callback);
}
export function setupLeftoverCreationListener(hass, callback) {
  return setupEventListener(hass, 'leftover_created', callback);
}
export function setupTaskUpdateListener(hass, callback) {
  return setupEventListener(hass, 'task_updated', callback);
}
export function setupCompletionDeletionListener(hass, callback) {
  return setupEventListener(hass, 'completion_deleted', callback);
}

export async function fireTaskEvent(hass, eventType, data) {
  try {
    const eventUrl = `/api/events/tasktracker_${eventType}`;
    await hass.callApi('POST', eventUrl.substring(5), data);
  } catch (error) {
    console.warn('Failed to fire TaskTracker event:', error);
  }
}
