// Indexes refer to the stage's baseline verification questions in the pinned KB.
// Required means essential to verifying the definition, never a gate on the user's declaration.
export const requiredQuestionIndexes:Record<string,number[]>={
 M0:[0,1,2],M1:[0,1,2],M2:[0],M3:[0,1],M4:[0,1,3],M5:[2],
 P0:[1,2],P1:[0],P2:[0,1],P3:[0],P4:[0,1,2,3,4],P5:[0],
 T0:[0,1],T1:[0],T2:[0,1],T3:[0,1],T4:[0,3],T5:[0,1,2]
};
export function conciseFollowups(value:unknown,answered:string[]=[],limit=3){
 const seen=new Set(answered.map(s=>s.replace(/[\s，。？?、；;]/g,'')));
 return (Array.isArray(value)?value:[]).filter((s:any)=>typeof s==='string'&&s.trim()).map((s:string)=>s.trim()).filter((s:string)=>{const key=s.replace(/[\s，。？?、；;]/g,'');if(seen.has(key))return false;seen.add(key);return true;}).slice(0,limit);
}
export function criticalFollowups(outcome:string,round:number,value:unknown,answered:string[]){
 return outcome==='符合'||round>=2?[]:conciseFollowups(value,answered,3);
}
