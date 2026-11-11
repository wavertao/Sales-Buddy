import { get, list, now, put } from '../db.ts';
import { AppError } from '../../../../packages/contracts/index.ts';
import type { ClauseReview, DecompItem, ExcludedClause, TenderFeedback, TenderParseResult, TenderRuleSet } from '../../../../packages/contracts/tender.ts';
import { deadlineOf, itemStats, ownerFields, titleOfClause } from './pipeline.ts';

/**
 * 人工复核：改判、确认、排除和捞回都落成一条 tender_feedback，再应用到解析结果上。
 * 人的结论优先级最高，重传新版时按 clauseKey 重新应用，不会被模型或规则覆盖。
 */
const feedbackId = (bidId: string, key: string) => `${bidId}:${key}`;
export const excludedOf = (runId: string) => get<ExcludedClause[]>('tender_excluded', runId) || [];
export const feedbackForBid = (bidId: string) => list<TenderFeedback>('tender_feedback').filter((f) => f.bidId === bidId);

/** 把一条人工结论应用到结果和已排除列表上，都是原地修改。 */
function applyOne(r: TenderParseResult, excluded: ExcludedClause[], rules: TenderRuleSet, f: TenderFeedback) {
  const at = r.items.findIndex((i) => i.clauseKey === f.clauseKey);
  const human = { source: 'human' as const, needsReview: undefined, reviewReasons: undefined, reason: f.note || undefined, workItemKey: f.workItemKey };
  // 判为不是要求、或归业主 / 其他承包商，都移出我方分解表，原因写明归谁
  const others = f.party === 'owner' ? '业主的责任' : f.party === 'other' ? '其他承包商的责任' : '';
  if (!f.isRequirement || others) {
    if (at < 0) return;
    const [it] = r.items.splice(at, 1);
    excluded.unshift({
      clauseKey: f.clauseKey, text: it.text, fileId: it.fileId, fileName: it.fileName, fileRole: it.fileRole, section: it.section, page: it.page,
      reason: `人工判定：${others || '不是要求'}${f.note ? `（${f.note}）` : ''}`, score: it.score, amended: it.amended, ruleCategory: it.ruleCategory, ruleStrength: it.ruleStrength,
    });
    return;
  }
  const category = f.category!;
  const owner = ownerFields(rules, category, deadlineOf(r.fields));
  if (at >= 0) {
    r.items[at] = { ...r.items[at], ...human, category, strength: f.strength, ...owner };
    return;
  }
  const ex = excluded.findIndex((e) => e.clauseKey === f.clauseKey);
  if (ex < 0) return;
  const [e] = excluded.splice(ex, 1);
  const no = Math.max(0, ...r.items.map((i) => i.no)) + 1;
  const item: DecompItem = {
    id: `R${String(no).padStart(4, '0')}`, no, category, title: titleOfClause(e.text), text: e.text, strength: f.strength, risks: [],
    fileId: e.fileId, fileName: e.fileName, fileRole: e.fileRole, section: e.section, page: e.page, ...owner,
    score: e.score, amended: e.amended, clauseKey: e.clauseKey, ruleCategory: e.ruleCategory, ruleStrength: e.ruleStrength, ...human,
  };
  r.items.push(item);
}

function refresh(r: TenderParseResult, excluded: ExcludedClause[]) {
  const { byCategory, risks, mandatory } = itemStats(r.items);
  r.stats = { ...r.stats, items: r.items.length, mandatory, byCategory, risks };
  if (r.judge) r.judge = { ...r.judge, excluded: excluded.length, needsReview: r.items.filter((i) => i.needsReview).length, unverified: r.items.filter((i) => i.source === 'rule').length };
  put('tender_runs', r.id, r);
  put('tender_excluded', r.id, excluded);
}

/** 重传后把这个投标已有的人工结论重新应用到新结果上；条款已不在新版里的就跳过。 */
export function applyFeedback(bidId: string, r: TenderParseResult, rules: TenderRuleSet): TenderParseResult {
  const all = feedbackForBid(bidId);
  if (!all.length) return r;
  const excluded = excludedOf(r.id);
  for (const f of all) applyOne(r, excluded, rules, f);
  refresh(r, excluded);
  return r;
}

export function reviewClause(by: string, bidId: string, r: TenderParseResult, rules: TenderRuleSet, key: string, body: ClauseReview): TenderParseResult {
  const excluded = excludedOf(r.id);
  const it = r.items.find((i) => i.clauseKey === key);
  const ex = excluded.find((e) => e.clauseKey === key);
  if (!it && !ex) throw new AppError('NOT_FOUND', '这条条款不在本次解析结果里', 404);
  if (body.isRequirement && !body.category) throw new AppError('INVALID_ARGUMENT', '属于要求的条款必须选类别', 400);
  // 同一条再次改判时保留最初的判断，自进化要对比的是机器原本怎么判
  const prior = get<TenderFeedback>('tender_feedback', feedbackId(bidId, key));
  const f: TenderFeedback = {
    ...body, bidId, clauseKey: key, text: (it || ex)!.text, fileName: (it || ex)!.fileName, section: (it || ex)!.section,
    before: prior?.before || (it ? { isRequirement: true, category: it.category, strength: it.strength, source: it.source } : { isRequirement: false, category: ex!.ruleCategory, strength: ex!.ruleStrength }),
    by, at: now(),
  };
  put('tender_feedback', feedbackId(bidId, key), f);
  applyOne(r, excluded, rules, f);
  refresh(r, excluded);
  return r;
}
