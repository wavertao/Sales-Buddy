import {test,expect} from '@playwright/test';
import {businessDay} from '../../packages/workbench';
async function login(page:any,request:any){
 const session=await(await request.post('/api/mock-session',{data:{userId:'U-018'}})).json();
 const headers={Authorization:'Bearer '+session.token};
 await request.get('/api/home-workbench',{headers});
 await expect.poll(async()=>((await(await request.get('/api/workbench-generations',{headers})).json()).generation?.status)).not.toBe('running');
 await page.addInitScript((token:string)=>localStorage.setItem('sb-token',token),session.token);await page.goto('/home');
 await expect(page.getByRole('heading',{name:'小Cue',exact:true})).toBeVisible();await expect(page.locator('.magic-cue-card').first()).toBeVisible({timeout:30000});return headers;
}
test('PC八项Feed、反馈互斥、详情实体与双√完成/取消',async({page,request})=>{
 const headers=await login(page,request);expect(await page.locator('.magic-cue-card').count()).toBeLessThanOrEqual(8);
 await expect(page.locator('.cue-todos,.cue-schedule')).toHaveCount(0);
 const card=page.locator('.magic-cue-card').first(),title=await card.locator('.cue-title').innerText();
 await card.getByRole('button',{name:/点赞：/}).click();await expect(card.getByRole('button',{name:/点赞：/})).toHaveAttribute('aria-pressed','true');
 await card.getByRole('button',{name:/点踩：/}).click();await expect(card.getByRole('button',{name:/点赞：/})).toHaveAttribute('aria-pressed','false');
 await card.locator('.cue-title').click();const detail=page.getByRole('dialog',{name:'提醒详情'});await expect(detail).toContainText('信息来源');await expect(detail.locator('.cue-detail-description')).not.toBeEmpty();await expect(detail).toContainText('以上为AI建议，实际的推进方案需由您判断');await expect(detail).not.toContainText('为什么提醒我');await page.getByLabel('关闭提醒详情').click();
 await card.getByRole('button',{name:/标记完成：/}).click();await page.getByRole('tab',{name:'已完成',exact:true}).click();const done=page.locator('.magic-cue-card').filter({hasText:title});await done.getByRole('button',{name:/取消完成：/}).click();await page.getByRole('tab',{name:'进行中',exact:true}).click();await expect(page.locator('.magic-cue-card').filter({hasText:title})).toBeVisible();
 const other=await(await request.post('/api/mock-session',{data:{userId:'U-019'}})).json(),items=await(await request.get('/api/magic-cues',{headers})).json();expect((await request.patch('/api/magic-cues/'+items.records[0].id,{headers:{Authorization:'Bearer '+other.token},data:{status:'completed'}})).status()).toBe(403);
 await page.screenshot({path:'runtime/reports/screenshots/workbench-responsive-desktop.png',fullPage:true});
});
test('目标待办分组、新建、勾选同步日报、撤销与持久化',async({page,request})=>{
 const headers=await login(page,request);await page.getByRole('navigation',{name:'主导航',exact:true}).getByRole('button',{name:'目标',exact:true}).click();await expect(page.getByRole('heading',{name:'目标',exact:true})).toBeVisible();await expect(page.locator('.goal-statistics')).toContainText('今天到期');
 await page.getByRole('button',{name:'添加待办',exact:true}).click();const form=page.getByRole('form',{name:'添加待办'});await form.getByLabel('关联客户 / 项目').selectOption('OP-UK-026');const title='响应式待办验收 '+Date.now();await form.getByLabel('标题',{exact:true}).fill(title);await form.getByLabel('描述',{exact:true}).fill('核实交付范围并记录客户反馈');await form.getByLabel('截止时间（北京时间）').fill('1999-01-01T11:00');await form.getByLabel('优先级').selectOption('P1');await form.getByRole('button',{name:'确认创建',exact:true}).click();await expect(form).toHaveCount(0);
 await page.getByLabel('完成待办：'+title,{exact:true}).click();await expect(page.getByRole('status').filter({hasText:'已同步今日日报'})).toBeVisible();await page.getByRole('button',{name:'今日日报 · 完成记录'}).click();await expect(page.getByRole('region',{name:'今日日报'})).toContainText(title);
 await page.getByLabel('恢复待办：'+title,{exact:true}).click();await expect(page.getByLabel('完成待办：'+title,{exact:true})).toBeVisible();await expect(page.getByRole('region',{name:'今日日报'})).toContainText('已取消完成');
 await page.reload();await expect(page.getByRole('heading',{name:'目标',exact:true})).toBeVisible();const rows=await(await request.get('/api/my-goals/tasks?group=overdue',{headers})).json();expect(rows.groups[0].records.find((t:any)=>t.name===title).status).toBe('pending');
});
test('卡片直接启动正确项目会话，重复请求复用且保留系统来源',async({page,request})=>{
 const headers=await login(page,request),items=await(await request.get('/api/magic-cues',{headers})).json(),cue=items.records[0];
 const [a,b]=await Promise.all([request.post('/api/magic-cues/'+cue.id+'/conversation',{headers,data:{}}),request.post('/api/magic-cues/'+cue.id+'/conversation',{headers,data:{}})]);const first=await a.json(),second=await b.json();expect(first.conversation.id).toBe(second.conversation.id);expect(first.run.id).toBe(second.run.id);
 await page.locator('.magic-cue-card').first().getByRole('button',{name:'发起会话',exact:true}).click();await expect(page.getByLabel('发送问题')).toBeVisible();await expect.poll(async()=>{const c=await(await request.get('/api/conversations/'+first.conversation.id,{headers})).json();return c.runs.find((r:any)=>r.id===first.run.id)?.status;},{timeout:30000}).toBe('completed');const c=await(await request.get('/api/conversations/'+first.conversation.id,{headers})).json();expect(c.messages.find((m:any)=>m.role==='user').origin).toBe('system');expect(c.scope.objectId).toBe(cue.scope.objectId);
});
test('目标日程保留日期与真实实体，移除会前讨论及会晤材料入口',async({page,request})=>{
 const headers=await login(page,request),activities=await(await request.get('/api/crm/activity',{headers})).json(),activity=activities.records.find((a:any)=>a.createdBy==='U-018');
 await page.getByRole('navigation',{name:'主导航',exact:true}).getByRole('button',{name:'目标',exact:true}).click();await page.getByRole('tab',{name:'日程',exact:true}).click();await page.getByLabel('选择日程日期').fill(businessDay(activity.scheduledAt));await expect(page.locator('.cue-agenda article').first()).toBeVisible();await expect(page.getByRole('button',{name:'会前讨论',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'会晤材料',exact:true})).toHaveCount(0);await page.locator('.cue-agenda article').first().locator('.cue-title').click();await expect(page.getByRole('dialog',{name:'商务活动详情'})).toBeVisible();await page.getByLabel('关闭实体详情').click();await page.getByLabel('选择日程日期').fill('2099-01-01');await expect(page.locator('.goal-schedule')).toContainText('暂无商务活动');
});
test('F12切换移动尺寸隐藏PC导航，五项底栏与目标切换无横向溢出',async({page,request})=>{
 await login(page,request);await page.setViewportSize({width:390,height:844});const nav=page.getByRole('navigation',{name:'移动端主导航'});await expect(page.locator('.sidebar')).toBeHidden();await expect(page.locator('.topbar')).toBeHidden();await expect(nav).toBeVisible();await expect(nav.getByRole('button')).toHaveText(['对话','客户经营','小Cue','目标','工具箱']);
 await expect(page.getByRole('button',{name:'赢单领航员',exact:true})).toBeHidden();const cardWidth=(await page.locator('.magic-cue-card').first().boundingBox())!.width,briefWidth=(await page.locator('.cue-brief').boundingBox())!.width;expect(Math.abs(cardWidth-briefWidth)).toBeLessThan(2);expect((await page.locator('.magic-controls button').first().boundingBox())!.width).toBeLessThanOrEqual(30);
 for(const width of [320,390,430,768]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'runtime/reports/screenshots/workbench-responsive-mobile.png',fullPage:true});
 await nav.getByRole('button',{name:'目标',exact:true}).click();await expect(page.getByRole('tab',{name:'待办',exact:true})).toBeVisible();await page.getByRole('tab',{name:'日程',exact:true}).click();await expect(page.getByLabel('选择日程日期')).toBeVisible();await expect(page.getByRole('button',{name:'会前讨论'})).toHaveCount(0);
 await nav.getByRole('button',{name:'客户经营',exact:true}).click();await expect(page.locator('.customer-operations')).toBeVisible();await nav.getByRole('button',{name:'对话',exact:true}).click();await expect(page.getByLabel('普通对话输入')).toBeVisible();await nav.getByRole('button',{name:'工具箱',exact:true}).click();await expect(page.getByRole('heading',{name:'工具箱',exact:true})).toBeVisible();
 await nav.getByRole('button',{name:'目标',exact:true}).click();await page.getByRole('tab',{name:'待办',exact:true}).click();await page.getByRole('button',{name:'添加待办',exact:true}).click();await expect(page.getByRole('form',{name:'添加待办'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.getByLabel('关闭添加待办').click();
 await page.setViewportSize({width:1440,height:1000});await expect(nav).toBeHidden();await expect(page.locator('.sidebar')).toBeVisible();
});
test('补录失败保留文字，手动草稿须确认后创建',async({page,request})=>{
 await login(page,request);await page.getByRole('navigation',{name:'主导航',exact:true}).getByRole('button',{name:'目标',exact:true}).click();
 await page.getByLabel('补录待办',{exact:true}).fill('明天联系客户确认报价');await page.getByRole('button',{name:'整理待办草稿',exact:true}).click();await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByLabel('补录待办',{exact:true})).toHaveValue('明天联系客户确认报价');await page.getByRole('button',{name:'使用当前文字手动填写'}).click();const form=page.getByRole('form',{name:'添加待办'});await expect(form.getByLabel('标题',{exact:true})).toHaveValue('明天联系客户确认报价');await expect(form.getByLabel('关联客户 / 项目')).toHaveValue('');await page.getByLabel('关闭添加待办').click();
});
