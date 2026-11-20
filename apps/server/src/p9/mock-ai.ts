// ============================================================================
// 演示 Mock，仅隔离测试/演示模式可用（SALES_BUDDY_TEST_MODE=1 或 P9 演示开关）。
// 本文件所有函数均为确定性规则实现，不得冒充模型结果；输出必须标注 mock。
// 生产路径无密钥报 503 是仓库约定（见 model.ts / agent.ts），本文件不改它，
// 也不给生产路径加任何模板兜底。
// 报价边界（硬约束）：Mock 不得输出报价建议、报价区间、价格优劣判断；
// BAFO Mock 只做旧值→新值差异；含金额的字段一律以锁定占位返回，不返回值。
// P9 演示时钟固定 2026-10-24，只用于 P9 相对标签，绝不改全局 BUSINESS_CLOCK。
// ============================================================================

export const P9_MOCK_LABEL = '演示 Mock，仅隔离测试/演示模式可用';
export const P9_DEMO_CLOCK = '2026-10-24';
export const P9_SUBMISSION_DEADLINE = '2026-11-05T14:00:00+08:00';

/** 演示 Mock，仅隔离测试/演示模式可用：给每份 Mock 输出打标。 */
export function mockLabel() {
  return P9_MOCK_LABEL;
}

// ---------------------------------------------------------------------------
// 纯函数：编号 / 节点状态机 / 门禁 / 倒排 / BAFO 差异 / 报价 gating
// ---------------------------------------------------------------------------

/** 演示 Mock，仅隔离测试/演示模式可用：编号 BID-{YYYYMMDD}-{NNN}，当日递增从 001。 */
export function generateBidNumber(initiatedDate: string, sequenceOfDay: number): string {
  const d = initiatedDate.slice(0, 10).replaceAll('-', '');
  if (!/^\d{8}$/.test(d)) throw new Error('invalid initiatedDate, expected YYYY-MM-DD');
  if (!Number.isInteger(sequenceOfDay) || sequenceOfDay < 1 || sequenceOfDay > 999) {
    throw new Error('sequenceOfDay must be an integer in 1..999');
  }
  return `BID-${d}-${String(sequenceOfDay).padStart(3, '0')}`;
}

/** 演示 Mock，仅隔离测试/演示模式可用：内部节点 0–9，屏上显示 = 内部 +1。 */
export const P9_NODE_NAMES = [
  '商机判断', '投标策略', '标书分解', '开工会', '澄清跟进',
  '投标文件制作', '交标', '澄清环节跟进', 'BAFO', '定标',
] as const;

export function displayNode(internalNode: number): string {
  if (!Number.isInteger(internalNode) || internalNode < 0 || internalNode > 9) throw new Error('node must be 0..9');
  return `节点 ${['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'][internalNode]} ${P9_NODE_NAMES[internalNode]}`;
}

/** 演示 Mock，仅隔离测试/演示模式可用：节点推进门禁（澄清并行不阻塞主链）。 */
export function nodeGate(node: number, input: {
  atbGapsBlocking?: boolean; strategyAdopted?: boolean; planDispatched?: boolean;
  submissionReady?: boolean; reviewSigned?: boolean;
}): { allowed: boolean; reason: string } {
  switch (node) {
    case 0: return { allowed: true, reason: '商机判断：缺失项标黄但不阻断发起' };
    case 1: return input.atbGapsBlocking ? { allowed: false, reason: 'ATB 存在阻断性缺口' } : { allowed: true, reason: 'ATB 缺口不阻断' };
    case 2: return input.strategyAdopted ? { allowed: true, reason: '策略已采用' } : { allowed: false, reason: '策略未采用，标书分解不可启动' };
    case 3: case 4: case 5:
      return input.planDispatched ? { allowed: true, reason: '计划已下发' } : { allowed: false, reason: '计划未下发' };
    case 6: return input.submissionReady ? { allowed: true, reason: '交标材料齐备' } : { allowed: false, reason: '交标材料未齐备' };
    case 7: case 8: return { allowed: true, reason: '澄清/BAFO 与主链并行，不阻塞' };
    case 9: return input.reviewSigned ? { allowed: true, reason: '人工复查已签字' } : { allowed: false, reason: '人工复查未签字，定标不可完成' };
    default: return { allowed: false, reason: '未知节点' };
  }
}

