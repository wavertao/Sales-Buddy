import {get,list,put} from './db.ts';
import {authorize,own} from './crm.ts';
import type {User,Scope} from '../../../packages/contracts/index.ts';
export function recordTurn(run:any,status:string,extra:Record<string,unknown>={}){
 const prior=get('conversation_logs',run.id);
 const log={...prior,id:run.id,runId:run.id,userId:run.userId,conversationId:run.conversationId,scope:run.scope,question:run.question,mode:run.mode,answerId:run.answerId,requestedAt:run.createdAt,status,timeSource:prior?.timeSource||'wall_clock',...extra};
 put('conversation_logs',run.id,log,run.userId,run.scope?.objectId||null);return log;
}
export function conversationLogs(u:User,scope?:Scope){if(scope)authorize(u,scope);return list('conversation_logs').filter(l=>l.userId===u.id&&(!scope||l.scope?.objectType===scope.objectType&&l.scope?.objectId===scope.objectId)).filter(l=>{try{if(l.scope)authorize(u,l.scope);if(get('conversations',l.conversationId)?.cueAccess)own(u,'conversations',l.conversationId);return true;}catch{return false;}}).sort((a,b)=>Date.parse(b.requestedAt)-Date.parse(a.requestedAt));}
export function backfillConversationLogs(){for(const run of list('runs'))if(!get('conversation_logs',run.id))recordTurn(run,run.status,{timeSource:'legacy_record',completedAt:run.completedAt||null,error:run.error||null,toolCount:run.toolCount||0});}
