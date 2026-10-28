import { AppError } from '../../../../packages/contracts/index.ts';
import type { User } from '../../../../packages/contracts/index.ts';
import { BAFO_FIELDS, CHECKLIST_TEMPLATES, PIPELINE_LABEL, nodeDisplay, nodeName } from '../../../../packages/contracts/p9.ts';
import type { BidItem, BidMeeting, BidRound, BidTask, ChecklistItem, Clarification, P9Bid, QuoteVersion, BidDoc } from '../../../../packages/contracts/p9.ts';
import { aiDecompose, aiPlan, aiStrategyDirection, assistantReply, isTestMode, DEFAULT_CHAPTERS } from './ai.ts';
import { computeHealth, escalationFor, isOverdue, runChecks } from './checks.ts';
import { dateOnly, fmt, parseDate, validateReschedule } from './plan.ts';
import { tryAdvance } from './state-machine.ts';
import { allocateBidNumber, canViewQuote, childById, children, collections, loadBid, loadChild, newId, requireQuoteAccess, saveBid, saveChild, stamp } from './store.ts';
import { allowedRecord, canAccess } from '../crm.ts';
import { allRecords, record } from '../db.ts';

/** 业务时钟日期（db.now() 的日期部分，仓库约定；绝不硬编码 2026-10-24，演示时钟由 BUSINESS_CLOCK 控制）。 */
export const todayStr = () => dateOnly(stamp());
const addDays = (date: string, n: number) => fmt(new Date(parseDate(date).getTime() + n * 86400000));

/** ATB 检查字段（后端实测字段口径；原型 43 项为种子口径，不在此硬抄）。 */
const ATB_FIELDS: { key: string; label: string }[] = [
  { key: 'location', label: '项目地点' }, { key: 'supplyScope', label: '供货范围' },
  { key: 'deposit', label: '投标保证金' }, { key: 'tenderTarget', label: '招标对象' },
  { key: 'tenderForm', label: '招标形式' }, { key: 'customerRole', label: '客户角色' },
  { key: 'warrantyYears', label: '质保年限' }, { key: 'warrantyScope', label: '质保范围' },
  { key: 'paymentTerms', label: '付款节点' }, { key: 'currency', label: '报价币种' },
  { key: 'gridDate', label: '并网时间' }, { key: 'bidOpenAt', label: '开标时间' },
  { key: 'acdc', label: 'AC/DC' }, { key: 'productStandard', label: '产品标准响应要求' },
  { key: 'afterSalesYears', label: '售后服务年限' }, { key: 'afterSalesTraining', label: '售后培训需求' },
  { key: 'availability', label: '可利用率需求' }, { key: 'liability', label: '违约责任及比例' },
];
function atbFromOpp(opp: Record<string, unknown> | null) {
  const gaps = ATB_FIELDS.filter((f) => opp == null || opp[f.key] == null || opp[f.key] === '').map((f) => f.label);
  return { total: ATB_FIELDS.length, filled: ATB_FIELDS.length - gaps.length, gaps };
}
function childBase<T extends string>(bid: P9Bid, id: string, type: T, name: string) {
  return { id, type, bidId: bid.id, customerId: bid.customerId, entityType: 'bid', entityId: bid.id, name, createdAt: stamp(), updatedAt: stamp() };
}
function allDone(tasks: BidTask[]) {
  return tasks.length > 0 && tasks.every((t) => t.status === 'done' || t.status === 'cancelled');
}
function persistEscalations(bid: P9Bid, tasks: BidTask[]) {
  const today = todayStr();
  for (const t of tasks) {
    const level = escalationFor(t, today);
    if (level !== t.escalationLevel) saveChild({ ...t, escalationLevel: level, updatedAt: stamp() });
  }
}
function createGapTasks(bid: P9Bid, gaps: string[]): BidTask[] {
  // 按标题全局去重（已完成也不重建，避免“完成缺口→检查仍不过→重建同一缺口”循环增殖）
  const existing = new Set(children<BidTask>(bid.id, 'bid_task').map((t) => t.title));
  const out: BidTask[] = [];
  for (const gap of gaps) {
    const title = `缺口：${gap}`.slice(0, 200);
    if (existing.has(title)) continue;
    const task: BidTask = {
      ...childBase(bid, newId('BT'), 'bid_task', title), title, bidItemId: null, node: bid.currentNode,
      assigneeId: null, assigneeRole: '', dueAt: dateOnly(bid.deadlineAt), priority: 'P0', status: 'todo',
      source: 'ai-check-gap', comments: [], result: null, completedAt: null, escalationLevel: null,
    };
    saveChild(task); out.push(task);
  }
  return out;
}
/** 单步条件推进（澄清并行节点为直通，不阻塞；门禁不通过则保持原节点）。 */
function nudge(bid: P9Bid): P9Bid {
  const r = tryAdvance(bid);
  return r.advanced ? saveBid(r.bid) : bid;
}

