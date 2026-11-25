import {existsSync,readFileSync,readdirSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join,extname,dirname} from 'node:path';
import {parseEnv} from 'node:util';
import {DatabaseSync} from 'node:sqlite';
const source=resolve(process.argv[2]||'.'),out=resolve(process.argv[3]||'runtime/migration/inventory.json');
const env=existsSync(join(source,'.env'))?parseEnv(readFileSync(join(source,'.env'),'utf8')):{};
const dbFile=resolve(source,env.DATABASE_PATH||'runtime/app/app.sqlite');
const paths={database:dbFile,memory:resolve(source,env.MEMORY_ROOT||join(dirname(dbFile),'memory')),materials:resolve(source,env.MATERIAL_ROOT||join(dirname(dbFile),'materials')),knowledge:join(source,'knowledge'),presentations:existsSync(join(source,'assets/presentations'))?join(source,'assets/presentations'):join(source,'knowledge/presentations')};
function scan(path){let files=0,bytes=0;const extensions={};function walk(p){if(!existsSync(p))return;const s=statSync(p);if(s.isFile()){files++;bytes+=s.size;const e=extname(p).toLowerCase()||'(none)';extensions[e]=(extensions[e]||0)+1;}else for(const n of readdirSync(p))walk(join(p,n));}walk(path);return{path,files,bytes,mib:Number((bytes/1048576).toFixed(2)),extensions};}
const database=new DatabaseSync(dbFile,{readOnly:true});
const tables=database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(r=>({table:r.name,count:Number(database.prepare('SELECT COUNT(*) n FROM "'+r.name.replaceAll('"','""')+'"').get().n)}));
const recordCounts=database.prepare('SELECT type,COUNT(*) count FROM records GROUP BY type ORDER BY type').all();
const documentCounts=database.prepare('SELECT collection,COUNT(*) count FROM documents GROUP BY collection ORDER BY collection').all();
const activeJobs=database.prepare("SELECT collection,COUNT(*) count FROM documents WHERE collection IN ('runs','presentation_jobs') AND json_extract(data,'$.status')='running' GROUP BY collection").all();
const materialRefs=database.prepare("SELECT data FROM documents WHERE collection='materials'").all().map(r=>JSON.parse(r.data));
const missingMaterialFiles=materialRefs.filter(m=>m.file&&!existsSync(m.file)).map(m=>({id:m.id,file:m.file,status:m.status}));
const directories=Object.fromEntries(Object.entries(paths).map(([k,p])=>[k,scan(p)]));
const report={at:new Date().toISOString(),source,paths,directories,tables,recordCounts,documentCounts,activeJobs,materials:{records:materialRefs.length,missing:missingMaterialFiles},configuration:{modelConfigured:!!(env.MODEL_API_BASE_URL&&env.MODEL_API_KEY&&env.MODEL_NAME),searchConfigured:!!env.EXA_API_KEY},policy:'Private inventory only. No credential values or conversation text included. Tests, logs, backups and dependencies excluded.'};
database.close();mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
