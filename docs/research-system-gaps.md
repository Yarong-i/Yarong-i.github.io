# What the research system still needs for the homepage

The homepage copies figures; it never calculates strategy results. These are the records the research system
(YATC ASK comparison ledger) would have to keep before the site can show them. Until then the site shows 미연동
or marks the figure as provisional.

## 1. 10-point filter strategy ledger

Rule (defined by the operator): buy the same final first choice as the base strategy only when its screen score is
10 or more; otherwise stay in cash. 10 points is a buy condition only — every recommendation stays public.

Needed per model and trading day, written by the research system in the same post-market ledger run:

| field | meaning |
|---|---|
| `filter10.condition_met` | final first choice exists and its `screen_score` ≥ 10 |
| `filter10.executed` | the mock buy was recorded (false for cash days, failures, missing prices) |
| `filter10.category` / `detail` | PICK, BELOW_THRESHOLD, NO_PICK, failure kinds — same vocabulary as the base ledger |
| `filter10.day` / `cum` / `equity` | per exposure, compounded daily, same start date (2026-11-06) and price rules |
| `filter10.final` | whether the day's close is confirmed |

The export would then fill `strategy.filter10` per day and `performance/<model>-filter10.json`.

## 2. Confirmed day result and correction history

Today the ledger publishes the day's figure from a provisional close (KIS current price after 15:30); the next
trading day confirms the close and the cumulative figure absorbs any difference. The homepage therefore shows the
provisional day value as 잠정 and cannot show the confirmed day value separately.

Needed:

| field | meaning |
|---|---|
| per day: `day_provisional`, `day_confirmed`, `confirmed_at`, `close_status` | both values kept, never overwritten |
| `cum_as_published` vs `cum_current` | the cumulative figure as sent that day and as it stands after confirmations |
| correction rows linked to the affected day and model | original → corrected close, source, KRX verification state, applied time |
| `unverified` list | corrected closes not yet matched to KRX official data |

With these, the day page can show "잠정 −0.60% → 확정 −0.45%" and list the correction instead of only noting it.

## 3. Calendar

A closed market day (휴장) is not recorded as such; the export only knows days that have runs. A trading-calendar
row per day (open/closed) would let the site show 휴장 instead of a missing day.
