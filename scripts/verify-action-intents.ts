import {mkdirSync as ensureReportDirectory} from 'node:fs';ensureReportDirectory('runtime/reports',{recursive:true});
import {DatabaseSync} from 'node:sqlite';
import {writeFileSync} from 'node:fs';
const base='http://127.0.0.1:3001';
const db=new DatabaseSync('runtime/app/app.sqlite',{readOnly:true});
const counts=()=>({records:Number((db.prepare('SELECT COUNT(*) n FROM records').get() as any).n),drafts:Number((db.prepare("SELECT COUNT(*) n FROM documents WHERE collection='drafts'").get() as any).n)});
const login:any=await (await fetch(base+'/api/mock-session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:'U-018'})})).json();
const call=async(path:string,body?:any)=>{const r=await fetch(base+'/api'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:'Bearer '+login.token},...(body?{body:JSON.stringify(body)}:{})});const j:any=await r.json();if(!r.ok)throw new Error(j.message);return j;};
const cs=await call('/conversations?scope='+encodeURIComponent(JSON.stringify({objectType:'opportunity',objectId:'OP-UK-026',customerId:'C-UK-0086'})));
let source:any;for(const c of cs){const history=await call('/conversations/'+c.id);source=history.messages.findLast((m:any)=>m.role==='assistant'&&m.mode==='live'&&m.actions?.some((a:any)=>a.actionType==='prepare_activity'));if(source)break;}
if(!source)throw new Error('没有用于验证历史按钮的真实模型回答');
const before=counts();const oldAction=source.actions.find((a:any)=>a.actionType==='prepare_activity');const result=await call('/actions/prepare',{answerId:source.id,actionId:oldAction.id,mode:'live'});
if(!result.run||result.draft)throw new Error('准备活动不应直接返回草稿');
await (await fetch(base+'/api/runs/'+result.run.id+'/events',{headers:{Authorization:'Bearer '+login.token},signal:AbortSignal.timeout(180000)})).text();
const afterSuggestion=counts();const history=await call('/conversations/'+source.conversationId);const answer=history.messages.find((m:any)=>m.id===result.run.answerId);if(!answer)throw new Error('活动计划回答未完成');
const create=answer.actions.find((a:any)=>a.actionType==='create_activity_draft');if(!create)throw new Error('缺少独立活动创建建议');
const prepared=await call('/actions/prepare',{answerId:answer.id,actionId:create.id});const afterDraft=counts();
const report={at:new Date().toISOString(),status:before.records===afterSuggestion.records&&before.drafts===afterSuggestion.drafts&&afterDraft.records===before.records&&prepared.draft?.kind==='activity'?'passed':'failed',runId:result.run.id,answerId:answer.id,draftId:prepared.draft?.id,suggestionDidNotCreateDraft:before.drafts===afterSuggestion.drafts,crmUnchanged:before.records===afterDraft.records,createPresentation:create.presentation,scope:'单条真实模型活动准备与草稿验证；未确认写入业务记录'};
writeFileSync('runtime/reports/action-intents-live-result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));db.close();if(report.status!=='passed')process.exitCode=1;
