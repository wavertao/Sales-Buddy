import type {Scope,SourceRef} from './contracts/index.ts';
export type CueFeedback='like'|'dislike'|null;
export type MagicCueItem={id:string;userId:string;scope:Scope;key:string;title:string;description:string;priority:number;rank?:number;ruleVersion?:number;scenario?:string;teamId?:string;aggregate?:boolean;active?:boolean;sources:SourceRef[];createdAt:string;updatedAt:string;origin:'ai_generated';status:'in_progress'|'completed';feedback:CueFeedback};
export type DailyBriefing={id:string;userId:string;day:string;title:string;description:string;cueIds:string[];createdAt:string;origin:'ai_generated'};
export type WorkbenchGeneration={id:string;userId:string;day:string;status:'running'|'completed'|'failed';startedAt:string;completedAt?:string;error?:string;itemLimit?:number};
export function businessDay(value:string|Date=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));}
export function businessHour(value:string|Date=new Date()){return Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',hourCycle:'h23'}).format(new Date(value)));}
export const CUE_PAGE_SIZE=8;
export const taskGroupNames={overdue:'逾期',today:'今天到期',week:'本周',later:'以后 / 未排期',completed:'已完成'};
export type TaskGroup=keyof typeof taskGroupNames;
export function taskGroup(task:{status:string;dueAt?:string},at:string|Date=new Date()):TaskGroup|null{
 if(task.status==='completed')return 'completed';
 if(['cancelled','closed'].includes(task.status))return null;
 if(!task.dueAt||Number.isNaN(Date.parse(task.dueAt)))return 'later';
 const today=businessDay(at),due=businessDay(task.dueAt),date=new Date(today+'T00:00:00Z');
 date.setUTCDate(date.getUTCDate()+(7-date.getUTCDay())%7);
 return due<today?'overdue':due===today?'today':due<=date.toISOString().slice(0,10)?'week':'later';
}
