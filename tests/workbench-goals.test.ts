import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {testDirectory} from './helpers/temp.ts';
import {taskGroup,businessDay} from '../packages/workbench.ts';
process.env.DATABASE_PATH=join(testDirectory('workbench-goals'),'app.sqlite');
process.env.MEMORY_ROOT=join(process.env.DATABASE_PATH,'..','memory');
process.env.SALES_BUDDY_TEST_MODE='1';process.env.BUSINESS_CLOCK='2026-11-11T10:00:00+08:00';
const D=await import('../apps/server/src/db.ts'),C=await import('../apps/server/src/crm.ts'),W=await import('../apps/server/src/home-workbench.ts'),G=await import('../apps/server/src/workbench-goals.ts');
const {seed}=await import('../apps/server/src/seed.ts');seed();
const u=C.user('U-018'),other=C.user('U-019'),admin=C.user('U-ADMIN');
const scope={objectType:'opportunity',objectId:'OP-UK-026',customerId:'C-UK-0086'};
const task=(id:string,extra:any={})=>D.saveRecord({id,type:'task',name:id,description:'核实资源与时间',entityId:scope.objectId,entityType:scope.objectType,customerId:scope.customerId,assigneeId:u.id,createdBy:u.id,status:'pending',priority:'P2',dueAt:'2026-11-11T11:00:00+08:00',updatedAt:D.now(),...extra});
after(()=>D.db.close());
test('北京时间互斥分组、周日边界、无日期和取消状态',()=>{
 const at='2026-11-11T10:00:00+08:00';
 assert.equal(taskGroup({status:'pending',dueAt:'2026-11-10T15:59:59Z'},at),'overdue');
 assert.equal(taskGroup({status:'pending',dueAt:'2026-11-10T16:00:00Z'},at),'today');
 assert.equal(taskGroup({status:'pending',dueAt:'2026-11-15T15:59:59Z'},at),'week');
 assert.equal(taskGroup({status:'pending',dueAt:'2026-11-15T16:00:00Z'},at),'later');
 assert.equal(taskGroup({status:'pending',dueAt:'2026-11-16T12:00:00+08:00'},'2026-11-15T09:00:00+08:00'),'later');
 assert.equal(taskGroup({status:'pending'},at),'later');assert.equal(taskGroup({status:'cancelled'},at),null);assert.equal(taskGroup({status:'completed'},at),'completed');
});
test('统计基于完整本人集合，组内分页不漏未排期，历史发起人不冒充本人',()=>{
 const before=G.groupedTasks(u).counts.today;
 for(let i=0;i<25;i++)task('GOAL-PAGE-'+i);
 task('GOAL-NO-DATE',{dueAt:null,createdBy:null});task('GOAL-OTHER',{assigneeId:other.id});
 const all=G.groupedTasks(u),first=G.groupedTasks(u,'today',0),second=G.groupedTasks(u,'today',1);
 assert.equal(all.counts.today,before+25);assert.equal(first.groups[0].records.length,20);assert.equal(first.counts.today,second.counts.today);
 assert.equal(new Set([...first.groups[0].records,...second.groups[0].records].map(t=>t.id)).size,Math.min(all.counts.today,40));
 assert.equal(all.groups.find(g=>g.key==='later')!.records.find(t=>t.id==='GOAL-NO-DATE')!.creatorName,'未记录');
 assert.ok(!all.groups.flatMap(g=>g.records).some(t=>t.id==='GOAL-OTHER'));assert.equal(G.groupedTasks(admin).groups.flatMap(g=>g.records).length,0);
});
test('八条真实候选、分页与实体来源、完成提醒不关闭任务',async()=>{
 W.requestGeneration(u,true);await W.waitGeneration(u);const page=W.cuePage(u);assert.equal(page.records.length,8);assert.equal(page.pageSize,8);
 const cue=page.records[0];assert.ok(W.cueDetail(u,cue.id).entities.some(e=>e.type==='opportunity'));
 W.setCueState(u,cue.id,'completed');assert.equal(D.record(cue.sources.find(s=>s.entityType==='task')!.recordId).status,'pending');
 W.setCueState(u,cue.id,'in_progress');assert.equal(W.cueDetail(u,cue.id).status,'in_progress');assert.throws(()=>W.cueDetail(other,cue.id));
});
test('任务状态幂等、日报持久化、取消完成保留审计，跨用户不可读',()=>{
 task('GOAL-REPORT');W.setTaskStatus(u,'GOAL-REPORT','completed');W.setTaskStatus(u,'GOAL-REPORT','completed');
 const report=G.dailyTaskReport(u);assert.equal(report.entries.filter(e=>e.taskId==='GOAL-REPORT').length,1);assert.equal(report.entries.find(e=>e.taskId==='GOAL-REPORT')!.origin,'task_status_event');
 assert.ok(!G.dailyTaskReport(other).entries.some(e=>e.taskId==='GOAL-REPORT'));
 W.setTaskStatus(u,'GOAL-REPORT','pending');assert.equal(G.dailyTaskReport(u).entries.find(e=>e.taskId==='GOAL-REPORT')!.status,'restored');assert.equal(D.list('task_status_audit').filter(e=>e.taskId==='GOAL-REPORT').length,2);
});
test('只闭环明确关联的日报洞察，多待办与人工状态保持正确',()=>{
 task('GOAL-LINK-A');task('GOAL-LINK-B');D.put('daily_insights','goal-insight',{id:'goal-insight',userId:u.id,title:'交付资源核实',day:businessDay(D.now()),status:'open',taskIds:[]},u.id);
 G.linkTaskInsight(u,'GOAL-LINK-A','goal-insight');G.linkTaskInsight(u,'GOAL-LINK-B','goal-insight');assert.throws(()=>G.linkTaskInsight(other,'GOAL-LINK-A','goal-insight'));
 W.setTaskStatus(u,'GOAL-LINK-A','completed');assert.equal(D.get('daily_insights','goal-insight').status,'open');
 W.setTaskStatus(u,'GOAL-LINK-B','completed');assert.equal(D.get('daily_insights','goal-insight').status,'closed');
 W.setTaskStatus(u,'GOAL-LINK-A','pending');assert.equal(D.get('daily_insights','goal-insight').status,'open');
});
test('日报同步失败不误撤销任务，重试不会复活已恢复记录；锁定日报追加更正',()=>{
 task('GOAL-FAIL');D.db.exec("CREATE TRIGGER test_report_failure BEFORE INSERT ON documents WHEN NEW.collection='daily_task_entries' BEGIN SELECT RAISE(FAIL,'injected report failure'); END;");
 assert.equal(W.setTaskStatus(u,'GOAL-FAIL','completed').reportSync,'pending');assert.equal(D.record('GOAL-FAIL').status,'completed');
 W.setTaskStatus(u,'GOAL-FAIL','pending');D.db.exec('DROP TRIGGER test_report_failure');G.retryTaskReports(u);assert.equal(G.dailyTaskReport(u).entries.find(e=>e.taskId==='GOAL-FAIL')!.status,'restored');
 task('GOAL-RETRY-ORDER');D.db.exec("CREATE TRIGGER test_report_failure BEFORE INSERT ON documents WHEN NEW.collection='daily_task_entries' BEGIN SELECT RAISE(FAIL,'injected report failure'); END;");W.setTaskStatus(u,'GOAL-RETRY-ORDER','completed');W.setTaskStatus(u,'GOAL-RETRY-ORDER','pending');D.db.exec('DROP TRIGGER test_report_failure');W.setTaskStatus(u,'GOAL-RETRY-ORDER','completed');G.retryTaskReports(u);assert.equal(G.dailyTaskReport(u).entries.filter(e=>e.taskId==='GOAL-RETRY-ORDER'&&e.status==='completed').length,1);assert.equal(G.dailyTaskReport(u).entries.filter(e=>e.taskId==='GOAL-RETRY-ORDER'&&e.status==='restored').length,1);
 task('GOAL-LOCKED');W.setTaskStatus(u,'GOAL-LOCKED','completed');const day=businessDay(D.now());D.put('daily_reports',u.id+':'+day,{userId:u.id,day,status:'locked'},u.id);
 W.setTaskStatus(u,'GOAL-LOCKED','pending');assert.equal(G.dailyTaskReport(u).entries.find(e=>e.taskId==='GOAL-LOCKED')!.status,'completed');assert.ok(G.dailyTaskReport(u).corrections.some(e=>e.taskId==='GOAL-LOCKED'));
 task('GOAL-LOCKED-NEW');W.setTaskStatus(u,'GOAL-LOCKED-NEW','completed');assert.ok(!G.dailyTaskReport(u).entries.some(e=>e.taskId==='GOAL-LOCKED-NEW'));assert.ok(G.dailyTaskReport(u).corrections.some(e=>e.taskId==='GOAL-LOCKED-NEW'&&e.action==='completed'));
});
test('自然语言整理使用模型且不写CRM，拒绝模型捏造关联对象',async()=>{
 const old={base:process.env.MODEL_API_BASE_URL,key:process.env.MODEL_API_KEY,name:process.env.MODEL_NAME};let objectId:string|null=scope.objectId;
 const server=createServer((req,res)=>{req.resume();req.on('end',()=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:JSON.stringify({title:'确认报价',description:'先核实费用',objectId,dueAt:null,priority:'P2',questions:['请确认截止时间']})}}]}));});});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address() as any;
 process.env.MODEL_API_BASE_URL='http://127.0.0.1:'+address.port;process.env.MODEL_API_KEY='fixture';process.env.MODEL_NAME='fixture';
 try{const count=D.allRecords('task').length;const draft=await G.parseTaskCapture(u,{text:'帮我确认报价'});assert.equal(draft.requiresConfirmation,true);assert.equal(draft.dueAt,null);assert.equal(D.allRecords('task').length,count);objectId='DOES-NOT-EXIST';await assert.rejects(()=>G.parseTaskCapture(u,{text:'关联未知项目'}));}finally{await new Promise<void>(resolve=>server.close(()=>resolve()));for(const [name,value] of Object.entries({MODEL_API_BASE_URL:old.base,MODEL_API_KEY:old.key,MODEL_NAME:old.name}))if(value===undefined)delete process.env[name];else process.env[name]=value;}
});
