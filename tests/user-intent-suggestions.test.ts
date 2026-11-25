import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isUserIntentSuggestion} from '../packages/user-intent-suggestions.ts';
import {INLINE_FOLLOWUPS_PROMPT} from '../apps/server/src/inline-followups.ts';
test('销售请求与Agent事实追问分开，用户举例均不能作为建议按钮',()=>{
 for(const text of ['Hassan Al Ketbi 在这笔投资中是否是最终签批人？如果不是，从 Aisha 到最终签批之间还要经过哪些人或委员会？','Khalid Al Mazrouei 是否已说明资金来源形态，以及预算处于设想、申请中还是已列入预算？','Omar Al Qasimi 和 Noor Al Hashimi 是否已给出接入申请主体和非外送运行的初步判断？','请提供并网批复。','预算是否获批，以及如何准备会议？','土地审批进行到哪一步？'])assert.equal(isUserIntentSuggestion(text),false,text);
});
test('查询、分析、话术、计划、资源和画像请求支持完整用户视角表达',()=>{
 for(const text of ['帮我查看Hassan的联系人信息和历史商务活动。','根据已有记录，帮我整理审批路径，标出已确认和缺失角色。','帮我准备向Aisha确认预算归属的话术。','帮我制定接入边界的核实计划，列明对接角色与期望产出。','帮我查找内部融资支持资源及使用前提。','根据刚刚的对话，帮我整理项目画像的更新建议。','如何通过现有联系窗口确认最终签批角色？','把技术方待确认事项压缩成会前清单。','Help me prepare a discussion plan for the customer.'])assert.equal(isUserIntentSuggestion(text),true,text);
});
test('创建与不支持的直接发送不混进猜你想问',()=>{for(const text of ['帮我创建一个待办','请直接发送客户邮件','帮我发邮件给客户','帮我修改CRM阶段','Delete this record'])assert.equal(isUserIntentSuggestion(text),false,text);assert.match(INLINE_FOLLOWUPS_PROMPT,/3至5/);assert.match(INLINE_FOLLOWUPS_PROMPT,/需要你确认/);assert.match(INLINE_FOLLOWUPS_PROMPT,/同|正文/);});
