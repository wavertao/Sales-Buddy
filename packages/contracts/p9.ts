import { z } from 'zod';

/**
 * P9 投标全流程 · 后端契约（implementation-plan §3 + §8 补充）。
 * 只含 Zod schema / 类型 / 常量，不含任何运行时依赖（不引 xstate、不引新包）。
 * 内部节点 0-9（逻辑卡①）为唯一口径；屏上 1-10 式显示 = 内部节点 + 1。
 */

// ---- 节点 0-9 ---------------------------------------------------------------
export const bidNodeSchema = z.number().int().min(0).max(9);
export type BidNode = z.infer<typeof bidNodeSchema>;

export const NODE_META: { node: BidNode; name: string; display: string; key: string }[] = [
  { node: 0, name: '商机判断', display: '① 商机判断', key: 'assessment' },
  { node: 1, name: '投标策略', display: '② 投标策略', key: 'strategy' },
  { node: 2, name: '标书分解', display: '③ 标书分解', key: 'decomposition' },
  { node: 3, name: '开工会', display: '④ 开工会', key: 'kickoff' },
  { node: 4, name: '澄清跟进', display: '⑤ 澄清跟进', key: 'clarification_pre' },
  { node: 5, name: '投标文件制作', display: '⑥ 投标文件制作', key: 'production' },
  { node: 6, name: '交标', display: '⑦ 交标', key: 'submission' },
  { node: 7, name: '澄清环节跟进', display: '⑧ 澄清环节跟进', key: 'clarification_post' },
  { node: 8, name: 'BAFO', display: '⑨ BAFO', key: 'bafo' },
  { node: 9, name: '定标', display: '⑩ 定标', key: 'award' },
];
export const nodeName = (n: number) => NODE_META[n]?.name ?? `节点${n}`;
export const nodeDisplay = (n: number) => NODE_META[n]?.display ?? `节点${n + 1}`;

// ---- AI 协管流水线（§8，持久化在投标上）--------------------------------------
export const pipelineStateSchema = z.enum([
  'idle', 'planning', 'plan_draft', 'decomposing', 'dispatched',
  'executing', 'checking', 'review', 'submitted',
]);
export type PipelineState = z.infer<typeof pipelineStateSchema>;
export const PIPELINE_LABEL: Record<PipelineState, string> = {
  idle: '未启动', planning: 'AI 正在排计划', plan_draft: 'AI 计划草稿待确认',
  decomposing: 'AI 正在拆标书（草稿已更新，待确认）', dispatched: '已下发',
  executing: '执行中', checking: 'AI 检查中', review: '人工复查中', submitted: '已交标',
};

// ---- 通用枚举 ---------------------------------------------------------------
export const bidStatusSchema = z.enum(['in_progress', 'submitted', 'awarded', 'lost', 'voided']);
export type BidStatus = z.infer<typeof bidStatusSchema>;
export const taskStatusSchema = z.enum(['todo', 'in_progress', 'done', 'partial', 'cancelled', 'delayed']);
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export const prioritySchema = z.enum(['P0', 'P1', 'P2']);
export const clarificationPhaseSchema = z.enum(['pre-bid', 'post-bid']);
export const clarificationTypeSchema = z.enum(['technical', 'business', 'deviation']);
export const clarificationStatusSchema = z.enum(['open', 'answered', 'closed']);

