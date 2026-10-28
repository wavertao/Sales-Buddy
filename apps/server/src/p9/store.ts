import { allRecords, now, record, saveRecord, uid } from '../db.ts';
import { AppError } from '../../../../packages/contracts/index.ts';
import { canAccess } from '../crm.ts';
import type { User } from '../../../../packages/contracts/index.ts';
import type { BidItem, BidMeeting, BidRound, BidTask, ChecklistItem, Clarification, P9Bid, QuoteVersion, BidDoc } from '../../../../packages/contracts/p9.ts';

/** P9 存储层：沿用仓库现有模式——全部实体共用 records 表，data 列存完整 JSON。 */
export type P9Type = 'bid' | 'bid_item' | 'bid_task' | 'clarification' | 'bid_doc' | 'quote_version' | 'checklist_item' | 'bid_meeting' | 'bid_round';
type AnyRec = Record<string, unknown> & { id: string; type: string; customerId: string; entityType?: string | null; entityId?: string | null; name: string; updatedAt: string };

/** 子记录落库：records 表要求 name 列，子实体以 title/filename 充当 name（不另加字段）。 */
export function saveChild<T extends { id: string; type: string; customerId: string; updatedAt?: string; [key: string]: unknown }>(r: T): T {
  const src = r as { name?: unknown; title?: unknown; filename?: unknown };
  const name = (typeof src.name === 'string' && src.name) || (typeof src.title === 'string' && src.title) || (typeof src.filename === 'string' && src.filename) || r.id;
  saveRecord({ ...r, name, updatedAt: now() });
  return { ...r, updatedAt: now() };
}
export function children<T>(bidId: string, type: P9Type): T[] {
  return allRecords(type).filter((r: AnyRec) => r.entityId === bidId || (r as { bidId?: string }).bidId === bidId) as T[];
}
export function childById<T>(id: string, type: P9Type): T | undefined {
  const r = record(id) as AnyRec | undefined;
  return r && r.type === type ? (r as T) : undefined;
}
export function loadBid(user: User, id: string): P9Bid {
  const r = record(id) as AnyRec | undefined;
  if (!r || r.type !== 'bid') throw new AppError('NOT_FOUND', '投标不存在', 404);
  if (!canAccess(user, r.customerId)) throw new AppError('FORBIDDEN', '无权访问当前投标', 403);
  return r as unknown as P9Bid;
}
export function loadChild<T>(user: User, bid: P9Bid, id: string, type: P9Type): T {
  const r = childById<T & { bidId: string }>(id, type);
  if (!r || (r as { bidId: string }).bidId !== bid.id) throw new AppError('NOT_FOUND', '记录不存在', 404);
  void user; // 归属已由 loadBid 校验（子记录 customerId 与投标一致）
  return r;
}
export function saveBid(bid: P9Bid): P9Bid {
  const next = { ...bid, updatedAt: now() };
  saveRecord({ ...next, entityType: 'opportunity', entityId: next.opportunityId || null });
  return next;
}

/** 编号 BID-{YYYYMMDD}-{NNN}：发起日（本地时区）、当日全局递增从 001、作废/流标不回收。 */
export function localDateStr(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}
export function allocateBidNumber(): string {
  // 单进程同步路径：调用方须在 allocate 后同步立即落库（中间无 await），
  // Node 单线程下取号与落库之间不可能交错，故不回收、不重号。
  const date = localDateStr();
  const prefix = `BID-${date}-`;
  let max = 0;
  for (const b of allRecords('bid') as P9Bid[]) {
    if (b.number?.startsWith(prefix)) {
      const n = Number(b.number.slice(prefix.length));
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

export const newId = (prefix: string) => uid(prefix);
export function stamp(): string { return now(); }

/** 报价 gating：仅 admin + 投标 pricingTeam 成员可见；其余角色 403（前端只给锁定占位）。 */
export function canViewQuote(user: User, bid: P9Bid): boolean {
  return user.role === 'admin' || (bid.pricingTeam || []).includes(user.id);
}
export function requireQuoteAccess(user: User, bid: P9Bid): void {
  if (!canViewQuote(user, bid)) throw new AppError('FORBIDDEN', '报价内容仅 admin 与投标 pricingTeam 成员可见', 403);
}

export type BidCollections = {
  items: BidItem[]; tasks: BidTask[]; clarifications: Clarification[]; docs: BidDoc[];
  quotes: QuoteVersion[]; checklist: ChecklistItem[]; meetings: BidMeeting[]; rounds: BidRound[];
};
export function collections(bidId: string): BidCollections {
  return {
    items: children<BidItem>(bidId, 'bid_item'),
    tasks: children<BidTask>(bidId, 'bid_task'),
    clarifications: children<Clarification>(bidId, 'clarification'),
    docs: children<BidDoc>(bidId, 'bid_doc'),
    quotes: children<QuoteVersion>(bidId, 'quote_version'),
    checklist: children<ChecklistItem>(bidId, 'checklist_item'),
    meetings: children<BidMeeting>(bidId, 'bid_meeting'),
    rounds: children<BidRound>(bidId, 'bid_round'),
  };
}
