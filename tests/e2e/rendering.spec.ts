import {test,expect} from '@playwright/test';
async function openCustomer(page:any,request:any,recent?:any){const login=await(await request.post('/api/mock-session',{data:{userId:'U-018'}})).json(),headers={Authorization:'Bearer '+login.token};let c=recent;if(!c){c=await(await request.post('/api/conversations',{headers,data:{scope:{objectType:'customer',objectId:'C-UK-0086',customerId:'C-UK-0086'}}})).json();await request.post('/api/conversations/'+c.id+'/messages',{headers,data:{question:'分析客户当前现状'}});await expect.poll(async()=>{const data=await(await request.get('/api/conversations/'+c.id,{headers})).json();return data.messages?.some((m:any)=>m.role==='assistant');}).toBe(true);}await page.addInitScript((token:string)=>localStorage.setItem('sb-token',token),login.token);await page.goto('/advisor/'+c.scope.objectType+'/'+c.scope.objectId+'/conversations/'+c.id);}
test('最近真实回复：历史宽表可读、可滚动、标题独立成行',async({page,request})=>{
 const login=await (await request.post('/api/mock-session',{data:{userId:'U-018'}})).json();
 const cs=await (await request.get('/api/conversations',{headers:{Authorization:'Bearer '+login.token}})).json();
 const recent=cs.find((c:any)=>c.id==='conversation-6756e0c6-d2e');test.skip(!recent,'当前数据库无该历史会话');
 await page.route('**/api/conversations?scope=*',async route=>{const r=await route.fetch();const list=await r.json();await route.fulfill({response:r,json:list.sort((a:any,b:any)=>Number(b.id===recent.id)-Number(a.id===recent.id))});});
 await openCustomer(page,request,recent);
 await expect(page.locator('.data-table-card').first()).toBeVisible();
 expect(await page.locator('.data-table-card').count()).toBeGreaterThanOrEqual(8);
 await expect(page.getByRole('heading',{name:'一、结论（先看这四条）',exact:true})).toBeVisible();
 const wide=page.locator('.answer-table-scroll').filter({has:page.locator('th', {hasText:'power/capacity'})});
 await expect(wide).toBeVisible();
 await expect.poll(()=>wide.evaluate(el=>el.isConnected&&el.clientWidth>0&&el.scrollWidth>el.clientWidth)).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.screenshot({path:'runtime/reports/screenshots/history-tables.png',fullPage:true});
});
test('echarts表格和图形：搜索分页、CSV、SVG、格式错误与历史回放',async({page,request})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const table={type:'table',title:'项目推进清单',columns:[{key:'id',label:'项目编号'},{key:'status',label:'证据状态'}],rows:Array.from({length:12},(_,i)=>({id:'OP-'+i,status:i===0?'**待核实**':'已确认'})),caption:'展示测试数据，仅用于组件验证'};
 const chart={type:'chart',title:'阶段分布组件验证',option:{xAxis:{type:'category',data:['S1','S3']},yAxis:{type:'value',name:'数量'},series:[{name:'项目',type:'bar',data:[2,3]}]},caption:'组件测试数据'};
 const content='## 组件验证\n\n```echarts\n'+JSON.stringify(table)+'\n```\n\n```echarts\n'+JSON.stringify(chart)+'\n```\n\n```echarts\n{broken\n```';
 await page.route(/\/api\/conversations\/[^/?]+$/,async route=>{const r=await route.fetch();const c=await r.json();const last=c.messages?.findLast((m:any)=>m.role==='assistant');if(last)last.content=content;await route.fulfill({response:r,json:c});});
 await openCustomer(page,request);const tableCard=page.getByRole('region',{name:'项目推进清单',exact:true});await expect(tableCard).toBeVisible();await expect(tableCard.locator('tbody tr')).toHaveCount(8);
 await tableCard.getByRole('button',{name:'下一页'}).click();await expect(tableCard.locator('tbody tr')).toHaveCount(4);
 await tableCard.getByRole('textbox').fill('OP-11');await expect(tableCard.locator('tbody tr')).toHaveCount(1);
 const dl=page.waitForEvent('download');await tableCard.getByRole('button',{name:'导出 CSV'}).click();expect((await dl).suggestedFilename()).toBe('项目推进清单.csv');
 await expect(page.locator('.chart-card svg')).toBeVisible();await expect(page.getByText('可视化数据格式不完整，以下保留原始内容。')).toBeVisible();
 await page.screenshot({path:'runtime/reports/screenshots/echarts-output.png',fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(errors).toEqual([]);
});

test('知识库展示原创活动指引并可下载MD',async({page,request})=>{
 await page.goto('/');await page.getByRole('button',{name:/张小小/}).click();await page.getByRole('button',{name:'赢单领航员',exact:true}).click();await page.getByRole('button',{name:'储能知识库',exact:true}).click();
 await expect(page.getByRole('heading',{name:'储能销售策略与活动指引'})).toBeVisible();
 await page.getByLabel('筛选阶段指引').selectOption('S3');
 await page.getByRole('button',{name:/阶段活动.*S3.*售前方案与评审推进/}).click();
 const body=page.getByRole('article',{name:'销售指引正文'});await expect(body.getByRole('heading',{name:'活动1：需求基线澄清会'})).toBeVisible();
 await expect(body).toContainText('产出物');await expect(body).toContainText('完成判定');await expect(body).toContainText('CRM闭环');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'下载 MD'}).click();expect((await download).suggestedFilename()).toBe('KB-S3-playbook.md');
 await page.screenshot({path:'runtime/reports/screenshots/sales-playbooks.png',fullPage:true});
 const login=await (await request.post('/api/mock-session',{data:{userId:'U-018'}})).json();const data=await (await request.get('/api/knowledge',{headers:{Authorization:'Bearer '+login.token}})).json();expect(data.documents).toHaveLength(58);expect(data.sources).toBeUndefined();expect(data.cards.every((d:any)=>!d.id.startsWith('KB-SRC-'))).toBe(true);
});
