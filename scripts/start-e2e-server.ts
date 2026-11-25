import {databasePath} from '../packages/paths.ts';
import {testDirectory} from '../tests/helpers/temp.ts';
import {writeFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {spawn,spawnSync} from 'node:child_process';
const root=testDirectory("e2e-"),database=join(root,'app.sqlite');
if(existsSync(databasePath())){const source=new DatabaseSync(databasePath());source.exec("VACUUM INTO '"+database.replaceAll("'","''")+"'");source.close();}
const envFile=join(root,'.env');writeFileSync(envFile,'MODEL_PROTOCOL=chat_completions\nMODEL_API_BASE_URL=http://127.0.0.1:1/v1\nMODEL_API_KEY=fixture-secret\nMODEL_NAME=fixture-model\nMODEL_TIMEOUT_MS=120000\n');
const preparation=spawnSync(process.execPath,[resolve('node_modules/tsx/dist/cli.mjs'),'scripts/seed-cue-scenarios.ts','--include-navigator-examples'],{stdio:'inherit',env:{...process.env,DATABASE_PATH:database,SALES_BUDDY_TEST_MODE:'1',DOTENV_CONFIG_PATH:envFile}});if(preparation.status!==0)throw Error('Failed to prepare isolated Cue fixtures');
const child=spawn(process.execPath,[resolve('node_modules/tsx/dist/cli.mjs'),'apps/server/src/index.ts','--production'],{stdio:'inherit',env:{...process.env,APP_HOST:'127.0.0.1',APP_PORT:'3002',DATABASE_PATH:database,MEMORY_ROOT:join(root,'memory'),MEMORY_MIGRATION_REPORT_PATH:join(root,'migration.json'),MODEL_CONFIG_PATH:envFile,DOTENV_CONFIG_PATH:envFile,MODEL_PROTOCOL:'chat_completions',MODEL_API_BASE_URL:'http://127.0.0.1:1/v1',MODEL_API_KEY:'fixture-secret',MODEL_NAME:'fixture-model',SALES_BUDDY_TEST_MODE:'1',EXA_API_KEY:'',EXA_SEARCH_ENABLED:'false'}});
process.on('SIGTERM',()=>child.kill());process.on('SIGINT',()=>child.kill());child.on('exit',code=>process.exit(code||0));
