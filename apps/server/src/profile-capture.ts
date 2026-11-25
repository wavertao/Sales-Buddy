import {extractLiveMemory,conservativePatches} from './memory-v3.ts';
import {updateStructuredProfilesSkill} from './structured-profiles.ts';
import {put,list} from './db.ts';
import {user} from './crm.ts';
export async function retryProfileCaptureJobs(){for(const job of list('profile_capture_jobs').filter(j=>j.status==='failed'&&(j.attempts||0)<3)){try{const owner=user(job.userId),source=job.source;if(source.userId!==owner.id||source.origin!=='user_input')continue;let updates:any[]=[];const patches=job.mode==='replay'?conservativePatches(source):await extractLiveMemory(source,[],value=>{updates=value;});updateStructuredProfilesSkill(owner,source.scope,source,patches,updates);put('profile_capture_jobs',job.id,{...job,status:'completed',updatedAt:new Date().toISOString()},owner.id);}catch(e:any){put('profile_capture_jobs',job.id,{...job,attempts:(job.attempts||0)+1,message:e.message},job.userId);}}}
