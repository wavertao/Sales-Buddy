import { test, expect } from '@playwright/test';

// P9 投标全流程集成旅程：真实后端（种子主标 BID-20261010-003）+ 按设计稿重写的前端。
// 覆盖：列表 → 驾驶舱 → 计划 → 待办完成（真实接口落库）→ BAFO 报价权限占位 → 移动端 390。
test('P9 投标全流程：列表→驾驶舱→计划→待办完成→BAFO 权限→移动端', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: /张小小/ }).click();
  await expect(page.getByRole('heading', { name: '搜索你的客户 / 项目' })).toBeVisible();
  const token = await page.evaluate(() => localStorage.getItem('sb-token'));
  const res = await page.request.get('/api/bids', { headers: { Authorization: 'Bearer ' + token } });
  expect(res.ok()).toBeTruthy();
  const records = (await res.json()).records ?? [];
  expect(records.some((b: any) => (b.number ?? b.id) === 'BID-20261010-003')).toBeTruthy();

  // 列表 → 主标驾驶舱
  await page.getByRole('button', { name: '投标全流程' }).click();
  await page.getByRole('button', { name: /BID-20261010-003/ }).first().click();
  await expect(page.getByText('AI 投标驾驶舱')).toBeVisible();
  await expect(page.getByText('投标助理').first()).toBeVisible();

  // 计划：条目级甘特
  await page.getByRole('tab', { name: '计划', exact: true }).click();
  await expect(page.getByText('4.1 技术规格书', { exact: true })).toBeVisible();

  // 待办：勾选 → 完成弹层 → 确认后进入详情（真实完成接口）
  await page.getByRole('tab', { name: '待办与澄清', exact: true }).click();
  await page.getByRole('checkbox', { name: '指派 2 条拆解条目的责任人', checked: false }).first().click();
  await page.getByPlaceholder('写一句完成情况…').fill('已指派：4.3 消防认证 → 陈磊；付款节点审查 → 王芳。');
  await page.getByRole('button', { name: '确认完成' }).click();
  await expect(page.getByText('评论与动态', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: '重新打开' })).toBeVisible();

  // BAFO：普通销售角色只看到「已报价」状态
  await page.getByRole('tab', { name: 'BAFO 对比', exact: true }).click();
  await expect(page.getByText('报价内容仅 admin 与投标 pricingTeam 成员可见')).toBeVisible();

  // 移动端 390
  await page.getByRole('button', { name: '返回投标列表' }).click();
  await page.getByRole('button', { name: '移动端' }).click();
  await expect(page.getByRole('button', { name: '回 PC 列表' })).toBeVisible();
  expect(errors).toEqual([]);
});
