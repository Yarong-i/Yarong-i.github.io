// Build time: the research record of each day's operating model, embedded in /live/ so a live trade can be read next
// to the recommendation it came from (same picks, scores, reasons and risks as 주식 연구). Only the operating model is
// taken: the live executor trades the operating model's final first pick, and comparison models are never added.
import { getResearchDays, premarketState, formatStamp, tableNames, displayName, modelSlug, homePicks } from './research';

export type LiveResearchDay = {
  date: string;
  market: string;
  models: number;  // runs of any model that day (0 = nothing published yet)
  run: null | {
    model: string; slug: string; name: string; publishedAt: string | null; published: boolean;
    state: { key: string; label: string; note: string | null }; detail: string | null;
    top: string | null;  // ticker of the final first pick (what the executor buys)
    picks: { name: string; ticker: string; score: number | null; rank: number | null; order: number; reasons: string[]; risks: string[]; conditions: string[] }[];
  };
};

export async function liveResearchDays(): Promise<LiveResearchDay[]> {
  const days = await getResearchDays();
  return days.map((d) => {
    const run = d.data.models.find((m) => m.role === 'operating');
    if (!run) return { date: d.id, market: d.data.market, models: d.data.models.length, run: null };
    const st = premarketState(run);
    return {
      date: d.id, market: d.data.market, models: d.data.models.length,
      run: {
        model: run.model, slug: modelSlug(run.model), name: tableNames(d.data.models).get(run.model) ?? displayName(run),
        publishedAt: run.premarket.publishedAt ? formatStamp(run.premarket.publishedAt, false) ?? null : null,
        published: run.premarket.status === 'published', state: { key: st.key, label: st.label, note: st.note ?? null },
        detail: run.premarket.detail ?? null, top: homePicks(run)[0]?.ticker ?? null,
        picks: run.premarket.picks.map((p) => ({ name: p.name, ticker: p.ticker, score: p.score ?? null, rank: p.finalRank ?? p.rank ?? null, order: p.order,
          reasons: p.reasons, risks: p.risks, conditions: p.changeConditions })),
      },
    };
  });
}