// ---- 列表 / 详情 -------------------------------------------------------------
export function listBids(user: User, q: Record<string, string>) {
  let rows = (allRecords('bid') as P9Bid[]).filter((b) => canAccess(user, b.customerId));
  if (q.status) rows = rows.filter((b) => b.status === q.status);
  if (q.node !== undefined && q.node !== '') rows = rows.filter((b) => String(b.currentNode) === q.node);
  if (q.ownerId) rows = rows.filter((b) => b.ownerId === q.ownerId);
  if (q.q) {
    const k = q.q.toLowerCase();
    rows = rows.filter((b) => [b.number, b.customerName, b.projectName, b.name].some((s) => (s || '').toLowerCase().includes(k)));
  }
  rows.sort((a, b) => (a.deadlineAt < b.deadlineAt ? -1 : 1));
  const limit = Math.min(50, Math.max(1, Number(q.limit) || 20));
  const cursor = Math.max(0, Number(q.cursor) || 0);
  return { records: rows.slice(cursor, cursor + limit), total: rows.length, nextCursor: cursor + limit < rows.length ? cursor + limit : null };
}
export function bidDetail(user: User, id: string) {
  const bid = loadBid(user, id);
  const c = collections(id);
  const today = todayStr();
  const health = computeHealth(c.tasks, c.clarifications, c.checklist, today);
  const overdue = c.tasks.filter((t) => isOverdue(t, today));
  return {
    bid, rounds: c.rounds.sort((a, b) => a.roundNo - b.roundNo),
    health, blockers: health.blockers, overdueTasks: overdue,
    counts: {
      items: c.items.length, tasks: c.tasks.length, openTasks: c.tasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled').length,
      clarifications: c.clarifications.length, unclosedClarifications: c.clarifications.filter((x) => x.status !== 'closed').length,
      checklist: c.checklist.length, checklistDone: c.checklist.filter((x) => x.status === 'done').length,
      meetings: c.meetings.length, docs: c.docs.length,
    },
    node: { current: bid.currentNode, name: nodeName(bid.currentNode), display: nodeDisplay(bid.currentNode) },
  };
}

// ---- 创建（自动启动 AI 协管：创建后即排计划；失败不阻断创建）-------------------
export async function createBid(user: User, body: Record<string, unknown>) {
  let opp: Record<string, unknown> | null = null;
  let customerId = String(body.customerId || '');
  let customerName = String(body.customerName || '');
  let projectName = String(body.projectName || '');
  if (body.opportunityId) {
    opp = allowedRecord(user, String(body.opportunityId), 'opportunity') as unknown as Record<string, unknown>;
    customerId = String(opp.customerId);
    const customer = record(customerId) as Record<string, unknown> | undefined;
    customerName = String(customer?.name || '');
    projectName = String(opp.name || projectName || '');
  } else {
    if (!customerId) throw new AppError('INVALID_ARGUMENT', '须提供 opportunityId 或 customerId', 400);
    const customer = allowedRecord(user, customerId, 'customer') as unknown as Record<string, unknown>;
    customerName = String(customer?.name || customerName || '');
    if (!projectName) projectName = '未命名项目';
  }
  const deadlineAt = String(body.deadlineAt || `${addDays(todayStr(), 20)}T14:00:00+08:00`);
  const number = allocateBidNumber();
  let bid: P9Bid = {
    id: newId('BID'), type: 'bid', number, customerId,
    opportunityId: body.opportunityId ? String(body.opportunityId) : null,
    customerName, projectName, name: `${customerName} · ${projectName}`,
    status: 'in_progress', currentNode: 0, ownerId: String(body.ownerId || user.id),
    sppTeam: String(body.sppTeam || ''), pricingTeam: (body.pricingTeam as string[]) || [],
    deadlineAt, createdAt: stamp(), updatedAt: stamp(), atb: atbFromOpp(opp),
    strategy: { scope: '', customer: '', competition: '', status: 'draft', updatedAt: stamp() },
    strategyHistory: [], aiPipeline: 'idle', aiDraft: null, aiLastError: null,
    reviewStatus: 'none', submission: null, award: null, groupUrl: null,
    customerRequirements: ((body.customerRequirements as { requirement: string; status?: string }[]) || []).map((r, i) => ({
      id: `REQ-${i + 1}`, requirement: r.requirement, status: (r.status as 'met' | 'deviation' | 'pending') || 'pending',
    })),
    approvalNo: null, approvalStatus: null,
  };
  bid = saveBid(bid); // 与 allocate 同步相邻，无 await 间隙
  for (const t of CHECKLIST_TEMPLATES) {
    saveChild({ ...childBase(bid, newId('CI'), 'checklist_item', t.title), templateId: t.id, title: t.title, category: t.category, required: t.required, status: 'pending', evidence: '' } as ChecklistItem);
  }
  saveChild({ ...childBase(bid, newId('BR'), 'bid_round', 'R1'), roundNo: 1, label: 'R1', status: 'current', summary: '首轮' } as BidRound);
  // R1 初始报价版本（原型口径：质保 5 年 / 付款 3-4-3 / 备件不含 / 整机质保；仅商业条款，不含金额）
  saveChild({ ...childBase(bid, newId('QV'), 'quote_version', '报价单 v1'), roundNo: 1, version: 'v1',
    fields: { warrantyYears: '5 年', warrantyScope: '整机质保', paymentTerms: '3-4-3', spareParts: '不含备件', deliveryTerms: '', validity: '' }, status: 'confirmed' } as QuoteVersion);
  // 商机缺口转待澄清（不阻断发起，见原型 §5.7）
  for (const gap of bid.atb.gaps) {
    saveChild({ ...childBase(bid, newId('CL'), 'clarification', gap), phase: 'pre-bid', clarType: 'business', question: `ATB 缺口待补：${gap}`, answer: '', ownerId: null, dueAt: null, status: 'open', incorporated: false, source: 'atb-gap' } as Clarification);
  }
  // 自动启动：投标创建后 AI 即排计划（§8 触发点 1）；先落库 planning 再调 AI
  bid = saveBid({ ...bid, aiPipeline: 'planning' });
  try {
    const draft = await aiPlan(bid);
    bid = saveBid({ ...bid, aiDraft: draft, aiPipeline: 'plan_draft', aiLastError: null });
  } catch (e) {
    bid = saveBid({ ...bid, aiPipeline: 'planning', aiLastError: e instanceof Error ? e.message : String(e) });
  }
  return bid;
}

