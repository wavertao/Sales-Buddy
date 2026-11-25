import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,existsSync,cpSync,readFileSync,writeFileSync,readlinkSync,chmodSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {join} from 'node:path';
const root='/opt/sales-buddy',env=parseEnv(readFileSync(root+'/shared/app.env','utf8'));
const db=new DatabaseSync(env.DATABASE_PATH,{readOnly:true});
const active=db.prepare("SELECT COUNT(*) n FROM documents WHERE collection IN ('runs','presentation_jobs','workbench_generations','workbench_jobs','profile_capture_jobs') AND json_extract(data,'$.status')='running'").get().n;
if(active){db.close();console.log('Backup deferred: active jobs exist. Existing backups remain intact.');process.exit(0);}
const dir=join(root,'backups','scheduled',new Date().toISOString().replace(/[:.]/g,'-'));mkdirSync(dir,{recursive:true,mode:0o700});
db.exec("VACUUM INTO '"+join(dir,'app.sqlite').replaceAll("'","''")+"'");db.close();
for(const[key,name]of[['MEMORY_ROOT','memory'],['MATERIAL_ROOT','materials']])if(env[key]&&existsSync(env[key]))cpSync(env[key],join(dir,name),{recursive:true});
cpSync(root+'/shared/app.env',join(dir,'app.env'));chmodSync(join(dir,'app.env'),0o600);chmodSync(join(dir,'app.sqlite'),0o600);
writeFileSync(join(dir,'backup.json'),JSON.stringify({at:new Date().toISOString(),release:readlinkSync(root+'/current'),policy:'Private database, memory, materials and API settings. No deletion of previous backups.'},null,2));
console.log('Backup completed:',dir);
