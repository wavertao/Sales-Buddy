import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {testDirectory} from './helpers/temp.ts';
process.env.DATABASE_PATH=join(testDirectory('conversation-entry'),'app.sqlite');process.env.MEMORY_ROOT=join(process.env.DATABASE_PATH,'..','memory');process.env.SALES_BUDDY_TEST_MODE='1';
const D=await import('../apps/server/src/db.ts'),C=await import('../apps/server/src/crm.ts'),A=await import('../apps/server/src/agent.ts'),G=await import('../apps/server/src/general-conversation.ts'),L=await import('../apps/server/src/conversation-log.ts');const {seed}=await import('../apps/server/src/seed.ts');seed();
const u=C.user('U-018'),other=C.user('U-019'),scope={objectType:'opportunity' as const,objectId:'OP-UK-026',customerId:'C-UK-0086'};
after(()=>D.db.close());
test('普通会话无关联范围，商机会话有领航员标记；历史客户/线索不误标',()=>{
 const ordinary=A.createConversation(u),nav=A.createConversation(u,scope),customer=A.createConversation(u,{objectType:'customer',objectId:scope.customerId,customerId:scope.customerId});assert.equal(ordinary.kind,'general');assert.equal(ordinary.scope,undefined);assert.equal(nav.kind,'navigator');const context=A.history(u).find(c=>c.id===nav.id)?.navigatorContext;assert.deepEqual(context,{opportunityId:scope.objectId,opportunityName:'英国储能一期',customerId:scope.customerId,customerName:'Northstar Energy'});assert.equal(A.history(u).find(c=>c.id===ordinary.id)?.navigatorContext,undefined);assert.equal(customer.kind,'general');assert.ok(A.history(u).some(c=>c.id===ordinary.id));assert.ok(!A.recent(u).some(c=>c.id===ordinary.id));assert.ok(!A.history(u,scope).some(c=>c.id===ordinary.id));assert.throws(()=>C.own(other,'conversations',ordinary.id));
});
test('仅返回有权限商机入口，不把客户或线索作为领航员项目',()=>{
 const links=G.navigatorLinks(u,'请分析 OP-UK-026 英国储能一期');assert.equal(links.length,1);assert.equal(links[0].href,'/advisor/opportunity/OP-UK-026');assert.equal(G.navigatorLinks(other,'OP-UK-026').length,0);assert.equal(G.navigatorLinks(u,'C-UK-0086').length,0);assert.equal(G.visibleNavigatorLinks(u,[{objectId:scope.customerId}]).length,0);
 const customer=D.record(scope.customerId);D.saveRecord({...customer,ownerId:other.id});assert.equal(G.visibleNavigatorLinks(u,links).length,0);D.saveRecord(customer);
});
test('普通对话提及商机只给链接，不改会话绑定、不创建项目会话或项目记忆',async()=>{
 const c=A.createConversation(u),before=D.list('conversations').length,memories=D.list('memories').length,portraits=D.list('project_portraits').length;
 const run=G.startGeneralRun(u,c.id,'我想讨论 OP-UK-026 英国储能一期','replay');for(let i=0;i<100&&D.get('runs',run.id).status==='running';i++)await new Promise(r=>setTimeout(r,5));
 assert.equal(D.get('runs',run.id).status,'completed');const answer=D.get('answers',run.answerId);assert.equal(answer.navigatorLinks[0].objectId,scope.objectId);assert.equal(D.get('conversations',c.id).scope,undefined);assert.equal(D.list('conversations').length,before);assert.equal(D.list('memories').length,memories);assert.equal(D.list('project_portraits').length,portraits);assert.ok(L.conversationLogs(u).some(l=>l.runId===run.id));assert.throws(()=>G.startGeneralRun(other,c.id,'hello','replay'));
 const target=A.createConversation(u,scope);assert.equal(target.kind,'navigator');assert.notEqual(target.id,c.id);assert.throws(()=>G.startGeneralRun(u,target.id,'不可切换范围','replay'));
});
