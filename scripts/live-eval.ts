import {mkdirSync as ensureReportDirectory} from 'node:fs';ensureReportDirectory('runtime/reports',{recursive:true});
import 'dotenv/config';
import {writeFileSync,mkdirSync} from 'node:fs';
const base='http://127.0.0.1:'+(process.env.APP_PORT||3001);
const cases:{stage:string;question:string;businessMode?:string}[]=[];for(let i=0;i<9;i++)for(const question of ['分析当前现状与证据缺口','下一步应该做什么，向客户追问哪些问题？','本阶段有哪些风险，依据是什么？'])cases.push({stage:'S'+i,question});
cases.push({stage:'S3',question:'客户说竞品低8%，如何回应？'},{stage:'S1',businessMode:'commercial_industrial',question:'客户想知道多久回本，缺哪些输入？'},{stage:'S2',businessMode:'channel_project',question:'帮我生成伙伴评估与激活计划。'});
mkdirSync('fixtures/evaluations',{recursive:true});writeFileSync('fixtures/evaluations/live-questions.json',JSON.stringify(cases,null,2));
mkdirSync('docs',{recursive:true});
if(!process.env.MODEL_API_BASE_URL||!process.env.MODEL_API_KEY||!process.env.MODEL_NAME){
 writeFileSync('runtime/reports/live-results.json',JSON.stringify({at:new Date().toISOString(),mode:'live',status:'blocked',planned:30,executed:0,reason:'未配置MODEL_API_BASE_URL、MODEL_API_KEY、MODEL_NAME，未调用模型，不计为通过。',businessReview:'pending'},null,2));
 console.log('LIVE BLOCKED: 30条问题已准备，在线模型未配置，执行0条。');process.exitCode=2;
}else{
 const login=await fetch(base+'/api/mock-session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:'U-ADMIN'})}).then(r=>r.json()) as any;
 const call=async(p:string,body?:any)=>{const r=await fetch(base+'/api'+p,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:'Bearer '+login.token},...(body?{body:JSON.stringify(body)}:{})});const j:any=await r.json();if(!r.ok)throw new Error(j.message);return j;};
 const results=[];for(const [i,c]of cases.entries()){
 try{const candidates=await call('/objects/search?q='+c.stage);const o=candidates.find((x:any)=>x.stage===c.stage&&x.status!=='converted'&&(!c.businessMode||x.businessMode===c.businessMode));if(!o)throw new Error('缺少对应阶段场景');
 const scope={objectType:o.type,objectId:o.id,customerId:o.customerId};
 const conversation=await call('/conversations',{scope});const run=await call('/conversations/'+conversation.id+'/messages',{question:c.question,mode:'live'});
 const response=await fetch(base+'/api/runs/'+run.id+'/events',{headers:{Authorization:'Bearer '+login.token}});await response.text();
 const detail=await call('/admin/export/'+run.id);const valid=detail.run.status==='completed'&&detail.answer?.sources?.some((s:any)=>s.sourceKind==='crm')&&detail.answer?.text?.trim();
 results.push({id:i+1,...c,status:valid?'technical_pass':'failed',runId:run.id,expertReview:'pending'});
 }catch(e:any){results.push({id:i+1,...c,status:'failed',error:e.message});}
 console.log('Live '+(i+1)+'/30: '+results.at(-1)?.status);
 }
 writeFileSync('runtime/reports/live-results.json',JSON.stringify({at:new Date().toISOString(),mode:'live',status:'executed',planned:30,executed:results.length,model:process.env.MODEL_NAME,results,businessReview:'pending'},null,2));
 if(results.some(x=>x.status==='failed'))process.exitCode=1;
}

