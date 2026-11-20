import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mockLabel, mockPlan, mockDecompose, mockDispatch, mockCheck, mockStrategyRegenerate,
  nextPipelineState, P9_PIPELINE_STATES,
} from '../apps/server/src/p9/mock-ai.ts';
import { loadP9Seed } from '../apps/server/src/p9/seed-data.ts';

const seed = loadP9Seed();

test('P9-PIPE-01 流水线全链路转移：idle→…→submitted', () => {
  let state: any = 'idle';
  const seen: string[] = [state];
  for (let i = 0; i < 8; i++) { state = nextPipelineState(state, 'advance').state; seen.push(state); }
  assert.deepEqual(seen, [...P9_PIPELINE_STATES]);
  assert.equal(state, 'submitted');
});

test('P9-PIPE-02 检查不通过回 executing；其他态的 check_failed 不是合法转移', () => {
  assert.equal(nextPipelineState('checking', 'check_failed').state, 'executing');
  assert.equal(nextPipelineState('executing', 'check_failed').state, 'executing');
  assert.equal(nextPipelineState('review', 'check_failed').state, 'review');
});

test('P9-PIPE-03 暂停与恢复：暂停态不推进，恢复后回原态', () => {
  const paused = nextPipelineState('executing', 'pause');
  assert.equal(paused.paused, true);
  assert.equal(nextPipelineState('executing', 'advance', true).state, 'executing');
  assert.equal(nextPipelineState('executing', 'resume', true).paused, false);
});

test('P9-PIPE-04 mockPlan 以交标截止日为锚点倒排、覆盖节点 0–9', () => {
  const plan = mockPlan({ deadline: '2026-11-05T14:00:00+08:00', nodes: [0, 1, 2, 3, 4, 5, 6] });
  assert.equal(plan.state, 'plan_draft');
  assert.equal(plan.mock, mockLabel());
  assert.ok(plan.items.every((i) => i.due <= '2026-11-05'));
  const full = mockPlan({ nodes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] });
  assert.equal(full.items.length, 10);
});

test('P9-PIPE-05 mockDecompose 输出分解条目并给出计划更新（新增/调整数）', () => {
  const plan = mockPlan({});
  const parsed: any = { items: seed.planItems.items.slice(0, 5).map((i: any) => ({ title: i.title, sourceClause: i.sourceClause, chapter: '第四章' })) };
  const r = mockDecompose({ parsed, planDraft: plan });
  assert.equal(r.items.length, 5);
  assert.equal(r.planUpdates.added, 5);
  assert.ok(r.planUpdates.note.includes('不覆盖'));
});

test('P9-PIPE-06 mockDispatch：计划→任务/待办数量与负责人', () => {
  const plan = mockPlan({});
  const dispatched = mockDispatch({ planItems: plan.items.map((i) => ({ ...i, owner: i.owner })) });
  assert.equal(dispatched.state, 'dispatched');
  assert.equal(dispatched.taskCount, plan.items.length);
  assert.equal(dispatched.todoCount, dispatched.tasks.filter((t) => t.owner).length);
  assert.ok(dispatched.todos.every((t) => t.assignee && t.due));
});

test('P9-PIPE-07 mockDispatch 提醒：逾期超 72h 进 BPM、逾期进 L2/L3 线', () => {
  const dispatched = mockDispatch({
    clockDate: '2026-10-24',
    planItems: [
      { title: '超72h任务', owner: '张伟', due: '2026-10-20', node: 2 },
      { title: '逾期任务', owner: '陈磊', due: '2026-10-22', node: 2 },
      { title: '未派任务', owner: null, due: '2026-10-26', node: 2 },
    ],
  });
  assert.ok(dispatched.reminders.some((r) => r.kind.includes('BPM')));
  assert.ok(dispatched.reminders.some((r) => r.kind.includes('逾期提醒')));
  assert.ok(dispatched.reminders.some((r) => r.kind.includes('未派责任人')));
});

test('P9-PIPE-08 mockCheck 通过进 review、不通过回 executing 且带缺口任务', () => {
  const pass = mockCheck({ todosOpen: 0, clarificationsOverdue48h: 0, checklistMissing: [], customerDeviations: [] });
  assert.equal(pass.nextState, 'review');
  assert.deepEqual(pass.gapTasks, []);
  const fail = mockCheck({ todosOpen: 1, clarificationsOverdue48h: 1, checklistMissing: ['UL9540A报告'], customerDeviations: ['付款偏差'] });
  assert.equal(fail.nextState, 'executing');
  assert.equal(nextPipelineState('checking', 'check_failed').state, fail.nextState);
  assert.ok(fail.gapTasks.length >= 4);
});

test('P9-PIPE-09 策略版本递增：v1→v2，含变更说明与 BAFO 轮次关联', () => {
  const v2 = mockStrategyRegenerate({
    previousVersion: 1, previousDirection: seed.strategyVersions.versions[0].direction,
    trigger: 'BAFO R2口径变化', linkedBafoRound: 'R2',
    directionUpdate: { 主打点: 'R2口径锁定：技术标与商务标同写质保10年可选项' },
  });
  assert.equal(v2.version, 2);
  assert.equal(v2.linkedBafoRound, 'R2');
  assert.equal(v2.status, '待确认');
  assert.ok(v2.changes.length >= 1);
  assert.ok(!JSON.stringify(v2).includes('让价'));
  // 种子内的策略版本历史本身也满足 v1→v2 递增
  const versions = seed.strategyVersions.versions.map((v: any) => v.version);
  assert.deepEqual(versions, [1, 2]);
});

test('P9-PIPE-10 种子流水线示例覆盖全部 9 态 + 暂停示例', () => {
  assert.deepEqual(seed.pipelineExamples.states, [...P9_PIPELINE_STATES]);
  assert.ok(seed.pipelineExamples.examples.some((e: any) => e.paused === true));
  assert.ok(seed.reminders.reminders.some((r: any) => r.kind.includes('BPM')));
});
