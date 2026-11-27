import { snapshotSchema } from './live-trading';
export async function getLiveTrading() {
  const files = import.meta.glob('../../data/live-trading.json', { query: '?raw', import: 'default', eager: true });
  const raw = Object.values(files)[0];
  if (raw === undefined) return { snapshot: null, error: false };
  try {
    const snapshot = snapshotSchema.parse(JSON.parse(String(raw)));
    return { snapshot, error: false };
  } catch (error) {
    return { snapshot: null, error: true };
  }
}
