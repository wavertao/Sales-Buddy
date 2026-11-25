import {test} from 'node:test';
import assert from 'node:assert/strict';
import {advisorPolicy} from '../apps/server/src/advisor-policy.ts';
import {styleIssues,acknowledgement,visibleAnswerText} from '../apps/server/src/answer-quality.ts';
test('角色MD区分手机商机简答与客户通用分析，依据与维护事项不抢占主问题',()=>{for(const text of ['250–400字','最多3项行动','每轮最多自然追问1个','明确请求支持','同一回答只用一种方式','来源弹窗','数据重复'])assert.ok(advisorPolicy.includes(text),text);});
test('发布前校验可见字数和行动数量，不把JSON字段计为销售正文',()=>{const text='```echarts\n'+JSON.stringify({type:'table',title:'行动',columns:[{key:'x',label:'事项'}],rows:[{x:'联系Sarah确认评审'}]})+'\n```';assert.ok(visibleAnswerText(text).length<50);assert.ok(styleIssues('字'.repeat(1600),'下一步怎么推').includes('篇幅过长'));assert.ok(styleIssues(Array.from({length:9},(_,i)=>i+1+'. 动作').join('\n'),'推进计划').includes('行动超过8项'));assert.ok(!styleIssues('字'.repeat(1800),'请详细展开全部细节').includes('篇幅过长'));});
test('纯问候和确认偏好可简短，不误判真实业务确认问题',()=>{assert.equal(acknowledgement('你好'),true);assert.equal(acknowledgement('这次只确认你理解即可'),true);assert.equal(acknowledgement('只需确认预算是否获批'),false);assert.equal(acknowledgement('你好，客户说竞品便宜8%怎么办'),false);});