// ---- 策略 --------------------------------------------------------------------
export function getStrategy(user: User, id: string) {
  const bid = loadBid(user, id);
  return { strategy: bid.strategy, history: bid.strategyHistory, pendingVersion: bid.strategyHistory.find((v) => v.status === 'draft') || null, currentRound: currentRoundLabel(id) };
}
export function putStrategy(user: User, id: string, body: Record<string, unknown>) {
  let bid = loadBid(user, id);
  if (typeof body.confirmVersion === 'number' && !bid.strategyHistory.some((x) => x.version === body.confirmVersion && x.status === 'draft')) {
    throw new AppError('NOT_FOUND', '待确认的策略版本不存在', 404);
  }
  const s = { ...bid.strategy };
  if (body.scope !== undefined) s.scope = String(body.scope);
  if (body.customer !== undefined) s.customer = String(body.customer);
  if (body.competition !== undefined) s.competition = String(body.competition);
  if (body.status !== undefined) s.status = body.status as P9Bid['strategy']['status'];
  s.updatedAt = stamp();
  bid = { ...bid, strategy: s };
  if (typeof body.confirmVersion === 'number') {
    const v = bid.strategyHistory.find((x) => x.version === body.confirmVersion && x.status === 'draft');
    if (!v) throw new AppError('NOT_FOUND', '待确认的策略版本不存在', 404);
    v.status = 'confirmed';
    bid.strategy = { ...bid.strategy, aiDirection: v.direction, status: 'saved', updatedAt: stamp() };
  }
  bid = saveBid(bid);
  // 节点推进：开始填策略即完成商机判断（0→1）；归档即完成策略（1→2，门禁三段填满）
  if (bid.currentNode === 0) bid = nudge(bid);
  if (bid.strategy.status === 'archived' && bid.currentNode === 1) bid = nudge(bid);
  return getStrategy(user, id);
}
export async function regenerateStrategy(user: User, id: string, body: Record<string, unknown>) {
  let bid = loadBid(user, id);
  if (body.scope !== undefined || body.customer !== undefined || body.competition !== undefined) {
    bid = saveBid({ ...bid, strategy: { ...bid.strategy,
      ...(body.scope !== undefined ? { scope: String(body.scope) } : {}),
      ...(body.customer !== undefined ? { customer: String(body.customer) } : {}),
      ...(body.competition !== undefined ? { competition: String(body.competition) } : {}),
      updatedAt: stamp() } });
  }
  const { direction, source } = await aiStrategyDirection(bid, String(body.trigger || '执行中再评估'));
  const version = bid.strategyHistory.length + 1;
  const entry = {
    version, direction, changes: `触发：${String(body.trigger || '执行中再评估')}；新版方向待用户确认后生效。`,
    trigger: String(body.trigger || '执行中再评估'), bafoRound: currentRoundLabel(id),
    status: 'draft' as const, createdAt: stamp(), createdBy: user.id,
  };
  bid = saveBid({ ...bid, strategyHistory: [...bid.strategyHistory, entry] });
  return { version: entry, source, note: '策略版本为草稿，须经 PUT strategy 确认（confirmVersion）后闭环生效' };
}
function currentRoundLabel(bidId: string): string {
  const rounds = children<BidRound>(bidId, 'bid_round').sort((a, b) => b.roundNo - a.roundNo);
  return rounds[0]?.label || 'R1';
}

// ---- 计划 / 甘特 ---------------------------------------------------------------
export function getPlan(user: User, id: string) {
  const bid = loadBid(user, id);
  const c = collections(id);
  const gantt = [
    ...(bid.aiDraft?.items || []).map((it) => ({ kind: 'draft', ...it })),
    ...c.items.map((it) => ({ kind: 'item', id: it.id, title: it.title, node: it.node, assigneeRole: it.assigneeRole, assigneeId: it.assigneeId, start: it.start, end: it.end, status: it.status })),
  ];
  const today = todayStr();
  const workingLeft = workingDaysBetween(today, dateOnly(bid.deadlineAt));
  return { bidId: id, deadlineAt: bid.deadlineAt, draft: bid.aiDraft, items: c.items, gantt, remainingWorkingDays: workingLeft, pipeline: bid.aiPipeline };
}
function workingDaysBetween(from: string, to: string): number {
  if (to < from) return 0;
  let n = 0; let d = parseDate(from);
  const end = parseDate(to);
  while (d <= end) { const day = d.getDay(); if (day !== 0 && day !== 6) n++; d = new Date(d.getTime() + 86400000); }
  return n;
}
export function addPlanItem(user: User, id: string, body: Record<string, unknown>) {
  const bid = loadBid(user, id);
  const today = todayStr();
  const item: BidItem = {
    ...childBase(bid, newId('BI'), 'bid_item', String(body.title)), title: String(body.title),
    category: String(body.category || '技术'), sourceClause: String(body.sourceClause || ''),
    node: (body.node as BidItem['node']) ?? bid.currentNode,
    assigneeId: (body.assigneeId as string | null) ?? null, assigneeRole: String(body.assigneeRole || ''),
    start: String(body.start || today), end: String(body.end || dateOnly(bid.deadlineAt)),
    status: 'pending', deliverable: String(body.deliverable || ''),
    dependsOn: (body.dependsOn as string[]) || [],
  };
  saveChild(item);
  return item;
}
export function reschedulePlanItem(user: User, bidId: string, itemId: string, body: { start: string; end: string }) {
  const bid = loadBid(user, bidId);
  const item = loadChild<BidItem>(user, bid, itemId, 'bid_item');
  const all = children<BidItem>(bidId, 'bid_item');
  const deps = all.filter((x) => (item.dependsOn as string[] || []).includes(x.id));
  const v = validateReschedule(item, body, bid.deadlineAt, deps, bid.currentNode);
  if (!v.ok) throw new AppError('CONFLICT', v.reason, 409);
  const next = saveChild({ ...item, start: body.start, end: body.end, updatedAt: stamp() });
  // 联动回写：已派发任务的截止同步改期（已完成任务不回写）
  const task = children<BidTask>(bidId, 'bid_task').find((t) => t.bidItemId === item.id && t.status !== 'done' && t.status !== 'cancelled');
  if (task) saveChild({ ...task, dueAt: body.end, updatedAt: stamp() });
  return next;
}
export function reopenPlanItem(user: User, bidId: string, itemId: string) {
  const bid = loadBid(user, bidId);
  const item = loadChild<BidItem>(user, bid, itemId, 'bid_item');
  const next = saveChild({ ...item, status: 'pending', updatedAt: stamp() });
  const task = children<BidTask>(bidId, 'bid_task').find((t) => t.bidItemId === item.id && (t.status === 'done' || t.status === 'cancelled'));
  if (task) reopenTaskRecord(bid, task, user);
  return next;
}
function reopenTaskRecord(bid: P9Bid, task: BidTask, user: User): BidTask {
  return saveChild({ ...task, status: 'todo', completedAt: null, updatedAt: stamp(),
    comments: [...task.comments, { id: newId('CM'), author: '系统', text: `由 ${user.name} 重新打开`, at: stamp() }] });
}

