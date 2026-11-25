import {test,expect} from '@playwright/test';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
import JSZip from 'jszip';

test('P11完整旅程：多轮背景、可编辑逐页问题、素材选择、生成、原生导出与个人归档',async({page,request})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const login=await(await request.post('/api/mock-session',{data:{userId:'U-018'}})).json();const headers={Authorization:'Bearer '+login.token};const baselineMaterials=(await(await request.get('/api/personal-materials',{headers})).json()).filter((m:any)=>m.source==='generated').length;const unique='P11验收-'+Date.now();
 await page.goto('/');await page.getByRole('button',{name:/张小小/}).click();await page.getByRole('button',{name:'赢单领航员',exact:true}).click();await page.getByRole('button',{name:'关键会晤赋能',exact:true}).click();
 await page.getByLabel('会晤搜索客户或项目').fill('英国储能一期');await page.getByRole('button').filter({hasText:'OP-UK-026'}).click();await page.getByRole('button',{name:'新建会晤准备',exact:true}).click();
 await page.getByLabel('会晤背景输入').fill(unique+' 准备英国储能一期的技术会晤，30分钟，英文材料，确认供货接口和交付安排');await page.getByRole('button',{name:'发送',exact:true}).click();await expect(page.locator('.meeting-bubble.user').last()).toContainText('准备英国储能一期');await expect(page.locator('.streaming-reply')).toBeVisible();await expect(page.locator('.streaming-reply p')).toContainText('这次');await expect(page.locator('.meeting-bubble.assistant:not(.streaming-reply)')).toHaveCount(1);
 await page.getByLabel('会晤背景输入').fill('David与Sarah参与，希望确认双方责任以及下一次技术评审');await page.getByRole('button',{name:'发送',exact:true}).click();await expect(page.locator('.meeting-bubble.assistant:not(.streaming-reply)')).toHaveCount(2);await expect(page.getByText('背景交流已完成，可以开始规划PPT大纲。')).toHaveCount(0);await page.screenshot({path:'runtime/reports/screenshots/p11-background.png',fullPage:true});
 await page.getByRole('button',{name:'完成背景交流，进入大纲'}).click();await expect(page.getByLabel('章节标题1')).toBeVisible();await page.getByRole('button',{name:'确认大纲，逐页规划'}).click();await expect(page.getByLabel('第1页问题')).toBeVisible();
 await page.getByLabel('第3页问题').fill('如何明确客户要求的现场接口责任？');await page.screenshot({path:'runtime/reports/screenshots/p11-editable-plan.png',fullPage:true});
 // Keep three pages to exercise each outcome without generating unrelated slides.
 for(let n=8;n>3;n--)await page.getByRole('button',{name:'删除第'+n+'页',exact:true}).click();
 await page.getByRole('button',{name:'确认页计划，匹配素材'}).click();await expect(page.getByRole('heading',{name:/份候选资料/})).toBeVisible();await page.getByRole('button',{name:'明确留空本页',exact:true}).click();await expect(page.getByRole('heading',{name:'本页明确留空'})).toBeVisible();
 await page.getByRole('navigation',{name:'目标页目录'}).getByRole('button').nth(1).click();await page.getByRole('button',{name:'选择个人素材库',exact:true}).click();
 await page.getByLabel('上传个人素材文件').setInputFiles(resolve('assets/presentations/library/MID-01.pptx'));await expect(page.locator('.material-record').filter({hasText:'MID-01'}).getByText('可用',{exact:true})).toBeVisible({timeout:60000});
 await page.getByLabel('选择素材页').selectOption('3');await page.getByRole('button',{name:'勾选本页',exact:true}).click();await page.getByRole('button',{name:/确认使用这些素材/}).click();await expect(page.locator('.source-selection')).toContainText('第3页');
 await page.getByLabel('本页生成补充信息').fill('围绕双方系统接口与交付责任准备一页讨论内容');await page.getByRole('button',{name:'生成右侧PPT',exact:false}).click();await expect(page.getByRole('button',{name:'确认采用本页',exact:true})).toBeVisible({timeout:60000});await page.screenshot({path:'runtime/reports/screenshots/p11-generated-slide.png',fullPage:true});await page.getByRole('button',{name:'确认采用本页',exact:true}).click();
 await page.getByRole('navigation',{name:'目标页目录'}).getByRole('button').nth(2).click();await page.locator('.candidate').getByRole('button',{name:'使用原页',exact:true}).first().click();await page.getByRole('button',{name:'预览与导出',exact:true}).click();
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'确认并导出PPT',exact:true}).click();await expect(page.getByRole('button',{name:'下载客户版PPT',exact:true})).toBeVisible({timeout:60000});
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'下载客户版PPT',exact:true}).click();const download=await downloadPromise;const zip=await JSZip.loadAsync(readFileSync((await download.path())!));const pres=await zip.file('ppt/presentation.xml')!.async('string');expect((pres.match(/<p:sldId\b/g)||[]).length).toBe(3);expect(Object.keys(zip.files).some(p=>p.startsWith('ppt/slides/')&&p.endsWith('.xml'))).toBe(true);
 await page.screenshot({path:'runtime/reports/screenshots/p11-export.png',fullPage:true});
 await page.getByRole('button',{name:'个人素材库',exact:true}).click();await expect(page.locator('.material-record').filter({hasText:'系统生成'})).toHaveCount(baselineMaterials+2);await page.screenshot({path:'runtime/reports/screenshots/p11-personal-library.png',fullPage:true});
 const kits=await(await request.get('/api/meeting-kits',{headers})).json();const k=kits.find((x:any)=>x.title.includes(unique));expect(k.pages[2].question).toBe('如何明确客户要求的现场接口责任？');
 const other=await(await request.post('/api/mock-session',{data:{userId:'U-019'}})).json();expect((await request.get('/api/meeting-kits/'+k.id,{headers:{Authorization:'Bearer '+other.token}})).status()).toBe(403);
 await page.getByRole('button',{name:'关键会晤赋能',exact:true}).click();await page.getByRole('button',{name:'返回会晤首页',exact:true}).click();const recent=page.locator('.meeting-recents article').filter({hasText:k.title});await expect(recent).toContainText('所属客户：');await expect(recent).toContainText('当前素材准备阶段：已导出');await expect(page.getByRole('heading',{name:'搜索你的客户 / 项目',exact:true})).toBeVisible();await page.waitForLoadState('networkidle');await expect(page.getByRole('heading',{name:'搜索你的客户 / 项目',exact:true})).toBeVisible();expect(errors).toEqual([]);
});

