import { modelStatus, modelTurn } from '../model.ts';
import { AppError } from '../../../../packages/contracts/index.ts';
import { buildPlanDraft } from './plan.ts';
import type { P9Bid, PlanDraft } from '../../../../packages/contracts/p9.ts';

/**
 * AI 能力分流（implementation-plan §4）：
 * - 隔离测试/演示模式（SALES_BUDDY_TEST_MODE=1）：确定性规则生成，输出标注 mock，绝不冒充模型结果。
 * - 生产路径：走仓库唯一入口 modelTurn + JSON 校验；无密钥报 503，不私自加模板兜底。
 * - 报价/标书内容绝不发外部搜索（本模块不调用任何搜索接口）。
 */
export const isTestMode = () => process.env.SALES_BUDDY_TEST_MODE === '1';
export const aiTag = () => (isTestMode() ? 'mock-deterministic' : 'model');

async function modelJson(prompt: string): Promise<Record<string, unknown>> {
  if (!modelStatus().configured) throw new AppError('MODEL_NOT_CONFIGURED', '请在本地.env配置模型地址、模型名和密钥', 503);
  let content = '';
  const r = await modelTurn(
    [{ role: 'system', content: '只回有效 JSON，不要代码围栏，不要捏造投标数据，不要给出报价决策或报价建议。' },
     { role: 'user', content: prompt }],
    [], AbortSignal.timeout(60000), (s) => { content += s; },
  );
  const text = (content || r.content || '').replace(/^```json/i, '').replace(/```$/g, '').trim();
  try { return JSON.parse(text) as Record<string, unknown>; }
  catch { throw new AppError('MODEL_API_ERROR', '模型返回不是有效 JSON', 502); }
}

function roleMap(bid: P9Bid): Record<string, string | null> {
  // 负责人建议：SLS 取投标负责人，其余角色暂空（未派即卡点信号，不虚构人名）。
  return { SLS: bid.ownerId || null, PM: null, SC: null, QA: null, AMD: null };
}

/** AI 排计划：测试模式用倒排规则；生产模式请模型按同一锚点输出，再经倒排校验回填日期。 */
export async function aiPlan(bid: P9Bid): Promise<PlanDraft> {
  if (isTestMode()) return { ...buildPlanDraft(bid.deadlineAt, roleMap(bid)), source: 'mock-deterministic:back-schedule' };
  const j = await modelJson(`为投标 ${bid.number}（${bid.projectName}，交标截止 ${bid.deadlineAt}）生成阶段计划 JSON：{"items":[{"title":string,"node":number,"assigneeRole":string,"durationDays":number}]}，节点 0-9，最后一项止于截止日。`);
  const raw = Array.isArray(j.items) ? (j.items as Record<string, unknown>[]) : [];
  if (!raw.length) throw new AppError('MODEL_API_ERROR', '模型未返回可用计划', 502);
  const draft = buildPlanDraft(bid.deadlineAt, roleMap(bid));
  draft.items = raw.slice(0, 12).map((it, i) => ({
    id: `PLAN-${i + 1}`, title: String(it.title || `计划项 ${i + 1}`),
    node: Math.min(9, Math.max(0, Number(it.node ?? 2))) as P9Bid['currentNode'],
    assigneeRole: String(it.assigneeRole || 'PM'), assigneeId: roleMap(bid)[String(it.assigneeRole || 'PM')] ?? null,
    start: draft.items[i]?.start ?? draft.items[0]?.start ?? bid.deadlineAt.slice(0, 10),
    end: draft.items[i]?.end ?? bid.deadlineAt.slice(0, 10),
    durationDays: Number(it.durationDays ?? 2), dependsOn: i > 0 ? [`PLAN-${i}`] : [],
  }));
  draft.source = 'model';
  return draft;
}

export type DecomposedItem = { title: string; category: string; sourceClause: string; node: number; role: string };
export const DEFAULT_CHAPTERS: { title: string; requirements: string[] }[] = [
  { title: '第一章 招标公告', requirements: ['投标人资格要求', '交标时间与地点确认'] },
  { title: '第二章 投标人须知', requirements: ['投标保证金要求', '投标文件份数与密封要求'] },
  { title: '第三章 评标办法', requirements: ['技术/商务评分权重确认', '偏差处理规则'] },
  { title: '第四章 技术要求', requirements: ['技术规格书响应', '并网性能要求', '消防与安全认证'] },
  { title: '第五章 商务条款', requirements: ['商务偏差表', '付款节点与合同审查'] },
  { title: '第六章 投标文件格式', requirements: ['投标文件格式核对', '签字与盖章要求'] },
];
const CATEGORY_OF: Record<string, string> = { 第一章: '商务', 第二章: '商务', 第三章: '商务', 第四章: '技术', 第五章: '商务', 第六章: '形式' };

