import {testDirectory} from './helpers/temp.ts';
import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {join} from 'node:path';
const root=testDirectory('space-');process.env.DATABASE_PATH=join(root,'app.sqlite');process.env.MEMORY_ROOT=join(root,'memory');
for(const k of ['MODEL_API_BASE_URL','MODEL_API_KEY','MODEL_NAME'])delete process.env[k];
const D=await import('../apps/server/src/db.ts'),C=await import('../apps/server/src/crm.ts');
const {seed}=await import('../apps/server/src/seed.ts'),{seedP9}=await import('../apps/server/src/p9/seed-p9.ts'),{seedProjectSpaces}=await import('../apps/server/src/project-space/seed.ts');
const S=await import('../apps/server/src/project-space/service.ts'),K=await import('../packages/contracts/project-space.ts');
seed();seedP9();seedProjectSpaces();after(()=>D.db.close());
const U=(id:string)=>C.users().find(u=>u.id===id)!;const zhang=U('U-018'),wang=U('U-021'),li=U('U-019');
const SPACE='PS-CATL-001',MAIN=S.mainThreadId(SPACE);
const until=async(f:()=>boolean)=>{for(let i=0;i<100&&!f();i++)await new Promise(r=>setTimeout(r,20));};
const status=(id:string)=>S.threadsOf(SPACE).find(t=>t.id===id)!.status;

test('示例空间：一个商机一个空间，成员可见，种子不重复写入',()=>{
 seedProjectSpaces();
 const rows=S.listSpaces(zhang);assert.equal(rows.length,1);assert.equal(rows[0].opportunityId,'OP-CATL-001');
 const d=S.spaceDetail(zhang,SPACE);assert.equal(d.space.stage,'S4');assert.equal(d.space.winConfidence,65);
 assert.equal(d.threads.filter(t=>t.kind==='expert').length,3);
 assert.ok(d.messages.some(m=>m.card?.threadId==='TH-CATL-BID'),'主会话有子会话卡片');
 assert.equal(S.spaceDetail(zhang,SPACE,'TH-CATL-BID').messages.length,2);
 assert.ok(!S.spaceDetail(zhang,SPACE,'TH-CATL-BID').messages.some(m=>m.content.includes('摘要：')),'子会话正文不含摘要行');
 assert.equal(S.listSpaces(wang).length,1,'成员王强可见');
 assert.equal(S.createSpace(zhang,'OP-CATL-001').id,SPACE,'同一商机不重复建空间');
});

test('主会话 @ 专家：开子会话，未加入的专家自动加入；模型未配置时明确失败',async()=>{
 const body=K.postMessageSchema.parse({content:'@客户拜访专家 准备下周拜访',mentions:['visit']});
 const {threads}=S.postMessage(zhang,SPACE,MAIN,body);assert.equal(threads.length,1);
 assert.ok(S.spaceDetail(zhang,SPACE).space.members.some(m=>m.kind==='expert'&&m.expertId==='visit'));
 await until(()=>status(threads[0].id)!=='running');
 assert.equal(status(threads[0].id),'failed');
 const card=S.messagesOf(MAIN).find(m=>m.card?.threadId===threads[0].id)!;assert.equal(card.card!.status,'failed');assert.match(card.card!.summary!,/模型未配置/);
});

test('专家完成后子会话保留正文，摘要回到群聊；子会话追问不刷群',async()=>{
 const srv=http.createServer((req,res)=>{req.resume();req.on('end',()=>{res.setHeader('content-type','application/json');res.end(JSON.stringify({choices:[{message:{content:'决策链：采购总监 → 技术副总 → 总经理。\n\n摘要：技术副总是关键影响者，本周先约他。'}}]}));});}).listen(0);
 await new Promise(r=>srv.once('listening',r));
 Object.assign(process.env,{MODEL_API_BASE_URL:'http://127.0.0.1:'+(srv.address() as any).port+'/v1',MODEL_API_KEY:'test',MODEL_NAME:'test'});
 try{
  const {threads:[t]}=S.postMessage(zhang,SPACE,MAIN,{content:'@客户经营专家 梳理决策链',mentions:['account']});
  await until(()=>status(t.id)!=='running');assert.equal(status(t.id),'done');
  assert.equal(S.messagesOf(t.id).at(-1)!.content,'决策链：采购总监 → 技术副总 → 总经理。');
  const main=S.messagesOf(MAIN);assert.equal(main.at(-1)!.content,'技术副总是关键影响者，本周先约他。');
  S.postMessage(zhang,SPACE,t.id,{content:'总经理谁能引荐？',mentions:[]});
  await until(()=>status(t.id)!=='running');
  assert.equal(S.messagesOf(t.id).length,4);assert.equal(S.messagesOf(MAIN).length,main.length,'追问不向群里重复汇报');
 }finally{srv.close();for(const k of ['MODEL_API_BASE_URL','MODEL_API_KEY','MODEL_NAME'])delete process.env[k];}
});

test('成员、主线与待办：重复邀请被拒，非成员跨团队不可见，只有负责人完成待办会通知群里',()=>{
 S.addMember(zhang,SPACE,K.addMemberSchema.parse({kind:'user',userId:'U-019',role:'SC'}) as any);
 assert.equal(S.listSpaces(li).length,1);
 assert.throws(()=>S.addMember(zhang,SPACE,{kind:'user',userId:'U-019',role:'SC'} as any),/已在项目空间/);
 S.updateSpace(zhang,SPACE,K.updateSpaceSchema.parse({stage:'S5'}));assert.equal(S.spaceDetail(zhang,SPACE).space.stage,'S5');
 assert.throws(()=>K.updateSpaceSchema.parse({winConfidence:120}));
 assert.equal(S.myTodos(wang).length,1);S.setTodoStatus(wang,'TD-CATL-1','completed');assert.equal(S.myTodos(wang).length,0);
 assert.match(S.messagesOf(MAIN).at(-1)!.content,/完成了待办/);
 const other=S.opportunityOptions(zhang)[0];const created=S.createSpace(zhang,other.id);
 assert.throws(()=>S.spaceDetail(li,created.id),/不是该项目空间的成员/);
});
