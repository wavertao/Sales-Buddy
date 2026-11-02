import { NODE_META, nodeDisplay, nodeName } from '../../../../packages/contracts/p9.ts';
import type { BidNode, P9Bid } from '../../../../packages/contracts/p9.ts';

/**
 * P9 节点状态机 0-9 · 手写纯 TS 实现（不引 xstate 包，见任务依赖规则）。
 * 语义对标 XState：state（currentNode）+ guard（节点门禁）+ action（推进副作用由 service 触发）。
 * XState 未来可替换：把本文件的 transition 表换成 createMachine 配置即可，
 * 状态名 / 门禁名 / 并行澄清语义保持不变（见最终汇报“可选依赖”）。
 *
 * 主链：0→1→2→3→5→6→8→9；澄清节点 4（接 3 后）与 7（接 6 后）并行不阻塞主链：
 * 4 与 7 既可作为当前节点停留，也可由主链动作跳过——advance() 在 3 之后先进入 4，
 * 但门禁“澄清未闭环不阻塞”允许从 4 直接推进到 5；同理 7→8。
 * 节点级回退：原型只明确任务级“可重新打开”，节点不回退（terminal 节点 9 与作废除外）。
 */

export type NodeGate = {
  from: BidNode; to: BidNode; gate: string; check: (bid: P9BidLike) => { ok: boolean; reason: string };
};
export type P9BidLike = {
  currentNode: number; status: string;
  atb?: { filled: number } | null;
  strategy?: { scope?: string; customer?: string; competition?: string; status?: string } | null;
  aiPipeline?: string | null; submission?: unknown | null;
  [key: string]: unknown;
};

const hasStrategy = (b: P9BidLike) =>
  !!b.strategy && !!b.strategy.scope && !!b.strategy.customer && !!b.strategy.competition;
const dispatched = (b: P9BidLike) =>
  ['dispatched', 'executing', 'checking', 'review', 'submitted'].includes(String(b.aiPipeline || ''));

export const TRANSITIONS: NodeGate[] = [
  { from: 0, to: 1, gate: 'ATB 已评估（缺口可留待澄清，不阻断）', check: (b) => ({ ok: !!b.atb, reason: b.atb ? '' : 'ATB 尚未评估' }) },
  { from: 1, to: 2, gate: '策略三段已填写', check: (b) => ({ ok: hasStrategy(b), reason: hasStrategy(b) ? '' : '策略三段（招标范围/对客/竞争）未填满' }) },
  { from: 2, to: 3, gate: '计划已下发（拆解确认后派发）', check: (b) => ({ ok: dispatched(b), reason: dispatched(b) ? '' : '计划尚未确认下发' }) },
  { from: 3, to: 4, gate: '开工会已召开（会议记录存在即放行，由 service 校验）', check: () => ({ ok: true, reason: '' }) },
  { from: 4, to: 5, gate: '澄清并行不阻塞主链', check: () => ({ ok: true, reason: '' }) },
  { from: 5, to: 6, gate: '标书定稿评审通过（人工复查已批准）', check: (b) => ({ ok: (b as P9Bid).reviewStatus === 'approved', reason: (b as P9Bid).reviewStatus === 'approved' ? '' : '人工复查尚未批准' }) },
  { from: 6, to: 7, gate: '交标记录齐备（交标后自动进入评标期澄清）', check: (b) => ({ ok: !!b.submission, reason: b.submission ? '' : '交标记录尚未提交' }) },
  { from: 7, to: 8, gate: '澄清并行不阻塞主链', check: () => ({ ok: true, reason: '' }) },
  { from: 8, to: 9, gate: '定标结论已录入（close 接口）', check: (b) => ({ ok: !!(b as P9Bid).award, reason: (b as P9Bid).award ? '' : '定标结论尚未录入' }) },
];

export function canAdvance(bid: P9BidLike, to?: BidNode): { ok: boolean; reason: string; from: number; to: number } {
  const from = bid.currentNode;
  if (bid.status === 'voided') return { ok: false, reason: '投标已作废，节点不再推进', from, to: to ?? from };
  if (from >= 9) return { ok: false, reason: '已到达终态节点 9 定标', from, to: to ?? from };
  const next = to ?? ((from + 1) as BidNode);
  const t = TRANSITIONS.find((x) => x.from === from && x.to === next);
  if (!t) return { ok: false, reason: `不允许从节点 ${from} 直接推进到节点 ${next}（须按序推进）`, from, to: next };
  const r = t.check(bid);
  return { ...r, from, to: next };
}

/** 推进到下一节点；门禁不通过时抛错（调用方转为 409），绝不静默跳过门禁。 */
export function advanceNode(bid: P9Bid, to?: BidNode): P9Bid {
  const r = canAdvance(bid, to);
  if (!r.ok) { const e = new Error(r.reason) as Error & { http: number; code: string }; e.http = 409; e.code = 'NODE_GATE'; throw e; }
  return { ...bid, currentNode: r.to as BidNode };
}

/** 尝试推进：门禁通过则返回新节点，否则保持原节点并返回原因（供 service 做“条件推进”）。 */
export function tryAdvance(bid: P9Bid, to?: BidNode): { bid: P9Bid; advanced: boolean; reason: string } {
  const r = canAdvance(bid, to);
  if (!r.ok) return { bid, advanced: false, reason: r.reason };
  return { bid: { ...bid, currentNode: r.to as BidNode }, advanced: true, reason: '' };
}

export function describeNode(node: number) {
  return { node, name: nodeName(node), display: nodeDisplay(node), meta: NODE_META[node] ?? null };
}
export const NODE_GATES_SUMMARY = TRANSITIONS.map((t) => ({
  from: `${t.from} ${nodeName(t.from)}`, to: `${t.to} ${nodeName(t.to)}`, gate: t.gate,
}));