/** AI 拆标书：章节→要求→分解条目；测试模式用确定性默认章节/文档章节，生产模式走模型解析。 */
export async function aiDecompose(
  bid: P9Bid, chapters: { title: string; requirements: string[] }[],
): Promise<{ items: DecomposedItem[]; source: string }> {
  const src = chapters.length ? chapters : DEFAULT_CHAPTERS;
  if (isTestMode()) {
    const items: DecomposedItem[] = [];
    for (const ch of src) {
      const prefix = ch.title.slice(0, 3);
      for (const req of ch.requirements) {
        items.push({ title: req, category: CATEGORY_OF[prefix] || '技术', sourceClause: ch.title, node: prefix === '第四章' ? 5 : 2, role: prefix === '第四章' ? 'SC' : 'PM' });
      }
    }
    return { items, source: 'mock-deterministic:chapters' };
  }
  const j = await modelJson(`解析招标文件章节并输出拆解 JSON：{"items":[{"title":string,"category":string,"sourceClause":string,"node":number,"role":string}]}。章节：${JSON.stringify(src).slice(0, 4000)}。只做结构拆解，不做报价决策。`);
  const raw = Array.isArray(j.items) ? (j.items as Record<string, unknown>[]) : [];
  if (!raw.length) throw new AppError('MODEL_API_ERROR', '模型未返回可用拆解', 502);
  return {
    items: raw.map((it) => ({
      title: String(it.title || ''), category: String(it.category || '技术'),
      sourceClause: String(it.sourceClause || ''), node: Math.min(9, Math.max(0, Number(it.node ?? 2))),
      role: String(it.role || 'PM'),
    })).filter((it) => it.title),
    source: 'model',
  };
}

export type StrategyDirection = { main: string; avoid: string; posture: string };
/**
 * 策略方向生成：只做方向建议。硬约束——不含任何价格数值、让价区间、报价建议；
 * 让价空间等数值只以用户已填策略字段为准，本函数不编造。
 */
export function ruleDirection(bid: P9Bid): StrategyDirection {
  const s = bid.strategy;
  return {
    main: `以对客策略为主线推进：${s.customer || '按三段策略执行'}；招标范围：${s.scope || '见策略三段'}`,
    avoid: '不打纯价格战；不承诺超出策略字段的范围与条款；偏差须先与商务确认，不带进交标阶段。',
    posture: '以价值主线锚定，不以设备单价为唯一锚点；收敛节奏以 BAFO 轮次为准，不做价格决策。',
  };
}
export async function aiStrategyDirection(bid: P9Bid, trigger: string): Promise<{ direction: StrategyDirection; source: string }> {
  if (isTestMode()) return { direction: ruleDirection(bid), source: 'mock-deterministic:strategy' };
  const j = await modelJson(`基于投标策略三段生成方向 JSON：{"main":string,"avoid":string,"posture":string}。触发：${trigger}。策略：${JSON.stringify(bid.strategy).slice(0, 3000)}。不要给出任何价格数值、让价区间或报价建议。`);
  if (!j.main || !j.avoid || !j.posture) throw new AppError('MODEL_API_ERROR', '模型未返回可用策略方向', 502);
  return { direction: { main: String(j.main), avoid: String(j.avoid), posture: String(j.posture) }, source: 'model' };
}

/** 常驻助理：测试模式按种子式脚本引用本标数据回答；生产模式走 modelTurn；无密钥 503。 */
export async function assistantReply(bid: P9Bid, question: string, ctx: { openTasks: number; overdue: number; unclosedClars: number; health: number }): Promise<{ reply: string; citations: string[]; source: string }> {
  if (isTestMode()) {
    const q = question;
    let reply: string;
    if (/风险|卡点/.test(q)) reply = `本标健康度 ${ctx.health}，当前节点 ${bid.currentNode}，逾期任务 ${ctx.overdue} 条、未闭环澄清 ${ctx.unclosedClars} 条。建议先闭环逾期与卡点任务。`;
    else if (/待办|我的/.test(q)) reply = `本标未完成待办 ${ctx.openTasks} 条，其中逾期 ${ctx.overdue} 条，详见待办与澄清 Tab。`;
    else if (/进度|到哪/.test(q)) reply = `本标当前节点 ${bid.currentNode}，交标截止 ${bid.deadlineAt}，流水线状态 ${bid.aiPipeline}。`;
    else if (/催/.test(q)) reply = `已为你拟好催办口径（未自动发送）：请责任人尽快闭环本标逾期任务，逾期将按 L2/L3 升级。确认后由你发送。`;
    else reply = `我在。本标编号 ${bid.number}，当前节点 ${bid.currentNode}，健康度 ${ctx.health}；待办、澄清、卡点、健康度都可以直接查，也可以让我拟催办口径。`;
    return { reply, citations: ['健康度', '节点进度', '待办与澄清'], source: 'mock-deterministic:script' };
  }
  if (!modelStatus().configured) throw new AppError('MODEL_NOT_CONFIGURED', '请在本地.env配置模型地址、模型名和密钥', 503);
  let content = '';
  const r = await modelTurn(
    [{ role: 'system', content: '你是投标助理，只引用本标数据回答，结论仅供内部参考，不做报价决策与建议。' },
     { role: 'user', content: `投标 ${bid.number} ${bid.projectName}，节点 ${bid.currentNode}，交标 ${bid.deadlineAt}，健康度 ${ctx.health}，未完成待办 ${ctx.openTasks}，逾期 ${ctx.overdue}，未闭环澄清 ${ctx.unclosedClars}。问题：${question}` }],
    [], AbortSignal.timeout(60000), (s) => { content += s; },
  );
  return { reply: content || r.content, citations: ['本标数据'], source: 'model' };
}
