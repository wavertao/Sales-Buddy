import {record,saveRecord,get,put,now} from './db.ts';
import {ref} from './crm.ts';
import {navigatorReplyPolicy} from './navigator-reply.ts';
import {SUGGESTIONS_VERSION} from './followups.ts';

/** Opt-in synthetic examples, separate from the existing Gulf Industry project and user history. */
export function seedNavigatorDemo(){
 const customerId='NAV-DEMO-C-GULF',objectId='NAV-DEMO-OP-JEBEL-ALI',userId='U-018',at=now(),tag={fictional:true,demoDataset:'NAV-DEMO-v1',createdAt:at,updatedAt:at};let added=0;
 const add=(r:any)=>{if(!record(r.id)){saveRecord({...tag,...r});added++;}return record(r.id);};
 const doc=(collection:string,id:string,value:any)=>{if(!get(collection,id))put(collection,id,{...tag,...value},value.userId||null,objectId);};
 const customer=add({id:customerId,type:'customer',customerId,name:'[演示] Gulf Industry',ownerId:userId,primarySalesId:userId,sppTeamId:'CUE-SPP-A',level:'B',country:'阿联酋',countryCode:'AE',businessMode:'commercial_industrial'});
 const project=add({id:objectId,type:'opportunity',customerId,name:'[演示] Dubai Jebel Ali厂区储能 · 领航员简答',stage:'S2',status:'active',ownerId:userId,primarySalesId:userId,primaryPmId:'U-CUE-PM-A',primaryPdId:'U-CUE-PD-A',sppTeamId:'CUE-SPP-A',businessMode:'commercial_industrial',powerMw:3,capacityMwh:6,description:'虚构演示项目。现有厂区的负荷优化需求，3MW/6MWh仅为讨论口径；接入、许可适用性及采购签批路径待核实。与原Gulf Industry项目和历史会话独立。'});
 for(const [suffix,name,title] of [['AISHA','Aisha Al Nuaimi','客户需求协调'],['OMAR','Omar Al Qasimi','客户技术负责人'],['FATIMA','Fatima Al Mansoori','客户采购协调']])add({id:'NAV-DEMO-CT-'+suffix,type:'contact',customerId,name:'[演示] '+name,title});
 const progress=add({id:'NAV-DEMO-PROGRESS-NEED',type:'opportunity_progress',customerId,entityId:objectId,entityType:'opportunity',name:'[演示] 需求基线确认',content:'客户陈述现有厂区有用能优化需求，3MW/6MWh仍待真实负荷和电价数据验证；采购主体和签批角色尚未确认。',createdBy:userId,occurredAt:at});
 add({id:'NAV-DEMO-PROGRESS-BOUNDARY',type:'opportunity_progress',customerId,entityId:objectId,entityType:'opportunity',name:'[演示] 待核实边界',content:'并网接入节点、许可适用性和安装范围需要客户技术方确认，未视为已批复或方案已定。',createdBy:userId,occurredAt:at});
 doc('profile_shared_mpt',objectId,{id:objectId,stages:{M:'M1',P:'P1',T:'T1'},assessed:true,version:1,updatedBy:userId});
 const scope={objectType:'opportunity' as const,objectId,customerId},intro='> 预置演示：以下为虚构业务样例，用于体验回答方式，不是原Gulf Industry项目的事实或新生成的在线回答。\n\n';
 const examples=[
  {key:'OVERVIEW',title:'[演示] 领航员 · 现状与下一步',question:'分析当前现状，下一步怎么推进？',text:'## 结论\n先核实需求与采购路径，再决定方案深度；可并行补充客户资料。\n\n## 项目简述\n现有厂区有用能优化需求，3MW/6MWh是讨论口径。接入、许可适用性、买方与签批路径尚待核实，不能据此认定项目条件已落实。\n\n## 推进建议（待办）\n1. 找Omar取得负荷、电价和运行目标，形成需求基线。\n2. 找Fatima确认采购主体及评审节点，形成采购路径说明。\n3. 通过Aisha确认下一次客户澄清的参与人及预期结果。\n\n先确认一个关键点：设备预计由业主直接采购，还是由投资方采购？',actions:[['取得负荷与电价数据','向客户技术负责人Omar取得负荷、电价及运行目标，形成可验证的需求基线。'],['确认采购主体与评审节点','向Fatima确认实际采购主体、评审及签批路径，记录客户反馈。'],['明确下一次客户澄清安排','通过Aisha确认参与角色和希望取得的结果；日期由双方另行确认。']]},
  {key:'RESOURCES',title:'[演示] 领航员 · 明确请求内部支持',question:'这个项目需要内部资源支持，应该找哪些角色，如何申请？',text:'## 结论\n先明确需要专业回答的问题，再通过直属负责人确认相应支持归口。\n\n## 项目简述\n需求基线、接入与许可适用性尚未确认。内部支持用于澄清问题，不代表方案、审批或资源排期已经落实。\n\n## 推进建议（待办）\n1. 向直属负责人确认PD技术支持归口，提交负荷、电价和运行目标，明确容量校核的输入与产出。\n2. 按实际接入问题申请专业意见，提供客户已有资料，取得需客户进一步核实的事项。\n3. 如涉及实施边界，请PM协助梳理职责与依赖；具体人员、授权和排期待确认。\n\n先确认：当前最需要支持的是技术方案校核，还是接入条件澄清？',actions:[['确认PD技术支持归口','先明确客户技术问题及输入资料，再通过直属负责人确认支持归口与可交付结果。'],['整理接入专业问题','汇总客户已有接入资料与待核实问题，按企业实际渠道申请专业支持，不编造联系人。'],['核实PM协作范围','需要实施边界支持时，确认PM职责和依赖，人员及排期待确认。']]}
 ];
 for(const e of examples){const id='NAV-DEMO-CONV-'+e.key;if(get('conversations',id))continue;const answerId=id+'-ANSWER',messageId=id+'-QUESTION',runId=id+'-RUN',policy=navigatorReplyPolicy(e.question);
  doc('conversations',id,{id,userId,scope,kind:'navigator',title:e.title,lastMessageAt:at});
  doc('messages',messageId,{id:messageId,userId,scope,conversationId:id,runId,role:'user',content:e.question,origin:'system'});
  const answer={id:answerId,userId,scope,conversationId:id,runId,mode:'replay',role:'assistant',origin:'demo_fixture',text:intro+e.text,content:intro+e.text,userQuestion:e.question,responsePurpose:'analysis',navigator:{responsePolicy:policy,resources:[]},navigatorActions:e.actions.map(([title,description],i)=>({id:'nav-action-'+i,title,description,dueAt:null})),tools:[],actions:[],sources:[ref(customer),ref(project),ref(progress)],suggestionsVersion:SUGGESTIONS_VERSION,suggestionsStatus:'completed',promptVersion:6};
  doc('answers',answerId,answer);doc('messages',answerId,answer);doc('workbenches',answerId,{answerId,userId,scope,conversationId:id,goal:e.question,steps:[{id:'demo',title:'预置虚构业务示例',status:'completed'}],sources:answer.sources,dataStatus:'completed'});
  doc('runs',runId,{id:runId,userId,scope,conversationId:id,answerId,userMessageId:messageId,question:e.question,mode:'replay',origin:'system',status:'completed',completedAt:at});
 }
 return{projectId:objectId,recordsAdded:added,conversationIds:examples.map(e=>'NAV-DEMO-CONV-'+e.key)};
}