// ---- 文档 / 会议 / 文件 ---------------------------------------------------------
export function listDocs(user: User, id: string) {
  const bid = loadBid(user, id);
  return children<BidDoc>(id, 'bid_doc');
}
export function addDoc(user: User, id: string, body: Record<string, unknown>) {
  const bid = loadBid(user, id);
  const doc: BidDoc = {
    ...childBase(bid, newId('DOC'), 'bid_doc', String(body.filename)), filename: String(body.filename),
    category: String(body.category || '招标文件原件'), version: String(body.version || 'v1'),
    size: String(body.size || ''), uploader: user.id, status: 'uploaded',
    chapters: (body.chapters as BidDoc['chapters']) || [], parseStatus: 'pending', parseError: null,
  };
  saveChild(doc);
  return doc;
}
async function decomposeIntoBid(bid: P9Bid, chapters: BidDoc['chapters']): Promise<{ items: BidItem[]; source: string }> {
  const { items, source } = await aiDecompose(bid, chapters);
  const existing = new Set(children<BidItem>(bid.id, 'bid_item').map((x) => `${x.title}|${x.sourceClause}`));
  const out: BidItem[] = [];
  const today = todayStr();
  for (const it of items) {
    if (existing.has(`${it.title}|${it.sourceClause}`)) continue;
    const rec: BidItem = {
      ...childBase(bid, newId('BI'), 'bid_item', it.title), title: it.title, category: it.category,
      sourceClause: it.sourceClause, node: it.node as BidItem['node'], assigneeId: null, assigneeRole: it.role,
      start: today, end: dateOnly(bid.deadlineAt), status: 'pending', deliverable: '', dependsOn: [],
    };
    saveChild(rec); out.push(rec);
  }
  return { items: out, source };
}
export async function parseDoc(user: User, bidId: string, docId: string) {
  const bid = loadBid(user, bidId);
  const doc = loadChild<BidDoc>(user, bid, docId, 'bid_doc');
  let chapters = doc.chapters;
  if (!chapters.length) {
    if (!isTestMode()) throw new AppError('CONFLICT', '该文档无章节内容可解析（后端仅存元数据，文件内容解析由数据组/前端传入章节后重试）', 409);
    chapters = DEFAULT_CHAPTERS;
  }
  saveChild({ ...doc, parseStatus: 'parsing', updatedAt: stamp() });
  try {
    const { items, source } = await decomposeIntoBid(bid, chapters);
    const parsed = saveChild({ ...doc, chapters, parseStatus: 'parsed', status: 'parsed', parseError: null, updatedAt: stamp() });
    // 解析完成即自动启动拆标书（§8 触发点 1）：未下发前流水线进入 decomposing（草稿已更新，待一次确认）
    let next = loadBid(user, bidId);
    if (['idle', 'planning', 'plan_draft', 'decomposing'].includes(next.aiPipeline)) {
      next = saveBid({ ...next, aiPipeline: 'decomposing', aiLastError: null });
    } else if (['dispatched', 'executing'].includes(next.aiPipeline)) {
      // 已下发后新增拆解项直接成任务，不卡死已执行流程
      for (const it of items) {
        saveChild({ ...childBase(next, newId('BT'), 'bid_task', it.title), title: it.title, bidItemId: it.id, node: it.node, assigneeId: null, assigneeRole: it.assigneeRole, dueAt: it.end, priority: 'P1', status: 'todo', source: 'decompose-after-dispatch', comments: [], result: null, completedAt: null, escalationLevel: null } as BidTask);
      }
    }
    return { doc: parsed, decomposed: items, source, pipeline: next.aiPipeline };
  } catch (e) {
    saveChild({ ...doc, parseStatus: 'failed', parseError: e instanceof Error ? e.message : String(e), updatedAt: stamp() });
    throw e;
  }
}
export function listMeetings(user: User, id: string) {
  loadBid(user, id);
  return children<BidMeeting>(id, 'bid_meeting');
}
export function addMeeting(user: User, id: string, body: Record<string, unknown>) {
  let bid = loadBid(user, id);
  const m: BidMeeting = {
    ...childBase(bid, newId('MT'), 'bid_meeting', String(body.title)), title: String(body.title),
    meetingType: String(body.meetingType || '内部会'), startsAt: String(body.startsAt),
    endsAt: body.endsAt ? String(body.endsAt) : null, participants: (body.participants as string[]) || [],
    organizer: user.id, status: 'scheduled', minutes: String(body.minutes || ''), recording: String(body.recording || ''),
  };
  saveChild(m);
  if (bid.currentNode === 3) bid = nudge(bid); // 开工会召开 → 进入澄清跟进（并行节点直通）
  return m;
}

