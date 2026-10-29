import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mockLabel, mockParseBidDocument, mockStrategyDirection, mockSuggestDecomposition,
  mockSubmissionCheck, mockIdentifyBlockers, mockAssistantReply, quoteLockedPlaceholder,
} from '../apps/server/src/p9/mock-ai.ts';

test('P9-MOCK-01 Mock 输出全部标注演示 Mock', () => {
  assert.ok(mockLabel().includes('演示 Mock'));
  const parsed = mockParseBidDocument({ name: '招标文件.pdf', pages: 42, chapters: [{ name: '第四章', clauses: ['4.1', '4.2'] }] });
  assert.equal(parsed.mock, mockLabel());
  assert.equal(parsed.candidateCount, 2);
});

test('P9-MOCK-02 标书解析按种子文档结构化输出（章节→条目）', () => {
  const r = mockParseBidDocument({
    name: 'XX储能项目招标文件.pdf', pages: 42,
    chapters: [
      { name: '第一章 招标公告', clauses: ['1.1', '1.2'] },
      { name: '第四章 技术要求', clauses: ['4.1', '4.2', '4.3'] },
    ],
  });
  assert.equal(r.candidateCount, 5);
  assert.ok(r.items.every((i) => i.chapter && i.sourceClause));
});

test('P9-MOCK-03 策略方向三段输入→方向模板，且不含报价姿态/区间', () => {
  const r = mockStrategyDirection({ scope: 'DC Block直采', customer: '技术中心→采购→投决', competition: '阳光电源/比亚迪' });
  assert.ok(r.主打点 && r.避让点);
  assert.ok(!JSON.stringify(r).includes('6-8%'));
  assert.ok(JSON.stringify(r).includes('报价管理部门'));
  assert.throws(() => mockStrategyDirection({ scope: '', customer: 'x', competition: 'y' }), /incomplete/);
});

test('P9-MOCK-04 拆解建议为草稿态、不影响已派发条目', () => {
  const r = mockSuggestDecomposition(['技术', '商务']);
  assert.equal(r.suggestions.length, 2);
  assert.ok(r.note.includes('草稿态'));
});

test('P9-MOCK-05 交标体检四源：通过一路与不通过一路', () => {
  const pass = mockSubmissionCheck({ todosTotal: 12, todosOpen: 0, clarificationsOverdue48h: 0, checklistMissing: [], customerDeviations: [] });
  assert.equal(pass.passed, true);
  assert.equal(pass.sources.length, 4);
  assert.equal(pass.reviewer, '王强（技术负责人）· 待签字');
  const fail = mockSubmissionCheck({ todosTotal: 12, todosOpen: 2, clarificationsOverdue48h: 3, checklistMissing: ['UL9540A报告'], customerDeviations: ['付款节点3-3-4与客户要求3-4-3偏差'] });
  assert.equal(fail.passed, false);
  assert.ok(fail.gapTasks.length >= 4);
  assert.ok(fail.gapTasks.some((t) => t.title.includes('UL9540A')));
});

test('P9-MOCK-06 卡点识别四类信号规则全覆盖', () => {
  const r = mockIdentifyBlockers([
    { title: '消防认证', owner: null, due: '2026-10-26', status: 'blocked' },
    { title: '技术评审', owner: '陈磊', due: '2026-10-26', status: 'pending', preconditionMissing: true },
    { title: '逾期任务', owner: '张伟', due: '2026-10-21', status: 'pending' },
    { title: '排期冲突任务', owner: '王强', due: '2026-10-27', status: 'pending', dependsOn: ['A', 'B'] },
  ]);
  const signals = new Set(r.blockers.map((b) => b.signal));
  assert.ok(signals.has('未派责任人') && signals.has('缺前置条件') && signals.has('逾期') && signals.has('排期冲突'));
});

test('P9-MOCK-07 助理脚本回复按种子知识、不编造标外数据', () => {
  const ctx = { health: 68, nodeDisplay: '节点 ③ 标书分解', blockersOpen: 3, todosOverdue: 2, deadline: '2026-11-05 14:00' };
  const r = mockAssistantReply('这个标的风险？', ctx);
  assert.ok(r.answer.includes('68'));
  assert.ok(r.answer.includes('3'));
  assert.equal(r.mock, mockLabel());
  const urge = mockAssistantReply('催一下报价过会', ctx);
  assert.ok(urge.answer.includes('L2'));
});

test('P9-MOCK-08 报价字段锁定占位不含金额', () => {
  const p = quoteLockedPlaceholder();
  assert.equal(p.visible, false);
  assert.equal(p.display, '已报价');
});