/** 演示 Mock，仅隔离测试/演示模式可用：只能顺序推进（0→9），不跳节点、不回退节点（任务级重开除外）。 */
export function canAdvanceNode(from: number, to: number): boolean {
  return Number.isInteger(from) && Number.isInteger(to) && from >= 0 && from <= 8 && to === from + 1;
}

/** 演示 Mock，仅隔离测试/演示模式可用：以交标截止日为锚点倒排（工作日扣周末的简化版：日历日倒推）。 */
export function backwardSchedule(deadlineIso: string, leadDays: number): string {
  const d = new Date(deadlineIso);
  if (Number.isNaN(d.getTime())) throw new Error('invalid deadline');
  d.setDate(d.getDate() - leadDays);
  return d.toISOString().slice(0, 10);
}

/** 演示 Mock，仅隔离测试/演示模式可用：距交标天数（演示时钟 2026-10-24 → 2026-11-05 = 12 天）。 */
export function daysUntilSubmission(clockDate = P9_DEMO_CLOCK, deadlineIso = P9_SUBMISSION_DEADLINE): number {
  const ms = new Date(deadlineIso).getTime() - new Date(clockDate + 'T00:00:00+08:00').getTime();
  return Math.floor(ms / 86400000);
}

/** 演示 Mock，仅隔离测试/演示模式可用：报价 gating。仅 admin 与投标 pricingTeam 可见金额。 */
export function canViewQuote(role: string, inPricingTeam: boolean): boolean {
  return role === 'admin' || inPricingTeam;
}

/** 演示 Mock，仅隔离测试/演示模式可用：报价字段一律锁定占位，不返回值、不做优劣判断。 */
export function quoteLockedPlaceholder() {
  return { visible: false, display: '已报价', note: '报价单严格权限：非授权角色仅见状态，不含金额' };
}

const PRICE_FIELDS = ['price', 'amount', '报价', '金额', '单价', '总价', '让价', '区间'];
/** 演示 Mock，仅隔离测试/演示模式可用：BAFO 字段差异，只列差异项；价格类字段只出锁定占位。 */
export function bafoFieldDiff(oldValues: Record<string, string | null>, newValues: Record<string, string | null>) {
  const diffs: Array<{ field: string; old: string | null; new: string | null; locked?: boolean }> = [];
  for (const field of Object.keys(newValues)) {
    if (oldValues[field] === newValues[field]) continue;
    if (PRICE_FIELDS.some((p) => field.includes(p))) {
      diffs.push({ field, old: null, new: null, locked: true });
    } else {
      diffs.push({ field, old: oldValues[field] ?? null, new: newValues[field] ?? null });
    }
  }
  return { mock: mockLabel(), diffs, diffCount: diffs.length };
}

// ---------------------------------------------------------------------------
// §8 AI 投标协管主链路：流水线状态机
// idle → planning → plan_draft → decomposing → dispatched → executing →
// checking → review → submitted；检查不通过 checking → executing；可暂停。
// ---------------------------------------------------------------------------

export const P9_PIPELINE_STATES = [
  'idle', 'planning', 'plan_draft', 'decomposing', 'dispatched',
  'executing', 'checking', 'review', 'submitted',
] as const;
export type P9PipelineState = (typeof P9_PIPELINE_STATES)[number];

const PIPELINE_NEXT: Record<P9PipelineState, P9PipelineState> = {
  idle: 'planning', planning: 'plan_draft', plan_draft: 'decomposing',
  decomposing: 'dispatched', dispatched: 'executing', executing: 'checking',
  checking: 'review', review: 'submitted', submitted: 'submitted',
};

/** 演示 Mock，仅隔离测试/演示模式可用：流水线转移。事件：advance | check_failed | pause | resume。 */
export function nextPipelineState(
  current: P9PipelineState, event: 'advance' | 'check_failed' | 'pause' | 'resume',
  paused = false,
): { state: P9PipelineState; paused: boolean } {
  if (event === 'pause') return { state: current, paused: true };
  if (event === 'resume') return { state: current, paused: false };
  if (paused) return { state: current, paused };
  if (event === 'check_failed') {
    // 只有检查态不通过才回 executing；其他态的 check_failed 不是合法转移。
    return current === 'checking' ? { state: 'executing', paused: false } : { state: current, paused: false };
  }
  return { state: PIPELINE_NEXT[current], paused: false };
}

