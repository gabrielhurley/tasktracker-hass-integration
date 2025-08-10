export function setupAutoRefresh(refreshCallback, intervalSeconds) {
  const intervalMs = intervalSeconds * 1000;
  if (isNaN(intervalMs) || intervalMs <= 0) return null;
  return setInterval(refreshCallback, intervalMs);
}
