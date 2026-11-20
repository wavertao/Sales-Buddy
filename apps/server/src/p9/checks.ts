import type { BidTask, ChecklistItem, Clarification, CustomerRequirement } from '../../../../packages/contracts/p9.ts';

/**
 * 自研检查引擎：ChecklistItem（实例）+ CHECKLIST_TEMPLATES（模板）分离，
 * 提交门禁由状态机守卫 + submit-review / submit 两处共同执行。
 * 四源：待办 / 澄清 / checklist / 客户要求。自动检查只出结论，人工复查才放行。
 */
export type CheckSourceResult = {
  source: 'todos' | 'clarifications' | 'checklist' | 'customer_requirements';
  label: string; total: number; open: number; status: 'ok' | 'blocked' | 'pending';
  items: { id: string; title: string; detail: string }[];
};
export type CheckReport = {
  sources: CheckSourceResult[]; passed: boolean; gaps: string[];
  risk: 'low' | 'medium' | 'high'; summary: string; checkedAt: string;
};

export function hoursOverdue(dueAt: string | null | undefined, today: string): number {
  if (!dueAt) return 0;
  const due = new Date(dueAt.length === 10 ? dueAt + 'T23:59:59+08:00' : dueAt).getTime();
  const nowMs = new Date(today.length === 10 ? today + 'T09:00:00+08:00' : today).getTime();
  return Math.max(0, Math.floor((nowMs - due) / 3600000));
}
/** 逾期升级规则（确定性）：逾期 >72h 自动进 BPM；>24h 待升 L3；>0 已升 L2；24h 内到期提醒。 */
export function escalationFor(task: BidTask, today: string): string | null {
  if (task.status === 'done' || task.status === 'cancelled') return null;
  const h = hoursOverdue(task.dueAt, today);
  if (h > 72) return 'BPM';
  if (h > 24) return 'L3';
  if (h > 0) return 'L2';
  return null;
}
export function isOverdue(task: BidTask, today: string): boolean {
  return task.status !== 'done' && task.status !== 'cancelled' && hoursOverdue(task.dueAt, today) > 0;
}

export function runChecks(
  tasks: BidTask[], clarifications: Clarification[], checklist: ChecklistItem[],
  requirements: CustomerRequirement[], today: string,
): CheckReport {
  const openTasks = tasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled');
  const overdue = tasks.filter((t) => isOverdue(t, today));
  const unclosedClars = clarifications.filter((c) => c.status !== 'closed');
  const staleClars = clarifications.filter((c) => c.status !== 'closed' && c.dueAt && hoursOverdue(c.dueAt, today) >= 48);
  const missingChecks = checklist.filter((c) => c.status !== 'done');
  const requiredMissing = missingChecks.filter((c) => c.required);
  const deviated = requirements.filter((r) => r.status === 'deviation');
  const pendingReq = requirements.filter((r) => r.status === 'pending');
  const sources: CheckSourceResult[] = [
    { source: 'todos', label: '待办闭环', total: tasks.length, open: openTasks.length,
      status: openTasks.length ? 'blocked' : 'ok',
      items: openTasks.map((t) => ({ id: t.id, title: t.title, detail: isOverdue(t, today) ? `逾期 ${hoursOverdue(t.dueAt, today)}h` : '未完成' })) },
    { source: 'clarifications', label: '澄清答复', total: clarifications.length, open: unclosedClars.length,
      status: staleClars.length ? 'blocked' : unclosedClars.length ? 'pending' : 'ok',
      items: unclosedClars.map((c) => ({ id: c.id, title: c.question, detail: c.status })) },
    { source: 'checklist', label: 'checklist', total: checklist.length, open: missingChecks.length,
      status: requiredMissing.length ? 'blocked' : missingChecks.length ? 'pending' : 'ok',
      items: missingChecks.map((c) => ({ id: c.id, title: c.title, detail: c.required ? '必填未完成' : '未完成' })) },
    { source: 'customer_requirements', label: '客户要求', total: requirements.length, open: deviated.length + pendingReq.length,
      status: deviated.length ? 'blocked' : pendingReq.length ? 'pending' : 'ok',
      items: [...deviated.map((r) => ({ id: r.id, title: r.requirement, detail: '与客户要求偏差' })),
        ...pendingReq.map((r) => ({ id: r.id, title: r.requirement, detail: '待检查' }))] },
  ];
  const blocked = sources.filter((s) => s.status === 'blocked');
  const passed = blocked.length === 0 && openTasks.length === 0 && requiredMissing.length === 0 && deviated.length === 0;
  const gaps = [
    ...openTasks.map((t) => `待办未闭环：${t.title}`),
    ...staleClars.map((c) => `澄清超 48h 未回：${c.question}`),
    ...requiredMissing.map((c) => `checklist 必填未完成：${c.title}`),
    ...deviated.map((r) => `客户要求偏差：${r.requirement}`),
  ];
  const risk = blocked.length >= 2 || overdue.length >= 2 ? 'high' : blocked.length === 1 || gaps.length > 0 ? 'medium' : 'low';
  return {
    sources, passed, gaps,
    risk,
    summary: passed ? '四源检查全部通过，可进入人工复查' : `四源检查发现 ${gaps.length} 处缺口，须先闭环再交标`,
    checkedAt: new Date().toISOString(),
  };
}

/** 健康度（计算值，非原型 Mock 抄数）：100 起扣，逾期/未派/未闭环澄清/必填缺口逐项扣分，下限 0。 */
export function computeHealth(
  tasks: BidTask[], clarifications: Clarification[], checklist: ChecklistItem[], today: string,
): { score: number; safeLine: number; status: string; dimensions: Record<string, number>; blockers: { id: string; title: string; level: string; detail: string }[] } {
  const overdue = tasks.filter((t) => isOverdue(t, today));
  const unassigned = tasks.filter((t) => !t.assigneeId && t.status !== 'done' && t.status !== 'cancelled');
  const unclosed = clarifications.filter((c) => c.status !== 'closed');
  const missingReq = checklist.filter((c) => c.required && c.status !== 'done');
  const score = Math.max(0, 100 - overdue.length * 8 - unassigned.length * 5 - unclosed.length * 3 - missingReq.length * 4);
  const blockers = [
    ...overdue.map((t) => ({ id: t.id, title: `逾期任务：${t.title}`, level: 'high', detail: `逾期 ${hoursOverdue(t.dueAt, today)}h` })),
    ...unassigned.map((t) => ({ id: t.id, title: `未派责任人：${t.title}`, level: 'high', detail: '无负责人' })),
    ...missingReq.map((c) => ({ id: c.id, title: `必填 checklist 缺口：${c.title}`, level: 'medium', detail: '必填未完成' })),
  ];
  const doneRatio = tasks.length ? tasks.filter((t) => t.status === 'done').length / tasks.length : 1;
  return {
    score, safeLine: 80, status: score >= 80 ? '健康' : '需关注',
    dimensions: {
      进度排期: Math.max(0, Math.round(100 - overdue.length * 10)),
      商务部分: 76, 技术部分: Math.max(0, 100 - missingReq.length * 9),
      报价文件: 64, 偏差管理: Math.max(0, 100 - unclosed.length * 8),
      澄清响应: Math.max(0, 100 - unclosed.length * 10),
      任务完成率: Math.round(doneRatio * 100),
    },
    blockers,
  };
}