// ---- 实体 -------------------------------------------------------------------
export type AtbSummary = { total: number; filled: number; gaps: string[] };
export type StrategySection = { scope: string; customer: string; competition: string };
export type StrategyVersion = {
  version: number; direction: { main: string; avoid: string; posture: string };
  changes: string; trigger: string; bafoRound: string; status: 'draft' | 'confirmed';
  createdAt: string; createdBy: string;
};
export type Strategy = StrategySection & {
  aiDirection?: { main: string; avoid: string; posture: string };
  status: 'draft' | 'saved' | 'archived'; updatedAt: string;
};
export type CustomerRequirement = { id: string; requirement: string; status: 'met' | 'deviation' | 'pending' };
export type PlanDraftItem = {
  id: string; title: string; node: BidNode; assigneeRole: string; assigneeId: string | null;
  start: string; end: string; durationDays: number; dependsOn: string[];
};
export type PlanDraft = { items: PlanDraftItem[]; generatedAt: string; source: string; deadlineAt: string };
export type P9Bid = {
  id: string; type: 'bid'; number: string; customerId: string; opportunityId: string | null;
  customerName: string; projectName: string; name: string;
  status: BidStatus; currentNode: BidNode; ownerId: string; sppTeam: string;
  pricingTeam: string[]; deadlineAt: string; createdAt: string; updatedAt: string;
  atb: AtbSummary; strategy: Strategy; strategyHistory: StrategyVersion[];
  aiPipeline: PipelineState; aiDraft: PlanDraft | null; aiLastError: string | null;
  reviewStatus: 'none' | 'pending' | 'approved' | 'rejected';
  submission: { submittedAt: string; deposit: string; method: string; copies: string; credential: string } | null;
  award: { result: 'won' | 'lost'; reason: string; lessons: string[]; closedAt: string } | null;
  groupUrl: string | null; customerRequirements: CustomerRequirement[];
  approvalNo: string | null; approvalStatus: string | null;
  [key: string]: unknown;
};
export type BidItem = {
  id: string; type: 'bid_item'; bidId: string; customerId: string; title: string;
  category: string; sourceClause: string; node: BidNode; assigneeId: string | null;
  assigneeRole: string; start: string; end: string; status: string;
  deliverable: string; createdAt: string; updatedAt: string; [key: string]: unknown;
};
export type BidTask = {
  id: string; type: 'bid_task'; bidId: string; customerId: string; title: string;
  bidItemId: string | null; node: BidNode; assigneeId: string | null; assigneeRole: string;
  dueAt: string; priority: 'P0' | 'P1' | 'P2'; status: TaskStatus; source: string;
  comments: { id: string; author: string; text: string; at: string }[];
  result: { outcome: string; note: string; at: string; by: string } | null;
  completedAt: string | null; escalationLevel: string | null;
  createdAt: string; updatedAt: string; [key: string]: unknown;
};
export type Clarification = {
  id: string; type: 'clarification'; bidId: string; customerId: string;
  phase: 'pre-bid' | 'post-bid'; clarType: 'technical' | 'business' | 'deviation';
  question: string; answer: string; ownerId: string | null; dueAt: string | null;
  status: 'open' | 'answered' | 'closed'; incorporated: boolean; source: string;
  createdAt: string; updatedAt: string; [key: string]: unknown;
};
export type BidDoc = {
  id: string; type: 'bid_doc'; bidId: string; customerId: string; filename: string;
  category: string; version: string; size: string; uploader: string; status: string;
  chapters: { title: string; requirements: string[] }[]; parseStatus: string; parseError: string | null;
  createdAt: string; updatedAt: string; [key: string]: unknown;
};
export type QuoteVersion = {
  id: string; type: 'quote_version'; bidId: string; customerId: string; roundNo: number;
  version: string; fields: Record<string, string>; status: string;
  createdAt: string; updatedAt: string; [key: string]: unknown;
};
export type ChecklistItem = {
  id: string; type: 'checklist_item'; bidId: string; customerId: string; templateId: string;
  title: string; category: string; required: boolean; status: 'pending' | 'done';
  evidence: string; createdAt: string; updatedAt: string; [key: string]: unknown;
};
export type BidMeeting = {
  id: string; type: 'bid_meeting'; bidId: string; customerId: string; title: string;
  meetingType: string; startsAt: string; endsAt: string | null; participants: string[];
  organizer: string; status: string; minutes: string; recording: string;
  createdAt: string; updatedAt: string; [key: string]: unknown;
};
export type BidRound = {
  id: string; type: 'bid_round'; bidId: string; customerId: string; roundNo: number;
  label: string; status: string; summary: string; createdAt: string; updatedAt: string;
  [key: string]: unknown;
};

// ---- 检查模板（模板与实例分离：模板在契约里，实例是 checklist_item 记录）------
export const CHECKLIST_TEMPLATES: { id: string; title: string; category: string; required: boolean }[] = [
  { id: 'TPL-01', title: '技术标强制响应齐全', category: '技术', required: true },
  { id: 'TPL-02', title: 'UL9540A 报告已附', category: '技术', required: true },
  { id: 'TPL-03', title: '消防认证响应已附', category: '技术', required: true },
  { id: 'TPL-04', title: '商务偏差表口径一致', category: '商务', required: true },
  { id: 'TPL-05', title: '付款节点与客户要求一致', category: '商务', required: true },
  { id: 'TPL-06', title: '投标保证金/保函齐备', category: '商务', required: true },
  { id: 'TPL-07', title: '资质与业绩清单齐全', category: '资质', required: true },
  { id: 'TPL-08', title: '签字与密封符合招标要求', category: '形式', required: true },
  { id: 'TPL-09', title: '份数与递交方式确认', category: '形式', required: true },
  { id: 'TPL-10', title: '澄清答复全部闭环或已进标书', category: '澄清', required: false },
  { id: 'TPL-11', title: '技术/商务/对客三一致性核查', category: '一致性', required: true },
  { id: 'TPL-12', title: '报价版本与技术方案版本对应', category: '一致性', required: true },
  { id: 'TPL-13', title: '交付周期与里程碑承诺', category: '交付', required: false },
  { id: 'TPL-14', title: '售后与质保条款确认', category: '售后', required: false },
];

