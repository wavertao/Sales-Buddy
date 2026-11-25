import {get,put} from './db.ts';
import {navigatorState,confirmNavigatorProposal} from './navigator.ts';
import {authorize} from './crm.ts';
import {AppError,type User} from '../../../packages/contracts/index.ts';

export function readProfileProposal(u:User,id:string){const d=get('navigator_proposals',id);if(!d||d.userId!==u.id)throw new AppError('FORBIDDEN','无权查看画像更新建议',403);authorize(u,d.scope);return d;}

/** The skill accepts only an existing user-reviewed proposal and selected changes, never free-form model writes. */
export function updateProjectProfileSkill(u:User,id:string,selected:string[]){
 const d=readProfileProposal(u,id),profile=confirmNavigatorProposal(u,id,selected),receiptId='profile-skill:'+id,at=new Date().toISOString();
 if(!get('navigator_skill_executions',receiptId)){
 const receipt={id:receiptId,userId:u.id,skill:'update_project_profile',proposalId:id,selected,profileVersion:profile.version,status:'completed',createdAt:at};
 if(d.conversationId){const conversation=get('conversations',d.conversationId);if(conversation?.userId===u.id&&conversation.scope.objectId===d.scope.objectId){
 const userMessageId=receiptId+':confirmation',answerId=receiptId+':result';
 put('messages',userMessageId,{id:userMessageId,userId:u.id,conversationId:d.conversationId,role:'user',origin:'tool_shortcut',content:'确认更新所选项目画像事项',createdAt:at},u.id,d.scope.objectId);
 const text='已更新你确认的项目画像事项，保存为第'+profile.version+'版。未选择的事项保持原记录；M/P/T阶段未自动修改。';
 const answer={id:answerId,userId:u.id,scope:d.scope,conversationId:d.conversationId,role:'assistant',content:text,text,mode:'live',actions:[],tools:[],navigatorConfirmation:id,sources:[],navigatorActions:[],createdAt:at};put('answers',answerId,answer,u.id,d.scope.objectId);put('messages',answerId,answer,u.id,d.scope.objectId);put('workbenches',answerId,{answerId,userId:u.id,scope:d.scope,goal:'更新已确认的项目画像事项',steps:[{id:'update',title:'用户确认后保存画像',status:'completed'}],sources:[],dataStatus:'completed'},u.id,d.scope.objectId);
 put('conversations',conversation.id,{...conversation,lastMessageAt:at},u.id,d.scope.objectId);
 }}
 put('run_calls',receiptId,{...receipt,runId:d.runId||null,name:'skill.update_project_profile',args:{proposalId:id,selected},recordRefs:[],durationMs:0},u.id,d.scope.objectId);
 put('navigator_skill_executions',receiptId,receipt,u.id,d.scope.objectId);
 }
 return {...navigatorState(u,d.scope),skillReceipt:get('navigator_skill_executions',receiptId)};
}
