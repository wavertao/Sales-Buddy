import {existsSync,mkdirSync,mkdtempSync,readdirSync,realpathSync,rmSync} from 'node:fs';
import {join,resolve,relative,isAbsolute} from 'node:path';
import {spawnSync} from 'node:child_process';
const portable=process.argv.includes('--portable'),e2e=process.argv.includes('--e2e');
const parent=resolve('runtime/test-runs',e2e?'e2e':'unit');mkdirSync(parent,{recursive:true});
const root=mkdtempSync(join(parent,'run-'));mkdirSync('runtime/reports/screenshots',{recursive:true});
const env={...process.env,TEST_RUN_ROOT:root,...(portable?{DOTENV_CONFIG_PATH:'.env.ci-not-present',EXA_SEARCH_ENABLED:'false'}:{})};
const files=readdirSync('tests').filter(f=>f.endsWith('.test.ts')&&(!portable||f!=='meetings.test.ts')).sort().map(f=>'tests/'+f);
if(portable)console.log('Portable suite: excludes meetings.test.ts (native presentation runtime required).');
const args=e2e?['node_modules/@playwright/test/cli.js','test',...process.argv.slice(2).filter(a=>a!=='--e2e')]:['--import','tsx','--test',...files];
const result=spawnSync(process.execPath,args,{stdio:'inherit',env});const status=result.status??1;
if(result.error)console.error(result.error.message);
if(status===0&&existsSync(root)){
 // Resolve the final target and verify containment before any recursive removal.
 const actual=realpathSync(root),base=realpathSync(parent),rel=relative(base,actual),workspace=realpathSync(process.cwd()),withinWorkspace=relative(workspace,actual);
 if(!rel||rel.startsWith('..')||isAbsolute(rel)||withinWorkspace.startsWith('..')||isAbsolute(withinWorkspace))throw Error('Refusing unsafe test cleanup target');
 try{rmSync(actual,{recursive:true,force:true,maxRetries:10,retryDelay:100});console.log('Successful test data cleaned:',relative(process.cwd(),actual));}catch{console.warn('Test data retained because files are still in use:',actual);}
}else console.error('Failed test data retained:',root);
process.exit(status);
