import { z } from 'astro/zod';
export const labels = {
  buy_waiting: '매수 조건 대기', buy_submitted: '매수 주문 접수', buy_partial: '매수 일부 체결',
  take_profit_waiting: '익절 조건 대기', stop_loss_waiting: '손절 조건 대기', exit_waiting: '익절·손절 조건 대기',
  take_profit_submitted: '익절 주문 접수', stop_loss_submitted: '손절 주문 접수',
  holding: '보유 중', sell_submitted: '매도 주문 접수', sell_partial: '매도 일부 체결',
  closed: '매도 완료', unfilled: '미체결 종료', rejected: '주문 거절', cancelled: '주문 취소', failed: '실행 실패',
} as const;
const number = z.number().nonnegative();
const statusSchema = z.enum(Object.keys(labels) as [keyof typeof labels, ...(keyof typeof labels)[]]);
const record = z.object({
  id: z.string().min(1), model: z.string().min(1), symbol: z.string().regex(/^\d{6}$/), name: z.string().min(1),
  status: statusSchema,
  statusSince: z.iso.datetime({ offset: true }).nullable().optional(),
  updatedAt: z.iso.datetime({ offset: true }),
  requestedQuantity: number.nullable(), filledQuantity: number.nullable(), filledAmount: number.nullable(),
  heldQuantity: number.nullable(), averagePrice: number.nullable(),
  takeProfitPrice: number.nullable(), stopLossPrice: number.nullable(),
  events: z.array(z.object({ at: z.iso.datetime({ offset: true }), text: z.string().min(1), status: statusSchema.optional() })),
});
export const snapshotSchema = z.object({
  version: z.literal(1), updatedAt: z.iso.datetime({ offset: true }), records: z.array(record),
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
