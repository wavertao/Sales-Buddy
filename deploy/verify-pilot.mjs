import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
const env=parseEnv(readFileSync('/opt/sales-buddy/shared/app.env','utf8'));Object.assign(process.env,env);
const base='http://127.0.0.1:3001',report={at:new Date().toISOString()};
const denied=await fetch(base+'/api/mock-users');if(denied.status!==401)throw Error('Access gate is not enforced');
const login=await fetch(base+'/deployment-login',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','X-Forwarded-Proto':'https'},body:new URLSearchParams({password:env.DEPLOYMENT_ACCESS_PASSWORD}),redirect:'manual'});if(login.status!==303)throw Error('Gate login failed');
const cookie=login.headers.get('set-cookie').split(';')[0];
const tokens=new Map();
async function api(path,user='U-ADMIN'){if(!tokens.has(user)){const s=await fetch(base+'/api/mock-session',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({userId:user})});if(!s.ok)throw Error('Session setup failed');tokens.set(user,(await s.json()).token);}const r=await fetch(base+path,{headers:{Cookie:cookie,Authorization:'Bearer '+tokens.get(user)}});if(!r.ok)throw Error('API verification failed: '+path+' '+r.status);return r;}
const db=new DatabaseSync(env.DATABASE_PATH,{readOnly:true});report.integrity=db.prepare('PRAGMA integrity_check').get().integrity_check;if(report.integrity!=='ok'||db.prepare('PRAGMA foreign_key_check').all().length)throw Error('Database integrity failed');
report.recordCounts=db.prepare('SELECT type,COUNT(*) count FROM records GROUP BY type ORDER BY type').all();
report.documentCounts=db.prepare('SELECT collection,COUNT(*) count FROM documents GROUP BY collection ORDER BY collection').all();
const expected=JSON.parse(readFileSync('/opt/sales-buddy/shared/import/manifest.json','utf8'));
if(report.recordCounts.reduce((n,x)=>n+x.count,0)!==expected.before.records)throw Error('CRM record count changed');
const sourceDb=new DatabaseSync('/opt/sales-buddy/shared/import/app/app.sqlite',{readOnly:true});
for(const collection of ['conversations','messages','memories','navigator_projects','navigator_project_versions','meeting_kits','materials']){const before=sourceDb.prepare('SELECT id FROM documents WHERE collection=?').all(collection);const after=new Set(db.prepare('SELECT id FROM documents WHERE collection=?').all(collection).map(x=>x.id));if(before.some(x=>!after.has(x.id)))throw Error('Missing migrated collection: '+collection);}
const materials=db.prepare("SELECT data FROM documents WHERE collection='materials'").all().map(r=>JSON.parse(r.data));let originals=0,previews=0;
for(const m of materials){if(!existsSync(m.file))throw Error('Missing material '+m.id);const r=await api('/api/materials/'+encodeURIComponent(m.id)+'/download',m.userId||'U-ADMIN');const b=Buffer.from(await r.arrayBuffer());if(createHash('sha256').update(b).digest('hex')!==createHash('sha256').update(readFileSync(m.file)).digest('hex'))throw Error('Download mismatch');originals++;for(const slide of m.slides||[])if(slide.previewAvailable){const p=await api('/api/materials/'+encodeURIComponent(m.id)+'/slides/'+slide.page+'/preview',m.userId||'U-ADMIN');if(!p.headers.get('content-type')?.startsWith('image/'))throw Error('Preview mismatch');await p.arrayBuffer();previews++;}}
report.materials={records:materials.length,downloaded:originals,previews};
const kb=await(await api('/api/admin/navigator-knowledge/modules')).json();report.knowledgeModules=kb.length;report.knowledgeRows=kb.reduce((n,m)=>n+m.count,0);
report.gateway=true;sourceDb.close();db.close();
const dir='/opt/sales-buddy/shared/smoke';mkdirSync(dir,{recursive:true});
const E=await import('../apps/server/src/presentation-engine.ts');
const ppt=dir+'/editable.pptx',png=dir+'/previews';await E.createPptx([{title:'储能项目会晤',bullets:['核实并网条件','确认下一阶段'],notes:'云端生成验证'},{title:'Next Steps',bullets:['Confirm scope and owners']}],ppt,png);const info=await E.inspectPptx(readFileSync(ppt));if(info.slides.length!==2||!existsSync(png+'/2.png'))throw Error('Portable PPT failed');
await E.assemblePptx([{file:ppt,page:2},{file:'/opt/sales-buddy/current/assets/presentations/library/PRE-01.pptx',page:1}],dir+'/combined.pptx');const rendered=await E.renderPptx(dir+'/combined.pptx',dir+'/combined-previews');if(rendered.pages!==2)throw Error('Original slide assembly failed');report.portablePpt={editable:true,generated:2,assembledAndRendered:2};
try{const modelBase=env.MODEL_API_BASE_URL.replace(/\/$/,''),url=modelBase.endsWith('/chat/completions')?modelBase:modelBase+'/chat/completions';const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+env.MODEL_API_KEY},body:JSON.stringify({model:env.MODEL_NAME,messages:[{role:'user',content:'Reply only OK.'}],max_tokens:16,stream:false}),signal:AbortSignal.timeout(45000)});report.model={status:r.status,chatCompletions:r.ok&&!!(await r.json()).choices?.[0]?.message};}catch{report.model={connected:false};}
try{const r=await fetch('https://api.exa.ai/search',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':env.EXA_API_KEY},body:JSON.stringify({query:'energy storage project',numResults:1,type:'fast'}),signal:AbortSignal.timeout(30000)});report.search={status:r.status,connected:r.ok};}catch{report.search={connected:false};}
writeFileSync('/opt/sales-buddy/shared/verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
