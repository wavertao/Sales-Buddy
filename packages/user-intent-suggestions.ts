/** Buttons speak as the salesperson requesting work, never as the agent interrogating them. */
export function isUserIntentSuggestion(text:string){
 const q=text.trim();
 if(/(?:帮我|请|直接|立即)(?:直接|立即|现在|先|帮我|准备|进行|在CRM中|在系统中){0,2}(?:创建|新建|发送|发出|删除|修改CRM|关闭任务|关闭待办|合并记录)|(?:创建|新建)(?:一个|一条|待办|任务|商务活动|进展记录)|^(?:create|send|delete|update crm|close task)\b/i.test(q))return false;
 const delegation=/帮我|为我|替我|请协助|请.{0,18}(?:查询|查找|查看|检索|整理|梳理|分析|比较|准备|拟定|制定|设计|推荐|列出|评估|汇总|解释)/.test(q);
 if(/^(?:请)?帮我(?:直接|立即)?(?:发邮件|发消息|发IM|邀约|审批|批准)/i.test(q))return false;
 const factualAt=q.search(/是否|是不是|有无|有没有|请提供|请确认|请补充|你能提供/),adviceAt=q.search(/如何|怎么|怎样/);
 if(!delegation&&factualAt>=0&&(adviceAt<0||factualAt<adviceAt))return false;
 const advice=/(?:如何|怎么|怎样).{0,40}(?:核实|确认|沟通|联系|推进|推动|问清|准备|协调|判断|评估|回应|争取|比较|安排|引荐|选择|解释|识别|解决)/.test(q);
 const transform=/^(?:把|将).+(?:整理|梳理|转成|压缩成|汇总|生成|拟成)/.test(q);
 const english=/^(?:please\s+)?(?:help me|look up|find|show|summari[sz]e|draft|prepare|compare|plan|explain|analy[sz]e|recommend|list)\b|\bhow (?:can|should|do) (?:I|we)\b/i.test(q);
 // A factual question with no request for agent work belongs in the main answer's clarification section.
 return delegation||advice||transform||english;
}
