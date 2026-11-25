import {mkdirSync,mkdtempSync} from 'node:fs';
import {join,resolve} from 'node:path';
/** npm test owns cleanup; direct test invocations remain contained under runtime. */
export function testDirectory(label:string){
 const root=resolve(process.env.TEST_RUN_ROOT||'runtime/test-runs/manual');
 mkdirSync(root,{recursive:true});
 return mkdtempSync(join(root,'data-test-'+label.replace(/[^a-z0-9-]/gi,'-').replace(/^-+|-+$/g,'')+'-'));
}
