/**
 * TaskDataManager
 *
 * A utility for managing task data in memory instead of storing JSON in DOM attributes.
 * This prevents JSON parsing errors when task data contains unescaped quotes and improves performance.
 */
export class TaskDataManager {
  constructor() {
    this._dataMap = new Map();
    this._keyCounter = 0;
  }

  /**
   * Clear all stored data
   */
  clear() {
    this._dataMap.clear();
    this._keyCounter = 0;
  }

  /**
   * Store task data and return a unique key
   * @param {Object} task - The task object to store
   * @param {string} taskType - The type of task ('task', 'self_care', 'leftover', etc.)
   * @returns {string} - Unique key for retrieving the data
   */
  storeTaskData(task, taskType = 'task') {
    // Use task ID if available, otherwise generate a unique key
    let key;
    if (task.id !== undefined) {
      key = `${taskType}_${task.id}`;
    } else {
      key = `${taskType}_${++this._keyCounter}`;
    }

    this._dataMap.set(key, { task, taskType });
    return key;
  }

  /**
   * Retrieve task data by key
   * @param {string} key - The key returned by storeTaskData
   * @returns {Object|null} - Object with {task, taskType} or null if not found
   */
  getTaskData(key) {
    return this._dataMap.get(key) || null;
  }

  /**
   * Store multiple tasks and return their keys
   * @param {Array} tasks - Array of task objects
   * @param {string} taskType - The type of tasks
   * @returns {Array} - Array of keys corresponding to the tasks
   */
  storeTaskList(tasks, taskType = 'task') {
    return tasks.map(task => this.storeTaskData(task, taskType));
  }

  /**
   * Get the number of stored items
   * @returns {number} - Number of stored items
   */
  size() {
    return this._dataMap.size;
  }

  /**
   * Check if a key exists
   * @param {string} key - The key to check
   * @returns {boolean} - Whether the key exists
   */
  hasKey(key) {
    return this._dataMap.has(key);
  }

  /**
   * Remove a specific key
   * @param {string} key - The key to remove
   * @returns {boolean} - Whether the key was found and removed
   */
  removeKey(key) {
    return this._dataMap.delete(key);
  }

  /**
   * Get all stored keys
   * @returns {Array} - Array of all stored keys
   */
  getAllKeys() {
    return Array.from(this._dataMap.keys());
  }

  /**
   * Get all stored task data
   * @returns {Array} - Array of all stored {task, taskType} objects
   */
  getAllTaskData() {
    return Array.from(this._dataMap.values());
  }
}

export default TaskDataManager;
