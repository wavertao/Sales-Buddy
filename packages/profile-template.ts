export type ProfileKind='personal'|'customer'|'project';
export type ProfileModule={id:string;title:string;visibility:'shared'|'private';fields:{id:string;label:string;multiple?:boolean;crm?:string}[]};
const fields=(items:string[][])=>items.map(([id,label,crm])=>({id,label,...(crm?{crm}:{}),multiple:!crm}));
export const PROFILE_TEMPLATE_VERSION=1;
export const profileTemplates:Record<ProfileKind,ProfileModule[]>={
 personal:[
  {id:'identity',title:'工作身份',visibility:'private',fields:fields([['role','岗位与职责'],['market','负责区域'],['business','产品与业务类型']])},
  {id:'scope',title:'工作范围',visibility:'private',fields:fields([['responsibility','负责范围与协作团队']])},
  {id:'preferences',title:'沟通与协作偏好',visibility:'private',fields:fields([['length','回答详细程度'],['format','表达与图表偏好'],['language','语言偏好'],['collaboration','AI协作偏好']])},
  {id:'habits',title:'工作习惯与关注',visibility:'private',fields:fields([['routine','汇报与跟进习惯'],['focus','持续关注主题'],['constraints','明确约束']])}
 ],
 customer:[
  {id:'identity',title:'客户身份',visibility:'shared',fields:fields([['name','客户名称','name'],['id','客户编号','id'],['region','国家与地区','region'],['website','官网','website'],['owner','客户负责人','ownerId']])},
  {id:'background',title:'业务背景',visibility:'shared',fields:fields([['description','业务背景','description'],['mode','业务类型','businessMode'],['markets','重点市场'],['investment','投资与开发模式']])},
  {id:'organization',title:'组织与关键角色',visibility:'shared',fields:fields([['structure','组织及角色'],['authority','权限及适用范围']])},
  {id:'procurement',title:'决策与采购机制',visibility:'shared',fields:fields([['investment','投资决策'],['technical','技术评审'],['purchasing','采购与签约'],['qualification','供应商准入']])},
  {id:'requirements',title:'客户级需求与偏好',visibility:'shared',fields:fields([['standards','通用标准与合作要求'],['communication','沟通与材料偏好']])},
  {id:'cooperation',title:'合作与竞争背景',visibility:'shared',fields:fields([['history','合作历史'],['partners','供应商、伙伴与EPC关系']])},
  {id:'related',title:'关联业务',visibility:'shared',fields:fields([['records','CRM关联记录']])},
  {id:'focus',title:'我的经营关注',visibility:'private',fields:fields([['topics','关注点'],['questions','未决问题'],['statements','待核实陈述'],['commitments','承诺与下一步']])}
 ],
 project:[
  {id:'identity',title:'商机身份与范围',visibility:'shared',fields:fields([['name','商机名称','name'],['id','商机编号','id'],['customer','所属客户','customerId'],['owner','商机负责人','ownerId'],['site','场址','siteName'],['capacity','容量（MWh）','capacityMwh']])},
  {id:'background',title:'项目业务背景',visibility:'shared',fields:fields([['description','项目背景','description'],['application','应用与客户痛点'],['value','价值目标'],['scope','供货范围与合作模式']])},
  {id:'mpt',title:'当前MPT定位',visibility:'shared',fields:fields([['position','M / P / T定位']])},
  {id:'stages',title:'S1–S4业务情况',visibility:'shared',fields:fields([['current','正式商机阶段','stage'],['s1','S1 - 需求引导'],['s2','S2 - 机会点跟踪'],['s3','S3 - 售前项目'],['s4','S4 - 投标']])},
  {id:'relationships',title:'关键关系与竞争',visibility:'private',fields:fields([['decision','项目决策链与教练'],['procurement','采购角色与EPC'],['competition','竞争方案及我方位置']])},
  {id:'facts',title:'事实、风险与未决事项',visibility:'private',fields:fields([['financing','资金与融资'],['land','土地与站点'],['permits','许可与审批'],['grid','并网与接入'],['revenue','收益与交易'],['technical','技术边界'],['schedule','关键节点'],['other','其他明确情况'],['risks','风险与冲突'],['questions','未决问题']])},
  {id:'focus',title:'我的关注与推进计划',visibility:'private',fields:fields([['topics','关注点'],['commitments','承诺与下一步'],['resources','资源协作'],['tasks','关联待办']])},
  {id:'timeline',title:'时间线与来源',visibility:'private',fields:fields([['changes','重要变化与依据']])}
 ]
};
