import {test,expect} from '@playwright/test';
async function login(page:any,request:any){const session=await(await request.post('/api/mock-session',{data:{userId:'U-018'}})).json();await page.addInitScript((token:string)=>localStorage.setItem('sb-token',token),session.token);return{Authorization:'Bearer '+session.token};}

test('普通对话与领航员输入区在手机和PC使用相同尺寸和样式',async({page,request})=>{
 await login(page,request);
 for(const viewport of [{width:390,height:844},{width:1440,height:1000}]){
  await page.setViewportSize(viewport);await page.goto('/home');
  await page.getByRole('navigation',{name:viewport.width<820?'移动端主导航':'主导航',exact:true}).getByRole('button',{name:'对话',exact:true}).click();
  await expect(page.getByLabel('普通对话输入')).toBeVisible();
  const measure=()=>page.locator('.chat-composer').evaluate(el=>{const s=getComputedStyle(el),t=getComputedStyle(el.querySelector('textarea')!),b=getComputedStyle(el.querySelector('.send')!);return{height:el.getBoundingClientRect().height,width:el.getBoundingClientRect().width,radius:s.borderRadius,padding:s.padding,border:s.borderColor,font:t.fontSize,input:t.height,button:b.width};});
  const general=await measure();await page.goto('/advisor/opportunity/OP-UK-026');await page.getByRole('button',{name:'新建对话',exact:true}).click();await expect(page.getByLabel('发送问题')).toBeVisible();const navigator=await measure();
  if(viewport.width<820)expect(general.width).toEqual(navigator.width);expect(general.width).toBeLessThanOrEqual(680);expect(navigator.width).toBeLessThanOrEqual(680);const {width:gw,...gs}=general,{width:nw,...ns}=navigator;expect(gs).toEqual(ns);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
});

test('MPT只读阶段、定义与全屏定位图，PC和手机移除记录及下载',async({page,request})=>{
 const headers=await login(page,request),scope=encodeURIComponent(JSON.stringify({objectType:'opportunity',objectId:'OP-UK-026',customerId:'C-UK-0086'}));
 const before=await(await request.get('/api/navigator/state?scope='+scope,{headers})).json();const knowledge=await(await request.get('/api/navigator/knowledge',{headers})).json();
 await page.route('**/api/navigator/state?*',async route=>{const response=await route.fetch(),p=await response.json();await route.fulfill({json:{...p,assessed:true,stages:{M:'M2',P:'P2',T:'T1'}}});});
 for(const width of [320,390,1440]){
  await page.setViewportSize({width,height:844});await page.goto('/advisor/opportunity/OP-UK-026');await page.getByRole('button',{name:'新建对话',exact:true}).click();await page.locator('.navigator-composer-bubbles').getByRole('button',{name:'MPT画布',exact:true}).click();
  const canvas=page.getByRole('dialog',{name:'项目画像矩阵',exact:true}),overview=canvas.getByLabel('项目当前阶段');
  await expect(canvas.getByRole('button',{name:'更新记录',exact:true})).toHaveCount(0);await expect(canvas.getByRole('button',{name:'下载画像MD',exact:true})).toHaveCount(0);await expect(overview.locator('select')).toHaveCount(0);
  await expect(overview.getByLabel('项目落地成熟度')).toContainText('M2');await expect(overview.getByLabel('订单归属',{exact:true})).toContainText('P2');await expect(overview.getByLabel('独立采购阶段',{exact:true})).toContainText('T1');
  if(width<820){const t=await overview.getByLabel('独立采购阶段',{exact:true}).boundingBox(),advice=await overview.getByLabel('M乘P推进建议').boundingBox();expect(t!.y+t!.height).toBeLessThan(advice!.y);}
  await overview.getByRole('button',{name:'查看阶段定义'}).click();const defs=page.getByRole('dialog',{name:'各阶段定义',exact:true});await expect(defs.getByRole('tabpanel')).toContainText('M2');await defs.getByRole('tab',{name:'T · 独立采购阶段',exact:true}).click();await expect(defs.locator('.current')).toContainText('T1');await page.keyboard.press('Escape');await expect(defs).toHaveCount(0);
  await overview.getByRole('button',{name:'查看阶段定位图'}).click();const map=page.getByRole('dialog',{name:'阶段定位图',exact:true});await expect(map.locator('.mpt-mini-grid button')).toHaveCount(36);for(const stage of knowledge.stages.filter((r:string[])=>['M','P'].includes(r[0]))){await expect(map.locator('.mpt-map-axis[data-stage="'+stage[1]+'"]')).toContainText(stage[2]);}await expect(map.locator('.mpt-mini-grid .current')).toHaveText('● 当前');await expect(map.locator('.mpt-map-current')).toHaveText('当前 M2 × P2');
  await map.getByRole('button',{name:'M3与P4，查看建议',exact:true}).click();await expect(map.getByLabel('M乘P推进建议')).toContainText('M3 × P4');await expect(map.locator('.mpt-mini-grid .current')).toHaveText('● 当前');
  await map.getByRole('button',{name:'全屏展示',exact:true}).click();await expect(map).toHaveClass(/is-fullscreen/);const full=await map.boundingBox();expect(full!.height).toBe(844);expect(full!.width).toBe(width);expect(await map.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
  await page.screenshot({path:'runtime/reports/screenshots/mpt-map-fullscreen-'+width+'.png'});await page.keyboard.press('Escape');await expect(map).not.toHaveClass(/is-fullscreen/);await map.getByLabel('关闭阶段弹窗').click();await expect(map).toHaveCount(0);await expect(overview.getByLabel('项目落地成熟度')).toContainText('M2');
  await canvas.evaluate(el=>{el.scrollTop=0;});await page.screenshot({path:'runtime/reports/screenshots/mpt-clean-overview-'+width+'.png'});
 }
 const after=await(await request.get('/api/navigator/state?scope='+scope,{headers})).json();expect(after.stages).toEqual(before.stages);expect(after.version).toEqual(before.version);
});