test('P11公共PPT知识库：分类、真实原页预览、研究来源和个人权限',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:/张小小/}).click();await page.getByRole('button',{name:'赢单领航员',exact:true}).click();await page.getByRole('button',{name:'储能知识库',exact:true}).click();await page.getByRole('button',{name:'面客PPT资料库',exact:true}).click();await expect(page.locator('.material-record')).toHaveCount(12);
 await page.getByRole('button',{name:'查看 / 选用',exact:true}).first().click();await expect(page.locator('.material-detail img')).toBeVisible();await page.getByText('24类标准目录与公开研究来源').click();await expect(page.locator('.material-category-list p')).toHaveCount(24);await expect(page.locator('.material-research a')).toHaveCount(6);await expect(page.getByRole('button',{name:'上传资料',exact:true})).toHaveCount(0);await page.screenshot({path:'runtime/reports/screenshots/p11-public-library.png',fullPage:true});
});

test('P11候选按6项翻页、点击放大、原文档完整预览和下载',async({page,request})=>{
 const login=await(await request.post('/api/mock-session',{data:{userId:'U-018'}})).json(),headers={Authorization:'Bearer '+login.token};
 const call=async(path:string,method:string,data:any)=>{const r=await request.fetch('/api'+path,{method,headers,data});expect(r.ok()).toBe(true);return r.json();};
 let k=await call('/meeting-kits','POST',{});k=await call('/meeting-kits/'+k.id+'/outline','PATCH',{revision:k.revision,outline:[{id:'section',title:'公司与产品介绍',purpose:'说明本次沟通范围'}]});k=await call('/meeting-kits/'+k.id+'/outline/confirm','POST',{revision:k.revision});
 k=await call('/meeting-kits/'+k.id+'/slide-plan','PATCH',{revision:k.revision,pages:[{id:'target',sectionId:'section',title:'公司概况与产品组合',question:'公司有哪些标准产品？',direction:'介绍企业与产品',minutes:3,requiresCustomerContext:false}]});k=await call('/meeting-kits/'+k.id+'/slide-plan/confirm','POST',{revision:k.revision});k=await call('/meeting-kits/'+k.id+'/matches','POST',{revision:k.revision});
 const material=await(await request.get('/api/materials/public-GEN-05-v1',{headers})).json();
 // Fixture expands real pages to exercise pagination independently of retrieval ranking tests.
 k.pages[0].candidates=material.slides.map((s:any,i:number)=>({materialId:material.id,page:s.page,title:s.title,materialTitle:material.title,version:1,tag:'可直接复用',confidence:98-i,reason:'当前主题匹配',difference:'请核对适用范围'}));
 await page.route('**/api/meeting-kits/'+k.id,route=>route.fulfill({json:k}));
 await page.goto('/');await page.getByRole('button',{name:/张小小/}).click();await page.getByRole('button',{name:'赢单领航员',exact:true}).click();await page.evaluate(id=>localStorage.setItem('sb-meeting-kit:U-018',id),k.id);await page.getByRole('button',{name:'关键会晤赋能',exact:true}).click();await expect(page.locator('.candidate')).toHaveCount(6);await expect(page.locator('.candidate').first()).toContainText('匹配度 98%');
 await page.locator('.candidate').first().getByRole('button',{name:/放大预览/}).click();await expect(page.getByRole('dialog',{name:'放大PPT预览',exact:true})).toBeVisible();await page.getByRole('button',{name:'关闭放大预览'}).click();
 await page.getByRole('button',{name:'下一页候选'}).click();await expect(page.locator('.candidate')).toHaveCount(2);await page.getByRole('button',{name:'上一页候选'}).click();await page.getByRole('button',{name:'查看原文档',exact:true}).first().click();const dialog=page.getByRole('dialog',{name:'会晤素材来源'});await expect(dialog.getByRole('navigation',{name:'原文档所有页面'}).getByRole('button')).toHaveCount(8);await dialog.getByRole('navigation',{name:'原文档所有页面'}).getByRole('button').nth(2).click();await expect(dialog.getByRole('heading',{name:'Approved Product Portfolio',exact:true})).toBeVisible();
 const downloading=page.waitForEvent('download');await dialog.getByRole('button',{name:'下载原文档',exact:true}).click();expect((await downloading).suggestedFilename()).toBe('GEN-05.pptx');await page.screenshot({path:'runtime/reports/screenshots/p11-original-document.png',fullPage:true});
});

