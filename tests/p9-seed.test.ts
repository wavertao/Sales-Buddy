import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadP9Seed, p9SeedCounts, P9_DEMO_CLOCK } from '../apps/server/src/p9/seed-data.ts';

const seed = loadP9Seed();
const counts = p9SeedCounts(seed);

test('P9-SEED-01 主标口径：宁德时代 R2、200MW/400MWh、交标 2026-11-05 14:00', () => {
  assert.equal(seed.bid.id, 'BID-20261010-003');
  assert.equal(seed.bid.capacity, '200 MW / 400 MWh');
  assert.equal(seed.bid.submissionDeadline, '2026-11-05T14:00:00+08:00');
  assert.equal(seed.bid.currentRound, 'R2');
  assert.equal(seed.bid.deposit.guaranteeNo, 'BZ-2026-0193');
});

test('P9-SEED-02 ATB 43 项、21 已填、22 缺口（由条目算出）', () => {
  assert.equal(counts.atbTotal, 43);
  assert.equal(counts.atbFilled, 21);
  assert.equal(counts.atbGap, 22);
});

test('P9-SEED-03 健康度 68/安全线 80、演示时钟固定 2026-10-24', () => {
  assert.equal(seed.bid.health.score, 68);
  assert.equal(seed.bid.health.safetyLine, 80);
  assert.equal(seed.bid.demoClock, P9_DEMO_CLOCK);
  assert.equal(P9_DEMO_CLOCK, '2026-10-24');
});

test('P9-SEED-04 列表 6 行 + 同商机 3 行', () => {
  assert.equal(seed.bids.list.rows.length, 6);
  assert.equal(seed.bids.sameOpportunity.length, 3);
  assert.ok(seed.bids.list.rows.some((r: any) => r.id === 'BID-20261010-003'));
});

test('P9-SEED-05 分解条目 34 条、已完成 6、未派 6（由条目算出）', () => {
  assert.equal(counts.planTotal, 34);
  assert.equal(counts.planCompleted, 6);
  assert.equal(counts.planUnassigned, 6);
});

test('P9-SEED-06 待办 12 条、逾期 2 条（演示时钟计）、澄清 8 条未闭环 3 条', () => {
  assert.equal(counts.todosTotal, 12);
  assert.equal(counts.todosOverdue, 2);
  assert.equal(counts.clarificationsTotal, 8);
  assert.equal(counts.clarificationsPending, 3);
});

test('P9-SEED-07 会议 6 场、文件 18 个、开放卡点 3 个', () => {
  assert.equal(counts.meetingsTotal, 6);
  assert.equal(counts.filesTotal, 18);
  assert.equal(counts.blockersOpen, 3);
});

test('P9-SEED-08 BAFO R1→R2→R3 与字段差异 4 处（只做旧值→新值）', () => {
  assert.deepEqual(seed.bafo.rounds.map((r: any) => r.round), ['R1', 'R2', 'R3']);
  assert.equal(seed.bafo.fieldDiffsR1ToR2.length, 4);
  const pay = seed.bafo.fieldDiffsR1ToR2.find((d: any) => d.field === '付款节点');
  assert.equal(pay.old, '3-4-3');
  assert.equal(pay.new, '3-3-4');
});

test('P9-SEED-09 复盘结论：高出中标方 6.2%、技术分差 6 分', () => {
  assert.ok(String(seed.review.conclusion).includes('6.2%'));
  assert.ok(String(seed.review.conclusion).includes('6分'));
  assert.equal(seed.review.lessons.length, 3);
});

test('P9-SEED-10 种子不含报价建议类输出值（无让价区间、无金额字段差异）', () => {
  // 注意：种子里“不在输出范围内”这类边界声明文案本身不是报价建议；
  // 本条验的是生成值：策略方向与 BAFO 差异里不得出现让价区间与金额字段。
  const directionText = JSON.stringify(seed.strategyVersions.versions.map((v: any) => v.direction));
  assert.ok(!directionText.includes('6-8%'));
  assert.ok(seed.bafo.fieldDiffsR1ToR2.every((d: any) => !['报价金额', '金额', '单价', '总价'].includes(d.field)));
  assert.ok(!JSON.stringify(seed.bafo.fieldDiffsR1ToR2).includes('元'));
});
