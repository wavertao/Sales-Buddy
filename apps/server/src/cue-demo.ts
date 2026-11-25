import {db,record,saveRecord,put,get,now,allRecords} from './db.ts';
import {businessDay} from '../../../packages/workbench.ts';

/** Explicit opt-in demo dataset. Never updates existing records or user data. */
export function seedCueDemo(){
 const prefix='CUE-DEMO-'+businessDay(now()),at=Date.parse(now()),date=(days:number)=>new Date(at+days*86400000).toISOString();
 const id=(suffix:string)=>prefix+'-'+suffix;
 const tag={fictional:true,demoDataset:prefix,createdAt:now(),updatedAt:now()};
 const add=(r:any)=>{if(!record(r.id))saveRecord({...tag,...r});return record(r.id);};
 const doc=(collection:string,key:string,value:any)=>{if(!get(collection,key))put(collection,key,{...tag,...value});};
 const people=[['U-CUE-LOW-A','[演示] 华北待核实销售','sales','TEAM-A'],['U-CUE-LOW-B','[演示] 华东待核实销售','sales','TEAM-B'],['U-CUE-SALES-A','[演示] 周销售','sales','TEAM-A'],['U-CUE-SALES-B','[演示] 林销售','sales','TEAM-B'],['U-CUE-LEADER-B','[演示] 华东SPP Leader','manager','TEAM-B'],['U-CUE-PRESIDENT','[演示] 区域总裁','manager','CUE-REGION'],['U-CUE-PM-A','[演示] 陈PM','sales','TEAM-A'],['U-CUE-PD-A','[演示] 刘PD','sales','TEAM-A'],['U-CUE-PM-B','[演示] 何PM','sales','TEAM-B'],['U-CUE-PD-B','[演示] 吴PD','sales','TEAM-B']];
 for(const p of people)db.prepare('INSERT OR IGNORE INTO users VALUES (?,?,?,?)').run(...p);
 doc('spp_regions','CUE-REGION',{id:'CUE-REGION',name:'[演示] 中国区域',presidentId:'U-CUE-PRESIDENT',active:true});
 for(const [suffix,leader,sales,peer] of [['A','U-020','U-018','U-CUE-SALES-A'],['B','U-CUE-LEADER-B','U-019','U-CUE-SALES-B']])doc('spp_teams','CUE-SPP-'+suffix,{id:'CUE-SPP-'+suffix,name:'[演示] '+(suffix==='A'?'华北':'华东')+'SPP团队',regionId:'CUE-REGION',leaderId:leader,active:true,members:[{userId:'U-CUE-LOW-'+suffix,role:'S'},{userId:sales,role:'S'},{userId:peer,role:'S'},{userId:'U-CUE-PM-'+suffix,role:'PM'},{userId:'U-CUE-PD-'+suffix,role:'PD'}]});
 const company=(suffix:string,sales='U-018',team='A')=>add({id:id('C-'+suffix),type:'customer',customerId:id('C-'+suffix),name:'[演示] '+suffix,createdAt:date(-90),ownerId:sales,level:'S',country:'中国',sppTeamId:'CUE-SPP-'+team,primarySalesId:sales});
 const opp=(suffix:string,c:any,sales='U-018',team='A')=>add({id:id('OP-'+suffix),type:'opportunity',customerId:c.id,name:'[演示] '+suffix+'储能项目',ownerId:sales,primarySalesId:sales,primaryPmId:'U-CUE-PM-'+team,primaryPdId:'U-CUE-PD-'+team,sppTeamId:'CUE-SPP-'+team,stage:'S2',status:'active',isKey:true,businessMode:'commercial_industrial',createdAt:date(-80),assignedAt:date(-80),summary:'工厂侧储能，需确认技术方案、采购路径与实施安排。'});
 const leadCompany=company('海港园区');
 for(const n of [1,2])add({id:id('LEAD-'+n),type:'lead',customerId:leadCompany.id,name:'[演示] 海港园区'+n+'期储能需求',ownerId:'U-018',primarySalesId:'U-018',sppTeamId:'CUE-SPP-A',stage:'S0',status:'new',assignedAt:date(-2),createdAt:date(-3)});
 const c=company('关西制造'),p=opp('关西工厂',c);
 for(const [n,title] of [['1','向关西工厂提交修订技术方案'],['2','确认关西工厂设备交付边界']])add({id:id('TASK-'+n),type:'task',customerId:c.id,entityId:p.id,entityType:'opportunity',name:title,description:n==='1'?'补充客户要求的电池安全及消防接口说明后提交。':'与客户确认供货、施工、并网责任界面。',assigneeId:'U-018',createdBy:'U-018',priority:'P1',status:'pending',dueAt:date(-1)});
 const prep=add({id:id('TASK-PREP'),type:'task',customerId:c.id,entityId:p.id,entityType:'opportunity',name:'取得近12个月负荷曲线',description:'客户技术澄清会要求使用真实负荷曲线校核容量。',assigneeId:'U-018',createdBy:'U-018',priority:'P2',status:'pending',dueAt:date(.3)});
 add({id:id('ACT-PREP'),type:'activity',customerId:c.id,entityId:p.id,entityType:'opportunity',name:'关西工厂技术澄清会',createdBy:'U-018',scheduledAt:date(.5),status:'planned',important:true,preparationTaskIds:[prep.id],participants:[],content:'议题：根据实际负荷曲线确认容量及系统边界。'});
 add({id:id('ACT-RESULT'),type:'activity',customerId:c.id,entityId:p.id,entityType:'opportunity',name:'关西工厂采购沟通',createdBy:'U-018',scheduledAt:date(-2),occurredAt:date(-2),status:'completed',participants:[],content:'已完成采购负责人沟通，需确认结果并记录下一步。'});
 for(const [suffix,axes,content] of [['东港物流',['P','T'],'客户已确认由业主直接采购储能设备，不再由EPC统包。'],['南湖制造',['M'],'客户已确认并网批复取得，项目实施前置条件发生变化。']] as [string,string[],string][]){const cp=company(suffix),op=opp(suffix,cp);doc('profile_shared_mpt',op.id,{id:op.id,stages:{M:'M2',P:'P2',T:'T1'},assessed:true,version:1,updatedAt:date(-4),updatedBy:'U-018'});add({id:id('PROGRESS-'+suffix),type:'opportunity_progress',customerId:cp.id,entityId:op.id,entityType:'opportunity',name:suffix+'客户确认',content,occurredAt:date(-1),createdBy:'U-018',materialChange:{confirmed:true,affectedAxes:axes}});doc('profile_documents',`project:${op.id}:shared`,{id:`project:${op.id}:shared`,kind:'project',objectId:op.id,userId:null,version:1,fields:{'background.demand':[{id:id('PROFILE-'+suffix),content:'客户确认需建设工厂侧储能，实施与采购路径以本项目确认记录为准。',status:'effective',updatedAt:date(-4)}]}});doc('cue_gap_observations','CUE-SPP-A:'+op.id,{firstSeenAt:date(-9),projectId:op.id,teamId:'CUE-SPP-A'});}
 const tender=opp('华东园区',company('华东园区','U-019','B'),'U-019','B');
 add({id:id('ACT-TENDER'),type:'activity',customerId:tender.customerId,entityId:tender.id,entityType:'opportunity',name:'[演示] 华东园区投标评审',createdBy:'U-019',scheduledAt:date(3),status:'planned',participants:[],content:'客户要求投标前确认项目资源配置。',managementRequest:{status:'open',neededBy:date(2),reason:'需要跨SPP调配并网专家，并由区域确认投标授权。',requiresRegionalCoordination:true}});
 add({id:id('ACT-REVIEW'),type:'activity',customerId:c.id,entityId:p.id,entityType:'opportunity',name:'[演示] 关西工厂方案评审',createdBy:'U-018',scheduledAt:date(4),status:'planned',participants:[],content:'方案评审前需要确认客户商务边界。',managementRequest:{status:'open',neededBy:date(3),reason:'主责销售明确请求SPP Leader参加客户评审并确认报价授权。',requiresRegionalCoordination:false}});
 doc('cue_gap_observations','CUE-SPP-B:'+tender.id,{firstSeenAt:date(-10),projectId:tender.id,teamId:'CUE-SPP-B'});
 add({id:id('PROGRESS-EAST'),type:'opportunity_progress',customerId:tender.customerId,entityId:tender.id,entityType:'opportunity',name:'采购路径已调整',content:'客户已确认本次设备独立采购，需要重新确认投标边界。',createdBy:'U-019',occurredAt:date(-2),materialChange:{confirmed:true,affectedAxes:['P','T']}});
 for(const team of ['A','B'])opp('待核实跟进'+team,company('低覆盖客户'+team,'U-CUE-LOW-'+team,team),'U-CUE-LOW-'+team,team);
 // Two full observation windows, distinct business records; low coverage is not a performance judgment.
 for(const [team,sales,peer] of [['A','U-018','U-CUE-SALES-A'],['B','U-019','U-CUE-SALES-B']]){const cp=company('活跃经营客户'+team,peer,team),op=opp('客户经营'+team,cp,peer,team);for(let n=1;n<=48;n+=3)add({id:id('CONTACT-'+team+'-'+n),type:'opportunity_progress',customerId:cp.id,entityId:op.id,entityType:'opportunity',name:'需求与安排确认'+n,content:'与客户确认本轮设备配置需求，下一步提交接口清单第'+n+'版。',createdBy:peer,occurredAt:date(-n),progressKind:'contact'});}
 // Negative examples: contacted lead, completed task, no explicit preparation gap, confirmed result.
 const negative=company('已跟进客户');const l=add({id:id('LEAD-CONTACTED'),type:'lead',customerId:negative.id,name:'[演示] 已首次联系线索',ownerId:'U-018',primarySalesId:'U-018',sppTeamId:'CUE-SPP-A',stage:'S0',status:'active',assignedAt:date(-2)});
 add({id:id('CONTACT-DONE'),type:'lead_progress',customerId:negative.id,entityId:l.id,entityType:'lead',name:'首次需求沟通',content:'已电话联系客户并确认用电需求，约定补充账单。',createdBy:'U-018',occurredAt:date(-1),progressKind:'contact'});
 add({id:id('TASK-DONE'),type:'task',customerId:c.id,entityId:p.id,entityType:'opportunity',name:'已完成材料提交',assigneeId:'U-018',createdBy:'U-018',status:'completed',priority:'P1',dueAt:date(-3)});
 add({id:id('ACT-NO-GAP'),type:'activity',customerId:c.id,entityId:p.id,entityType:'opportunity',name:'[演示] 无明确准备缺口的例会',createdBy:'U-018',scheduledAt:date(.6),status:'planned',important:true,participants:[],content:'例行沟通，没有确认的材料缺口。'});
 return{dataset:prefix,records:allRecords().filter(r=>r.demoDataset===prefix).length,users:people.map(p=>({id:p[0],name:p[1]}))};
}
