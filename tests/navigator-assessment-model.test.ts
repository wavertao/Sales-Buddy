import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdirSync,mkdtempSync} from 'node:fs';
import {resolve,join} from 'node:path';

test('在线模型协议适配链路（本地受控响应）：基础提交直接进入延伸问题，三题两轮后回到结果，不提前写入画像',async()=>{
 mkdirSync(resolve('runtime/test-runs'),{recursive:true});const root=mkdtempSync(resolve('runtime/test-runs/data-test-assessment-model-'));
 process.env.DATABASE_PATH=join(root,'app.sqlite');process.env.MEMORY_ROOT=join(root,'memory');process.env.SALES_BUDDY_TEST_MODE='0';
 let response:any={outcome:'信息不足',reason:'需要核实核心RTB条件',followup:['土地控制由谁持有？','土地控制由谁持有?','并网是否批复？','许可有哪些条件？','资金缺口？'],supplemental:['后续补充投资人资料']};const requests:any[]=[];
 const server=createServer(async(req,res)=>{let body='';for await(const b of req)body+=b;requests.push(JSON.parse(body));res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(response)}}]}));});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const address=server.address() as any;process.env.MODEL_API_BASE_URL='http://127.0.0.1:'+address.port+'/v1';process.env.MODEL_API_KEY='fixture-local-only';process.env.MODEL_NAME='fixture-model';
 const D=await import('../apps/server/src/db.ts');
 try{
 const C=await import('../apps/server/src/crm.ts'),K=await import('../apps/server/src/navigator-knowledge.ts'),N=await import('../apps/server/src/navigator.ts');(await import('../apps/server/src/seed.ts')).seed();await K.initNavigatorKnowledge();const u=C.user('U-018'),scope={objectType:'opportunity' as const,objectId:'OP-UK-026',customerId:'C-UK-0086'};
 let a=N.startAssessment(u,scope,true,{M:'M2'});a=await N.answerAssessment(u,a.id,{revision:a.revision,review:true,answers:[]});
 assert.equal(a.status,'questioning');assert.equal(a.round,1);assert.equal(a.questions.length,3);assert.equal(a.question.title,'土地控制由谁持有？');assert.equal(D.get('navigator_assessments',a.id),undefined);assert.equal(N.navigatorState(u,scope).version,0);
 response={...response,followup:['土地控制由谁持有？','附加许可何时关闭？','接入容量是多少？','还有什么？']};
 const answerAll=()=>a.questions.map((q:any,index:number)=>({index,state:'confirmed',text:'客户说明了此项具体状态及主体'}));
 a=await N.answerAssessment(u,a.id,{revision:a.revision,review:true,answers:answerAll()});assert.equal(a.round,2);assert.equal(a.questions.length,3);assert.ok(!a.questions.some((q:any)=>q.title==='土地控制由谁持有？'));
 response={...response,followup:['第三轮不应再问？']};a=await N.answerAssessment(u,a.id,{revision:a.revision,review:true,answers:answerAll()});assert.equal(a.status,'review');assert.equal(a.results.M.stage,'M2');assert.equal(a.results.M.outcome,'信息不足');assert.deepEqual(a.results.M.followup,[]);assert.deepEqual(a.results.M.deferred,['第三轮不应再问？']);
 const context=JSON.parse(requests[0].messages[1].content);assert.ok(context.definition);assert.ok(context.rules.length);assert.ok(context.crm.some((r:any)=>r.type==='contact'));assert.ok(!context.crm.some((r:any)=>r.type==='contact'&&r.customerId!==scope.customerId));
 a=await N.answerAssessment(u,a.id,{revision:a.revision,accept:true});const p=N.confirmAssessment(u,a.id,a.revision);assert.equal(p.stages.M,'M2');assert.equal(p.verification.M.outcome,'信息不足');
 response={...response,followup:['可稍后核实的核心RTB补充问题？']};a=N.startAssessment(u,scope,true);a=await N.answerAssessment(u,a.id,{revision:a.revision,stage:'M2'});a=await N.answerAssessment(u,a.id,{revision:a.revision,review:true,answers:[]});assert.equal(a.status,'questioning');assert.equal(a.round,1);a=await N.answerAssessment(u,a.id,{revision:a.revision,advance:true,answers:[{index:0,text:'',state:''},{index:0,text:'客户暂时只说需要进一步核实',state:''},{index:1,text:'',state:'invalid'}]});assert.equal(a.currentAxis,'P');assert.equal(a.status,'choosing');assert.ok(a.answers.some((r:any)=>r.text==='客户暂时只说需要进一步核实'&&r.state==='unknown'));assert.equal(N.navigatorState(u,scope).version,p.version);
 }finally{D.db.close();await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
});
