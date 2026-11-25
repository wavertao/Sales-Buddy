import {test} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {deploymentAccess} from '../apps/server/src/deployment-access.ts';
test('云端访问闸门覆盖Mock登录与API，签名cookie不干扰Bearer，拒绝伪造与过期凭据',async()=>{
 const app=express();app.use(deploymentAccess('test-only-access-password-123456'));app.get('/api/mock-users',(_q,r)=>r.json({ok:true}));const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.on('listening',r));const base='http://127.0.0.1:'+(server.address()as any).port;
 try{assert.equal((await fetch(base+'/')).status,401);assert.equal((await fetch(base+'/api/mock-users',{headers:{Authorization:'Bearer test'}})).status,401);
 const bad=await fetch(base+'/deployment-login',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'password=wrong',redirect:'manual'});assert.equal(bad.status,401);
 const good=await fetch(base+'/deployment-login',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','X-Forwarded-Proto':'https'},body:'password=test-only-access-password-123456',redirect:'manual'});assert.equal(good.status,303);const header=good.headers.get('set-cookie')!;assert.match(header,/HttpOnly/);assert.match(header,/Secure/);const cookie=header.split(';')[0];assert.equal((await fetch(base+'/api/mock-users',{headers:{Cookie:cookie,Authorization:'Bearer test'}})).status,200);assert.equal((await fetch(base+'/api/mock-users',{headers:{Cookie:cookie+'x'}})).status,401);
 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});
