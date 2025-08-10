export function getDefaultDailyState() {
  return {
    energy: 3,
    motivation: 3,
    focus: 3,
    pain: 1,
    mood: 0,
    free_time: 3,
  };
}

export function getPresetDailyStates() {
  return {
    great: { label: 'Great', values: { energy: 5, motivation: 4, focus: 4, pain: 1, mood: 2, free_time: 4 } },
    motivated: { label: 'Motivated', values: { energy: 4, motivation: 5, focus: 3, pain: 1, mood: 1, free_time: 3 } },
    normal: { label: 'Normal', values: { energy: 3, motivation: 3, focus: 3, pain: 1, mood: 0, free_time: 3 } },
    tired: { label: 'Tired', values: { energy: 2, motivation: 2, focus: 2, pain: 1, mood: -1, free_time: 3 } },
    stressed: { label: 'Stressed', values: { energy: 3, motivation: 2, focus: 1, pain: 2, mood: -1, free_time: 1 } },
    in_pain: { label: 'In Pain', values: { energy: 2, motivation: 2, focus: 2, pain: 5, mood: -1, free_time: 2 } },
    lazy: { label: 'Lazy', values: { energy: 3, motivation: 1, focus: 2, pain: 1, mood: 0, free_time: 4 } },
    complicated: { label: 'Complicated', values: null },
  };
}

export function findMatchingDailyStatePreset(state) {
  if (!state) return null;
  const presets = getPresetDailyStates();
  for (const [key, preset] of Object.entries(presets)) {
    if (key === 'complicated' || !preset.values) continue;
    const matches = Object.keys(preset.values).every(axis => state[axis] === preset.values[axis]);
    if (matches) return key;
  }
  return 'complicated';
}

export async function fetchDailyState(hass, username) {
  if (!username) return null;
  try {
    const resp = await hass.callService('tasktracker', 'get_daily_state', { username }, {}, true, true);
    if (resp && resp.response && resp.response.data) {
      return resp.response.data;
    }
  } catch (e) {
    console.warn('Failed to fetch daily state:', e);
  }
  return null;
}

export async function saveDailyState(hass, username, stateValues) {
  if (!username) return false;
  try {
    const { date, ...filteredStateValues } = stateValues;
    const payload = { username, ...filteredStateValues };
    await hass.callService('tasktracker', 'set_daily_state', payload, {}, true, true);
    return true;
  } catch (e) {
    console.warn('Failed to set daily state:', e);
    return false;
  }
}
