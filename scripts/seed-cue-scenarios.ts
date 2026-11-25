import {mkdirSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {db,dbPath} from '../apps/server/src/db.ts';
import {seed} from '../apps/server/src/seed.ts';
import {seedCueDemo} from '../apps/server/src/cue-demo.ts';
import {seedNavigatorDemo} from '../apps/server/src/navigator-demo.ts';
const backupDir=join(dirname(dbPath),'backups');mkdirSync(backupDir,{recursive:true});
const backup=join(backupDir,'before-cue-demo-'+Date.now()+'.sqlite');
db.exec("VACUUM INTO '"+backup.replaceAll("'","''")+"'");
if(!db.prepare('SELECT id FROM users LIMIT 1').get())seed();
db.exec('BEGIN IMMEDIATE');
try{const result=seedCueDemo(),navigatorExamples=process.argv.includes('--include-navigator-examples')?seedNavigatorDemo():undefined;db.exec('COMMIT');console.log(JSON.stringify({backup,...result,navigatorExamples,integrity:db.prepare('PRAGMA integrity_check').get()},null,2));}catch(e){db.exec('ROLLBACK');throw e;}finally{db.close();}
