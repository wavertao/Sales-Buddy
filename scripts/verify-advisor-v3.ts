import {mkdirSync as ensureReportDirectory} from 'node:fs';ensureReportDirectory('runtime/reports',{recursive:true});
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
const base='http://127.0.0.1:3001';
const login:any=await (await fetch(base+'/api/mock-session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:'U-ADMIN'})})).json();
const call=async(path:string,body?:any,method?:string)=>{const r=await fetch(base+'/api'+path,{method:method||(body?'POST':'GET'),headers:{'Content-Type':'application/json',Authorization:'Bearer '+login.token},...(body?{body:JSON.stringify(body)}:{})});const j:any=await r.json();if(!r.ok)throw new Error(j.message);return j;};
const uk={objectType:'opportunity',objectId:'OP-UK-026',customerId:'C-UK-0086'},client={objectType:'customer',objectId:'C-UK-0086',customerId:'C-UK-0086'},de={objectType:'opportunity',objectId:'OP-DE-041',customerId:'C-DE-002'};
const cases=[
 {id:'sales-next',scope:client,q:'Northstar现在最值得推进的下一步是什么？请给我可执行的建议。'},
 {id:'price',scope:uk,q:'客户说竞品便宜8%，我该怎么回应？给我能用的话术和下一步。'},
 {id:'tasks',scope:uk,q:'请整理下一步待办建议，重点告诉我找谁做什么、拿到什么产出。'},
 {id:'meeting',scope:uk,q:'准备下次与David和Sarah的商务活动，只要核心目标、会前准备、关键议题与产出。'},
 {id:'profile',scope:uk,q:'我负责欧洲储能业务，以后我偏好先看行动建议再按需展开细节。这次只确认你理解即可。'},
 {id:'cross-client',scope:de,q:'现在看德国园区储能项目，下一步怎样引导客户？沿用我的长期沟通习惯。'},
 {id:'greeting',scope:client,q:'你好'},
 {id:'cleanup',scope:uk,q:'请只检查当前项目待办的疑似重复，给出人工核对与整理建议，不执行变更。'}
];
mkdirSync('runtime/reports/v3-review',{recursive:true});const results:any[]=[],messageIds=new Set<string>();
function visibleText(text:string){return text.replace(/```echarts?\s*\n([\s\S]*?)```/g,(_,raw)=>{try{const j=JSON.parse(raw);return[j.title,j.caption,...(j.rows||[]).flatMap((r:any)=>Object.values(r))].join(' ');}catch{return raw;}});}
async function persist(){writeFileSync('runtime/reports/advisor-v3-live-results.json',JSON.stringify({at:new Date().toISOString(),planned:8,executed:results.length,results,expertReview:'pending',note:'技术及风格检查；不是完整销售专家或30题能力验收'},null,2));}
const previousIds=new Set<string>();try{const prior=JSON.parse(readFileSync('runtime/reports/advisor-v3-first-pass.json','utf8'));for(const r of prior.results.filter((r:any)=>r.id==='profile')){const detail=await call('/admin/export/'+r.runId);if(detail.run.userMessageId)previousIds.add(detail.run.userMessageId);}}catch{}
for(const m of await call('/memories?ownerId=U-ADMIN')){let current=m;for(const e of m.entries.filter((e:any)=>e.status==='disabled'&&e.sources?.some((s:any)=>previousIds.has(s.id))))current=await call('/memories/'+encodeURIComponent(m.id),{operation:'restore',version:current.version,entryId:e.id,reason:'仅恢复上一轮自动化验证生成的管理员条目以复测'},'PATCH');}
for(const c of cases){try{const conversation=await call('/conversations',{scope:c.scope});const run=await call('/conversations/'+conversation.id+'/messages',{mode:'live',question:c.q});messageIds.add(run.userMessageId);await (await fetch(base+'/api/runs/'+run.id+'/events',{headers:{Authorization:'Bearer '+login.token},signal:AbortSignal.timeout(180000)})).text();for(let i=0;i<30;i++){const meta=await call('/answers/'+run.answerId+'/suggestions');if(meta.status!=='generating')break;await new Promise(r=>setTimeout(r,1000));}const detail=await call('/conversations/'+conversation.id);const answer=detail.messages.find((m:any)=>m.id===run.answerId);if(!answer)throw new Error(detail.runs[0]?.error||'没有完整回答');
 const displayed=visibleText(answer.content);const numbered=(answer.content.match(/^\s*\d+[.、]\s/gm)||[]).length;const questions=(answer.actions||[]).filter((a:any)=>a.actionType==='followup');const warnings=[];if(c.id!=='cleanup'&&displayed.length>1600)warnings.push('默认回答超过约1000字的宽松阈值');if(c.id!=='cleanup'&&/^#{1,4}.*(?:证据基线|证据矩阵|CRM事实|未知清单)/m.test(answer.content))warnings.push('正文出现证据盘点标题');if(c.id==='greeting'&&displayed.length>300)warnings.push('问候展开过长');if(numbered>8)warnings.push('编号行动超过8项');if(c.id!=='cleanup'&&/先清理|先去重|先.{0,8}合并/.test(displayed.slice(0,300)))warnings.push('数据维护抢占主问题');if(c.id==='cross-client'&&/Northstar|OP-UK-026/.test(displayed))warnings.push('疑似跨客户内容');
 writeFileSync('runtime/reports/v3-review/'+c.id+'.md','# 用户问题\n'+c.q+'\n\n# 回答\n'+answer.content+'\n\n# 动态追问\n'+questions.map((a:any)=>'- '+a.goal).join('\n'));
 results.push({id:c.id,runId:run.id,answerId:answer.id,status:((['profile','greeting'].includes(c.id)&&questions.length===0)||questions.length>=2)&&!warnings.length?'technical_pass':'needs_review',displayedCharacters:displayed.length,numberedActions:numbered,followups:questions.map((a:any)=>a.goal),warnings,promptVersion:answer.promptVersion});
 if(c.id==='profile'){for(let i=0;i<20;i++){const jobs=(await call('/admin/runs')).memoryJobs;const job=jobs.find((j:any)=>j.answerId===run.answerId);if(job?.status==='completed')break;await new Promise(r=>setTimeout(r,1000));}const own=await call('/memories?ownerId=U-ADMIN');const profile=own.find((m:any)=>m.kind==='user');results.at(-1).profileCaptured=!!profile?.entries.some((e:any)=>e.sourceId===run.userMessageId||e.sources?.some((s:any)=>s.id===run.userMessageId));if(!results.at(-1).profileCaptured){results.at(-1).status='needs_review';results.at(-1).warnings.push('明确长期信息未捕捉');}}
 }catch(e:any){results.push({id:c.id,status:'failed',error:e.message});}await persist();console.log(c.id+': '+results.at(-1).status);}
// Validation uses the mock administrator; do not leave verification preferences active.
for(const m of await call('/memories?ownerId=U-ADMIN')){let current=m;for(const e of m.entries.filter((e:any)=>(messageIds.has(e.sourceId)||e.sources?.some((s:any)=>messageIds.has(s.id)))&&e.status!=='disabled'))try{current=await call('/memories/'+encodeURIComponent(m.id),{operation:'disable',version:current.version,entryId:e.id,reason:'在线验证完成，验证条目不参与后续回答'},'PATCH');}catch{}}
await persist();if(results.some(r=>r.status!=='technical_pass'))process.exitCode=1;