// ---------------------------------------------------------------------------
// Mock AI（确定性规则，全部标注演示 Mock）
// ---------------------------------------------------------------------------

export interface MockPlanItem { title: string; owner: string | null; due: string; node: number; dependsOn?: string[] }

/** 演示 Mock，仅隔离测试/演示模式可用：以交标截止日为锚点倒排 + 节点 0–9 生成计划草稿。 */
export function mockPlan(input: { deadline?: string; nodes?: number[]; team?: Record<string, string> }) {
  const deadline = input.deadline ?? P9_SUBMISSION_DEADLINE;
  const team = input.team ?? { SLS: '李明', PM: '王强', SC: '陈磊', QA: '张伟', AMD: '王芳' };
  const stages: Array<{ node: number; title: string; leadDays: number; owner: string }> = [
    { node: 0, title: '商机判断：补齐ATB缺口', leadDays: 26, owner: team.SLS },
    { node: 1, title: '投标策略：三段填写与方向确认', leadDays: 24, owner: team.SLS },
    { node: 2, title: '标书分解：拆解确认与BSD审核', leadDays: 14, owner: team.PM },
    { node: 3, title: '开工会：分工晾晒与卡点升级', leadDays: 13, owner: team.PM },
    { node: 4, title: '澄清跟进：首轮澄清', leadDays: 11, owner: team.SC },
    { node: 5, title: '投标文件制作：商务/技术/报价编写', leadDays: 4, owner: team.SC },
    { node: 6, title: '交标：凭证与保证金核验', leadDays: 0, owner: team.SLS },
    { node: 7, title: '澄清环节跟进：评标期响应', leadDays: -3, owner: team.SC },
    { node: 8, title: 'BAFO：多轮收敛与差异归档', leadDays: -7, owner: team.PM },
    { node: 9, title: '定标：结论与复盘归档', leadDays: -10, owner: team.PM },
  ];
  const wanted = input.nodes ?? [0, 1, 2, 3, 4, 5, 6];
  const items: MockPlanItem[] = stages
    .filter((s) => wanted.includes(s.node))
    .map((s) => ({ title: s.title, owner: s.owner, due: backwardSchedule(deadline, s.leadDays), node: s.node }));
  return { mock: mockLabel(), state: 'plan_draft' as P9PipelineState, deadline, items, note: 'AI计划草稿待一次确认，确认后才下发（不自动落库）' };
}

/** 演示 Mock，仅隔离测试/演示模式可用：按种子文档结构化输出（章节→条目候选）。 */
export function mockParseBidDocument(doc: { name: string; pages: number; chapters: Array<{ name: string; clauses: string[] }> }) {
  const items = doc.chapters.flatMap((ch) =>
    ch.clauses.map((clause, i) => ({ title: `${clause}响应`, sourceClause: clause, chapter: ch.name, index: i + 1 })),
  );
  return {
    mock: mockLabel(), document: doc.name, pages: doc.pages,
    chapters: doc.chapters.map((c) => c.name), candidateCount: items.length, items,
  };
}

/** 演示 Mock，仅隔离测试/演示模式可用：拆解并更新计划（新增/调整任务，不改已派发条目）。 */
export function mockDecompose(input: {
  parsed: ReturnType<typeof mockParseBidDocument>;
  planDraft: ReturnType<typeof mockPlan>;
  configOwnerByKeyword?: Record<string, string>;
}) {
  const ownerByKeyword = input.configOwnerByKeyword ?? { '技术': '陈磊', '商务': '王芳', '交付': '张伟', '资质': '王芳' };
  const newItems = input.parsed.items.map((it) => {
    const owner = Object.entries(ownerByKeyword).find(([k]) => it.title.includes(k))?.[1] ?? null;
    return { title: it.title, sourceClause: it.sourceClause, chapter: it.chapter, owner, status: owner ? 'pending' : 'blocked' as const };
  });
  const planUpdates = {
    added: newItems.length,
    adjusted: input.planDraft.items.length,
    note: '已人工改过的条目不覆盖；拆解结果为草稿，确认后才更新计划',
  };
  return { mock: mockLabel(), state: 'decomposing' as P9PipelineState, items: newItems, planUpdates };
}

