import {requestsInternalResources} from './navigator-reply.ts';
import {isUserIntentSuggestion} from '../../../packages/user-intent-suggestions.ts';
import {testRuntime} from './runtime-mode.ts';
import {acknowledgement,visibleAnswerText} from './answer-quality.ts';
import {z} from 'zod';
import {put,get,list,uid,record} from './db.ts';
import {own,authorize,allowedRecord} from './crm.ts';
import {memoryContext} from './memory.ts';
import {type User,type SuggestedAction,isCreateAction,AppError} from '../../../packages/contracts/index.ts';
export const SUGGESTIONS_VERSION=6;
const pending=new Map<string,Promise<any>>();
const questionSchema=z.object({label:z.string().optional(),intent:z.enum(['lookup','analysis','communication','planning','resources','profile']).optional(),question:z.string().min(5).max(12000),entityIds:z.array(z.string()).min(1).max(20)});
export function visibleAnswer(answer:any){const tools=answer.tools||answer.actions?.filter((a:any)=>!isCreateAction(a)&&a.actionType!=='followup')||[];return{...answer,tools,actions:answer.suggestionsVersion===SUGGESTIONS_VERSION?answer.actions:(answer.actions||[]).filter(isCreateAction),suggestionsStatus:answer.suggestionsVersion===SUGGESTIONS_VERSION?answer.suggestionsStatus:'not_generated'};}
function save(answer:any){put('answers',answer.id,answer,answer.userId,answer.scope.objectId);const message=get('messages',answer.id);if(message)put('messages',answer.id,{...message,...answer,role:'assistant',content:answer.text},answer.userId,answer.scope.objectId);return answer;}
function entities(u:User,answer:any){const ids=[answer.scope.objectId,answer.scope.customerId,...(answer.sources||[]).filter((s:any)=>s.sourceKind==='crm').map((s:any)=>s.recordId)];return [...new Set<string>(ids)].flatMap(id=>{try{const r=allowedRecord(u,id);return[{id:r.id,type:r.type,name:r.name,title:r.title||'',stage:r.stage||'',content:(r.content||'').slice(0,90)}];}catch{return[];}});}
export async function generateFollowups(u:User,answer:any,inline?:any[]){authorize(u,answer.scope);const rows=entities(u,answer);const valid=new Set(rows.map(r=>r.id));const context={question:answer.userQuestion||get('runs',answer.runId)?.question||'',answer:visibleAnswerText(answer.text).slice(0,1600),scope:answer.scope,entities:rows,memories:memoryContext(u,answer.scope)};
 if(acknowledgement(context.question))return [];
 let proposed:any[]=[];
 if(inline){proposed=inline.slice(0,20).flatMap(q=>{const result=questionSchema.safeParse(q);return result.success?[result.data]:[];});}else if(answer.mode==='live'||!testRuntime()){
 throw new AppError('SUGGESTIONS_FAILED','追问只随主回答生成，不再单独调用模型');
 }else{
 const subject=rows.find(r=>r.id===answer.scope.objectId)?.name||'当前项目';const buyer=rows.find(r=>r.type==='contact'&&/采购/.test(r.title)),technical=rows.find(r=>r.type==='contact'&&/技术/.test(r.title));const ids=[answer.scope.objectId];
 if(/竞品|便宜|价格|降价/.test(context.question))proposed=[{label:'把价差转成同口径比较',question:'针对'+subject+'的价差问题，帮我制定向'+(buyer?.name||'客户采购')+'核实三个比较口径的沟通清单。',entityIds:[...ids,...(buyer?[buyer.id]:[])]},{label:'准备针对客户的回应话术',question:'基于'+subject+'当前背景，帮我拟一段先澄清价值、再讨论价格的客户回应。',entityIds:ids}];
 else if(answer.responsePurpose==='activity_plan')proposed=[{label:'细化'+(technical?.name||'技术方')+'的确认清单',question:'把'+(technical?.name||'客户技术方')+'在'+subject+'这次沟通中需要确认的事项压缩成会前清单。',entityIds:[...ids,...(technical?[technical.id]:[])]},{label:'设计采购路径提问',question:'针对'+subject+'，怎么向'+(buyer?.name||'采购角色')+'问清下一评审节点和参与角色？',entityIds:[...ids,...(buyer?[buyer.id]:[])]}];
 else proposed=[{label:'如何接近下一决策角色？',question:'针对'+subject+'，如何通过'+(buyer?.name||'现有联系窗口')+'确认下一决策角色和沟通路径？',entityIds:[...ids,...(buyer?[buyer.id]:[])]},{label:'把当前缺口转成客户沟通',question:'结合'+subject+'当前情况，帮我拟定向'+(technical?.name||'客户负责人')+'确认最关键缺口的三个问题。',entityIds:[...ids,...(technical?[technical.id]:[])]}];
 }
 const seen=new Set<string>();const actions:SuggestedAction[]=[];for(const p of proposed){if(answer.navigator&&!requestsInternalResources(context.question)&&(p.intent==='resources'||requestsInternalResources(p.question)))continue;if(!isUserIntentSuggestion(p.question))continue;if(!/数据清理|重复|去重|合并|归并/.test(context.question)&&/合并|去重|归并|清理数据|关闭.{0,6}(任务|待办)/.test(p.question))continue;const key=p.question.replace(/[\s，。？！?]/g,'');if(seen.has(key)||key===context.question.replace(/[\s，。？！?]/g,'')||p.entityIds.some((id:string)=>!valid.has(id)))continue;seen.add(key);actions.push({id:uid('followup'),actionType:'followup',label:p.question,goal:p.question,entityIds:p.entityIds.slice(0,5),presentation:'question'});}if(!actions.length&&inline)throw new AppError('SUGGESTIONS_FAILED','没有可执行的用户委托建议');return actions.slice(0,answer.navigator?3:5);
}
export async function updateSuggestions(u:User,id:string){const a=own(u,'answers',id);authorize(u,a.scope);const current=visibleAnswer(a);save({...current,suggestionsVersion:SUGGESTIONS_VERSION,suggestionsStatus:'generating'});try{const questions=await generateFollowups(u,a);const next=save({...get('answers',id),actions:[...questions,...(a.actions||[]).filter(isCreateAction)],suggestionsVersion:SUGGESTIONS_VERSION,suggestionsStatus:'completed',suggestionsError:null});put('suggestion_jobs',id,{id,userId:u.id,status:'completed',at:new Date().toISOString()});return next;}catch(e:any){const next=save({...get('answers',id),suggestionsVersion:SUGGESTIONS_VERSION,suggestionsStatus:'failed',suggestionsError:'暂未生成后续问题，可重试'});put('suggestion_jobs',id,{id,userId:u.id,status:'failed',message:e.message});return next;}}
export function requestSuggestions(u:User,id:string,retry=false){const answer=own(u,'answers',id);authorize(u,answer.scope);if(answer.suggestionsVersion===SUGGESTIONS_VERSION&&['completed','failed'].includes(answer.suggestionsStatus)&&!retry)return visibleAnswer(answer);if(!pending.has(id)&&(!answer.suggestionsStatus||['not_generated','failed'].includes(answer.suggestionsStatus)||answer.suggestionsVersion!==SUGGESTIONS_VERSION||retry)){const job=updateSuggestions(u,id).finally(()=>pending.delete(id));pending.set(id,job);}return visibleAnswer(get('answers',id)||answer);}

export function waitSuggestions(id:string){return pending.get(id)||Promise.resolve(get('answers',id));}