// ---- 待办 ----------------------------------------------------------------------
export function listTodos(user: User, id: string, q: Record<string, string>) {
  loadBid(user, id);
  let rows = children<BidTask>(id, 'bid_task');
  if (q.assignee === 'me') rows = rows.filter((t) => t.assigneeId === user.id);
  if (q.status) rows = rows.filter((t) => t.status === q.status);
  if (q.overdue === 'true') { const today = todayStr(); rows = rows.filter((t) => isOverdue(t, today)); }
  rows.sort((a, b) => (a.dueAt < b.dueAt ? -1 : 1));
  return rows;
}
export function addTodo(user: User, id: string, body: Record<string, unknown>) {
  let bid = loadBid(user, id);
  const task: BidTask = {
    ...childBase(bid, newId('BT'), 'bid_task', String(body.title)), title: String(body.title),
    bidItemId: null, node: (body.node as BidTask['node']) ?? bid.currentNode,
    assigneeId: (body.assigneeId as string | null) ?? null, assigneeRole: String(body.assigneeRole || ''),
    dueAt: String(body.dueAt || dateOnly(bid.deadlineAt)), priority: (body.priority as BidTask['priority']) || 'P1',
    status: 'todo', source: String(body.source || 'manual'), comments: [], result: null, completedAt: null, escalationLevel: null,
  };
  saveChild(task);
  if (bid.aiPipeline === 'dispatched') saveBid({ ...bid, aiPipeline: 'executing' });
  return task;
}
export function completeTodo(user: User, bidId: string, taskId: string, body: { outcome: string; note: string }) {
  let bid = loadBid(user, bidId);
  const task = loadChild<BidTask>(user, bid, taskId, 'bid_task');
  const statusMap: Record<string, BidTask['status']> = { completed: 'done', partial: 'partial', cancelled: 'cancelled', delayed: 'delayed' };
  const status = statusMap[body.outcome] || 'done';
  const next = saveChild({ ...task, status, completedAt: status === 'done' ? stamp() : null, updatedAt: stamp(),
    result: { outcome: body.outcome, note: body.note, at: stamp(), by: user.id },
    comments: [...task.comments, { id: newId('CM'), author: user.name, text: body.note, at: stamp() }] });
  // 完成即检查（§8 链路 6）：全部任务完成时自动跑四源体检
  let autoCheck: ReturnType<typeof runChecks> | null = null;
  let gapTasks: BidTask[] = [];
  const tasks = children<BidTask>(bidId, 'bid_task');
  if (bid.aiPipeline === 'dispatched') bid = saveBid({ ...bid, aiPipeline: 'executing' });
  if (allDone(tasks) && (bid.aiPipeline === 'executing' || bid.aiPipeline === 'dispatched')) {
    const c = collections(bidId);
    persistEscalations(bid, c.tasks);
    autoCheck = runChecks(c.tasks, c.clarifications, c.checklist, bid.customerRequirements, todayStr());
    if (autoCheck.passed) {
      bid = saveBid({ ...bid, aiPipeline: 'review', reviewStatus: 'pending' });
    } else {
      gapTasks = createGapTasks(bid, autoCheck.gaps);
      bid = saveBid({ ...bid, aiPipeline: 'executing' });
    }
  }
  if (bid.currentNode === 4 || bid.currentNode === 7) bid = nudge(bid);
  return { task: next, autoCheck, gapTasks, pipeline: bid.aiPipeline };
}
export function commentTodo(user: User, bidId: string, taskId: string, text: string) {
  const bid = loadBid(user, bidId);
  const task = loadChild<BidTask>(user, bid, taskId, 'bid_task');
  return saveChild({ ...task, comments: [...task.comments, { id: newId('CM'), author: user.name, text, at: stamp() }], updatedAt: stamp() });
}
export function reopenTodo(user: User, bidId: string, taskId: string) {
  const bid = loadBid(user, bidId);
  const task = loadChild<BidTask>(user, bid, taskId, 'bid_task');
  if (task.status === 'todo' || task.status === 'in_progress') throw new AppError('CONFLICT', '该待办尚未完成，无需重新打开', 409);
  return reopenTaskRecord(bid, task, user);
}

