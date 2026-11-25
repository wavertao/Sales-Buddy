import {modelTurn} from './model.ts';
import {advisorPolicy} from './advisor-policy.ts';
import {VISUALIZATION_PROMPT} from '../../../packages/visualization.ts';
import {navigatorReplyPolicy} from './navigator-reply.ts';
export function acknowledgement(question:string){return /^\s*(你好|您好|hi|hello|谢谢|早上好|晚上好)[！!。\s]*$/i.test(question)||/(?:这次)?只(?:需)?确认(?:你|您)?(?:理解|明白)|记住(?:这些|以上|我的偏好).*即可/.test(question);}
export function visibleAnswerText(text:string){return text.replace(/```echarts?\s*\n([\s\S]*?)```/g,(_,raw)=>{try{const spec=JSON.parse(raw);return[spec.title,spec.caption,...(spec.rows||[]).flatMap((r:any)=>Object.values(r))].join(' ');}catch{return raw;}});}
function actionsCount(text:string){const numbered=(text.match(/^\s*\d+[.、]\s/gm)||[]).length;let maxRows=0;for(const m of text.matchAll(/```echarts?\s*\n([\s\S]*?)```/g))try{const t=JSON.parse(m[1]);if(t.type==='table'&&/行动|动作|待办|推进/.test(t.title))maxRows=Math.max(maxRows,t.rows.length);}catch{}return Math.max(numbered,maxRows);}
type ReplyOptions={navigator?:boolean;navigatorActions?:{title:string;description:string}[]};
export function styleIssues(text:string,question:string,options:ReplyOptions={}){
 const issues:string[]=[],policy=navigatorReplyPolicy(question),compact=options.navigator&&!policy.detailed;
 if(visibleAnswerText(text).length>(acknowledgement(question)?300:options.navigator?policy.maxCharacters:policy.detailed?Infinity:1400))issues.push('篇幅过长');
 const max=options.navigator?policy.maxActions:8;if(actionsCount(text)>max)issues.push('行动超过'+max+'项');
 if(!/依据|证据|明细|记录ID|数据清理|重复/.test(question)&&/^#{1,4}.*(?:证据基线|证据矩阵|CRM事实|未知清单)/m.test(text))issues.push('正文盘点证据');
 if(options.navigator&&!policy.resourcesRequested&&(/^(?:#{1,4}\s*|\*\*)[^\n]{0,20}(?:资源|内部支持|支持归口)/m.test(text)||/(?:联系|协调|申请|调动|寻求|找|推荐).{0,14}(?:内部|我方|我司|集团|售前|并网专家|财务部门|解决方案工程师|PM\b|PD\b)/i.test(text)))issues.push('未经请求展开内部资源');
 if(compact&&!/表格|图表|矩阵|用表|table|chart/i.test(question)&&/```echarts?|^\s*\|.+\|/m.test(text))issues.push('默认回答不应使用宽表格');
 if(compact&&(text.match(/[？?]/g)||[]).length>1)issues.push('单轮事实追问超过1个');
 if(compact&&/现状|当前情况|下一步|怎么推进|如何推进/.test(question)&&(text.match(/^#{1,4}\s/gm)||[]).length>3)issues.push('默认分析超过三部分');
 return issues;
}
export async function refineAnswer(text:string,question:string,records:any[],signal:AbortSignal,options:ReplyOptions={}){
 let result=text;const initial=styleIssues(text,question,options),policy=navigatorReplyPolicy(question);let passes=0;
 while(styleIssues(result,question,options).length&&passes<2){passes++;const response=await modelTurn([{role:'system',content:advisorPolicy},{role:'system',content:VISUALIZATION_PROMPT},{role:'system',content:'你是答案编辑。仅编辑草稿，不新增事实，不解释修改过程。'+(options.navigator?policy.instructions:'目标900–1100可见字符，最多8个行动；问候或确认偏好限1–3句。')+'保留真正回答当前问题的结论、具体动作和必要追问，已经回答的问题不重复问。同一行动只出现一次，不同时列步骤和行动表。删除密集ID、未经请求的英文、重复提醒和大段证据；不要把建议称为已执行。返回最终销售可见Markdown，不输出隐藏控制块。如有navigatorActions，待办保留相同的对象、动作与顺序，只压缩表述，不另换一组任务。'},{role:'user',content:JSON.stringify({question,issues:styleIssues(result,question,options),draft:result,navigatorActions:options.navigatorActions,crm:records.map(r=>({id:r.id,name:r.name,type:r.type,stage:r.stage,evidence:r.evidence,content:r.content,projectConditions:r.projectConditions})).slice(0,25)})}],[],signal,()=>{});if(response.content?.trim())result=response.content;else break;}
 return{text:result,quality:{initialIssues:initial,editingPasses:passes,remainingIssues:styleIssues(result,question,options),visibleCharacters:visibleAnswerText(result).length,actions:actionsCount(result)}};
}
