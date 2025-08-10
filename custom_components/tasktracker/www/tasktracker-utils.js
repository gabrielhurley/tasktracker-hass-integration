// Compatibility shim delegating to modular utils
import * as F from './utils/formatters.js';
import * as U from './utils/users.js';
import * as E from './utils/events.js';
import * as A from './utils/actions.js';
import * as V from './utils/visuals.js';
import * as C from './utils/config-editor.js';
import * as Arr from './utils/arrays.js';
import * as S from './utils/styles.js';
import * as T from './utils/timers.js';
import * as DS from './utils/daily-state.js';
import { createStyledButton, showModal } from './utils/ui/components.js';
import { createTaskModal } from './utils/ui/task-modal.js';
import { createCompletionEditModal } from './utils/ui/completion-edit-modal.js';
import { createDailyStateModal } from './utils/ui/daily-state-modal.js';
import { showSuccess as toastShowSuccess, showError as toastShowError } from './utils/toast.js';
// Legacy datetime helpers removed. Use TaskTrackerDateTime from './utils/datetime-utils.js' where needed.

export class TaskTrackerUtils {
  // Date/time helpers are provided by TaskTrackerDateTime in './utils/datetime-utils.js'

  // Users
  static getAvailableUsers = U.getAvailableUsers;
  static getEnhancedUsers = U.getEnhancedUsers;
  static getUserDisplayName = U.getUserDisplayName;
  static getUsernameFromDisplayName = U.getUsernameFromDisplayName;
  static getCurrentUsername = U.getCurrentUsername;
  static hasValidUserConfig = U.hasValidUserConfig;
  static getUsernameForAction = U.getUsernameForAction;

  // Toasts (delegated to utils/toast.js)
  static showSuccess(message) { return toastShowSuccess(message); }
  static showError(message) { return toastShowError(message); }

  // Formatting
  static formatDate = F.formatDate;
  static formatDueDate = F.formatDueDate;
  static formatSelfCareDueDate = F.formatSelfCareDueDate;
  static convertTo12HourFormat = F.convertTo12HourFormat;
  static formatDateTime = F.formatDateTime;
  static formatDuration = F.formatDuration;
  static formatPriority = F.formatPriority;
  static normalizePriority = F.normalizePriority;
  static formatDateTimeForInput = F.formatDateTimeForInput;
  static getPriorityOptions = F.getPriorityOptions;
  static getFrequencyDaysOptions = F.getFrequencyDaysOptions;
  static getMoodLabel = F.getMoodLabel;
  static getFreeTimeLabel = F.getFreeTimeLabel;
  static capitalize = F.capitalize;

  // Events
  static setupEventListener = E.setupEventListener;
  static setupTaskCompletionListener = E.setupTaskCompletionListener;
  static setupLeftoverDisposalListener = E.setupLeftoverDisposalListener;
  static setupTaskCreationListener = E.setupTaskCreationListener;
  static setupLeftoverCreationListener = E.setupLeftoverCreationListener;
  static setupTaskUpdateListener = E.setupTaskUpdateListener;
  static setupCompletionDeletionListener = E.setupCompletionDeletionListener;
  static fireTaskEvent = E.fireTaskEvent;

  // Actions
  static completeTask = A.completeTask;
  static deleteCompletion = A.deleteCompletion;
  static updateCompletion = A.updateCompletion;
  static updateTask = A.updateTask;
  static snoozeTask = A.snoozeTask;
  static disposeLeftover = A.disposeLeftover;
  static createTaskFromDescription = A.createTaskFromDescription;
  static deleteTask = A.deleteTask;

  // Visuals
  static getOverdueColor = V.getOverdueColor;
  static getTaskBorderStyle = V.getTaskBorderStyle;

  // Config editor
  static createConfigRow = C.createConfigRow;
  static createNumberInput = C.createNumberInput;
  static createTextInput = C.createTextInput;
  static createCheckboxInput = C.createCheckboxInput;
  static createSelectInput = C.createSelectInput;
  static getCommonConfigStyles = C.getCommonConfigStyles;
  static handleConfigValueChange = C.handleConfigValueChange;

  // Arrays
  static arraysEqual = Arr.arraysEqual;

  // Styles
  static getCommonCardStyles = S.getCommonCardStyles;

  // Timers
  static setupAutoRefresh = T.setupAutoRefresh;

  // Daily state
  static getDefaultDailyState = DS.getDefaultDailyState;
  static getPresetDailyStates = DS.getPresetDailyStates;
  static findMatchingDailyStatePreset = DS.findMatchingDailyStatePreset;
  static fetchDailyState = DS.fetchDailyState;
  static saveDailyState = DS.saveDailyState;

  // UI components and modals
  static createStyledButton = createStyledButton;
  static showModal = showModal;
  static createTaskModal = createTaskModal;
  static createCompletionEditModal = createCompletionEditModal;
  static createDailyStateModal = createDailyStateModal;

  // Misc kept empty for now
}
