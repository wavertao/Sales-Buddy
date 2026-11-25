import {requiredQuestionIndexes} from '../../../packages/mpt-assessment.ts';
const names:Record<string,string[]>={
 M0:['项目主体','区域规模与应用','实际开发动作','下一步与负责人','信息时效'],
 M1:['土地控制','并网节点','核心许可','当前障碍与负责人'],
 M2:['核心RTB条件','持有或转售路径','未来业主与投资人','选型认可','资金与收入路径'],
 M3:['融资条件与卡点','收入与承购安排','成本可信度','设备Bankability要求','采购与签约角色'],
 M4:['NTP先决条件','合同生效','付款与担保','开工指令授权','交付与现场接口'],
 M5:['我方合同','剩余采购范围','施工与交付进度','变更验收与付款'],
 P0:['信息时效','项目身份','联系回应','联系人来源与权限'],P1:['回应者与角色','首访进展','决策链','下一次接触'],P2:['影响与决策权限','支持范围','信息与引荐支持'],P3:['可验证支持行为','信息有效性','岗位与主体变化'],P4:['书面认可','绑定性质','批准主体','业主与EPC认可','重采与未决条件'],P5:['中标主体与范围','合同生效','投资融资与NTP条件','排产与交付授权'],
 T0:['设备采购活动','RFx状态','负责人及窗口'],T1:['RFI主体目的与流程'],T2:['报价性质','范围口径与决策主体','PPA与投资依赖'],T3:['正式招标要求','招评定标签约角色'],T4:['评标进度','未关闭偏差','竞争与替换条件','重新采购'],T5:['正式结果与选定主体','中标归属','范围有效期与先决条件']
};
export function checkpointDefinitions(stages:any,snapshot:any,previous:any[]=[]){
 return ['M','P','T'].flatMap(axis=>{const stage=stages[axis];if(!stage)return[];const retained=previous.filter(q=>q.axis===axis&&q.stage===stage);if(retained.length)return retained;const definition=snapshot.stages.rows.find((r:string[])=>r[1]===stage);if(!definition)return[];return snapshot.questions.rows.filter((r:string[])=>r[1]===stage&&r[0].startsWith(definition[2]+'核实')).map((r:string[],index:number)=>({checkpointKey:stage+':'+index,axis,stage,title:names[stage]?.[index]||r[3],question:r[3],requirement:(requiredQuestionIndexes[stage]||[]).includes(index)?'required':'supplemental'}));});
}
export function projectCheckpoints(p:any,snapshot:any){
 return checkpointDefinitions(p.stages,snapshot,p.checkpointDefinitions).map(q=>{const facts=p.facts.filter((f:any)=>f.active!==false&&f.axis===q.axis&&(!f.stage||f.stage===q.stage)&&(f.checkpointKey===q.checkpointKey||f.title===q.question||f.title===q.title));const fact=facts.reverse().sort((a:any,b:any)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')))[0];return{...q,factId:fact?.id||null,description:fact?.description||'尚未明确，待对话补充',status:fact?.status||'unknown',updatedAt:fact?.updatedAt||null,source:fact?.source};});
}
export function checkpointForFact(f:any,definitions:any[]){return definitions.find(q=>q.axis===f.axis&&(!f.stage||f.stage===q.stage)&&(f.checkpointKey===q.checkpointKey||f.title===q.question||f.title===q.title));}
