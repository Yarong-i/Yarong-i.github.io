// Public, read-only JSON URL of the latest snapshot (…/live/latest.json in the public bucket). Leave empty until the
// bucket exists. Per-date archives are read from the same place (…/live/days/<date>.json); without an endpoint the
// archives copied into the site at build (/live/days/) are used. Never put write URLs, credentials or server
// addresses here: the browser only reads.
export const liveTradingConfig = {
  endpoint: 'https://objectstorage.ap-chuncheon-1.oraclecloud.com/n/ax4qeaolf1uw/b/yarong-live/o/live/latest.json',
  pollMs: 10_000,
  timeoutMs: 8_000,
  staleMs: 60_000,
};

const bucketBase = () => liveTradingConfig.endpoint.replace(/latest\.json$/, '');
/** Where the browser reads one date's archive: the live bucket first (no rebuild needed), then the site's copy. */
export const archiveUrls = (date: string) => [
  ...(liveTradingConfig.endpoint ? [`${bucketBase()}days/${date}.json`] : []),
  `/live/days/${date}.json`,
];
/** The public list of operating days (the bucket itself cannot be listed). */
export const indexUrls = () => [...(liveTradingConfig.endpoint ? [`${bucketBase()}index.json`] : []), '/live/index.json'];
