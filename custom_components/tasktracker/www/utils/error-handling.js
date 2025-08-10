export function handleActionError(prefix, error) {
  const message = (error && error.message) ? error.message : 'Unknown error';
  // eslint-disable-next-line no-console
  console.error(prefix + ':', error);
  throw new Error(`${prefix}: ${message}`);
}

export function ensureServiceSuccess(response, fallbackMessage = 'Service call failed') {
  const ok = response && response.response && response.response.success;
  if (ok) return response.response;
  const msg = response && response.response && response.response.spoken_response;
  throw new Error(msg || fallbackMessage);
}
