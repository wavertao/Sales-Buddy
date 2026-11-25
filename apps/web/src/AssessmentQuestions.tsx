import React,{useState,useEffect} from 'react';
export function AssessmentQuestions({a,busy,onSubmit,onDraft}:{a:any;busy:boolean;onSubmit:(answers:any[])=>void;onDraft:(answers:any[])=>void}){
 const [index,setIndex]=useState(0);
 const [drafts,setDrafts]=useState<any>(()=>Object.fromEntries(a.questions.map((q:any,i:number)=>{const answer=a.answers.findLast((r:any)=>r.axis===a.currentAxis&&r.stage===a.selected[a.currentAxis]&&r.question===q.title);const draft=a.draftAnswers?.find((r:any)=>r.index===i);return[i,draft|| (answer?{text:answer.text,state:answer.state}:{})]})));
 const entries=()=>Object.entries(drafts).filter(([,v]:any)=>v.text?.trim()).map(([i,v]:any)=>({index:Number(i),...v,state:v.state||'unknown'}));
 useEffect(()=>{onDraft(Object.entries(drafts).map(([i,v]:any)=>({index:Number(i),text:v.text||'',state:v.state||''})))},[drafts]);
 const q=a.questions[index],value=drafts[index]||{},update=(v:any)=>setDrafts({...drafts,[index]:{...value,...v}});
 const required=a.questions.filter((q:any)=>q.requirement!=='supplemental').length;
 return <>
 {a.round>0&&<div className="notice"><b>继续核实关键问题 · 第{a.round}轮</b><p>{a.results[a.currentAxis]?.reason}</p>{a.questions.map((q:any,i:number)=><p key={i}>{i+1}. {q.title}</p>)}</div>}
 <p className="fine-print">本轮 {required} 项必需条件，{a.questions.length-required} 项可后补信息。必需指核实阶段的依据；未明确仍可提交。</p>
 {q&&<><div className="nav-agent-question"><div><small>{a.selected[a.currentAxis]} · 核对 {index+1} / {a.questions.length} · {q.requirement==='supplemental'?'可后补':'必需条件'}</small><h3>{q.title}</h3></div></div>
 <div className="nav-answer-options" role="radiogroup" aria-label="事项状态">{[['confirmed','已确认','说明准确现状与依据'],['unknown','未明确','保留待核，不影响阶段申报'],['not_applicable','不涉及','说明本项目不适用的原因']].map(([state,label,help])=><button key={state} role="radio" aria-checked={value.state===state} disabled={busy} className={value.state===state?'selected':''} onClick={()=>update({state})}><i>{value.state===state?'●':'○'}</i><b>{label}</b><span>{help}</span></button>)}</div>
 {value.fromProfile&&<p className="fine-print">已带入当前画像中的记录，可直接修改。</p>}<textarea aria-label="评估情况补充" value={value.text||''} maxLength={3000} disabled={busy} placeholder="说明实际情况；不清楚时也可记录待核实原因。" onChange={e=>update({text:e.target.value})}/>
 <div className="nav-panel-actions"><button className="soft" disabled={busy||index===0} onClick={()=>setIndex(index-1)}>上一个问题</button><span>{index+1} / {a.questions.length}</span><button className="soft" disabled={busy||index===a.questions.length-1} onClick={()=>setIndex(index+1)}>下一个问题</button><button className="primary" disabled={busy} onClick={()=>onSubmit(entries())}>提交</button></div></>}
 </>;
}
