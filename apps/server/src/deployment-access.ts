import express from 'express';
import {createHmac,timingSafeEqual} from 'node:crypto';
const cookieName='sales_buddy_access';
const same=(a:string,b:string)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
export function deploymentCookie(password=process.env.DEPLOYMENT_ACCESS_PASSWORD||''){
 if(!password)return '';
 const expires=String(Date.now()+24*3600000);
 return cookieName+'='+expires+'.'+createHmac('sha256',password).update(expires).digest('hex');
}
export function deploymentAccess(password=process.env.DEPLOYMENT_ACCESS_PASSWORD||''){
 const router=express.Router();if(!password)return router;
 if(password.length<20)throw new Error('部署访问口令至少20个字符');
 const sign=(v:string)=>createHmac('sha256',password).update(v).digest('hex');
 const allowed=(raw:string)=>{const [expires,sig]=raw.split('.');return /^\d+$/.test(expires||'')&&Number(expires)>Date.now()&&Number(expires)<Date.now()+25*3600000&&!!sig&&same(sign(expires),sig);};
 const attempts=new Map<string,{count:number;until:number}>();
 router.post('/deployment-login',express.urlencoded({extended:false,limit:'2kb'}),(req,res)=>{
  const key=req.socket.remoteAddress||'unknown',now=Date.now();let a=attempts.get(key);if(!a||a.until<now){a={count:0,until:now+60000};if(attempts.size>1000)attempts.clear();attempts.set(key,a);}if(++a.count>10){res.status(429).send('尝试过于频繁，请稍后重试');return;}
  if(!same(String(req.body?.password||''),password)){res.status(401).send('访问口令不正确，请返回重试');return;}
  const secure=req.secure||req.get('x-forwarded-proto')==='https';res.setHeader('Set-Cookie',`${deploymentCookie(password)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400${secure?'; Secure':''}`);res.setHeader('Cache-Control','no-store');res.redirect(303,'/');
 });
 router.use((req,res,next)=>{const cookie=String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1)||'';if(allowed(cookie)){next();return;}
  res.setHeader('Cache-Control','no-store');if(req.path.startsWith('/api')||req.path.startsWith('/mcp')){res.status(401).json({error:'DEPLOYMENT_LOGIN_REQUIRED',message:'请先登录试用环境'});return;}
  res.status(401).type('html').send('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sales Buddy · 受控试用</title><style>body{font:16px system-ui;background:#f6f7ff;color:#24314d;display:grid;place-items:center;min-height:95vh}main{background:white;padding:40px;border-radius:18px;max-width:400px;box-shadow:0 8px 40px #1a2a5510}input,button{box-sizing:border-box;width:100%;padding:14px;margin-top:18px;border:1px solid #dce1f2;border-radius:8px}button{background:#5965e9;color:white;cursor:pointer}p{color:#71809c;line-height:1.6}</style><main><h1>Sales Buddy</h1><p>赢单领航员 · 内部试用环境<br>请输入部署访问口令后继续。</p><form method="post" action="/deployment-login"><label>访问口令<input name="password" type="password" autocomplete="current-password" required></label><button type="submit">进入试用环境</button></form></main></html>');
 });return router;
}
