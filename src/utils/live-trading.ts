import { z } from 'astro/zod';
export const labels = {
  buy_waiting: '매수 조건 대기', buy_submitted: '매수 증권사 접수', buy_partial: '매수 부분 체결',
  take_profit_waiting: '익절 조건 대기', stop_loss_waiting: '손절 조건 대기', exit_waiting: '익절·손절 조건 대기',
  take_profit_submitted: '익절 주문 접수', stop_loss_submitted: '손절 주문 접수',
  holding: '보유', sell_submitted: '매도 증권사 접수', sell_partial: '매도 부분 체결',
  closed: '매도 체결', unfilled: '미체결 종료', rejected: '주문 거절', cancelled: '주문 취소', failed: '실행 실패',
  // yatc-live states (the exporter emits these; −1.5%/+3% are observation only, never an order status)
  planned: '주문 예정', cancel_requested: '취소 요청', cancel_confirmed: '취소 확인', carried: '이월',
  unconfirmed: '결과 미확인', not_sent: '주문 미전송',
} as const;
const number = z.number().nonnegative();
const eventId = z.string().regex(/^[a-z][a-z0-9-]{0,60}$/);
const statusSchema = z.enum(Object.keys(labels) as [keyof typeof labels, ...(keyof typeof labels)[]]);
const record = z.object({
  id: z.string().min(1), model: z.string().min(1), symbol: z.string().regex(/^\d{6}$/), name: z.string().min(1),
  status: statusSchema,
  statusSince: z.iso.datetime({ offset: true }).nullable().optional(),
  updatedAt: z.iso.datetime({ offset: true }),
  requestedQuantity: number.nullable(), filledQuantity: number.nullable(), filledAmount: number.nullable(),
  heldQuantity: number.nullable(), averagePrice: number.nullable(),
  takeProfitPrice: number.nullable(), stopLossPrice: number.nullable(),
  // id: stable public event ID (e.g. e123) used by date+event links such as Discord alerts
  events: z.array(z.object({ id: eventId.nullable().optional(), at: z.iso.datetime({ offset: true }), text: z.string().min(1), status: statusSchema.optional() })),
  // optional detail (all from the ledger; unknown = null)
  tradingDate: z.iso.date().optional(),
  cancelledQuantity: number.nullable().optional(), soldQuantity: number.nullable().optional(),
  soldAmount: number.nullable().optional(), averageSellPrice: number.nullable().optional(),
  realizedPnl: z.number().nullable().optional(), carriedQuantity: number.nullable().optional(),
});
const qty = number.nullable();
const tradeRow = z.object({
  symbol: z.string().regex(/^\d{6}$/), name: z.string().nullable(), carry: z.boolean(), heldBefore: number.optional(),
  orderQty: qty, orderState: z.string().nullable(), filledQty: number, avgBuyPrice: qty, buyAmount: number,
  cancelledQty: number, cancelState: z.enum(['none', 'requested', 'confirmed', 'unresolved']),
  sellOrderQty: qty, sellQty: number, avgSellPrice: qty, sellAmount: number,
  sellCancelledQty: number, sellCancelState: z.enum(['none', 'requested', 'confirmed', 'unresolved']),
  heldAfter: number, realizedPnl: z.number(), returnPct: z.number().nullable(),
});
export const dayResults = {
  done: '매매 완료', no_pick: '추천 없음', pick_failed: '추천 생성 실패', not_attempted: '매수 미시도', unfilled: '미체결',
  carried: '이월', check: '확인 필요', in_progress: '진행 중',
} as const;
const stockRef = z.object({ symbol: z.string().regex(/^\d{6}$/), name: z.string().nullable() });
const resultSchema = z.enum(Object.keys(dayResults) as [keyof typeof dayResults, ...(keyof typeof dayResults)[]]);
export const daySummary = z.object({
  date: z.iso.date(), model: z.string(), result: resultSchema, reason: z.string().nullable(),
  symbol: z.string().nullable(), name: z.string().nullable(),
  // today's candidate (the Sonnet pick) and shares carried in from earlier days
  pick: stockRef.nullable().optional(), pickStatus: z.enum(['waiting', 'ok', 'none', 'failed']).optional(),
  stocks: z.array(stockRef.extend({ role: z.enum(['candidate', 'carry']) })).optional(),
  buyAmount: number, sellAmount: number, realizedPnl: z.number(), unrealizedPnl: z.number().nullable(),
  fee: qty, tax: qty, costConfirmed: z.boolean(), reportAt: z.iso.datetime({ offset: true }).nullable(),
  heldAfter: number, trades: z.array(tradeRow),
});
export const operatorSchema = z.object({
  model: z.string().min(1), since: z.iso.date(), through: z.iso.date(),
  updatedAt: z.iso.datetime({ offset: true }),
  realizedPnl: z.number().nullable(), unrealizedPnl: z.number().nullable(), returnPct: z.number().nullable(),
  closedTrades: number.int().nullable(), winningTrades: number.int().nullable(),
  costBasis: z.enum(['net', 'gross', 'unknown']), returnMethod: z.string().min(1).nullable(),
});
/** live/index.json: the public list of operating days (the bucket cannot be listed). */
export const indexSchema = z.object({
  version: z.literal(1), updatedAt: z.iso.datetime({ offset: true }), model: z.string(), startDate: z.iso.date().nullable(),
  operators: z.array(operatorSchema).optional(),
  days: z.array(daySummary.pick({ date: true, result: true, reason: true, symbol: true, name: true, stocks: true, buyAmount: true, realizedPnl: true, heldAfter: true, costConfirmed: true })
    .extend({ model: z.string().optional(), sellAmount: number.optional() })),
});
export const snapshotSchema = z.object({
  version: z.literal(1), updatedAt: z.iso.datetime({ offset: true }), records: z.array(record),
  // updatedAt = when the server read the ledger (data generation); brokerCheckedAt = newest KIS read in the ledger
  brokerCheckedAt: z.iso.datetime({ offset: true }).nullable().optional(),
  // per-date archive files carry their date; day-level events (no-buy reason, post-close report) have IDs too
  date: z.iso.date().optional(),
  dayEvents: z.array(z.object({ id: eventId, at: z.iso.datetime({ offset: true }), date: z.iso.date(), text: z.string().min(1), test: z.boolean().optional() })).optional(),
  // summary of the target day (home) / of this archive's date, as of the end of that day
  day: daySummary.nullable().optional(),
  summary: daySummary.nullable().optional(),
  operation: z.object({
    model: z.string().min(1), orderSend: z.boolean(), startDate: z.iso.date().nullable(),
    phase: z.enum(['off', 'before_start', 'pre_open', 'in_session', 'closed']),
    tradingDate: z.iso.date(), sessionOpen: z.string().nullable().optional(), sessionClose: z.string().nullable().optional(),
    realOrders: number.int(),
  }).optional(),
  operators: z.array(z.object({
    model: z.string().min(1), since: z.iso.date(), through: z.iso.date(),
    updatedAt: z.iso.datetime({ offset: true }),
    realizedPnl: z.number().nullable(), unrealizedPnl: z.number().nullable(), returnPct: z.number().nullable(),
    closedTrades: number.int().nullable(), winningTrades: number.int().nullable(),
    costBasis: z.enum(['net', 'gross', 'unknown']), returnMethod: z.string().min(1).nullable(),
  }).refine((v) => v.since <= v.through, 'Invalid performance period')
    .refine((v) => v.winningTrades === null || v.closedTrades === null || v.winningTrades <= v.closedTrades, 'Wins exceed closed trades')).optional(),
});
export const formatTime = (value: string) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value));
export const amount = (value: number | null, unit: string) => value === null ? '미확인' : `${value.toLocaleString('ko-KR')}${unit}`;

export const signed = (value: number | null, unit: string) => value === null ? '집계 전' : `${value > 0 ? '+' : ''}${value.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}${unit}`;
