import {ensureLinkedFixtures} from './mock-fixtures-v2.ts';
import {db,now,saveRecord,setMeta,put,record} from './db.ts';
import {stageNames} from '../../../packages/contracts/index.ts';
export const seedVersion='2026.10.27-v2-linked';
export const userSeeds=[{id:'U-018',name:'张小小',role:'sales',teamId:'TEAM-A'},{id:'U-019',name:'李明',role:'sales',teamId:'TEAM-B'},{id:'U-020',name:'王经理',role:'manager',teamId:'TEAM-A'},{id:'U-ADMIN',name:'演示管理员',role:'admin',teamId:'ADMIN'},{id:'U-021',name:'王强',role:'sales',teamId:'TEAM-A'},{id:'U-022',name:'陈磊',role:'sales',teamId:'TEAM-A'},{id:'U-023',name:'王芳',role:'sales',teamId:'TEAM-A'},{id:'U-024',name:'张伟',role:'sales',teamId:'TEAM-A'}];
export const customers=[
['C-UK-0086','Northstar Energy','英国','GB','欧洲','开发商','utility_scale'],
['C-DE-002','Rheinpark Manufacturing','德国','DE','欧洲','业主','commercial_industrial'],
['C-ES-003','Iberia Power','西班牙','ES','欧洲','渠道伙伴','channel_project'],
['C-US-004','Prairie Grid','美国','US','北美','Utility','utility_scale'],
['C-CA-005','Maple Integration','加拿大','CA','北美','集成商','commercial_industrial'],
['C-US-006','Mesa EPC','美国','US','北美','EPC','utility_scale'],
['C-SA-007','Desert Horizon','沙特','SA','中东','开发商','utility_scale'],
['C-AE-008','Gulf Industry','阿联酋','AE','中东','业主','commercial_industrial'],
['C-OM-009','Muscat Systems','阿曼','OM','中东','渠道伙伴','channel_project'],
['C-AU-010','Southern Network','澳大利亚','AU','亚太','Utility','utility_scale'],
['C-JP-011','Sakura Integration','日本','JP','亚太','集成商','commercial_industrial'],
['C-SG-012','Meridian EPC','新加坡','SG','亚太','EPC','utility_scale']
];
export function seed(force=false){
if(!force&&db.prepare('SELECT id FROM users LIMIT 1').get()){ensureLinkedFixtures();return;}
db.exec('BEGIN');
try{
if(force){db.exec('DELETE FROM documents; DELETE FROM events; DELETE FROM records WHERE entity_id IS NOT NULL; DELETE FROM records WHERE type!=\'customer\'; DELETE FROM records; DELETE FROM users; DELETE FROM metadata;');}
for(const u of userSeeds)db.prepare('INSERT OR REPLACE INTO users VALUES (?,?,?,?)').run(u.id,u.name,u.role,u.teamId);
for(let i=0;i<customers.length;i++){
 const [id,name,country,countryCode,region,role,businessMode]=customers[i];
 const ownerId=i%3===2?'U-019':'U-018';
 saveRecord({id,type:'customer',customerId:id,name,country,countryCode,region,roles:[role],businessMode,ownerId,description:name+'的海外储能业务；全部企业及商务内容为虚构演示数据。',updatedAt:now()});
 for(let d=0;d<3;d++)saveRecord({id:'ORG-'+i+'-'+d,type:'organization',customerId:id,name:['采购部','技术部','投资与财务部'][d],parentId:null,function:['procurement','technical','finance'][d],updatedAt:now()});
 for(let c=0;c<4;c++)saveRecord({id:'CT-'+i+'-'+c,type:'contact',customerId:id,name:i===0?['Sarah','David','Emily','Michael'][c]:['采购负责人','技术负责人','业务开发','财务负责人'][c],title:['采购经理','技术总监','开发经理','财务经理'][c],organizationUnitId:'ORG-'+i+'-'+(c%3),knownRoles:[['采购协调','技术评估','机会引荐','财务审核'][c]],decisionAuthorityConfirmed:false,ownerId,updatedAt:now()});
}
const opps:any[]=[];
for(let j=0;j<24;j++){
 const ci=j%12;const c=record(customers[ci][0]);const si=j<20?1+Math.floor(j/4):j<22?6:j===22?7:8;
 const id=j===8?'OP-UK-026':j===1?'OP-DE-041':j===2?'OP-ES-018':'OP-'+String(j+1).padStart(3,'0');
 const customerId=j===8?'C-UK-0086':c.id;const customer=record(customerId);
 const mode=customer.businessMode;
 const capacity=mode==='utility_scale'?200:mode==='commercial_industrial'?4:null;
 const caseType=j%3===0?'missing':j%3===1?'normal':'conflict';
 const isPrimary=id==='OP-UK-026';
 const stage=isPrimary?'S3':'S'+si;
 const evidence={need:si>=2,scope:caseType==='normal'&&si>=3,decision:caseType==='normal'&&si>=2,budget:caseType==='normal'&&si>=2,tender:si>=4&&caseType==='normal',contract:si>=5&&caseType==='normal',delivery:si>=6&&caseType==='normal',acceptance:si>=7&&caseType==='normal',payment:si>=8&&caseType==='normal'};
 const name=isPrimary?'英国储能一期':id==='OP-DE-041'?'德国园区储能':id==='OP-ES-018'?'西班牙渠道首批项目':customer.name+' · '+stageNames[Number(stage.slice(1))]+'项目';
 const opp={id,type:'opportunity',customerId,name,projectCode:isPrimary?'ESS-UK-026':id==='OP-DE-041'?'ESS-DE-041':id==='OP-ES-018'?'CH-ES-018':'ESS-'+id,stage,businessMode:mode,ownerId:customer.ownerId,powerMw:capacity?capacity/2:null,capacityMwh:capacity,amount:capacity?capacity*120000:null,currency:customer.region==='欧洲'?'EUR':'USD',caseType,evidence,description:'应用：'+(mode==='commercial_industrial'?'削峰与电费优化':mode==='channel_project'?'伙伴首批终端项目验证':'电网灵活性与储能容量')+'。关注技术边界、采购流程及交付保障。',updatedAt:now()};
 saveRecord(opp);opps.push(opp);
 for(let p=0;p<6;p++)saveRecord({id:'PR-'+j+'-'+p,type:'opportunity_progress',customerId,entityType:'opportunity',entityId:id,name:['首次需求沟通','技术方案沟通','采购评审沟通','竞争信息反馈','客户资料补充','下一步计划'][p],content:['客户确认有储能意向，但投资和预算需要核实。','与技术负责人交流初步方案，供货边界'+(evidence.scope?'已有客户确认。':'仍需客户确认。'),'采购评审路径'+(evidence.decision?'已确认负责人和时间表。':'尚未明确最终签批人。'),'采购转述竞品便宜8%；未取得同口径完整报价。','已补充初步容量与应用场景，详细资料仍需核对。','建议安排技术澄清，确认采购标准与下一节点。'][p],createdBy:opp.ownerId,occurredAt:'2026-10-'+String(12+p).padStart(2,'0')+'T09:00:00+08:00',updatedAt:now()});
}
for(let l=0;l<6;l++){
 const c=record(customers[l*2][0]);const converted=l<2;const target=opps[l].id;
 const lead={id:'LD-'+String(l+1).padStart(3,'0'),type:'lead',customerId:converted?opps[l].customerId:c.id,name:converted?opps[l].name+' · 转化前线索':c.name+' · 新增储能需求',stage:'S0',status:'open',businessMode:c.businessMode,ownerId:c.ownerId,source:'展会/转介绍',description:'初步应用和联系人待验证，尚未完成商机资格判断。',updatedAt:now()};
 saveRecord(lead);
 for(let p=0;p<3;p++)saveRecord({id:'LP-'+l+'-'+p,type:'lead_progress',customerId:lead.customerId,entityType:'lead',entityId:lead.id,name:'线索验证记录 '+(p+1),content:['获取客户名称与初步需求','确认联系窗口，投资主体待核实','安排首次需求引导'][p],occurredAt:now(),createdBy:lead.ownerId,updatedAt:now()});
 if(converted){saveRecord({...lead,status:'converted',convertedOpportunityId:target});saveRecord({...opps[l],convertedFromLeadId:lead.id});put('conversion','CONV-'+l,{leadId:lead.id,opportunityId:target,at:now()});}
}
for(let i=0;i<60;i++){
 const o=opps[i%24];const c=record(o.customerId);
 if(i<48)saveRecord({id:'ACT-'+i,type:'activity',customerId:o.customerId,entityType:'opportunity',entityId:o.id,name:['技术澄清会','采购流程沟通','客户拜访','渠道联合评审'][i%4],activityType:'meeting',participants:['Sarah','David'],scheduledAt:'2026-10-26T14:00:00+08:00',content:'确认需求、评审路径和双方下一步承诺。',createdBy:o.ownerId,updatedAt:now()});
 saveRecord({id:'TD-'+i,type:'task',customerId:o.customerId,entityType:'opportunity',entityId:o.id,name:['确认技术供货边界','核实最终签批人','补齐客户数据','准备同类项目案例'][i%4],description:'预期产出：客户确认资料或明确反馈。',assigneeId:o.ownerId,dueAt:'2026-10-'+(i%3===0?'24':'28')+'T18:00:00+08:00',priority:i%2?'P1':'P2',status:i%5===0?'completed':'pending',createdBy:o.ownerId,updatedAt:now()});
 if(i<24){
 saveRecord({id:'MTG-'+i,type:'meeting',customerId:o.customerId,entityType:'opportunity',entityId:o.id,name:'储能方案技术交流纪要',summary:'客户关注成本、交付和技术范围；尚需采购确认审批路径。',content:'客户提出竞品价格较低。我方承诺先核对供货范围、服务年限和付款条件；技术负责人需确认需求基线。',occurredAt:now(),participants:['Sarah','David'],updatedAt:now()});
 saveRecord({id:'NEWS-'+i,type:'news',customerId:o.customerId,name:c.name+'公布储能业务规划（虚构情报）',summary:'客户表示关注储能机会；不能直接等同于已落实预算或采购意向。',sourceUrl:null,publishedAt:'2026-10-20',retrievedAt:now(),fictional:true,updatedAt:now()});
 saveRecord({id:'DOC-'+i,type:'evidence',customerId:o.customerId,entityType:'opportunity',entityId:o.id,name:'需求清单 '+(o.evidence.scope?'客户确认V3':'讨论稿V1'),version:o.evidence.scope?'3':'1',confirmed:o.evidence.scope,content:'功率与容量参考商机；供货和服务边界以客户确认文件为准。',updatedAt:now()});
 }
}
setMeta('seedVersion',seedVersion);setMeta('mode','replay');setMeta('faults',{});setMeta('businessClock',now());
db.exec('COMMIT');
}catch(e){db.exec('ROLLBACK');throw e;}
ensureLinkedFixtures();
}

