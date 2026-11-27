// Public, read-only JSON URL. Leave empty until the exporter endpoint is ready.
// Never place brokerage endpoints, credentials, or private server URLs here.
export const liveTradingConfig = {
  endpoint: '',
  pollMs: 10_000,
  timeoutMs: 8_000,
  staleMs: 60_000,
};
