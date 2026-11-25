import {resolve} from 'node:path';
import {AppError,type Mode} from '../../../packages/contracts/index.ts';
export function testRuntime(){return process.env.SALES_BUDDY_TEST_MODE==='1'&&/[\\/]data-test-[^\\/]+[\\/]/.test(resolve(process.env.DATABASE_PATH||'runtime/app/app.sqlite'));}
export function userMode(requested?:unknown):Mode{
 if(requested!==undefined&&!['live',...(testRuntime()?['replay']:[])].includes(String(requested)))throw new AppError('UNSUPPORTED_MODE','用户界面仅支持在线模型',400);
 return testRuntime()?'replay':'live';
}