// ---- 澄清（两态过滤：未闭环 / 已进标书）-------------------------------------------
export function listClarifications(user: User, id: string, q: Record<string, string>) {
  loadBid(user, id);
  let rows = children<Clarification>(id, 'clarification');
  if (q.filter === 'unclosed') rows = rows.filter((c) => c.status !== 'closed');
  else if (q.filter === 'in-bid') rows = rows.filter((c) => c.incorporated);
  else if (q.status) rows = rows.filter((c) => c.status === q.status);
  rows.sort((a, b) => (a.dueAt || '9999') < (b.dueAt || '9999') ? -1 : 1);
  return rows;
}
export function addClarification(user: User, id: string, body: Record<string, unknown>) {
  const bid = loadBid(user, id);
  const c: Clarification = {
    ...childBase(bid, newId('CL'), 'clarification', String(body.question).slice(0, 200)), phase: (body.phase as Clarification['phase']) || 'pre-bid',
    clarType: (body.clarType as Clarification['clarType']) || 'technical', question: String(body.question),
    answer: String(body.answer || ''), ownerId: (body.ownerId as string | null) ?? null,
    dueAt: (body.dueAt as string | null) ?? null, status: body.answer ? 'answered' : 'open',
    incorporated: body.incorporated === true, source: String(body.source || 'manual'),
  };
  saveChild(c);
  return c;
}
/** 契约外补充（见汇报）：澄清状态流转（答复/关闭/进标书/重开）——§3 只列 GET/POST，无状态变更口。 */
export function updateClarification(user: User, bidId: string, clarId: string, body: Record<string, unknown>) {
  let bid = loadBid(user, bidId);
  const c = loadChild<Clarification>(user, bid, clarId, 'clarification');
  const next = saveChild({ ...c,
    ...(body.status !== undefined ? { status: body.status as Clarification['status'] } : {}),
    ...(body.incorporated !== undefined ? { incorporated: body.incorporated === true } : {}),
    ...(body.answer !== undefined ? { answer: String(body.answer) } : {}),
    updatedAt: stamp() });
  if (next.status === 'closed' && (bid.currentNode === 4 || bid.currentNode === 7)) bid = nudge(bid);
  return next;
}

/** 契约外补充（见汇报）：checklist 实例完成口——§3 只列 GET checks，无实例完成口，检查无法闭环。 */
export function completeChecklistItem(user: User, bidId: string, itemId: string, evidence?: string) {
  const bid = loadBid(user, bidId);
  const item = loadChild<ChecklistItem>(user, bid, itemId, 'checklist_item');
  return saveChild({ ...item, status: 'done', evidence: evidence || item.evidence || '', updatedAt: stamp() });
}

// ---- 检查 / 复查 / 交标 -----------------------------------------------------------
export function getChecks(user: User, id: string) {
  const bid = loadBid(user, id);
  const c = collections(id);
  return { bidId: id, pipeline: bid.aiPipeline, reviewStatus: bid.reviewStatus, report: runChecks(c.tasks, c.clarifications, c.checklist, bid.customerRequirements, todayStr()) };
}
export function submitReview(user: User, id: string, body: { decision: string; reviewer?: string; notes?: string }) {
  let bid = loadBid(user, id);
  const c = collections(id);
  const report = runChecks(c.tasks, c.clarifications, c.checklist, bid.customerRequirements, todayStr());
  if (body.decision === 'approved' && !report.passed) {
    throw new AppError('CONFLICT', `人工复查门禁未通过：${report.gaps.join('；')}`, 409);
  }
  if (body.decision === 'approved') {
    bid = saveBid({ ...bid, reviewStatus: 'approved', aiPipeline: 'review' });
    if (bid.currentNode === 5) bid = nudge(bid); // 复查批准 → 进入交标节点
  } else {
    bid = saveBid({ ...bid, reviewStatus: 'rejected', aiPipeline: 'executing' });
  }
  return { bid, report, reviewer: body.reviewer || user.name, notes: body.notes || '' };
}
export function submitBid(user: User, id: string, body: Record<string, unknown>) {
  let bid = loadBid(user, id);
  if (bid.reviewStatus !== 'approved') throw new AppError('CONFLICT', '交标前须先通过人工复查（POST submit-review 批准）', 409);
  for (const f of ['submittedAt']) if (!body[f]) throw new AppError('INVALID_ARGUMENT', `交标记录缺少 ${f}`, 400);
  bid = saveBid({ ...bid,
    submission: { submittedAt: String(body.submittedAt), deposit: String(body.deposit || ''), method: String(body.method || ''), copies: String(body.copies || ''), credential: String(body.credential || '') },
    status: 'submitted', aiPipeline: 'submitted' });
  // 节点链：5→6（复查已批准）→7（交标记录齐备），门禁不通过则停在原节点
  while (bid.currentNode < 7) { const r = tryAdvance(bid); if (!r.advanced) break; bid = r.bid; }
  bid = saveBid(bid);
  return bid;
}

