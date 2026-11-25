import {mkdirSync as ensureReportDirectory} from 'node:fs';ensureReportDirectory('runtime/reports',{recursive:true});
import {testDirectory} from '../tests/helpers/temp.ts';
import {writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
// Isolated data; only generic, invented meeting text and public MOCK material go to the configured model.
const root=testDirectory("p11-live-");
process.env.DATABASE_PATH=join(root,'app.sqlite');process.env.MEMORY_ROOT=join(root,'memory');process.env.SALES_BUDDY_TEST_MODE='';
const D=await import('../apps/server/src/db.ts'),C=await import('../apps/server/src/crm.ts'),M=await import('../apps/server/src/meetings.ts'),A=await import('../apps/server/src/materials.ts');
const {seed}=await import('../apps/server/src/seed.ts');const {initKnowledge}=await import('../apps/server/src/knowledge.ts');seed();initKnowledge();await A.initMaterialLibrary();const u=C.user('U-018');
const steps:any[]=[];const started=Date.now();
async function finish(j:any){const at=Date.now();for(let i=0;i<800;i++){const job=D.get('presentation_jobs',j.id);if(job.status!=='running'){steps.push({type:job.type,status:job.status,elapsedMs:Date.now()-at,...(job.error?{error:job.error}:{})});if(job.status!=='completed')throw new Error(job.error);return M.kit(u,j.kitId);}await new Promise(r=>setTimeout(r,250));}throw new Error('Live任务超时');}
let result:any;
try{
 let k=M.createKit(u,{});k=await finish(M.sendMeetingMessage(u,'',k.id,{revision:k.revision,question:'这是无真实客户的通用储能初访测试，全部使用公开MOCK材料。15分钟英文PPT，参会角色是投资负责人和技术负责人。目标是确认应用场景、需求数据、接口责任以及下一次技术交流安排。尚无产品承诺、报价和客户事实。无需再澄清，可以直接形成交流大纲。'}));
 k=await finish(M.proposeOutline(u,'',k.id,{revision:k.revision}));k=M.confirmOutline(u,k.id,k.revision);k=await finish(M.proposePlan(u,k.id,{revision:k.revision}));const proposedPages=k.pages.length;if(!k.outline.every((s:any)=>/[\u4e00-\u9fff]/.test(s.title))||!k.pages.every((p:any)=>[p.title,p.question,p.direction].every(t=>/[\u4e00-\u9fff]/.test(t))))throw new Error('界面规划未使用中文');const replyEvents=steps.filter(s=>s.type==='background').length;
 k=M.editPlan(u,k.id,{revision:k.revision,pages:k.pages.slice(0,1)});k=M.confirmPlan(u,k.id,k.revision);const m=A.materialList(u).find(m=>m.source==='public'&&m.id.includes('PRE-01'))!;k=M.selectSources(u,k.id,{revision:k.revision,targetId:k.pages[0].id,sources:[{materialId:m.id,pages:[2]}]});
 k=await finish(M.generatePage(u,k.id,k.pages[0].id,{revision:k.revision,supplement:'Keep the slide concise. Only describe discussion objectives, not a product commitment.'}));k=M.choosePage(u,k.id,k.pages[0].id,{revision:k.revision,mode:'confirm_generated'});k=await finish(M.exportKit(u,k.id,{revision:k.revision}));
 result={ok:true,runtime:'online model, no fixture',scope:'unbound generic invented meeting; public MOCK only',planningLanguage:'zh',pptLanguage:k.brief.language,proposedPages,exportedPages:k.pages.length,personalMaterials:A.materialList(u,{personal:true}).length,steps,elapsedMs:Date.now()-started};
}catch(e:any){result={ok:false,steps,error:e.message,elapsedMs:Date.now()-started};process.exitCode=1;}
writeFileSync('runtime/reports/p11-live-smoke.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));D.db.close();
