import { test, expect } from '@playwright/test';

// P9 投标全流程集成旅程：真实后端（种子主标 BID-20261010-003）+ 前端 23 屏工作区。
// 覆盖：列表 → 驾驶舱 → 计划 → 待办完成（真实接口落库）→ BAFO 报价锁定占位 → 移动端 390。
test('P9 投标全流程：列表→驾驶舱→计划→待办完成→BAFO 锁定占位→移动端', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: /张小小/ }).click();
  await expect(page.getByRole('heading', { name: '搜索你的客户 / 项目' })).toBeVisible();
  // 真实接口与种子对齐：列表含主标（非演示数据）。
  const token = await page.evaluate(() => localStorage.getItem('sb-token'));
  const res = await page.request.get('/api/bids', { headers: { Authorization: 'Bearer ' + token } });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  const records = body.records ?? [];
  expect(records.some((b: any) => (b.number ?? b.id) === 'BID-20261010-003')).toBeTruthy();
  // UI：进投标工作区，点主标行进驾驶舱。
  await page.getByRole('button', { name: '投标全流程' }).click();
  await expect(page.getByText('BID-20261010-003').first()).toBeVisible();
  await page.locator('tr', { hasText: 'BID-20261010-003' }).first().click();
  await expect(page.getByText('AI 投标驾驶舱')).toBeVisible();
  await expect(page.getByText('投标助理').first()).toBeVisible();
  // 计划屏：前端演示计划行 p1 在真实模式下与后端记录对齐。
  await page.getByRole('button', { name: '计划', exact: true }).click();
  await expect(page.getByText('4.1 技术规格书', { exact: true })).toBeVisible();
  // 待办屏：完成 t2（进行中 → 已完成），走真实完成接口。
  await page.getByRole('button', { name: '待办与澄清', exact: true }).click();
  const t2row = page.locator('tr', { hasText: '指派 2 条拆解条目的责任人' });
  await expect(t2row).toBeVisible();
  // 注意：该 checkbox 为受控组件（checked 取决于待办状态），check() 会因点后仍未勾选而超时；
  // 这里只需 click 触发 onChange 打开完成弹层，完成后再断言勾选。
  await t2row.locator('input[type="checkbox"]').click();
  await page.getByRole('button', { name: '确认完成' }).click();
  // 完成后停留在待办详情屏（表行被详情替代）：以详情屏的“已完成”状态为准。
  await expect(page.getByRole('button', { name: '← 待办与澄清' })).toBeVisible();
  // 详情屏仅在状态为已完成时渲染“完成结果”块，以此为准。
  await expect(page.getByText('完成结果')).toBeVisible();
  // BAFO 屏：普通销售角色看到锁定占位，不展示金额。
  await page.getByRole('button', { name: 'BAFO 对比', exact: true }).click();
  await expect(page.getByText('报价内容仅 admin 与投标 pricingTeam 成员可见')).toBeVisible();
  // 移动端 390：回列表后进移动端视图。
  await page.getByRole('button', { name: '← 回投标列表' }).click();
  await page.getByRole('button', { name: /移动端 390/ }).click();
  await expect(page.getByRole('button', { name: '← 回 PC 列表' })).toBeVisible();
  expect(errors).toEqual([]);
});
