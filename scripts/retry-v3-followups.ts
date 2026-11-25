import {mkdirSync as ensureReportDirectory} from 'node:fs';ensureReportDirectory('runtime/reports',{recursive:true});
import {readFileSync,writeFileSync} from 'node:fs';
const base='http://127.0.0.1:3001';
const login:any=await (await fetch(base+'/api/mock-session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:'U-ADMIN'})})).json();
const call=async(p:string,post=false)=>{const r=await fetch(base+'/api'+p,{method:post?'POST':'GET',headers:{Authorization:'Bearer '+login.token}});if(!r.ok)throw new Error('HTTP '+r.status);return r.json() as any;};
const report=JSON.parse(readFileSync('runtime/reports/advisor-v3-live-results.json','utf8'));
for(const result of report.results.filter((r:any)=>(process.argv.includes('--refresh-all')?!['profile','greeting'].includes(r.id):r.status==='needs_review')&&!r.warnings.length&&r.answerId)){
 let data=await call('/answers/'+result.answerId+'/suggestions/retry',true);for(let i=0;i<40&&data.status==='generating';i++){await new Promise(r=>setTimeout(r,1000));data=await call('/answers/'+result.answerId+'/suggestions');}
 const questions=data.actions.filter((a:any)=>a.actionType==='followup');result.followups=questions.map((a:any)=>a.goal);result.metadataRetry={at:new Date().toISOString(),status:data.status};if(data.status==='completed'&&questions.length>=2)result.status='technical_pass';
 const file='runtime/reports/v3-review/'+result.id+'.md';writeFileSync(file,readFileSync(file,'utf8').replace(/# 动态追问[\s\S]*$/,'# 动态追问\n'+questions.map((a:any)=>'- '+a.goal).join('\n')));writeFileSync('runtime/reports/advisor-v3-live-results.json',JSON.stringify({...report,at:new Date().toISOString()},null,2));console.log(result.id+': '+result.status);
}
if(report.results.some((r:any)=>r.status!=='technical_pass'))process.exitCode=1;
