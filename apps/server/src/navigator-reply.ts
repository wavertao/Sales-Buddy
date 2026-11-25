/** Current-turn intent only. Project gaps, previous replies and knowledge cannot request resources. */
export function requestsInternalResources(question:string){
 return question.split(/[，。；;！!\n]/).some(part=>{
  if(/(?:不要|不用|无需|不需要|不必|先不|暂不|别|不是问).{0,16}(?:资源|内部支持|协调|专家|人员|PM|PD)/i.test(part))return false;
  if(/客户(?:的)?内部|客户(?:有|的).*资源/.test(part)&&!/(?:我方|我司|我们|集团|公司内部)/.test(part))return false;
  const target=/(?:内部|我方|我司|我们|公司|集团).{0,16}(?:资源|支持|协调|人|专家)|(?:资源).{0,12}(?:支持|归口|联系人|申请|联系|找谁)|(?:PM|PD|项目经理|解决方案工程师|售前|并网专家|财务部门).{0,16}(?:支持|协助|协调|介入)|(?:找|请|协调|申请).{0,12}(?:PM|PD|项目经理|解决方案工程师|售前|并网专家|财务部门)/i.test(part);
  return target&&/(?:如何|怎么|怎样|哪些|哪个|有什么|谁|能否|可否|是否可以|帮我|请|需要|申请|协调|调动|安排|推荐|支持[？?]|求助)|\b(?:need|request|help|support|which|who|how)\b/i.test(part);
 })||/\b(?:need|request|find|which|who|how|help)\b.{0,60}\b(?:internal (?:resources?|support|experts?)|presales support|solution engineers?)\b/i.test(question)&&! /\b(?:no|without|do not|don't)\b.{0,25}\b(?:internal|resources?|support)\b/i.test(question);
}
export function navigatorReplyPolicy(question:string){
 const detailed=/详细|完整展开|深度分析|全部细节|不要限制字数|完整分析|详细方案|详细计划|detailed|in.depth/i.test(question);
 const resourcesRequested=requestsInternalResources(question),maxActions=detailed?8:3,maxCharacters=detailed?1800:600;
 const instructions=[
  '本轮是具体商机的赢单领航员对话，优先适配手机阅读。',
  detailed?'用户明确要求展开，按主问题给必要细节，仍避免重复列行动。':'默认正文250–400字，最多600个可见字符；不为凑篇幅扩展。分析现状和下一步时只用三部分：## 结论（一句话）；## 项目简述（2–3句，仅当前判断相关事实，区分客户陈述、已核实和待核实）；## 推进建议（待办）（按优先级1–3项，每项一句，含找谁/做什么/产出）。不额外加风险清单、资源说明、执行节奏、证据盘点或重复小结。具体话术等请求直接交付所需内容，不机械套三段。',
  `最多${maxActions}项行动，隐藏salesbuddy-navigator块也最多${maxActions}项，行动名称简明，描述不超过120字。默认用短列表，不用宽表格或图表；只有本轮明确要求表格/图表/对比矩阵时才使用。能并行核实需求和采购路径时直接给可做的动作，不因一个待核实条件要求全部工作暂停。`,
  resourcesRequested?'本轮明确请求内部资源支持：可针对具体缺口给必要的支持角色、申请路径与输入产出；没有真实联系人或授权就说明待核实，不编造姓名、链接、排期或承诺。':'本轮没有明确请求内部资源支持：不主动输出递资源、内部支持部门、专家/人员推荐、协调路径、归口或“资源待补”的说明。画像缺口、历史资源讨论、资金问题和知识库命中均不是请求。隐藏行动及猜你想问也不主动推荐内部资源。客户联系人与客户侧责任分工仍可用于推进建议。',
  '保留销售访谈技巧：围绕当前最影响下一步判断的一个缺口，最多自然追问1个关键事实，可放在项目简述或推进建议末尾。先回答再问，不因缺信息拒答；不要每轮机械追问。先查本轮用户原话、当前画像及历史，已回答的不重复问；模糊答案再聚焦“谁/当前结果/剩余条件”中的一个。用户不知道时给向客户核实的路径，用户暂不回答时继续可推进的部分。不要列首次画像核对清单、已了解几项或一次问多个问题。',
  '用户补充的信息由既有后台画像更新机制处理，区分用户陈述、待核实与已确认，不因一句口头反馈认定审批通过、融资关闭或采购授权生效。无需在正文播报存储过程。',
  '纯问候、致谢或确认偏好用1–3句，不套项目分析、不追问。同轮隐藏salesbuddy-followups最多3个可委托AI完成工作的建议；向用户索要事实的追问放正文，不放猜你想问。'
 ].join('\n');
 return{detailed,resourcesRequested,maxActions,maxCharacters,instructions};
}