// BAFO 字段差异只呈现以下商业条款字段（不含金额字段；不做优劣判断、不评分、不排序）。
export const BAFO_FIELDS: { key: string; label: string }[] = [
  { key: 'warrantyYears', label: '质保年限' },
  { key: 'warrantyScope', label: '质保范围' },
  { key: 'paymentTerms', label: '付款节点' },
  { key: 'spareParts', label: '备件范围' },
  { key: 'deliveryTerms', label: '交付条款' },
  { key: 'validity', label: '报价有效期' },
];

// ---- 请求 schema -------------------------------------------------------------
export const createBidSchema = z.object({
  opportunityId: z.string().min(1).optional(),
  customerId: z.string().min(1).optional(),
  customerName: z.string().max(200).optional(),
  projectName: z.string().max(200).optional(),
  ownerId: z.string().min(1).optional(),
  sppTeam: z.string().max(100).optional(),
  pricingTeam: z.array(z.string().min(1)).max(50).optional(),
  deadlineAt: z.string().min(1).optional(),
  customerRequirements: z.array(z.object({
    requirement: z.string().min(1).max(500), status: z.enum(['met', 'deviation', 'pending']).optional(),
  })).max(50).optional(),
});
export const strategySchema = z.object({
  scope: z.string().max(5000).optional(),
  customer: z.string().max(5000).optional(),
  competition: z.string().max(5000).optional(),
  status: z.enum(['draft', 'saved', 'archived']).optional(),
  confirmVersion: z.number().int().positive().optional(),
});
export const planItemSchema = z.object({
  title: z.string().min(1).max(200),
  category: z.string().max(100).optional(),
  sourceClause: z.string().max(200).optional(),
  node: bidNodeSchema.optional(),
  assigneeId: z.string().min(1).nullable().optional(),
  assigneeRole: z.string().max(100).optional(),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  deliverable: z.string().max(500).optional(),
  dependsOn: z.array(z.string().min(1)).max(20).optional(),
});
export const rescheduleSchema = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export const docSchema = z.object({
  filename: z.string().min(1).max(300),
  category: z.string().max(100).optional(),
  version: z.string().max(50).optional(),
  size: z.string().max(50).optional(),
  chapters: z.array(z.object({
    title: z.string().min(1).max(200),
    requirements: z.array(z.string().min(1).max(500)).max(50),
  })).max(20).optional(),
});
export const meetingSchema = z.object({
  title: z.string().min(1).max(200),
  meetingType: z.string().max(100).optional(),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1).optional(),
  participants: z.array(z.string().min(1)).max(50).optional(),
  minutes: z.string().max(10000).optional(),
  recording: z.string().max(300).optional(),
});
export const todoSchema = z.object({
  title: z.string().min(1).max(200),
  assigneeId: z.string().min(1).nullable().optional(),
  assigneeRole: z.string().max(100).optional(),
  dueAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  priority: prioritySchema.optional(),
  node: bidNodeSchema.optional(),
  source: z.string().max(100).optional(),
});
export const completeTodoSchema = z.object({
  outcome: z.enum(['completed', 'partial', 'cancelled', 'delayed']),
  note: z.string().min(1).max(2000),
  attachments: z.array(z.string().max(300)).max(10).optional(),
});
export const commentSchema = z.object({ text: z.string().min(1).max(2000) });
export const clarificationSchema = z.object({
  phase: clarificationPhaseSchema.optional(),
  clarType: clarificationTypeSchema.optional(),
  question: z.string().min(1).max(2000),
  answer: z.string().max(5000).optional(),
  ownerId: z.string().min(1).nullable().optional(),
  dueAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  incorporated: z.boolean().optional(),
  source: z.string().max(100).optional(),
});
export const clarificationUpdateSchema = z.object({
  status: clarificationStatusSchema.optional(),
  incorporated: z.boolean().optional(),
  answer: z.string().max(5000).optional(),
});
export const reviewSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  reviewer: z.string().min(1).max(100).optional(),
  notes: z.string().max(2000).optional(),
});
export const submitSchema = z.object({
  submittedAt: z.string().min(1),
  deposit: z.string().max(200).optional(),
  method: z.string().max(200).optional(),
  copies: z.string().max(200).optional(),
  credential: z.string().max(300).optional(),
});
export const bafoRoundSchema = z.object({
  summary: z.string().max(2000).optional(),
  fields: z.record(z.string(), z.string()).optional(),
});
export const closeSchema = z.object({
  result: z.enum(['won', 'lost']),
  reason: z.string().max(2000).optional(),
  lessons: z.array(z.string().max(1000)).max(20).optional(),
});
export const chatSchema = z.object({ question: z.string().min(1).max(2000) });
export const aiDecomposeSchema = z.object({ documentId: z.string().min(1).optional() });
export const regenerateSchema = z.object({
  trigger: z.string().max(500).optional(),
  scope: z.string().max(5000).optional(),
  customer: z.string().max(5000).optional(),
  competition: z.string().max(5000).optional(),
});
