import {salesDocuments,stageGuides,knowledgeVersion} from './sales-knowledge.ts';
import {db,readFileSync,writeJson,mkdirSync,writeFileSync,now,resolve,meta,setMeta} from './db.ts';
import {stageNames,type Scope} from '../../../packages/contracts/index.ts';
import {record,allRecords} from './db.ts';
export const sourceCatalog=JSON.parse(readFileSync(resolve('knowledge/research/sources/catalog.json'),'utf8'));
const requirements=[
[['need','需求真实性'],['contact','有效联系窗口']],
[['need','业务目标及应用场景'],['budget','投资主体及预算路径']],
[['need','真实需求'],['budget','预算与融资'],['decision','决策流程与关键角色']],
[['scope','客户确认的技术及供货边界'],['decision','采购标准、最终签批人与评审节点']],
[['scope','明确技术基线'],['tender','招标资格、评分与截止时间']],
[['contract','合同偏差与签批路径'],['decision','商务决策'],['budget','付款与授权条件']],
[['delivery','交接范围与交付节点']],
[['acceptance','验收标准、测试及遗留问题']],
[['payment','付款条件、资料与客户承诺']]
];
export const profiles=stageNames.map((name,i)=>{const guide=stageGuides[i];return{id:'S'+i,name,entityType:i===0?'lead':'opportunity',goal:guide.goal,entry:guide.entry,exit:guide.exit,requiredEvidence:requirements[i].map(([key,title])=>({key,title})),questions:guide.questions,actions:guide.activities.map(a=>a.name),activities:guide.activities,sourceRefs:['KB-S'+i+'-playbook'],version:2,reviewStatus:'original_internal_guidance_pending_business_review'};});
export {salesDocuments,knowledgeVersion};
export function tokens(text:string){
 const latin=(text.toLowerCase().match(/[a-z0-9_-]{2,}/g)||[]).slice(0,20);
 const chinese=text.match(/[\u4e00-\u9fff]+/g)||[];
 return [...new Set([...latin,...chinese.flatMap(s=>[...s].slice(0,-1).map((_,i)=>s.slice(i,i+2)))])].slice(0,50).join(' ');
}
export function initKnowledge(){if(meta<string>('knowledgeVersion','')!==knowledgeVersion)reindex();}
export function reindex(){
 db.exec('BEGIN');try{db.exec('DELETE FROM knowledge;DELETE FROM knowledge_fts;');
 for(const d of salesDocuments){db.prepare('INSERT INTO knowledge(id,title,stage,mode,countries,source_id,body,version) VALUES (?,?,?,?,?,?,?,?)').run(d.id,d.title,d.stage,d.mode,'[]',d.id,d.body,d.version);db.prepare('INSERT INTO knowledge_fts VALUES (?,?,?)').run(d.id,tokens(d.title+' '+d.summary),tokens(d.body));}
 setMeta('knowledgeVersion',knowledgeVersion);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
 mkdirSync('knowledge/sales/guides',{recursive:true});for(const d of salesDocuments)writeFileSync('knowledge/sales/guides/'+d.id+'.md',d.body,'utf8');
 writeJson('knowledge/sales/guides/manifest.json',salesDocuments.map(d=>({...d,body:undefined,path:'knowledge/sales/guides/'+d.id+'.md'})));
 writeFileSync('knowledge/sales/guides/README.md','# 储能销售策略与活动指引\n\n本库为原创内部工作基线，不是公开文档目录；公司产品、授权、法律和项目事实仍需有效材料。\n\n'+salesDocuments.map(d=>'- ['+d.title+']('+d.id+'.md) · '+d.pillar+' / '+d.subcategory+' · '+d.category+' · '+d.summary).join('\n'));
 writeFileSync('knowledge/sales/guides/储能销售策略与关键活动全流程指引-v3.md','# 储能销售策略与关键活动全流程指引\n\n版本：3 · 日期：2026-10-27\n\n适用：海外储能销售团队；S0为线索，S1–S8为商机。原创内部活动基线，需业务负责人审核；企业授权和客户事实以有效材料为准。\n\n共58份文档：保留30份原有指引，新增定方向10类、识风险10类、递资源8类专题。\n\n'+salesDocuments.map(d=>d.body.replace(/^#/gm,'##')).join('\n\n---\n\n'));
 for(const profile of profiles)writeJson('knowledge/sales/stages/'+profile.id+'.json',profile);
 mkdirSync('knowledge/sales/playbooks',{recursive:true});for(const mode of ['utility_scale','commercial_industrial','channel_project'])writeFileSync('knowledge/sales/playbooks/'+mode+'.md',salesDocuments.find(d=>d.mode===mode)!.body);
 for(const region of ['欧洲','北美','中东','亚太'])writeJson('knowledge/sales/regions/'+region+'.json',salesDocuments.filter(d=>d.region===region));
 writeJson('knowledge/sales/glossary/terms.json',{BESS:'电池储能系统',PCS:'功率变换系统',EMS:'能量管理系统',FAT:'工厂验收测试',SAT:'现场验收测试',RFP:'建议书征询',scope:'供货边界',decision:'决策路径'});
 writeJson('knowledge/sales/demo-policy.json',{fictional:true,title:'演示商务政策',rule:'没有有效授权资料时，不作底价、折扣、交期、质保或收益承诺。内部策略不是公司正式授权政策。'});
}
export function searchKnowledge(query:string,stage='all',country='',mode='all',includeResources=true){
 const region=({GB:'欧洲',DE:'欧洲',ES:'欧洲',US:'北美',CA:'北美',SA:'中东',AE:'中东',OM:'中东',AU:'亚太',JP:'亚太',SG:'亚太'} as Record<string,string>)[country];
 const terms=tokens(query).split(' ').filter(Boolean);let matched=new Set<string>();
 if(terms.length)try{matched=new Set((db.prepare('SELECT id FROM knowledge_fts WHERE knowledge_fts MATCH ? LIMIT 50').all(terms.slice(0,20).map(t=>'"'+t.replaceAll('"','')+'"').join(' OR ')) as any[]).map(x=>x.id));}catch{}
 const candidates=salesDocuments.filter(d=>(includeResources||d.pillar!=='递资源')&&(d.mode==='all'||mode==='all'||d.mode===mode)&&(d.region==='all'||d.region===region));
 const score=(d:typeof salesDocuments[number])=>(d.stage===stage&&stage!=='all'?5:d.stages?.includes(stage)?3:0)+(d.mode===mode&&mode!=='all'?2:0)+(d.region===region?1.5:0)+(matched.has(d.id)?1:0)+terms.reduce((sum,t)=>sum+(d.title.includes(t)?1.5:0)+(d.summary.includes(t)?0.8:0)+(d.body.includes(t)?0.12:0),0);
 const ranked=candidates.sort((a,b)=>score(b)-score(a));const current=ranked.find(d=>d.stage===stage&&stage!=='all');const specialist=/竞品|降价|价格异议|便宜/.test(query)?ranked.find(d=>d.id==='KB-PLAY-competition'):/伙伴|渠道|激活/.test(query)?ranked.find(d=>d.id==='KB-MODE-channel_project'):undefined;const balanced=['定方向','识风险','递资源'].map(p=>ranked.find(d=>d.pillar===p));const selected=[...new Map([...(current?[current]:[]),...(specialist?[specialist]:[]),...balanced.filter(Boolean),...ranked].map(d=>[d!.id,d!])).values()].slice(0,6);
 return selected.map(d=>({...d,countries:'[]',source_id:d.id,path:'knowledge/sales/guides/'+d.id+'.md',source:{kind:'internal_playbook',title:d.title},reviewStatus:d.reviewStatus}));
}
export function assess(scope:Scope,supplied?:{entity:any;contacts:any[]}){
 const r=supplied?.entity||record(scope.objectId);if(scope.objectType==='customer')return{stage:null,status:'客户级分析',items:[],actions:['对关联线索商机分别诊断','按证据与时间窗口排序机会','协调关键人沟通']};
 const p=profiles.find(x=>x.id===r.stage)!;const e={...(r.evidence||{})};
 if(scope.objectType==='lead'){e.need=!!r.description;e.contact=(supplied?.contacts||allRecords('contact')).some(x=>x.customerId===r.customerId);}
 const items=p.requiredEvidence.map((x,i)=>({...x,status:r.evidenceConflicts?.includes(x.key)||r.caseType==='conflict'&&i===0?'冲突':e[x.key]?'具备':'待核实'}));
 return{stage:r.stage,stageName:p.name,status:items.every(x=>x.status==='具备')?'证据较充分':'证据部分充分',items,actions:p.actions,questions:p.questions,ruleVersion:p.version};
}

