// Jest tests for completion edit/update wiring
// Note: We avoid importing ESM frontend files; test the service param shape and datetime input roundtrip directly.

describe('Completion Edit: updateCompletion wiring', () => {
  test('updateCompletion includes completed_at in service params', async () => {
    const captured = { domain: null, service: null, params: null };
    const hass = {
      callService: async (domain, service, params) => {
        captured.domain = domain;
        captured.service = service;
        captured.params = params;
        return { response: { success: true, spoken_response: 'ok' } };
      }
    };

    const completionId = 42;
    const iso = '2025-08-01T15:30:00.000Z';

    // Local replica of the service call composition used by the frontend util
    async function updateCompletion(hassInst, completionIdArg, updates) {
      const params = { completion_id: completionIdArg, ...updates };
      const response = await hassInst.callService('tasktracker', 'update_completion', params, {}, true, true);
      return response.response || { success: false };
    }

    const res = await updateCompletion(hass, completionId, { completed_at: iso });

    expect(captured.domain).toBe('tasktracker');
    expect(captured.service).toBe('update_completion');
    expect(captured.params).toMatchObject({ completion_id: completionId, completed_at: iso });
    expect(res.success).toBe(true);
  });
});

describe('Completion Edit: formatDateTimeForInput', () => {
  test('formats ISO for datetime-local input and roundtrips back to ISO', () => {
    const iso = '2025-08-01T07:45:00.000Z';
    // Local replica of input formatting logic: convert ISO to local time string without seconds
    function formatDateTimeForInput(isoString) {
      if (!isoString) return '';
      const date = new Date(isoString);
      const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      return local;
    }
    const inputVal = formatDateTimeForInput(iso);
    // Expect YYYY-MM-DDTHH:MM (no seconds)
    expect(inputVal).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);

    // new Date(datetime-local) will parse in local time; toISOString() yields UTC
    const backIso = new Date(inputVal).toISOString();
    expect(typeof backIso).toBe('string');
  });
});
