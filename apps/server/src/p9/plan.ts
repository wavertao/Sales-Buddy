import type { BidNode, PlanDraft, PlanDraftItem } from '../../../../packages/contracts/p9.ts';

/** 倒排计算：以交标截止日为锚点，按工作日（跳过周六日）倒推。 */
export const dateOnly = (iso: string) => iso.slice(0, 10);
export const isWorkingDay = (d: Date) => d.getDay() !== 0 && d.getDay() !== 6;
export function fmt(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
/** 从 end（含）往前数 duration 个工作日，返回 start。 */
export function backWorkingDays(end: string, duration: number): string {
  let d = parseDate(end); let count = 0;
  while (count < duration - 1) { d = new Date(d.getTime() - 86400000); if (isWorkingDay(d)) count++; }
  // 若 end 本身不是工作日，先回退到最近工作日
  while (!isWorkingDay(d)) d = new Date(d.getTime() - 86400000);
  return fmt(d);
}
export function prevWorkingDay(date: string): string {
  let d = new Date(parseDate(date).getTime() - 86400000);
  while (!isWorkingDay(d)) d = new Date(d.getTime() - 86400000);
  return fmt(d);
}

type StageTpl = { title: string; node: BidNode; role: string; days: number };
const STAGES: StageTpl[] = [
  { title: '商机判断：ATB 补齐与判断结论', node: 0, role: 'SLS', days: 3 },
  { title: '投标策略：三段填写与方向确认', node: 1, role: 'SLS', days: 2 },
  { title: '标书分解：解析与拆解确认', node: 2, role: 'PM', days: 3 },
  { title: '拆解确认与 BSD 审核', node: 2, role: 'PM', days: 2 },
  { title: '开工会：分工晾晒与卡点升级', node: 3, role: 'PM', days: 1 },
  { title: '首轮澄清跟进', node: 4, role: 'SC', days: 2 },
  { title: '投标文件制作：技术标与商务标', node: 5, role: 'SC', days: 5 },
  { title: '交标：凭证与保证金齐备', node: 6, role: 'SLS', days: 1 },
];

/** 生成阶段级计划草稿：最后一项（交标）止于截止日，逐项向前倒排。 */
export function buildPlanDraft(deadlineAt: string, roleToUser: Record<string, string | null>): PlanDraft {
  const deadline = dateOnly(deadlineAt);
  const items: PlanDraftItem[] = [];
  let end = deadline;
  for (let i = STAGES.length - 1; i >= 0; i--) {
    const s = STAGES[i];
    const start = backWorkingDays(end, s.days);
    items.unshift({
      id: `PLAN-${i + 1}`, title: s.title, node: s.node, assigneeRole: s.role,
      assigneeId: roleToUser[s.role] ?? null, start, end, durationDays: s.days,
      dependsOn: i > 0 ? [`PLAN-${i}`] : [],
    });
    end = prevWorkingDay(start);
  }
  return { items, generatedAt: new Date().toISOString(), source: 'ai-plan-draft', deadlineAt };
}

/**
 * 拖动改期后端校验（失败不落库）：
 * 1) 起止合法；2) 结束不得晚于交标截止日；3) 依赖：前置项结束不得晚于本项开始；
 * 4) 节点门禁：已完成节点的已完成条目不得改期（须先重新打开）。
 */
export function validateReschedule(
  item: { node: number; status: string; start: string; end: string },
  next: { start: string; end: string },
  deadlineAt: string,
  deps: { end: string }[],
  currentNode: number,
): { ok: boolean; reason: string } {
  if (next.start > next.end) return { ok: false, reason: '开始日期不得晚于结束日期' };
  if (next.end > dateOnly(deadlineAt)) return { ok: false, reason: '结束日期不得晚于交标截止日' };
  for (const d of deps) if (d.end > next.start) return { ok: false, reason: '改期后开始日期早于前置依赖结束日期' };
  if (item.status === 'done' && item.node < currentNode) return { ok: false, reason: '已完成节点的已完成条目不得改期，须先重新打开' };
  return { ok: true, reason: '' };
}
