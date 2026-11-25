import {webSearch,webSearchSchema,WEB_SEARCH_DESCRIPTION,searchConfigured} from './web-search.ts';
import {authorize} from './crm.ts';
import {deploymentCookie} from './deployment-access.ts';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {crmCall,toolSpecs} from './crm.ts';
import {put,uid,now} from './db.ts';
import {AppError,type User} from '../../../packages/contracts/index.ts';
export function createMcpServer(u:User){
 const server=new McpServer({name:'sales-buddy-mock-crm',version:'0.1.0'});
 for(const [name,spec]of Object.entries(toolSpecs)){
 server.registerTool(name,{description:spec.description,inputSchema:spec.schema.shape,annotations:{readOnlyHint:!spec.write,destructiveHint:!!spec.write,idempotentHint:!!spec.write}},async(args:any)=>{
 const started=Date.now();const id=uid('call');let result:any;
 try{result=crmCall(u,name,args);put('tool_calls',id,{id,userId:u.id,toolName:name,args:{...args,confirmationToken:args.confirmationToken?'[redacted]':undefined},status:'success',durationMs:Date.now()-started,recordRefs:result.recordRefs,at:now()},u.id);
 return{content:[{type:'text' as const,text:JSON.stringify(result)}],structuredContent:result};
 }catch(e:any){put('tool_calls',id,{id,userId:u.id,toolName:name,status:'failed',durationMs:Date.now()-started,code:e.code||'INVALID_ARGUMENT',message:e.message,at:now()},u.id);return{isError:true,content:[{type:'text' as const,text:JSON.stringify({code:e.code||'INVALID_ARGUMENT',message:e.message})}]};}
 });
 }
 if(searchConfigured())server.registerTool('web_search',{description:WEB_SEARCH_DESCRIPTION,inputSchema:webSearchSchema.shape,annotations:{readOnlyHint:true,destructiveHint:false}},async(args:any)=>{const id=uid('call'),started=Date.now();try{if(args.scope)authorize(u,args.scope);const result=await webSearch(args);put('tool_calls',id,{id,userId:u.id,toolName:'web_search',args:{query:result.query},status:'success',durationMs:Date.now()-started,recordRefs:result.recordRefs,at:now()},u.id);return{content:[{type:'text' as const,text:JSON.stringify(result)}],structuredContent:result};}catch(e:any){put('tool_calls',id,{id,userId:u.id,toolName:'web_search',status:'failed',code:e.code||'SEARCH_FAILED',at:now()},u.id);return{isError:true,content:[{type:'text' as const,text:JSON.stringify({code:e.code||'SEARCH_FAILED',message:e.message})}]};}});
 return server;
}
export async function connectMcp(token:string){
 const client=new Client({name:'sales-buddy-agent',version:'0.1.0'});
 const cookie=deploymentCookie();
 const transport=new StreamableHTTPClientTransport(new URL('http://127.0.0.1:'+(process.env.APP_PORT||3001)+'/mcp'),{requestInit:{headers:{Authorization:'Bearer '+token,...(cookie?{Cookie:cookie}:{})}}});
 await client.connect(transport);return client;
}
export async function callMcp(client:Client,name:string,args:Record<string,unknown>){
 const response=await client.callTool({name,arguments:args},undefined,{timeout:name==='web_search'?25000:10000});
 const raw=(response.content as any[])?.find(c=>c.type==='text')?.text;
 const data=raw?JSON.parse(raw):response.structuredContent;
 if(response.isError)throw new AppError(data?.code||'UPSTREAM_UNAVAILABLE',data?.message||'MCP执行失败',502);
 return data;
}

