import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateBidNumber, displayNode, nodeGate, canAdvanceNode, backwardSchedule,
  daysUntilSubmission, canViewQuote, bafoFieldDiff,
} from '../apps/server/src/p9/mock-ai.ts';

test('P9-RULE-01 编号规则 BID-{YYYYMMDD}-{NNN}、当日递增、作废不回收由调用方保证', () => {
  assert.equal(generateBidNumber('2026-10-10', 3), 'BID-20261010-003');
  assert.equal(generateBidNumber('2026-10-10', 26), 'BID-20261010-026');
  assert.throws(() => generateBidNumber('2026-10-10', 0), /1\.\.999/);
  assert.throws(() => generateBidNumber('2026/10/10', 1), /invalid/);
});

test('P9-RULE-02 状态机：内部 0–9，显示 = 内部 +1；只能顺序推进', () => {
  assert.equal(displayNode(2), '节点 ③ 标书分解');
  assert.equal(displayNode(0), '节点 ① 商机判断');
  assert.equal(canAdvanceNode(2, 3), true);
  assert.equal(canAdvanceNode(2, 4), false);
  assert.equal(canAdvanceNode(2, 2), false);
  assert.equal(canAdvanceNode(9, 10), false);
});

test('P9-RULE-03 状态机门禁：策略未采用不可进标书分解；复查未签字不可定标', () => {
  assert.equal(nodeGate(2, { strategyAdopted: false }).allowed, false);
  assert.equal(nodeGate(2, { strategyAdopted: true }).allowed, true);
  assert.equal(nodeGate(9, { reviewSigned: false }).allowed, false);
  assert.equal(nodeGate(0, {}).allowed, true);
  // 澄清并行不阻塞主链：节点 7/8 始终可进
  assert.equal(nodeGate(7, {}).allowed, true);
  assert.equal(nodeGate(8, {}).allowed, true);
});

test('P9-RULE-04 检查引擎门禁：四源任一未闭环即不通过（见 p9-mock-ai P9-MOCK-05）', () => {
  // 本条只验门禁语义的纯函数部分：交标节点门禁依赖 submissionReady
  assert.equal(nodeGate(6, { submissionReady: false }).allowed, false);
  assert.equal(nodeGate(6, { submissionReady: true }).allowed, true);
});

test('P9-RULE-05 报价 gating：仅 admin 与 pricingTeam 可见金额，其余锁定占位', () => {
  assert.equal(canViewQuote('admin', false), true);
  assert.equal(canViewQuote('sales', true), true);
  assert.equal(canViewQuote('sales', false), false);
  assert.equal(canViewQuote('sc', false), false);
});

test('P9-RULE-06 BAFO 差异：只列差异项，相同字段不展示；价格字段锁定不返回值', () => {
  const r = bafoFieldDiff(
    { 质保年限: '5年', 付款节点: '3-4-3', 报价金额: '100', 备件范围: '不含备件' },
    { 质保年限: '10年', 付款节点: '3-3-4', 报价金额: '95', 备件范围: '不含备件' },
  );
  assert.equal(r.diffCount, 3);
  assert.ok(r.diffs.some((d) => d.field === '质保年限' && d.old === '5年' && d.new === '10年'));
  assert.ok(!r.diffs.some((d) => d.field === '备件范围'));
  const locked = r.diffs.find((d) => d.field === '报价金额');
  assert.equal(locked?.locked, true);
  assert.equal(locked?.new, null);
});

test('P9-RULE-07 倒排计算：演示时钟 2026-10-24 距交标 12 天；倒排锚点为交标日', () => {
  assert.equal(daysUntilSubmission(), 12);
  assert.equal(backwardSchedule('2026-11-05T14:00:00+08:00', 12), '2026-10-24');
  assert.equal(backwardSchedule('2026-11-05T14:00:00+08:00', 0), '2026-11-05');
});