// ---- BAFO（只做差异呈现，不做优劣判断、不评分、不排序、不给价格建议）----------------
export function diffQuoteVersions(prev: QuoteVersion | undefined, curr: QuoteVersion | undefined) {
  if (!prev || !curr) return [];
  return BAFO_FIELDS.filter((f) => (prev.fields[f.key] || '') !== (curr.fields[f.key] || '')).map((f) => ({
    field: f.key, label: f.label, oldValue: prev.fields[f.key] || '', newValue: curr.fields[f.key] || '',
    status: curr.status === 'confirmed' ? 'confirmed' : 'pending',
  }));
}
export function getBafo(user: User, id: string) {
  const bid = loadBid(user, id);
  const c = collections(id);
  const rounds = c.rounds.sort((a, b) => a.roundNo - b.roundNo);
  const latestQuote = (roundNo: number) => {
    const qs = c.quotes.filter((x) => x.roundNo === roundNo).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return qs[0];
  };
  const diffs: Record<string, ReturnType<typeof diffQuoteVersions>> = {};
  for (let i = 1; i < rounds.length; i++) diffs[`${rounds[i - 1].label}→${rounds[i].label}`] = diffQuoteVersions(latestQuote(rounds[i - 1].roundNo), latestQuote(rounds[i].roundNo));
  const last = rounds[rounds.length - 1];
  const lastQuote = last ? latestQuote(last.roundNo) : undefined;
  return {
    bidId: id, currentRound: currentRoundLabel(id), rounds,
    versions: rounds.map((r) => ({ round: r.label, quote: latestQuote(r.roundNo) || null })),
    diffs, finalDefinition: lastQuote ? `最终版 = 最新技术方案 + 报价单 ${lastQuote.version}（${last?.label}，严格权限）` : '暂无报价版本',
  };
}
export function createBafoRound(user: User, id: string, body: Record<string, unknown>) {
  let bid = loadBid(user, id);
  const rounds = children<BidRound>(id, 'bid_round').sort((a, b) => b.roundNo - a.roundNo);
  const nextNo = (rounds[0]?.roundNo || 0) + 1;
  const prevQuotes = children<QuoteVersion>(id, 'quote_version').filter((x) => x.roundNo === (rounds[0]?.roundNo || 0)).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const prev = prevQuotes[0];
  const round: BidRound = { ...childBase(bid, newId('BR'), 'bid_round', `R${nextNo}`), roundNo: nextNo, label: `R${nextNo}`, status: 'pending', summary: String(body.summary || '') };
  saveChild(round);
  const quote: QuoteVersion = {
    ...childBase(bid, newId('QV'), 'quote_version', `报价单 v${nextNo}`), roundNo: nextNo, version: `v${nextNo}`,
    fields: { ...(prev?.fields || {}), ...((body.fields as Record<string, string>) || {}) }, status: 'pending',
  };
  saveChild(quote);
  bid = saveBid({ ...bid });
  if (bid.currentNode === 7) bid = nudge(bid); // 进入 BAFO 节点
  return { round, quoteVersion: quote, diffsVsPrevious: diffQuoteVersions(prev, quote) };
}
export function listQuoteVersions(user: User, id: string) {
  const bid = loadBid(user, id);
  requireQuoteAccess(user, bid);
  return children<QuoteVersion>(id, 'quote_version').sort((a, b) => a.roundNo - b.roundNo);
}
export function quoteVisibility(user: User, id: string) {
  const bid = loadBid(user, id);
  return { visible: canViewQuote(user, bid), placeholder: canViewQuote(user, bid) ? null : '已报价（金额不可见，须 admin 或 pricingTeam 成员查看）' };
}

// ---- 定标 / 建群 / 助理 --------------------------------------------------------------
export function closeBid(user: User, id: string, body: { result: 'won' | 'lost'; reason?: string; lessons?: string[] }) {
  let bid = loadBid(user, id);
  bid = saveBid({ ...bid,
    award: { result: body.result, reason: body.reason || '', lessons: body.lessons || [], closedAt: stamp() },
    status: body.result === 'won' ? 'awarded' : 'lost' });
  while (bid.currentNode < 9) { const r = tryAdvance(bid); if (!r.advanced) break; bid = r.bid; }
  bid = saveBid(bid);
  return bid;
}
export function createGroup(user: User, id: string) {
  let bid = loadBid(user, id);
  if (bid.groupUrl) return { groupUrl: bid.groupUrl, members: groupMembers(id), existing: true };
  const groupUrl = `https://group.placeholder.sales-buddy/bid/${bid.number}`;
  bid = saveBid({ ...bid, groupUrl });
  return { groupUrl, members: groupMembers(id), existing: false };
}
function groupMembers(bidId: string): string[] {
  const bid = childById<P9Bid>(bidId, 'bid');
  const tasks = children<BidTask>(bidId, 'bid_task');
  const set = new Set<string>();
  if (bid?.ownerId) set.add(bid.ownerId);
  for (const p of bid?.pricingTeam || []) set.add(p);
  for (const t of tasks) if (t.assigneeId) set.add(t.assigneeId);
  return [...set];
}
export async function assistantChat(user: User, id: string, question: string) {
  const bid = loadBid(user, id);
  const c = collections(id);
  const today = todayStr();
  const open = c.tasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled');
  const health = computeHealth(c.tasks, c.clarifications, c.checklist, today);
  const r = await assistantReply(bid, question, {
    openTasks: open.length, overdue: c.tasks.filter((t) => isOverdue(t, today)).length,
    unclosedClars: c.clarifications.filter((x) => x.status !== 'closed').length, health: health.score,
  });
  return { bidId: id, ...r, footer: 'AI 会引用本标数据回答 · 结论仅供内部参考' };
}