/** 演示 Mock，仅隔离测试/演示模式可用：确认后生成任务/待办并分派提醒（含 L2/L3 与逾期超 72h 进 BPM）。 */
export function mockDispatch(input: {
  planItems: Array<{ title: string; owner: string | null; due: string; node: number }>;
  clockDate?: string;
}) {
  const clock = input.clockDate ?? P9_DEMO_CLOCK;
  const tasks = input.planItems.map((p, i) => ({
    id: `TASK-${String(i + 1).padStart(2, '0')}`, title: p.title, owner: p.owner, due: p.due, node: p.node,
    status: p.owner ? 'pending' : 'blocked',
  }));
  const todos = tasks.filter((t) => t.owner).map((t) => ({ taskId: t.id, title: t.title, assignee: t.owner, due: t.due, source: `节点${t.node}` }));
  const reminders = tasks.flatMap((t) => {
    if (!t.owner) return [{ taskId: t.id, kind: '未派责任人', action: '指派责任人', channel: '待办提醒' }];
    const overdueHours = (new Date(clock + 'T09:40:00+08:00').getTime() - new Date(t.due + 'T09:00:00+08:00').getTime()) / 3600000;
    if (overdueHours > 72) return [{ taskId: t.id, kind: '逾期超72h自动进BPM', action: '进BPM', channel: 'BPM待办' }];
    if (overdueHours > 0) return [{ taskId: t.id, kind: '逾期提醒', action: '升级L2，超时未回进L3', channel: '待办提醒+日报洞察' }];
    if (overdueHours > -24) return [{ taskId: t.id, kind: '到期前提醒', action: '提前提醒', channel: '待办提醒' }];
    return [];
  });
  return {
    mock: mockLabel(), state: 'dispatched' as P9PipelineState,
    taskCount: tasks.length, todoCount: todos.length, tasks, todos, reminders,
  };
}

/** 演示 Mock，仅隔离测试/演示模式可用：策略方向生成（三段输入→方向模板；不含报价姿态）。 */
export function mockStrategyDirection(input: { scope: string; customer: string; competition: string }) {
  if (!input.scope || !input.customer || !input.competition) {
    throw new Error('strategy inputs incomplete: scope, customer and competition are all required');
  }
  return {
    mock: mockLabel(),
    主打点: `以“${input.customer}”的价值主线打穿：技术标按招标范围写清边界与服务承诺`,
    避让点: '不接纯价格战；招标范围外的总包与土建不在报价范围',
    note: '仅作方向建议；报价姿态不在Mock输出范围内，由报价管理部门另行确定',
  };
}

/** 演示 Mock，仅隔离测试/演示模式可用：拆解建议（按种子文档给条目与责任人建议，不覆盖人工修改）。 */
export function mockSuggestDecomposition(keywords: string[]) {
  return {
    mock: mockLabel(),
    suggestions: keywords.map((k) => ({ keyword: k, suggestion: `按配置表为“${k}”生成分解条目并带出默认责任人与工期（草稿态）` })),
    note: '改条目只产生草稿态，不影响已派发条目',
  };
}

/** 演示 Mock，仅隔离测试/演示模式可用：四源体检（待办/澄清/checklist/客户要求），含通过与不通过两路。 */
export function mockCheck(input: {
  todosOpen: number; clarificationsOverdue48h: number; checklistMissing: string[]; customerDeviations: string[];
}) {
  const sources = [
    { source: '待办', open: input.todosOpen, ok: input.todosOpen === 0 },
    { source: '澄清', overdue48h: input.clarificationsOverdue48h, ok: input.clarificationsOverdue48h === 0 },
    { source: 'checklist', missing: input.checklistMissing, ok: input.checklistMissing.length === 0 },
    { source: '客户要求', deviations: input.customerDeviations, ok: input.customerDeviations.length === 0 },
  ];
  const passed = sources.every((s) => s.ok);
  const gapTasks = passed ? [] : [
    ...input.checklistMissing.map((m) => ({ title: `补齐checklist缺口：${m}`, source: 'checklist' })),
    ...input.customerDeviations.map((d) => ({ title: `确认客户要求偏差：${d}`, source: '客户要求' })),
    ...(input.todosOpen > 0 ? [{ title: '闭环未完成待办', source: '待办' }] : []),
    ...(input.clarificationsOverdue48h > 0 ? [{ title: '回复超48h未回的澄清', source: '澄清' }] : []),
  ];
  return {
    mock: mockLabel(), passed,
    nextState: (passed ? 'review' : 'executing') as P9PipelineState,
    conclusion: passed ? '检查通过：进入人工复查' : '检查不通过：回写缺口任务继续推进，不卡死',
    sources, gapTasks,
  };
}

