import {businessDay} from '../../../packages/workbench.ts';
import {createHash} from 'node:crypto';
import {allRecords,get,list,now,record,put} from './db.ts';
import {allowedRecord,authorize,ref} from './crm.ts';
import {cuePersona,inManagedScope,managedTeams,projectTeam} from './spp.ts';
import type {Scope,SourceRef,User} from '../../../packages/contracts/index.ts';

export const CUE_RULE_VERSION=2;
export type CueCandidate={key:string;scope:Scope;title:string;description:string;priority:number;sources:SourceRef[];context:unknown;scenario:string;teamId?:string;aggregate?:boolean};
const day=86400000,ended=(r:any)=>['completed','closed','cancelled','converted','lost','won'].includes(r.status);
const time=(r:any)=>Date.parse(r.occurredAt||r.completedAt||r.updatedAt||'');
const effective=(r:any)=>!r.aiGenerated&&!['ai_generated','system'].includes(r.origin)&&!r.demoSummary&&!['cancelled','draft'].includes(r.status)&&String(r.content||r.description||r.outcome||'').trim().length>=5;
function canRead(u:User,r:any){try{allowedRecord(u,r.id);return true;}catch{return false;}}
function objectScope(r:any):Scope{const p=r.entityId?record(r.entityId):r;return{objectType:p?.type==='lead'?'lead':p?.type==='opportunity'?'opportunity':'customer',objectId:p?.id||r.customerId,customerId:r.customerId};}
function project(r:any){return ['lead','opportunity'].includes(r.type);}
function activeProject(r:any){return project(r)&&!ended(r)&&(r.type==='lead'||['S1','S2','S3','S4'].includes(r.stage));}
export function cueScopeMember(u:User,r:any){const persona=cuePersona(u);if(['spp_leader','regional_president'].includes(persona))return inManagedScope(u,r);const p=r.entityId?record(r.entityId):r;return persona==='sales'&&((p?.primarySalesId||p?.ownerId)===u.id||r.type==='task'&&r.assigneeId===u.id||r.type==='activity'&&r.createdBy===u.id);}
export function trackGapObservations(u:User){for(const team of managedTeams(u)){for(const p of allRecords('opportunity').filter(p=>projectTeam(p)?.id===team.id&&activeProject(p)&&p.isKey===true)){const key=team.id+':'+p.id,old=get('cue_gap_observations',key),hasPlan=allRecords('task').some(t=>t.entityId===p.id&&!ended(t)&&t.assigneeId&&t.dueAt)||p.nextAction?.ownerId&&p.nextAction?.dueAt&&p.nextAction?.description&&p.nextAction.status!=='completed';if(hasPlan){if(old)put('cue_gap_observations',key,{...old,firstSeenAt:null,resolvedAt:now()});}else if(!old?.firstSeenAt)put('cue_gap_observations',key,{projectId:p.id,teamId:team.id,firstSeenAt:now()});}}}
export function scenarioCandidates(u:User,signals:{recordId:string;quote:string;axes:string[]}[]=[],unbounded=false):CueCandidate[]{
 const at=Date.parse(now()),rows=allRecords().filter(r=>canRead(u,r)).map(r=>{const signal=signals.find(s=>s.recordId===r.id);return signal?{...r,materialChange:{confirmed:true,affectedAxes:signal.axes},content:signal.quote}:r;}),persona=cuePersona(u),result:CueCandidate[]=[];
 const progress=rows.filter(r=>['lead_progress','opportunity_progress'].includes(r.type)&&effective(r));
 const activities=rows.filter(r=>r.type==='activity'&&!['cancelled','closed'].includes(r.status));
 const contact=(p:any)=>progress.filter(r=>r.entityId===p.id&&(r.progressKind==='contact'||/已.*(?:联系|沟通|拜访)|电话联系|客户反馈/.test(r.content||''))).length||activities.some(a=>a.entityId===p.id&&(a.completedAt||a.occurredAt)&&effective(a));
 const add=(scenario:string,r:any,title:string,description:string,priority:number,occurrence:unknown,extra:any[]=[],teamId?:string)=>{const scope=objectScope(r);authorize(u,scope);const p=record(scope.objectId);const sources=[r,p,...extra].filter((x,i,a)=>x&&canRead(u,x)&&a.findIndex(y=>y?.id===x.id)===i).map(ref) as SourceRef[];result.push({key:createHash('sha256').update(JSON.stringify([u.id,scenario,r.id,occurrence])).digest('hex').slice(0,24),scope,title,description,priority,sources,context:{persona,snapshotAt:now(),factsOnly:true},scenario,teamId});};
 if(persona==='sales'){
  for(const p of rows.filter(r=>activeProject(r)&&(r.primarySalesId||r.ownerId)===u.id)){
   if(p.type==='lead'&&at-Date.parse(p.assignedAt||p.createdAt)>day&&!contact(p))add('new_lead_contact',p,'首次联系'+p.name,'线索分配已超过24小时，尚无有效首次联系记录。请联系客户，确认需求、联系人及下一步，并记录沟通结果。',2,p.assignedAt||p.createdAt);
   if(p.type==='opportunity'){
    const mpt=get('profile_shared_mpt',p.id);
    if(mpt?.assessed){const changes=progress.filter(r=>r.entityId===p.id&&r.materialChange?.confirmed===true&&r.materialChange?.affectedAxes?.some((a:string)=>['M','P','T'].includes(a))&&time(r)>Date.parse(mpt.updatedAt));for(const change of changes)add('mpt_review',change,'复核'+p.name+'的MPT定位',`MPT评估后出现已确认变化：${change.content}。请结合变化复核${change.materialChange.affectedAxes.join('、')}定位；系统不会自动调整阶段。`,2,change.id,[p]);}
   }
  }
  for(const t of rows.filter(r=>r.type==='task'&&r.assigneeId===u.id&&!ended(r)&&r.priority==='P1'&&Date.parse(r.dueAt)<at))add('critical_task_overdue',t,'完成逾期任务：'+t.name,`关键待办截止时间为${t.dueAt}。${t.description||t.content||''} 请确认交付内容并完成；确需延期时与相关人员重新约定时间。`,1,t.dueAt);
  for(const a of activities.filter(r=>r.createdBy===u.id)){
   const scheduled=Date.parse(a.scheduledAt),missing=rows.filter(r=>r.type==='task'&&a.preparationTaskIds?.includes(r.id)&&!ended(r));
   if(a.important===true&&scheduled>at&&scheduled<=at+day&&missing.length)add('communication_preparation',a,'准备'+a.name+'所需材料',`沟通安排在${a.scheduledAt}，已明确的准备任务尚未完成：${missing.map(t=>t.name).join('、')}。请会前确认材料及责任人。`,1,a.scheduledAt,missing);
   const outcomes=progress.some(r=>r.activityId===a.id)||rows.some(r=>r.type==='meeting'&&r.activityId===a.id&&effective(r));
   if(scheduled<at-day&&!outcomes&&!a.outcomeConfirmed&&!a.outcome)add('activity_result',a,'确认'+a.name+'的沟通结果',a.occurredAt||a.completedAt?'活动已记录发生，但尚无确认结果或关联进展。请补录客户反馈、结论和下一步安排。':'活动计划时间已过24小时，尚无实际发生及结果的确认记录。请先确认是否举行，再补录结果或调整安排。',2,a.scheduledAt);
  }
 }
 if(['spp_leader','regional_president'].includes(persona)){
  const president=persona==='regional_president';
  for(const team of managedTeams(u)){
   const teamRows=rows.filter(r=>projectTeam(r.entityId?record(r.entityId)||r:r)?.id===team.id),projects=teamRows.filter(r=>r.type==='opportunity'&&activeProject(r)&&r.isKey===true);
   const group=(scenario:string,items:any[],title:string,description:string,priority:number)=>{if(!items.length)return;const first=items[0];add(scenario,first,title,description,priority,[team.id,items.map(r=>r.id).sort()],items.slice(1),team.id);const c=result[result.length-1];c.aggregate=true;};
   const stale=teamRows.filter(r=>r.type==='customer'&&r.level==='S'&&!progress.some(p=>p.customerId===r.id&&time(p)>=at-7*day)&&!activities.some(a=>a.customerId===r.id&&Date.parse(a.occurredAt||a.completedAt||a.scheduledAt)>=at-7*day&&Date.parse(a.occurredAt||a.completedAt||a.scheduledAt)<=at));
   group('s_customer_coverage',stale,team.name+'：安排S级客户跟进',`近7天未见有效商务活动或线索/商机进展的S级客户：${stale.map(r=>r.name).join('、')}。请确认经营安排，记录缺失不等于实际未跟进。`,2);
   const gaps=projects.filter(p=>!rows.some(r=>r.type==='task'&&r.entityId===p.id&&!ended(r)&&r.assigneeId&&r.dueAt)&&!(p.nextAction?.ownerId&&p.nextAction?.dueAt&&p.nextAction?.description&&p.nextAction.status!=='completed'));
   const persistent=gaps.filter(p=>{const o=get('cue_gap_observations',team.id+':'+p.id);return o?.firstSeenAt&&at-Date.parse(o.firstSeenAt)>=7*day;});
   group('project_next_action',president?persistent:gaps,team.name+'：明确重点商机推进安排',`${(president?persistent:gaps).map(p=>p.name).join('、')}缺少责任人、日期及具体下一步。${president?'该缺口持续超过7天，请与SPP Leader确认处置计划。':'请与主责销售、PM、PD确认可执行的下一步。'}`,2);
   const changes=progress.filter(r=>projects.some(p=>p.id===r.entityId)&&r.materialChange?.confirmed===true&&time(r)>=at-7*day);
   group('major_project_change',changes,team.name+'：复核重点商机重大变化',changes.map(r=>record(r.entityId)?.name+'：'+r.content).join('；')+'。请确认对项目推进及团队安排的影响。',1);
   const requests=teamRows.filter(r=>r.managementRequest?.status==='open'&&Date.parse(r.managementRequest.neededBy)>at&&Date.parse(r.managementRequest.neededBy)<=at+7*day&&(!president||r.managementRequest.requiresRegionalCoordination===true));
   group('management_intervention',requests,team.name+'：确认'+(president?'跨团队协调':'评审或投标介入')+'安排',requests.map(r=>r.name+'：'+r.managementRequest.reason+'，需要时间'+r.managementRequest.neededBy).join('；')+'。请确认负责人及决策安排。',1);
   const sales=team.members.filter(m=>m.role==='S'&&teamRows.some(p=>activeProject(p)&&(p.primarySalesId||p.ownerId)===m.userId));
   const metric=(start:number,end:number)=>sales.map(m=>{const records=progress.filter(r=>r.createdBy===m.userId&&time(r)>=start&&time(r)<end&&inManagedScope(u,r)&&projectTeam(record(r.entityId))?.id===team.id);const activity=activities.filter(r=>r.createdBy===m.userId&&r.completedAt&&Date.parse(r.completedAt)>=start&&Date.parse(r.completedAt)<end&&effective(r)&&projectTeam(record(r.entityId)||r)?.id===team.id);const days=new Set([...records,...activity].map(r=>businessDay(new Date(time(r)))).filter(d=>{const weekday=new Date(d+'T00:00:00Z').getUTCDay();return weekday!==0&&weekday!==6;}));let workingDays=0;for(let t=start;t<end;t+=day){const d=new Date(businessDay(new Date(t))+'T00:00:00Z').getUTCDay();if(d!==0&&d!==6)workingDays++;}return{...m,records:[...records,...activity],rate:days.size/Math.max(1,workingDays)};});
   const current=metric(at-28*day,at),average=current.reduce((s,m)=>s+m.rate,0)/Math.max(1,current.length),previous=metric(at-56*day,at-28*day),oldAverage=previous.reduce((s,m)=>s+m.rate,0)/Math.max(1,previous.length);
   const low=current.filter(m=>m.records.length===0||m.rate<average),persistentLow=low.filter(m=>!previous.find(x=>x.userId===m.userId)?.records.length||(previous.find(x=>x.userId===m.userId)?.rate||0)<oldAverage);
   if(sales.length>=2&&(president?persistentLow:low).length){const lowSet=president?persistentLow:low;const evidence=current.flatMap(m=>m.records);if(!evidence.length)evidence.push(...teamRows.filter(p=>activeProject(p)));group('sales_record_frequency',evidence,team.name+'：确认销售推进记录覆盖',`近28天按工作日计算的有效推进记录覆盖，${lowSet.map(m=>m.userId).join('、')}没有有效记录或低于团队平均。${president?'前一28天窗口也存在同类差异。':''}请先核实分工、在岗情况及记录完整性；这不是业绩或工作投入结论。统计仅包含销售，不将PM和PD纳入比较。`,3);}
  }
 }
 for(const c of result){const p=record(c.scope.objectId);if(p?.type!=='opportunity')continue;const shared=get('profile_documents',`project:${p.id}:shared`),mpt=get('profile_shared_mpt',p.id),personal=!c.aggregate?get('profile_documents',`project:${p.id}:${u.id}`):null;
  const fields=(doc:any)=>Object.fromEntries(Object.entries<any[]>(doc?.fields||{}).map(([k,v])=>[k,v.filter(e=>e.status==='effective').map(e=>({content:e.content,updatedAt:e.updatedAt}))]));
  c.context={...(c.context as any),projectProfile:{shared:Object.fromEntries(Object.entries(fields(shared)).filter(([k])=>/^(identity|background|mpt|stages)\./.test(k))),myPrivate:personal?fields(personal):undefined,mpt:mpt?{stages:mpt.stages,assessed:mpt.assessed,updatedAt:mpt.updatedAt,version:mpt.version}:null}};
  if(mpt)c.sources.push({...ref(p),sourceKind:'profile',entityType:'project_profile',title:p.name+' · 共享MPT定位',profileVersion:mpt.version,updatedAt:mpt.updatedAt,excerpt:JSON.stringify(mpt.stages)});
 }
 if(unbounded)return result;const relevance=(c:CueCandidate)=>{const r=record(c.sources[0].recordId);return Date.parse(r?.occurredAt||r?.scheduledAt||r?.dueAt||r?.assignedAt||r?.updatedAt||'')||0;};const counts=new Map<string,number>();return result.sort((a,b)=>a.priority-b.priority||relevance(b)-relevance(a)||a.key.localeCompare(b.key)).filter(c=>{const k=c.scenario+':'+(c.teamId||'personal'),n=counts.get(k)||0;counts.set(k,n+1);return n<4;}).slice(0,32);
}