// ---- AI 协管主链路（§8）----------------------------------------------------------------
export async function aiPlanRoute(user: User, id: string) {
  let bid = loadBid(user, id);
  bid = saveBid({ ...bid, aiPipeline: 'planning', aiLastError: null });
  try {
    const draft = await aiPlan(bid);
    bid = saveBid({ ...bid, aiDraft: draft, aiPipeline: 'plan_draft', aiLastError: null });
    return { pipeline: bid.aiPipeline, draft, source: draft.source };
  } catch (e) {
    bid = saveBid({ ...bid, aiPipeline: 'planning', aiLastError: e instanceof Error ? e.message : String(e) });
    throw e;
  }
}
export async function aiDecomposeRoute(user: User, id: string, documentId?: string) {
  const bid = loadBid(user, id);
  const docs = children<BidDoc>(id, 'bid_doc');
  const doc = documentId ? docs.find((d) => d.id === documentId) : docs[docs.length - 1];
  if (!doc) throw new AppError('CONFLICT', '尚无招标文件可拆解，须先上传文档', 409);
  const { items, source } = await decomposeIntoBid(bid, doc.chapters.length ? doc.chapters : DEFAULT_CHAPTERS);
  let next = loadBid(user, id);
  if (['idle', 'planning', 'plan_draft', 'decomposing'].includes(next.aiPipeline)) {
    next = saveBid({ ...next, aiPipeline: 'decomposing', aiLastError: null });
  } else if (['dispatched', 'executing'].includes(next.aiPipeline)) {
    for (const it of items) {
      saveChild({ ...childBase(next, newId('BT'), 'bid_task', it.title), title: it.title, bidItemId: it.id, node: it.node, assigneeId: null, assigneeRole: it.assigneeRole, dueAt: it.end, priority: 'P1', status: 'todo', source: 'decompose-after-dispatch', comments: [], result: null, completedAt: null, escalationLevel: null } as BidTask);
    }
  }
  return { pipeline: next.aiPipeline, decomposed: items, source, note: '拆解已更新计划；下发前须用户一次确认（POST ai/dispatch）' };
}
/** 确认即下发（唯一必需人工动作）：草稿落库 → 生成任务/待办 → 按 RACI 分派提醒。 */
export function aiDispatch(user: User, id: string) {
  let bid = loadBid(user, id);
  if (!bid.aiDraft || !['plan_draft', 'decomposing', 'planning'].includes(bid.aiPipeline)) {
    throw new AppError('CONFLICT', '尚无可下发的 AI 计划草稿，须先生成计划（POST ai/plan）', 409);
  }
  const draft = bid.aiDraft;
  const existingItems = children<BidItem>(id, 'bid_item');
  const byTitle = new Map(existingItems.map((x) => [x.title, x]));
  const tasks: BidTask[] = [];
  const mkTask = (title: string, bidItemId: string | null, node: number, assigneeId: string | null, role: string, dueAt: string): BidTask => {
    const t: BidTask = { ...childBase(bid, newId('BT'), 'bid_task', title), title, bidItemId, node: node as BidTask['node'], assigneeId, assigneeRole: role, dueAt, priority: 'P1', status: 'todo', source: 'ai-dispatch', comments: [], result: null, completedAt: null, escalationLevel: null };
    saveChild(t); tasks.push(t); return t;
  };
  for (const it of draft.items) {
    let item = byTitle.get(it.title);
    if (!item) {
      item = { ...childBase(bid, newId('BI'), 'bid_item', it.title), title: it.title, category: '计划', sourceClause: '', node: it.node, assigneeId: it.assigneeId, assigneeRole: it.assigneeRole, start: it.start, end: it.end, status: 'dispatched', deliverable: '', dependsOn: it.dependsOn };
      saveChild(item);
    } else {
      saveChild({ ...item, status: 'dispatched', start: it.start, end: it.end, assigneeId: item.assigneeId ?? it.assigneeId, updatedAt: stamp() });
    }
    mkTask(it.title, item.id, it.node, it.assigneeId, it.assigneeRole, it.end);
  }
  for (const it of existingItems) {
    const hasTask = children<BidTask>(id, 'bid_task').some((t) => t.bidItemId === it.id);
    if (!hasTask) mkTask(it.title, it.id, it.node, it.assigneeId, it.assigneeRole, it.end);
  }
  bid = saveBid({ ...bid, aiPipeline: 'dispatched' });
  if (bid.currentNode === 2) bid = nudge(bid); // 下发 → 进入开工会节点
  const reminders = tasks.filter((t) => t.assigneeId).map((t) => ({ taskId: t.id, assigneeId: t.assigneeId, kind: 'assigned', message: `已分派：${t.title}，截止 ${t.dueAt}` }));
  return { pipeline: bid.aiPipeline, tasksCreated: tasks.length, reminders, note: '已按 RACI 分派；到期前与逾期提醒由检查/状态计算给出（L2/L3、逾期超 72h 自动进 BPM）' };
}
export function aiStatus(user: User, id: string) {
  const bid = loadBid(user, id);
  const c = collections(id);
  const today = todayStr();
  const open = c.tasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled');
  const nextAction: Record<string, string> = {
    idle: '等待 AI 启动排计划', planning: 'AI 正在排计划', plan_draft: '确认并下发 AI 计划草稿',
    decomposing: '确认并下发 AI 计划草稿（已含拆解更新）', dispatched: '开始执行已下发任务',
    executing: '推进任务，全部完成自动检查', checking: '等待检查结果', review: '人工复查签字后交标', submitted: '已交标',
  };
  return {
    bidId: id, number: bid.number, pipeline: bid.aiPipeline, pipelineLabel: PIPELINE_LABEL[bid.aiPipeline],
    currentNode: bid.currentNode, nodeDisplay: nodeDisplay(bid.currentNode),
    draftItems: bid.aiDraft?.items.length || 0, hasDraft: !!bid.aiDraft,
    tasksTotal: c.tasks.length, tasksDone: c.tasks.filter((t) => t.status === 'done').length,
    tasksOpen: open.length, tasksOverdue: c.tasks.filter((t) => isOverdue(t, today)).length,
    unclosedClarifications: c.clarifications.filter((x) => x.status !== 'closed').length,
    reviewStatus: bid.reviewStatus, lastError: bid.aiLastError, nextAction: nextAction[bid.aiPipeline] || '',
  };
}
/** 全部完成时自动触发，也可手动触发；手动触发未全部完成时只出报告、不推流水线。 */
export function aiCheck(user: User, id: string) {
  let bid = loadBid(user, id);
  const c = collections(id);
  persistEscalations(bid, c.tasks);
  const report = runChecks(c.tasks, c.clarifications, c.checklist, bid.customerRequirements, todayStr());
  let gapTasks: BidTask[] = [];
  if (allDone(c.tasks)) {
    if (report.passed) {
      bid = saveBid({ ...bid, aiPipeline: 'review', reviewStatus: 'pending' });
    } else {
      gapTasks = createGapTasks(bid, report.gaps);
      bid = saveBid({ ...bid, aiPipeline: 'executing' });
    }
  }
  return { pipeline: bid.aiPipeline, report, gapTasks, allTasksDone: allDone(c.tasks) };
}