/** 演示 Mock，仅隔离测试/演示模式可用：交标体检（mockCheck 的种子口径封装，四源规则出清单）。 */
export function mockSubmissionCheck(seedCheck: {
  todosTotal: number; todosOpen: number; clarificationsOverdue48h: number;
  checklistMissing: string[]; customerDeviations: string[];
}) {
  const r = mockCheck(seedCheck);
  return { ...r, todosTotal: seedCheck.todosTotal, reviewer: '王强（技术负责人）· 待签字', reviewNote: 'AI只做检查，人工逐项确认后进入标书定稿' };
}

/** 演示 Mock，仅隔离测试/演示模式可用：卡点识别（未派责任人、排期冲突、缺前置条件、逾期四类信号规则）。 */
export function mockIdentifyBlockers(items: Array<{
  title: string; owner: string | null; due: string; status: string; dependsOn?: string[]; preconditionMissing?: boolean;
}>, clockDate = P9_DEMO_CLOCK) {
  const blockers: Array<{ title: string; signal: string; level: string }> = [];
  for (const it of items) {
    if (!it.owner) blockers.push({ title: it.title, signal: '未派责任人', level: '高' });
    if (it.preconditionMissing) blockers.push({ title: it.title, signal: '缺前置条件', level: '高' });
    if (it.status !== 'completed' && it.due.slice(0, 10) < clockDate) blockers.push({ title: it.title, signal: '逾期', level: '高' });
    if (it.dependsOn && it.dependsOn.length > 1) blockers.push({ title: it.title, signal: '排期冲突', level: '中' });
  }
  return { mock: mockLabel(), blockers, count: blockers.length };
}

/** 演示 Mock，仅隔离测试/演示模式可用：策略再制作（新版方向 + 变更说明 + 版本号递增；与 BAFO 轮次关联快照）。 */
export function mockStrategyRegenerate(input: {
  previousVersion: number; previousDirection: Record<string, string>; trigger: string; linkedBafoRound: string;
  directionUpdate: Record<string, string>;
}) {
  if (!input.trigger) throw new Error('regenerate trigger is required');
  const version = input.previousVersion + 1;
  const direction = { ...input.previousDirection, ...input.directionUpdate };
  const changes = Object.keys(input.directionUpdate).map((k) => `${k}已更新（触发：${input.trigger}）`);
  return {
    mock: mockLabel(), version, status: '待确认', linkedBafoRound: input.linkedBafoRound,
    trigger: input.trigger, direction, changes,
    note: '更新→再制作→确认必须闭环；确认前为草稿，不覆盖已采用版本；报价姿态不在Mock输出范围内',
  };
}

/** 演示 Mock，仅隔离测试/演示模式可用：助理脚本回复（按种子知识，不编造标外数据，不含报价建议）。 */
export function mockAssistantReply(question: string, seed: {
  health: number; nodeDisplay: string; blockersOpen: number; todosOverdue: number; deadline: string;
}) {
  const q = question;
  let answer: string;
  if (q.includes('风险') || q.includes('卡点')) {
    answer = `健康度${seed.health}，开放卡点${seed.blockersOpen}个，逾期待办${seed.todosOverdue}条；最危险的是技术标强制响应缺口与报价文件未过BSD，需先闭环这两件。`;
  } else if (q.includes('待办')) {
    answer = `逾期待办${seed.todosOverdue}条，当前节点${seed.nodeDisplay}；先处理逾期与今日到期待办。`;
  } else if (q.includes('进度')) {
    answer = `当前节点${seed.nodeDisplay}，交标${seed.deadline}，健康度${seed.health}。`;
  } else if (q.includes('催')) {
    answer = '已记录催办请求（演示Mock）：将按待办提醒+日报洞察通知责任人，升级线为L2/L3、逾期超72h进BPM。';
  } else {
    answer = `我在。这个标的待办、澄清、卡点、健康度我都能直接查；当前节点${seed.nodeDisplay}。`;
  }
  return { mock: mockLabel(), question: q, answer, citations: ['健康度与节点进度', '驾驶舱卡点与逾期任务'], note: '结论仅供内部参考' };
}
