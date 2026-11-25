import {requestsInternalResources} from './navigator-reply.ts';
import {structuredProfileContext,updateStructuredProfilesSkill} from './structured-profiles.ts';
import {splitNavigatorOutput,NAVIGATOR_OUTPUT_PROMPT} from '../../../packages/navigator-output.ts';
import {visibleStreamText} from './answer-stream.ts';
import {navigatorContext,NAVIGATOR_POLICY,proposeNavigatorUpdate} from './navigator.ts';
import {initNavigatorKnowledge} from './navigator-knowledge.ts';
import {projectInterviewPlan,interviewSection,markInterviewAsked,INTERVIEW_POLICY,resolveInterviewScope} from './project-interview.ts';
import {portraitContext,applyPortraitUpdates,conservativePortraitUpdates,portraitId,PROJECT_PORTRAIT_POLICY} from './project-portrait.ts';
import {WEB_SEARCH_POLICY} from './web-search.ts';
import {INLINE_FOLLOWUPS_PROMPT,splitInlineFollowups} from './inline-followups.ts';
import {testRuntime} from './runtime-mode.ts';
import {refineAnswer,acknowledgement} from './answer-quality.ts';
import {advisorPolicy,ADVISOR_PROMPT_VERSION} from './advisor-policy.ts';
import {generateFollowups,visibleAnswer,SUGGESTIONS_VERSION} from './followups.ts';
import {type MessageOrigin,isInternalText} from './message-source.ts';
import {responsePurpose,replaySuggestions,suggestionInstructions,type ResponsePurpose} from './advisor-suggestions.ts';
import {recordTurn} from './conversation-log.ts';
import {VISUALIZATION_PROMPT} from '../../../packages/visualization.ts';
import {z} from 'zod';
import {db,put,get,list,uid,now,addEvent,record} from './db.ts';
import {authorize,own,toolSpecs,makeDraft,approveDraft,validateFields} from './crm.ts';
import {connectMcp,callMcp} from './mcp.ts';
import {assess,searchKnowledge} from './knowledge.ts';
import {projectMemory,captureMemory,extractLiveMemory,conservativePatches,memoryContext,sourceForRun} from './memory.ts';
import {modelTurn,modelStatus} from './model.ts';
import {AppError,type User,type Scope,type Mode,type SourceRef,type Workbench,type SuggestedAction,isCreateAction} from '../../../packages/contracts/index.ts';
export const controllers=new Map<string,AbortController>();
export function boundToolArguments(scope:Scope,name:string,args:any){
 if(name==='web_search')return{...args,scope};
 if(name.startsWith('list_')||name==='get_customer_organization'||name==='search_customers')return{...args,customerId:scope.customerId,scope};
 if(name==='get_customer'&&args.id!==scope.customerId)throw new AppError('FORBIDDEN','当前回答仅分析已选客户',403);
 if(['get_lead','get_opportunity'].includes(name)){const r=record(args.id);if(r&&r.customerId!==scope.customerId)throw new AppError('FORBIDDEN','对象不属于当前分析客户',403);}
 if(['get_lead','get_opportunity'].includes(name)&&scope.objectType!=='customer'&&args.id!==scope.objectId)throw new AppError('FORBIDDEN','请切换到客户范围比较其他项目',403);
 if(name==='get_records_by_refs')for(const id of args.ids||[]){const r=record(id);if(r&&(r.customerId!==scope.customerId||scope.objectType!=='customer'&&!['customer','organization','contact','news'].includes(r.type)&&r.id!==scope.objectId&&r.entityId!==scope.objectId))throw new AppError('FORBIDDEN','来源记录不属于当前分析对象',403);}
 return args;
}
const chatNow=()=>new Date().toISOString();
export function createConversation(u:User,scope?:Scope){const r=scope?authorize(u,scope):null,at=chatNow();const c={id:uid('conversation'),userId:u.id,...(scope?{scope}:{}),kind:scope?.objectType==='opportunity'?'navigator':'general',title:r?.name||'新的对话',createdAt:at,lastMessageAt:at};put('conversations',c.id,c,u.id,scope?.objectId||null);return c;}
export function history(u:User,scope?:Scope){
 if(scope)authorize(u,scope);const messages=list('messages').filter(m=>m.userId===u.id&&m.role==='user');const runs=list('runs').filter(r=>r.userId===u.id);
 return list('conversations').filter(c=>c.userId===u.id&&(!scope||c.scope?.objectType===scope.objectType&&c.scope?.objectId===scope.objectId)).filter(c=>{try{if(c.scope)authorize(u,c.scope);if(c.cueAccess)own(u,'conversations',c.id);return true}catch{return false}}).map(c=>{const questions=messages.filter(m=>m.conversationId===c.id);const run=runs.find(r=>r.conversationId===c.id);const opportunity=c.scope?.objectType==='opportunity'?record(c.scope.objectId):null;const customer=opportunity?record(opportunity.customerId):null;return{...c,...(opportunity?{navigatorContext:{opportunityId:opportunity.id,opportunityName:opportunity.name,customerId:customer?.id||opportunity.customerId,customerName:customer?.name||'未设置客户名称'}}:{}),kind:c.scope?.objectType==='opportunity'?'navigator':'general',title:c.title===(c.scope?record(c.scope.objectId)?.name:null)&&questions.length?String(questions.at(-1).content).slice(0,48):c.title,messageCount:questions.length,lastQuestion:questions[0]?.content,lastStatus:run?.status||null};}).sort((a,b)=>Date.parse(b.lastMessageAt||b.createdAt)-Date.parse(a.lastMessageAt||a.createdAt));
}
export function recent(u:User){
 const map=new Map<string,any>();for(const c of history(u)){if(!c.messageCount||!c.scope)continue;const key=c.scope.objectType+':'+c.scope.objectId;const old=map.get(key);if(old){old.count++;old.turnCount+=c.messageCount;continue;}const r=record(c.scope.objectId);map.set(key,{...c,title:r.name,count:1,turnCount:c.messageCount});}return [...map.values()];
}
function actions(scope:Scope,purpose:ResponsePurpose='analysis',allowCreate=true):SuggestedAction[]{const buttons:SuggestedAction[]=[
{id:uid('action'),actionType:'generate_plan',label:scope.objectType==='customer'?'生成客户行动计划':'生成推进计划',goal:'基于本轮证据制定可执行推进计划'},
{id:uid('action'),actionType:'prepare_communication',label:'准备客户沟通',goal:'准备沟通目标、必问问题、议程及英文草稿'},
{id:uid('action'),actionType:'prepare_task',label:'整理下一步待办',goal:'请基于当前客户或项目的信息、进展和已有任务，汇总下一步待办建议，明确依据、责任角色、产出和完成判定；先核对已有待办，不创建记录'},
{id:uid('action'),actionType:'prepare_activity',label:'准备商务活动',goal:'请基于当前客户或项目的信息、联系人、进展和已有商务活动，准备活动目标、参与角色、会前资料、议程、关键问题和会后跟进计划；不创建记录'},
...(scope.objectType==='customer'?[]:[{id:uid('action'),actionType:'prepare_progress' as const,label:'创建进展记录',goal:'仅记录用户已明确反馈的实际进展，不将建议写成事实'}])
];if(allowCreate&&purpose==='task_suggestions')buttons.push({id:uid('action'),actionType:'create_task_draft',label:'创建待办草稿',goal:'将本轮明确建议新增的待办转为可编辑草稿，已有任务优先复用'});if(allowCreate&&purpose==='activity_plan')buttons.push({id:uid('action'),actionType:'create_activity_draft',label:'创建商务活动草稿',goal:'将本轮活动准备计划转为可编辑商务活动草稿'});return buttons.map(a=>({...a,presentation:['create_task_draft','create_activity_draft','prepare_progress'].includes(a.actionType)?'create':'question'}));}
export function startRun(u:User,token:string,conversationId:string,question:string,mode:Mode,options:{purpose?:ResponsePurpose;parentAnswerId?:string;origin?:MessageOrigin;profileUpdate?:boolean}={}){
 const c=own(u,'conversations',conversationId);authorize(u,c.scope);if(!question.trim()||question.length>12000)throw new AppError('INVALID_ARGUMENT','问题不能为空，最多12000字');
 if(c.scope.objectType==='lead'&&record(c.scope.objectId).status==='converted')throw new AppError('CONFLICT','该线索已转化，请在对应商机中新建对话；转化前记录保持只读',409);
 if(mode==='replay'&&!testRuntime())throw new AppError('UNSUPPORTED_MODE','固定响应只允许用于隔离自动化测试',400);
 if(mode==='live'&&!modelStatus().configured)throw new AppError('MODEL_NOT_CONFIGURED','尚未配置在线模型，不能运行真实Agent',503);
 if(options.profileUpdate&&c.scope.objectType==='customer')throw new AppError('INVALID_ARGUMENT','请进入具体项目对话更新画像');
 const portraitScope=resolveInterviewScope(u,c,question);const questionProfile=portraitScope?get('project_portraits',portraitId(u.id,portraitScope)):null;const projectQuestionContext=questionProfile?.onboarding?{dimension:questionProfile.onboarding.lastAskedDimension,question:questionProfile.onboarding.lastQuestion,crmStage:questionProfile.crmStage}:null;
 const messageId=uid('message');const run={id:uid('run'),answerId:uid('answer'),conversationId,userId:u.id,scope:c.scope,question,mode,userMessageId:messageId,portraitScope,projectQuestionContext,origin:options.origin||'user_input',responsePurpose:options.purpose||responsePurpose(question),parentAnswerId:options.parentAnswerId||null,profileUpdate:options.profileUpdate===true,status:'running',createdAt:chatNow()};
 const hasQuestion=list('messages').some(m=>m.conversationId===c.id&&m.role==='user');put('messages',messageId,{id:messageId,userId:u.id,conversationId,runId:run.id,role:'user',content:question,origin:run.origin,createdAt:run.createdAt},u.id,c.scope.objectId);
 put('conversations',c.id,{...c,...(c.scope.objectType==='customer'?{projectPortraitScope:portraitScope}:{}),title:hasQuestion?c.title:question.trim().slice(0,48),lastMessageAt:run.createdAt},u.id,c.scope.objectId);
 put('runs',run.id,run,u.id,c.scope.objectId);recordTurn(run,'running',{userMessageId:messageId});
 const controller=new AbortController();controllers.set(run.id,controller);
 void runAnswer(u,token,run,controller);
 return run;
}
async function runAnswer(u:User,token:string,run:any,controller:AbortController){
 let interview:any=null;let client:any;const retrieved=new Map<string,any>();let toolCount=0;let usage:any=null;
 const timeout=setTimeout(()=>controller.abort(),Number(process.env.MODEL_TIMEOUT_MS||120000));
 const wb:Workbench={scope:run.scope,goal:run.question,steps:[{id:'read',title:'读取当前对象的关联资料',status:'running'},{id:'analyze',title:'核对阶段证据与知识',status:'pending'},{id:'answer',title:'整理建议与可执行行动',status:'pending'}],sources:[],dataStatus:'loading'};
 const publish=(type:string,data:any)=>{addEvent(run.id,type,data);};
 const snapshot=()=>{put('workbenches',run.answerId,{...wb,userId:u.id,answerId:run.answerId,conversationId:run.conversationId,updatedAt:now()},u.id,run.scope.objectId);publish('workbench',wb);};
 const collect=(refs:SourceRef[])=>{wb.sources=[...new Map([...wb.sources,...refs].map(r=>[r.sourceKind+':'+r.entityType+':'+r.recordId+':'+(r.version||''),r])).values()];snapshot();};
 try{
 publish('run_started',run);publish('run_phase',{phase:'retrieving',label:'正在读取CRM关联资料'});snapshot();await initNavigatorKnowledge();if(run.profileUpdate){
 publish('run_phase',{phase:'analyzing',label:'正在梳理本次会话与当前画像'});wb.steps[0].title='读取本次会话与当前项目画像';wb.steps[0].status='completed';wb.steps[1].title='分析明确事实与画像差异';wb.steps[1].status='running';snapshot();
 const d=await proposeNavigatorUpdate(u,run.scope,run.conversationId);if(controller.signal.aborted)throw new AppError('CANCELLED','已取消');put('navigator_proposals',d.id,{...d,runId:run.id},u.id,run.scope.objectId);
 const text=d.analysis+(d.changes.length?'\n\n已整理'+d.changes.length+'项更新建议，请在下方核对；确认后再更新项目画像。':'\n\n本轮暂未提取到可直接更新的明确事实。请补充项目的实际状态，再整理更新建议。');publish('answer_delta',{text});
 wb.steps[1].status='completed';wb.steps[2].title='整理画像更新建议，等待用户确认';wb.steps[2].status='waiting_confirmation';wb.dataStatus='completed';snapshot();
 const answer={id:run.answerId,userId:u.id,scope:run.scope,conversationId:run.conversationId,runId:run.id,mode:run.mode,text,userQuestion:run.question,navigatorProposalId:d.id,navigatorActions:[],tools:[],actions:[],suggestionsVersion:SUGGESTIONS_VERSION,suggestionsStatus:'completed',sources:[],createdAt:chatNow(),promptVersion:ADVISOR_PROMPT_VERSION};put('answers',answer.id,answer,u.id,run.scope.objectId);put('messages',answer.id,{...answer,role:'assistant',content:text},u.id,run.scope.objectId);recordTurn(run,'completed',{completedAt:chatNow(),toolCount:0,answerPreview:text.slice(0,240)});publish('answer_completed',answer);put('runs',run.id,{...run,status:'completed',completedAt:chatNow(),toolCount:0},u.id,run.scope.objectId);publish('run_completed',{answerId:answer.id});return;
 }client=await connectMcp(token);
 const call=async(name:string,args:any)=>{if(controller.signal.aborted)throw new AppError('CANCELLED','已取消');args=boundToolArguments(run.scope,name,args);if(++toolCount>20)throw new AppError('LIMIT_EXCEEDED','工具调用达到20次上限');publish('tool_started',{name});const started=Date.now();try{const result=await callMcp(client,name,args);put('run_calls',uid('rc'),{runId:run.id,userId:u.id,name,args,recordRefs:result.recordRefs,durationMs:Date.now()-started,status:'success'},u.id,run.scope.objectId);for(const r of result.records||[])retrieved.set(r.id,r);collect(result.recordRefs||[]);return result;}catch(e:any){put('run_calls',uid('rc'),{runId:run.id,userId:u.id,name,args,status:'failed',message:e.message},u.id,run.scope.objectId);throw e;}};
 const scope=run.scope as Scope;interview=scope.objectType==='customer'?projectInterviewPlan(u,run.portraitScope||scope,run.question):null;const object=(await call('get_'+scope.objectType,{id:scope.objectId})).records[0];
 const essentials=scope.objectType==='customer'?['list_contacts','list_leads','list_opportunities','list_tasks','list_business_activities']:['list_contacts','list_project_contacts',scope.objectType==='lead'?'list_lead_progress':'list_opportunity_progress','list_tasks','list_business_activities','list_meeting_records','list_evidence_documents'];
 if(scope.objectType==='customer'&&run.responsePurpose!=='analysis')essentials.push('list_lead_progress','list_opportunity_progress','list_meeting_records');
 let partial=false;
 for(const name of essentials)try{await call(name,{scope,limit:12});}catch(e:any){partial=true;publish('notice',{message:name+'读取失败：'+e.message});}
 if(scope.objectType==='customer'){for(const p of [...retrieved.values()].filter(r=>['lead','opportunity'].includes(r.type)).slice(0,4))try{await call(p.type==='lead'?'list_lead_progress':'list_opportunity_progress',{scope,projectId:p.id,limit:8});}catch{partial=true;}}
 wb.steps[0].status='completed';wb.steps[1].status='running';wb.dataStatus=partial?'partial_failure':'completed';snapshot();
 const customer=scope.objectType==='customer'?object:(await call('get_customer',{id:scope.customerId})).records[0];
 const navigator=scope.objectType!=='customer'?navigatorContext(u,scope,run.question):null;
 const assessment=assess(scope,{entity:object,contacts:wb.sources.filter(s=>s.entityType==='contact')});const knowledge=searchKnowledge(run.question,object.stage||'all',customer.countryCode,object.businessMode||customer.businessMode||'all',!navigator||navigator.responsePolicy.resourcesRequested);
 collect(knowledge.map((k:any)=>({recordId:k.id,entityType:'knowledge',title:k.title,customerId:scope.customerId,updatedAt:'2026-10-25',capturedAt:now(),sourceKind:'knowledge',version:String(k.version),excerpt:k.body,sourceUrl:k.source?.url,reviewStatus:k.reviewStatus})));
 const memories=projectMemory(u,scope).filter(m=>m.kind==='user');
 collect(memories.map(m=>({recordId:m.id,entityType:'memory',title:m.title,customerId:scope.customerId,updatedAt:m.updatedAt,capturedAt:now(),sourceKind:'memory',version:String(m.version),excerpt:m.markdown})));
 wb.steps[1].status='completed';wb.steps[2].status='running';snapshot();publish('run_phase',{phase:'generating',label:'正在整理建议与推荐行动'});
 let inlineQuestions:any[]=[];let text='';let answerQuality:any=null;let suggestionFields:any[]|null=null;let navigatorActions:any[]=[];const purpose:ResponsePurpose=run.responsePurpose||'analysis';
 if(run.mode==='replay'){
 text='> 演示模式：以下由规则与固定模板组织，CRM数据经真实MCP读取，不代表在线模型推理。\n\n';
 text+='## '+object.name+'：当前推进判断\n\n';
 text+=scope.objectType==='customer'?'本轮综合该客户的线索、商机、联系人和活动；各项目的阶段、规模与参数保持独立。\n\n':'CRM正式阶段为 **'+object.stage+'**，证据评估为 **'+assessment.status+'**。\n\n';
 text+='当前优先把客户尚未确认的关键事项转成有负责人和产出的沟通。\n\n';
 text+='### 下一步推进\n'+assessment.actions.map((x:string,i:number)=>(i+1)+'. '+x+'，明确负责人、时间与期望产出。').join('\n')+'\n\n';
 if(customer.businessMode==='commercial_industrial')text+='工商业收益讨论先收集负荷、电费、投资方式、运行策略和场地资料，不能直接承诺回收期。\n\n';
 if(customer.businessMode==='channel_project')text+='渠道评估应分别核实伙伴服务能力和首批真实机会，可安排联合评审后再决定资源投入。\n\n';
 if(/英文|话术|沟通|议程/.test(run.question))text+='### 沟通草稿\n“我们先一起确认需求、评审标准和关键节点，再讨论能够推进的技术与商务方案。”\n\n英文草稿：Let us first align the scope, evaluation criteria and next decision milestone before discussing commercial options.\n\n';
 text+='### 优先核实\n'+(assessment.questions||['各机会的优先级依据是什么？','关键联系人能否安排跨项目沟通？']).slice(0,3).map((q:string)=>'- '+q).join('\n');
 
 if(acknowledgement(run.question))text='> 演示模式：以下由规则与固定模板组织。\n\n'+(/偏好|负责|理解/.test(run.question)?'理解，我会先回应你的当前需求，再给可执行建议；长期信息由后台按原话提取。':'你好，可以告诉我你想优先推进哪个客户或项目，以及当前最想解决的问题。');
 else if(/竞品|便宜|降价|价格异议|价差/.test(run.question)){const rs=[...retrieved.values()];const buyer=rs.find(r=>r.type==='contact'&&/采购/.test(r.title)),tech=rs.find(r=>r.type==='contact'&&/技术/.test(r.title));text='> 演示模式：以下由规则与固定模板组织，CRM数据经真实MCP读取，不代表在线模型推理。\n\n## '+object.name+'：价格异议回应\n\n先把价差放回同一比较口径，不凭转述直接让价。\n\n1. **向'+(buyer?.name||'采购角色')+'核实报价来源**：确认是口头转述还是完整报价，产出客户可提供的范围和条件清单。\n2. **与'+(tech?.name||'技术角色')+'对齐边界**：核实容量口径、供货接口、服务和质保前提，产出一页同口径比较。\n3. **再讨论条件交换**：确认差异后，由销售核对内部授权，形成客户可判断的条件方案。\n\n可用话术：“谢谢反馈，我们先把范围、容量口径和服务条件放在一起核对；确认可比后，我再核对内部授权，给您正式回应。”';}
 if(navigator&&!navigator.responsePolicy.detailed&&purpose==='analysis'&&!acknowledgement(run.question)){text='> 演示模式：规则组织，非在线模型推理。\n\n## 结论\n先确认当前最关键的客户决策条件，同时推进可并行的需求核实。\n\n## 项目简述\n'+object.name+'当前商机阶段为'+object.stage+'。'+String(object.description||'需求与采购路径需结合最新沟通确认。').slice(0,160)+'\n\n## 推进建议（待办）\n'+assessment.actions.slice(0,navigator.responsePolicy.maxActions).map((a:string,i:number)=>(i+1)+'. '+a+'，明确客户责任人与可检查的产出。').join('\n')+'\n\n先确认：'+String(assessment.questions?.[0]||'下一步由哪位客户负责人确认？').replace(/[？?]+$/,'')+'？';}
 if(purpose!=='analysis'){const plan=replaySuggestions(purpose,scope,object,assessment,[...retrieved.values()],u);text='> 演示模式：以下由规则与固定模板组织，CRM数据经真实MCP读取，不代表在线模型推理。\n\n'+plan.text;suggestionFields=plan.fields;}
 for(let i=0;i<text.length;i+=48){if(controller.signal.aborted)throw new AppError('CANCELLED','已取消');publish('answer_delta',{text:text.slice(i,i+48)});await new Promise(r=>setTimeout(r,8));}
 }else{
 const available=(await client.listTools()).tools.filter((t:any)=>!toolSpecs[t.name]?.write);
 const tools=available.map((t:any)=>({type:'function',function:{name:t.name,description:t.description,parameters:t.inputSchema}}));
 const old=list('messages').filter(m=>m.conversationId===run.conversationId&&m.userId===u.id).reverse().slice(-12);
 const parent=run.parentAnswerId?own(u,'answers',run.parentAnswerId):null;const context={scope,object,assessment,dataVersion:'2026.10.27-v2-linked',responsePurpose:purpose,previousAnswer:parent?{id:parent.id,text:parent.text.slice(0,1800)}:null,retrievedRecords:[...retrieved.values()],records:wb.sources.filter(s=>s.sourceKind==='crm'),knowledge,memories:[],projectPortraits:[],structuredProfiles:structuredProfileContext(u,scope,run.question),focusedProject:run.portraitScope?record(run.portraitScope.objectId):null,projectInterview:interview};
 const messages:any[]=[{role:'system',content:suggestionInstructions[purpose]},{role:'system',content:VISUALIZATION_PROMPT},{role:'system',content:advisorPolicy},{role:'system',content:WEB_SEARCH_POLICY},{role:'system',content:PROJECT_PORTRAIT_POLICY},{role:'system',content:INTERVIEW_POLICY},{role:'system',content:INLINE_FOLLOWUPS_PROMPT},{role:'system',content:'以最新CRM结构化数据为准。客户/项目联系人通过关联记录确定，不使用其他客户姓名；旧历史回答可能引用已升级的样例，不把旧回答当当前事实。evidence布尔值仅为线索，是否合同已签、许可已批、资金到账以具体状态和证据为准，不从阶段号推断。当前应用上下文（其中用户陈述仍需核实）：'+JSON.stringify(context)},...old.filter(m=>m.role!=='user'||!isInternalText(m.content)).map(m=>({role:m.role,content:m.role==='assistant'?m.content.slice(0,600):m.content}))];
 if(navigator)messages.splice(messages.findIndex(m=>m.role!=='system')<0?messages.length:messages.findIndex(m=>m.role!=='system'),0,{role:'system',content:navigator.responsePolicy.instructions});
 if(scope.objectType!=='customer')messages.unshift({role:'system',content:NAVIGATOR_POLICY+'\n'+NAVIGATOR_OUTPUT_PROMPT+'\n当前项目赢单领航员上下文：'+JSON.stringify(navigator)});
 let done=false;
 for(let round=0;round<8;round++){
 let roundText='',sent='';publish('run_phase',{phase:'generating',label:'正在整理建议与推荐行动'});
 const msg=await modelTurn(messages,tools,controller.signal,chunk=>{roundText+=chunk;const visible=visibleStreamText(roundText);if(visible.startsWith(sent)){const delta=visible.slice(sent.length);if(delta)publish('answer_delta',{text:delta});}else publish('answer_replace',{text:visible});sent=visible;});usage=msg.usage||usage;messages.push({role:'assistant',content:msg.content||null,...(msg.tool_calls.length?{tool_calls:msg.tool_calls}:{})});
 if(!msg.tool_calls.length){text=msg.content||'';done=true;break;}publish('answer_replace',{text:''});publish('run_phase',{phase:'retrieving',label:'正在补充核对关联信息'});publish('notice',{message:'正在核对关联信息…'});
 for(const tc of msg.tool_calls){let result:any;try{if(tc.function.name!=='web_search'&&(!toolSpecs[tc.function.name]||toolSpecs[tc.function.name].write))throw new AppError('UNSUPPORTED_CAPABILITY','分析时只能查询');result=await call(tc.function.name,JSON.parse(tc.function.arguments||'{}'));}catch(e:any){result={error:e.code||'INVALID_ARGUMENT',message:e.message};}messages.push({role:'tool',tool_call_id:tc.id,content:JSON.stringify(result)});}
 }
 if(!done)throw new AppError('LIMIT_EXCEEDED','模型达到8轮工具循环上限');
 if(!text.trim())throw new AppError('MODEL_API_ERROR','模型没有返回有效回答');
 const separated=splitInlineFollowups(text);const navigatorOutput=splitNavigatorOutput(separated.text);text=navigatorOutput.text;navigatorActions=navigatorOutput.actions.filter(a=>!navigator||navigator.responsePolicy.resourcesRequested||!requestsInternalResources(a.title+'，'+a.description)).slice(0,navigator?.responsePolicy.maxActions||8);inlineQuestions=separated.questions;
 publish('run_phase',{phase:'refining',label:'正在校对答案与推荐行动'});const refined=await refineAnswer(text,run.question,[...retrieved.values()],controller.signal,{navigator:!!navigator,navigatorActions});text=refined.text;answerQuality=refined.quality;
 publish('answer_replace',{text});
 }
 const interviewText=interviewSection(interview);if(interviewText){text+=interviewText;publish('answer_delta',{text:interviewText});}
 wb.steps[2].status='completed';snapshot();if(run.mode==='replay'&&scope.objectType!=='customer'&&purpose==='analysis'&&!acknowledgement(run.question))navigatorActions=assessment.actions.slice(0,3).map((s:string,i:number)=>({id:'nav-action-'+i,title:s,description:s+'，与相关负责人核实实际状态、下一节点与预期产出。',dueAt:null}));
 const allActions=actions(scope,purpose,suggestionFields===null||suggestionFields.length>0);const toolsForAnswer=allActions.filter(a=>!isCreateAction(a));const suggested=allActions.filter(a=>isCreateAction(a)&&(a.actionType!=='prepare_progress'||/客户.*反馈|已确认|已完成|记录.*进展/.test(run.question)));
 const answer={navigator,navigatorActions,id:run.answerId,userId:u.id,scope,conversationId:run.conversationId,runId:run.id,mode:run.mode,text,quality:answerQuality,projectInterview:interview,userQuestion:run.question,responsePurpose:purpose,suggestionFields,tools:toolsForAnswer,actions:suggested,suggestionsVersion:SUGGESTIONS_VERSION,suggestionsStatus:'completed',sources:wb.sources,assessment,createdAt:chatNow(),usage,toolCount,knowledgeVersion:2,promptVersion:ADVISOR_PROMPT_VERSION};
 publish('run_phase',{phase:'finalizing',label:'正在整理猜你想问'});try{const questions=await generateFollowups(u,answer,run.mode==='live'?inlineQuestions:undefined);answer.actions=[...questions,...suggested];}catch{answer.suggestionsStatus='unavailable';}
 markInterviewAsked(u,interview);put('answers',answer.id,answer,u.id,scope.objectId);put('messages',answer.id,{...answer,role:'assistant',content:text},u.id,scope.objectId);
 recordTurn(run,'completed',{completedAt:chatNow(),toolCount,answerPreview:text.slice(0,240)});clearTimeout(timeout);publish('answer_completed',visibleAnswer(get('answers',answer.id)));put('runs',run.id,{...run,status:'completed',completedAt:chatNow(),toolCount,usage},u.id,scope.objectId);publish('run_completed',{answerId:answer.id});
 try{const source=sourceForRun(run);put('profile_capture_jobs',run.id,{id:run.id,userId:u.id,source,mode:run.mode,status:'running',attempts:0},u.id,source.scope?.objectId||null);const prior=list('messages').filter(m=>m.userId===u.id&&m.conversationId===run.conversationId&&m.role==='user'&&m.origin==='user_input').reverse();let structuredUpdates:any[]=[];const extracted=run.mode==='live'?await extractLiveMemory(source,prior,updates=>{structuredUpdates=updates;applyPortraitUpdates(u,source.scope,source,updates.length?updates:undefined);}):undefined;if(run.mode!=='live')applyPortraitUpdates(u,source.scope,source);captureMemory(u,source.scope,source,assessment,extracted);updateStructuredProfilesSkill(u,source.scope,source,[...conservativePatches(source),...(extracted||[])],structuredUpdates.length?structuredUpdates:conservativePortraitUpdates(source));put('profile_capture_jobs',run.id,{id:run.id,userId:u.id,status:'completed'},u.id,source.scope?.objectId||null);publish('memory_status_changed',{status:'completed'});}catch(e:any){const profileJob=get('profile_capture_jobs',run.id);if(profileJob)put('profile_capture_jobs',run.id,{...profileJob,status:'failed',message:e.message},u.id,scope.objectId);try{applyPortraitUpdates(u,run.portraitScope||scope,sourceForRun(run));}catch{}put('memory_jobs',answer.id,{answerId:answer.id,status:'failed',message:e.message},u.id,scope.objectId);publish('memory_status_changed',{status:'failed',message:e.message});}
 }catch(e:any){wb.steps.filter(s=>s.status==='running').forEach(s=>s.status='failed');snapshot();put('runs',run.id,{...run,status:controller.signal.aborted?'cancelled':'failed',completedAt:chatNow(),error:e.message,code:e.code||'RUN_FAILED'},u.id,run.scope.objectId);recordTurn(run,controller.signal.aborted?'cancelled':'failed',{completedAt:chatNow(),toolCount,error:e.message});publish('run_failed',{message:e.message,code:e.code||'RUN_FAILED'});}
 finally{clearTimeout(timeout);controllers.delete(run.id);if(client)await client.close().catch(()=>{});}
}
export async function prepareAction(u:User,token:string,answerId:string,actionId:string,requestedMode?:Mode){
 const a=own(u,'answers',answerId);authorize(u,a.scope);const action=[...(a.actions||[]),...(a.tools||[])].find((x:any)=>x.id===actionId);if(!action)throw new AppError('INVALID_ARGUMENT','按钮不属于当前回答');
 if(action.actionType==='followup')return{prefill:action.goal};
 if(['analyze','generate_plan','prepare_communication','prepare_task','prepare_activity'].includes(action.actionType)){
 const purpose:ResponsePurpose=action.actionType==='prepare_task'?'task_suggestions':action.actionType==='prepare_activity'?'activity_plan':'analysis';
 const goal=action.actionType==='followup'?action.goal:action.label;
 return{run:startRun(u,token,a.conversationId,goal,requestedMode||a.mode,{purpose,parentAnswerId:a.id,origin:action.actionType==='followup'?'suggestion_click':'tool_shortcut'})};
 }
 if(action.actionType==='prepare_progress')return{needsInput:true,kind:a.scope.objectType==='lead'?'lead_progress':'opportunity_progress',message:'请填写客户已经明确反馈或实际发生的进展，不把建议记录为已完成事实。'};
 if(!['create_task_draft','create_activity_draft'].includes(action.actionType))throw new AppError('UNSUPPORTED_CAPABILITY','不是支持的创建建议');
 const kind=action.actionType==='create_activity_draft'?'activity':'task';const at=new Date(Date.now()+3*86400000).toISOString();
 let existing:any[]=[];if(kind==='task'){const c=await connectMcp(token);try{existing=(await callMcp(c,'list_tasks',{scope:a.scope,limit:30})).records;}finally{await c.close();}}
 let items:any[]=a.suggestionFields||[];
 if((requestedMode||a.mode)==='live'){
 const template=kind==='task'?{title:'填写本轮明确建议新增的待办',description:'依据与具体产出、完成判定',assigneeId:u.id,dueAt:at,priority:'P1'}:{title:'填写本轮活动计划主题',description:'活动目标、参与角色、会前准备、议程及预期产出',scheduledAt:at,activityType:'meeting'};
 const response=await modelTurn([{role:'system',content:'根据本轮已完成建议生成CRM草稿，只返回JSON：{"items":[字段对象]}，1至3项（活动仅1项）。没有合适新增项则items为空。只选本轮明确建议新增的项，不重复已有待办，不把处理现有任务变成新建；不得更改对象或身份，不声称执行。字段只能来自模板；时间为有效ISO8601，未确认排期用模板占位等待用户编辑。模板：'+JSON.stringify(template)},{role:'user',content:JSON.stringify({scope:a.scope,answer:a.text,existingTasks:existing})}],[],AbortSignal.timeout(45000),()=>{});
 let parsed;try{parsed=JSON.parse(response.content.replace(/^\x60\x60\x60(?:json)?\s*|\x60\x60\x60$/g,''));}catch{throw new AppError('INVALID_ARGUMENT','模型草稿不是有效JSON，未执行创建');}
 items=z.object({items:z.array(z.record(z.string(),z.unknown())).max(kind==='task'?3:1)}).parse(parsed).items;
 }
 if(kind==='task')items=items.filter(f=>!existing.some(r=>(r.title||r.name||'').trim().toLowerCase()===String(f.title||'').trim().toLowerCase()&&r.status!=='completed'&&(a.scope.objectType!=='customer'||!r.entityId)));
 if(!items.length)throw new AppError('NO_NEW_ITEMS','本轮没有需要新增的记录，可能已有同名待办；请先在对话中核对或完善建议');
 for(const fields of items)validateFields(u,kind,a.scope,fields);
 const drafts=items.map(fields=>makeDraft(u,a.scope,kind,fields,a.id));return{draft:drafts[0],drafts};
}
export async function executeBatch(u:User,token:string,items:{id:string;version:number}[]){
 if(!items.length||items.length>10)throw new AppError('INVALID_ARGUMENT','每批1–10条');
 const results=[];for(const item of items){try{const result=await executeDraft(u,token,item.id,item.version);results.push({draftId:item.id,status:'succeeded',result});}catch(e:any){results.push({draftId:item.id,status:'failed',message:e.message});}}
 return{status:results.every(r=>r.status==='succeeded')?'succeeded':results.some(r=>r.status==='succeeded')?'partial_success':'failed',results};
}
export async function executeDraft(u:User,token:string,id:string,version:number){
 const {draft,toolName,args}=approveDraft(u,id,version);const old=get('executions',args.confirmationToken);if(old?.status==='succeeded')return old;
 put('drafts',id,{...draft,status:'executing'},u.id,draft.scope.objectId);const client=await connectMcp(token);
 try{const result=await callMcp(client,toolName,args);const execution={id:args.confirmationToken,userId:u.id,scope:draft.scope,status:'succeeded',result,at:now()};put('executions',execution.id,execution,u.id,draft.scope.objectId);put('drafts',id,{...draft,status:'succeeded',result},u.id,draft.scope.objectId);return execution;}
 catch(e:any){put('drafts',id,{...draft,status:'failed',error:e.message},u.id,draft.scope.objectId);put('executions',args.confirmationToken,{id:args.confirmationToken,userId:u.id,scope:draft.scope,status:'failed',error:e.message},u.id,draft.scope.objectId);throw e;}
 finally{await client.close();}
}

