import {managedSalesIds,managedTeams,inManagedScope} from './spp.ts';
import {z} from 'zod';
import {randomBytes} from 'node:crypto';
import {db,record,allRecords,saveRecord,put,get,list,uid,now,meta} from './db.ts';
import {AppError,scopeSchema,type Scope,type User,type Draft} from '../../../packages/contracts/index.ts';
export function users():User[]{return(db.prepare('SELECT * FROM users').all() as any[]).map(u=>({id:u.id,name:u.name,role:u.role,teamId:u.team_id}));}
export function user(id:string){const u=users().find(u=>u.id===id);if(!u)throw new AppError('FORBIDDEN','用户不存在',403);return u;}
export function session(userId:string){user(userId);const token=randomBytes(32).toString('hex');put('sessions',token,{userId});return token;}
export function fromToken(token:string){const s=get('sessions',token);if(!s)throw new AppError('FORBIDDEN','请重新选择Mock用户',401);return user(s.userId);}
export function canAccess(u:User,customerId:string){const c=record(customerId);if(!c||c.type!=='customer')return false;const owner=users().find(x=>x.id===c.ownerId);return u.role==='admin'||c.ownerId===u.id||(u.role==='manager'&&(owner?.teamId===u.teamId||managedSalesIds(u).has(c.ownerId)));}
export function allowedRecord(u:User,id:string,type?:string){const r=record(id);if(!r)throw new AppError('NOT_FOUND','记录不存在',404);if(type&&r.type!==type)throw new AppError('INVALID_ARGUMENT','实体类型不匹配');if(!canAccess(u,r.customerId))throw new AppError('FORBIDDEN','无权访问当前对象',403);return r;}
export function authorize(u:User,scope:Scope){scopeSchema.parse(scope);const r=allowedRecord(u,scope.objectId,scope.objectType);if(r.customerId!==scope.customerId)throw new AppError('INVALID_ARGUMENT','客户归属不一致');return r;}
export function own(u:User,collection:string,id:string){const d=get(collection,id);if(!d)throw new AppError('NOT_FOUND','记录不存在',404);if(d.userId!==u.id)throw new AppError('FORBIDDEN','此会话/执行记录不属于当前用户',403);if(d.scope)authorize(u,d.scope);if(collection==='conversations'&&d.cueAccess){if(!managedTeams(u).some(t=>t.id===d.cueAccess.teamId))throw new AppError('FORBIDDEN','团队管理权限已变化',403);for(const id of d.cueAccess.recordIds){const r=allowedRecord(u,id);if(!inManagedScope(u,r))throw new AppError('FORBIDDEN','团队范围已变化',403);}}if(collection==='runs'&&d.conversationId&&get('conversations',d.conversationId)?.cueAccess)own(u,'conversations',d.conversationId);return d;}
export function ref(r:any){return{recordId:r.id,entityType:r.type,title:r.name,customerId:r.customerId,updatedAt:r.updatedAt,capturedAt:new Date().toISOString(),sourceKind:'crm',excerpt:r.content||r.summary||r.description||'',relation:{objectType:r.entityType||'customer',objectId:r.entityId||r.customerId}};}
const querySchema=z.object({projectId:z.string().optional(),customerId:z.string().optional(),scope:scopeSchema.optional(),query:z.string().max(200).optional(),stage:z.string().optional(),status:z.string().optional(),cursor:z.number().int().min(0).default(0),limit:z.number().int().min(1).max(30).default(20)});
const idSchema=z.object({id:z.string().min(1)});
export const toolSpecs:Record<string,{schema:z.ZodObject<any>;description:string;type?:string;write?:boolean}>={
 search_customers:{schema:querySchema,description:'搜索有权限的客户，支持关键词与分页。',type:'customer'},
 get_customer:{schema:idSchema,description:'按客户ID获取基本信息。',type:'customer'},
 get_customer_organization:{schema:querySchema,description:'查询客户内部部门、上下级和职能。',type:'organization'},
 list_contacts:{schema:querySchema,description:'查询客户联系人、职务与已知关系；职位不等同于决策权。',type:'contact'},
 list_project_contacts:{schema:querySchema,description:'查询项目联系人关联、项目角色及权限核实状态。',type:'project_contact'},
 list_leads:{schema:querySchema,description:'查询客户的S0线索；线索与商机是不同实体。',type:'lead'},
 get_lead:{schema:idSchema,description:'获取单条S0线索。',type:'lead'},
 list_opportunities:{schema:querySchema,description:'查询客户S1到S8商机。',type:'opportunity'},
 get_opportunity:{schema:idSchema,description:'获取商机、正式阶段及证据字段。',type:'opportunity'},
 list_lead_progress:{schema:querySchema,description:'查询指定Scope线索的进展；不要混用商机进展。',type:'lead_progress'},
 list_opportunity_progress:{schema:querySchema,description:'查询指定商机Scope的进展。',type:'opportunity_progress'},
 list_business_activities:{schema:querySchema,description:'查询客户或当前业务的商务活动。',type:'activity'},
 list_tasks:{schema:querySchema,description:'查询已有待办及状态，避免重复创建。',type:'task'},
 list_customer_news:{schema:querySchema,description:'查询已有客户外部资讯。演示资讯带fictional标记，不是实时网络搜索。',type:'news'},
 list_meeting_records:{schema:querySchema,description:'查询已有会议纪要。',type:'meeting'},
 list_evidence_documents:{schema:querySchema,description:'查询需求、方案等证据资料及确认状态。',type:'evidence'},
 get_records_by_refs:{schema:z.object({ids:z.array(z.string()).max(30)}),description:'按记录ID列表读取来源；每条重新校验权限。'},
};
for(const [name,type]of [['create_task','task'],['create_business_activity','activity'],['create_lead_progress','lead_progress'],['create_opportunity_progress','opportunity_progress']]){
 toolSpecs[name]={schema:z.object({scope:scopeSchema,fields:z.record(z.string(),z.unknown()),confirmationToken:z.string().min(1)}),description:'仅在应用确认卡确认后创建'+type+'。需要有效confirmationToken，不支持其他更新。',write:true,type};
}
export function queryRecords(u:User,type:string,a:any={}){
 if(a.scope)authorize(u,a.scope);if(a.customerId)allowedRecord(u,a.customerId,'customer');
 let rows=allRecords(type).filter(r=>canAccess(u,r.customerId));
 const cid=a.scope?.customerId||a.customerId;if(cid)rows=rows.filter(r=>r.customerId===cid);
 if(a.scope&&a.scope.objectType!=='customer'&&!['customer','contact','organization','news'].includes(type)){
 rows=rows.filter(r=>r.id===a.scope.objectId||r.entityId===a.scope.objectId);
 }
 if(a.scope&&a.scope.objectType!=='customer'&&type==='contact'){const links=allRecords('project_contact').filter(l=>l.entityId===a.scope.objectId&&l.customerId===cid);if(links.length){const ids=new Set(links.map(l=>l.contactId));rows=rows.filter(r=>ids.has(r.id));}}
 if(a.stage)rows=rows.filter(r=>r.stage===a.stage);
 if(a.status)rows=rows.filter(r=>r.status===a.status);
 if(a.query){const q=a.query.toLocaleLowerCase();rows=rows.filter(r=>JSON.stringify(r).toLocaleLowerCase().includes(q));}
 if(a.projectId){const p=allowedRecord(u,a.projectId);if(!['lead','opportunity'].includes(p.type)||cid&&p.customerId!==cid||a.scope&&a.scope.objectType!=='customer'&&p.id!==a.scope.objectId)throw new AppError('FORBIDDEN','项目筛选不属于当前客户或会话范围',403);if(type==='contact'){const ids=new Set(allRecords('project_contact').filter(l=>l.entityId===p.id).map(l=>l.contactId));rows=rows.filter(r=>ids.has(r.id));}else rows=rows.filter(r=>r.id===p.id||r.entityId===p.id);}
 if(['lead_progress','opportunity_progress','meeting'].includes(type))rows.sort((a,b)=>Date.parse(b.occurredAt||b.updatedAt)-Date.parse(a.occurredAt||a.updatedAt)||(b.sequence||0)-(a.sequence||0));
 const cursor=a.cursor||0,limit=a.limit||20;
 return{records:rows.slice(cursor,cursor+limit),total:rows.length,nextCursor:cursor+limit<rows.length?cursor+limit:null};
}
export function validateFields(u:User,kind:string,scope:Scope,fields:any){
 const object=authorize(u,scope);
 if(!['task','activity','lead_progress','opportunity_progress'].includes(kind))throw new AppError('UNSUPPORTED_CAPABILITY','不支持此创建能力');
 const permitted=kind==='task'?['title','description','dueAt','assigneeId','priority']:kind==='activity'?['title','description','scheduledAt','activityType','participants']:['title','description','occurredAt'];
 if(Object.keys(fields).some(k=>!permitted.includes(k)))throw new AppError('INVALID_ARGUMENT','字段不属于该创建能力，禁止覆盖身份、类型、状态或对象标识');
 if(typeof fields.title!=='string'||!fields.title.trim()||fields.title.length>200)throw new AppError('INVALID_ARGUMENT','标题必填，最多200字');
 if(typeof fields.description!=='string'||!fields.description.trim()||fields.description.length>10000)throw new AppError('INVALID_ARGUMENT','内容必填，最多10000字');
 if(kind==='lead_progress'&&(scope.objectType!=='lead'||object.status==='converted'))throw new AppError('INVALID_ARGUMENT','请选择未转换的S0线索');
 if(kind==='opportunity_progress'&&scope.objectType!=='opportunity')throw new AppError('INVALID_ARGUMENT','商机进展必须关联商机');
 if(kind==='activity'&&fields.participants){if(!Array.isArray(fields.participants)||fields.participants.some((p:any)=>typeof p!=='string'||!allRecords('contact').some(c=>c.customerId===scope.customerId&&(c.id===p||c.name===p))))throw new AppError('INVALID_ARGUMENT','商务活动参与人必须来自当前客户联系人，请使用联系人ID或准确姓名');}
 const date=kind==='task'?fields.dueAt:kind==='activity'?fields.scheduledAt:fields.occurredAt;
 if(!date||Number.isNaN(Date.parse(String(date))))throw new AppError('INVALID_ARGUMENT','请填写有效的时间');
 if(kind==='task'){
 const target=user(String(fields.assigneeId||u.id));
 if(target.id!==u.id&&!(u.role==='admin'||u.role==='manager'&&target.teamId===u.teamId))throw new AppError('FORBIDDEN','当前用户只能给自己建待办，经理可派发同团队',403);
 if(!canAccess(target,scope.customerId))throw new AppError('FORBIDDEN','负责人无权访问关联客户',403);
 }
}
export function crmCall(u:User,name:string,raw:unknown){
 const spec=toolSpecs[name];if(!spec)throw new AppError('UNSUPPORTED_CAPABILITY','没有该CRM工具');
 const args:any=spec.schema.parse(raw);const faults=meta<any>('faults',{});
 if((faults.failTools||[]).includes(name))throw new AppError('UPSTREAM_UNAVAILABLE','模拟接口故障：'+name,503);
 if((faults.timeoutTools||[]).includes(name))throw new AppError('TIMEOUT','模拟接口超时：'+name,504);
 if(spec.write){
 const {scope,fields,confirmationToken}=args;
 const approval=get('approval',confirmationToken);
 if(!approval||approval.userId!==u.id||approval.toolName!==name||JSON.stringify(approval.scope)!==JSON.stringify(scope)||JSON.stringify(approval.fields)!==JSON.stringify(fields))throw new AppError('FORBIDDEN','创建操作缺少与当前草稿一致的确认凭证',403);
 const prior=get('write_results',confirmationToken);if(prior)return prior;
 const draft=own(u,'drafts',approval.draftId);
 if(draft.version!==approval.draftVersion)throw new AppError('CONFLICT','草稿已变更，请重新确认',409);
 validateFields(u,spec.type!,scope,fields);
 const r={id:uid(spec.type!.toUpperCase()),type:spec.type,customerId:scope.customerId,entityType:scope.objectType==='customer'?null:scope.objectType,entityId:scope.objectType==='customer'?null:scope.objectId,name:fields.title,content:fields.description,...fields,createdBy:u.id,createdAt:now(),updatedAt:now(),status:'pending'};
 if(spec.type==='activity'&&fields.participants){r.participantIds=fields.participants.map((p:string)=>allRecords('contact').find(c=>c.customerId===scope.customerId&&(c.id===p||c.name===p))!.id);r.participants=r.participantIds.map((id:string)=>record(id).name);}
 saveRecord(r);
 const result={status:'success',records:[r],recordRefs:[ref(r)],requestId:uid('req'),asOf:now()};
 put('write_results',confirmationToken,result,u.id,scope.objectId);
 if(faults.responseLost===true){throw new AppError('TIMEOUT','已提交，模拟回执丢失；重试将核查执行账本',504);}
 return result;
 }
 let result:any;
 if(name.startsWith('get_')&&['get_lead','get_opportunity'].includes(name)&&args.id){const r=allowedRecord(u,args.id,spec.type);if(args.scope&&r.customerId!==args.scope.customerId)throw new AppError('FORBIDDEN','对象不属于当前客户',403);}
 if(name==='get_records_by_refs'){result={records:args.ids.map((id:string)=>allowedRecord(u,id))};}
 else if(name.startsWith('get_')&&name!=='get_customer_organization'){result={records:[allowedRecord(u,args.id,spec.type)]};}
 else result=queryRecords(u,spec.type!,args);
 return{status:'success',...result,recordRefs:result.records.map(ref),requestId:uid('req'),asOf:now()};
}
export function makeDraft(u:User,scope:Scope,kind:Draft['kind'],fields:any,answerId:string){
 validateFields(u,kind,scope,fields);
 const draft:Draft={id:uid('draft'),version:1,kind,scope,fields,status:'ready',answerId,userId:u.id};
 put('drafts',draft.id,draft,u.id,scope.objectId);return draft;
}
export function reviseDraft(u:User,id:string,version:number,fields:any){
 const d=own(u,'drafts',id) as Draft;
 if(d.version!==version)throw new AppError('CONFLICT','草稿版本已变化',409);
 if(JSON.stringify(d.fields)===JSON.stringify(fields))return d;
 if(get('write_results','confirm-'+d.id+'-v'+d.version))throw new AppError('CONFLICT','该版本已写入CRM，请先重试确认获取原始回执，不能修改后重复创建',409);
 if(d.status==='succeeded'||d.status==='executing')throw new AppError('CONFLICT','已执行的草稿不能修改',409);
 validateFields(u,d.kind,d.scope,fields);
 return put('drafts',id,{...d,fields,version:d.version+1,status:'ready'},u.id,d.scope.objectId);
}
export function approveDraft(u:User,id:string,version:number){
 const d=own(u,'drafts',id) as Draft;
 if(d.version!==version)throw new AppError('CONFLICT','确认版本已失效',409);
 validateFields(u,d.kind,d.scope,d.fields);
 const toolName=Object.entries(toolSpecs).find(([,s])=>s.write&&s.type===d.kind)![0];
 const token='confirm-'+d.id+'-v'+d.version;
 put('approval',token,{userId:u.id,draftId:d.id,draftVersion:d.version,toolName,scope:d.scope,fields:d.fields});
 return{draft:d,toolName,args:{scope:d.scope,fields:d.fields,confirmationToken:token}};
}

