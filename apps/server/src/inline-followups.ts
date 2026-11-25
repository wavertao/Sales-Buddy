export const INLINE_FOLLOWUPS_PROMPT=`最终回答先输出销售可见的Markdown正文，再在最末尾输出一个且仅一个如下代码块：
\`\`\`salesbuddy-followups
{"questions":[{"question":"帮我基于本轮背景完成一项具体工作的完整请求","intent":"lookup","entityIds":["当前上下文中的实体ID"]}]}
\`\`\`
这是“猜你想问”，按钮内容将作为销售自己的消息。生成3至5个相关且不重复的请求；不够时宁缺毋滥，可返回0至5个。每条必须站在销售视角，请Agent完成有用的工作，不能把Agent想向销售核实的事实写成按钮。
区分三类内容：正文中的“需要你确认”才向销售提问，最多3个；正文的下一步行动说明目标、找谁、怎么沟通、期望结果；隐藏questions只放销售委托Agent的请求。未知事项不是继续向用户索要同一事实的理由，应转为查资料、核实计划、沟通话术或协调资源的请求。
根据本轮主问题、回答中尚未完成的有价值工作、当前实体和固定画像重点事项缺口挑选方向，不按固定菜单凑齐：lookup查CRM联系人/组织/商机进展/活动；analysis梳理决策链、对比或识别卡点；communication准备客户沟通话术、议程和问题清单；planning制定具体核实或推进计划；resources查找内部支持能力、使用前提及已核实对接渠道；profile整理刚刚对话中待用户确认的画像更新建议。
反例：“Hassan是否为最终签批人？”“预算是否已获批？”“请提供接入申请主体。”这些是向销售索要事实，不能作为猜你想问。
正例的写法：“帮我查看已有CRM中这位联系人的信息及历史商务活动。”“根据已有记录，帮我整理审批路径，区分已确认角色和缺失角色。”“帮我准备向现有联系窗口核实预算归属的话术。”“帮我制定接入边界的核实计划，列明对接角色与期望产出。”必须替换成当前上下文真正相关的实体与工作，不照抄示例。
只建议现有CRM查询、分析、沟通准备、计划、知识库资源检索或画像提案能力；没有依据时明确查已有信息或制定核实方案，不暗示能取得客户内部权限。公开背景不能证明签批权。不得承诺发邮件、发IM、修改CRM字段、完成审批；不得输出创建待办/活动/进展的指令，创建按钮走单独协议。资源缺联系人时不得编造姓名、工号和链接。
每条围绕一项清晰工作，保留完整背景和期望产出，不为按钮长度刻意缩写。entityIds只引用当前可信上下文实体ID。不得重复本轮用户原问题、已完成工作、无关数据清理或泛泛的功能菜单。问候或简单确认返回空数组。代码块仅供解析，不在正文重复展示。`;
export function splitInlineFollowups(raw:string):{text:string;questions:any[]}{
 const pattern=/```salesbuddy-followups\s*\n([\s\S]*?)(?:```|$)/g;
 let questions:any[]=[];
 const text=raw.replace(pattern,(_,json)=>{try{const value=JSON.parse(json.trim());if(Array.isArray(value.questions))questions=value.questions;}catch{}return '';}).trim();
 return{text,questions};
}
