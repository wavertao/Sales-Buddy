import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {testDirectory} from './helpers/temp.ts';
const root=testDirectory('deployment-mcp');
process.env.DATABASE_PATH=join(root,'app.sqlite');process.env.MEMORY_ROOT=join(root,'memory');process.env.SALES_BUDDY_TEST_MODE='1';process.env.APP_HOST='127.0.0.1';process.env.APP_PORT='0';process.env.DEPLOYMENT_ACCESS_PASSWORD='test-only-mcp-access-password-123456';
process.argv.push('--production');
const {server}=await import('../apps/server/src/index.ts');
if(!server.listening)await new Promise<void>(r=>server.once('listening',r));
process.env.APP_PORT=String((server.address()as any).port);
const C=await import('../apps/server/src/crm.ts'),M=await import('../apps/server/src/mcp.ts'),D=await import('../apps/server/src/db.ts');
after(async()=>{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));D.db.close();});
test('部署闸门开启时真实HTTP MCP可查询CRM，用户Bearer仍控制数据权限',async()=>{
 const token=C.session('U-018');const blocked=await fetch('http://127.0.0.1:'+process.env.APP_PORT+'/mcp',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}'});assert.equal(blocked.status,401);assert.equal((await blocked.json()).error,'DEPLOYMENT_LOGIN_REQUIRED');
 const client=await M.connectMcp(token);try{const result=await M.callMcp(client,'get_customer',{id:'C-UK-0086'});assert.equal(result.records[0].id,'C-UK-0086');assert.ok((await client.listTools()).tools.length);}finally{await client.close();}
 const other=await M.connectMcp(C.session('U-019'));try{await assert.rejects(()=>M.callMcp(other,'get_customer',{id:'C-UK-0086'}),(e:any)=>e.code==='FORBIDDEN');}finally{await other.close();}
});
test('部署签名凭据不能代替应用用户认证',async()=>{
 await assert.rejects(()=>M.connectMcp('not-a-valid-session'),/FORBIDDEN|重新选择Mock用户/);
});
