import React,{useEffect,useMemo,useRef,useState} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {ArrowLeft,ArrowUp,AtSign,Bot,Check,ChevronRight,CircleAlert,FolderKanban,LoaderCircle,MessagesSquare,Plus,RotateCcw,Sparkles,UserPlus,Users,X} from 'lucide-react';
import {memberRoles,spaceExperts,spaceStages} from '../../../packages/contracts/project-space';
import './project-space.css';
type Any=any;

/**
 * 项目空间：左列是空间及其会话（主群聊 + 专家子会话），右侧打开空间。
 * 主会话多人协同；@ 专家后，专家在子会话里执行，完成后回群里汇报。
 */
const POLL_MS=3000;
const expertOf=(id:string)=>spaceExperts.find(e=>e.id===id);
const clock=(iso:string)=>new Date(iso).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Shanghai'});
const dayLabel=(iso:string)=>new Date(iso).toLocaleDateString('zh-CN',{month:'numeric',day:'numeric',timeZone:'Asia/Shanghai'});
const statusText:Any={running:'执行中',done:'已完成',failed:'未完成'};

function readUrl(){const p=new URLSearchParams(location.search);return{space:p.get('space')||'',thread:p.get('thread')||''};}
function writeUrl(space:string,thread:string,main:boolean){const p=new URLSearchParams();if(space)p.set('space',space);if(thread&&!main)p.set('thread',thread);try{history.replaceState(null,'','/spaces'+(p.toString()?'?'+p:''));}catch{/* 地址同步失败不影响使用 */}}

export function ProjectSpaces({api,user,launch}:Any){
 const initial=useMemo(()=>launch||readUrl(),[]);
 const [spaces,setSpaces]=useState<Any[]>([]),[spaceId,setSpaceId]=useState<string>(initial.space),[threadId,setThreadId]=useState<string>(initial.thread),[detail,setDetail]=useState<Any>(null);
 const [error,setError]=useState(''),[creating,setCreating]=useState(false),[loaded,setLoaded]=useState(false);
 const alive=useRef(true);useEffect(()=>()=>{alive.current=false;},[]);
 async function loadSpaces(){const rows=await api('/project-spaces');if(!alive.current)return rows;setSpaces(rows);setLoaded(true);return rows;}
 async function loadDetail(id=spaceId,thread=threadId){if(!id)return;const d=await api('/project-spaces/'+encodeURIComponent(id)+(thread?'?thread='+encodeURIComponent(thread):''));if(!alive.current)return;setDetail(d);if(d.activeThreadId!==thread)setThreadId(d.activeThreadId);writeUrl(d.space.id,d.activeThreadId,d.activeThreadId===d.space.id+':main');}
 const run=(f:()=>Promise<unknown>)=>{setError('');f().catch((e:Error)=>alive.current&&setError(e.message));};
 useEffect(()=>{run(async()=>{const rows=await loadSpaces();if(!spaceId&&rows?.[0])setSpaceId(rows[0].id);});},[]);
 useEffect(()=>{if(spaceId)run(()=>loadDetail(spaceId,threadId));},[spaceId,threadId]);
 useEffect(()=>{if(launch?.space){setSpaceId(launch.space);setThreadId(launch.thread||'');}},[launch]);
 // 多人协同：轮询当前会话与空间列表。
 useEffect(()=>{const t=setInterval(()=>{if(document.hidden)return;void loadDetail().catch(()=>{});},POLL_MS);const l=setInterval(()=>{if(!document.hidden)void loadSpaces().catch(()=>{});},POLL_MS*4);return()=>{clearInterval(t);clearInterval(l);};},[spaceId,threadId]);
 function openSpace(id:string){setDetail(null);setSpaceId(id);setThreadId('');}
 function openThread(id:string){setThreadId(id);}
 return <div className="ps-root">
  <aside className="ps-list" aria-label="项目空间列表">
   <div className="ps-list-head"><h2>项目空间</h2><button className="ps-icon-btn" aria-label="新建项目空间" title="新建项目空间" onClick={()=>setCreating(true)}><Plus size={16}/></button></div>
   {!loaded?<div className="ps-skeleton"/>:spaces.length?spaces.map(s=><div key={s.id} className={'ps-space-group'+(s.id===spaceId?' open':'')}>
    <button className={'ps-space'+(s.id===spaceId?' selected':'')} onClick={()=>openSpace(s.id)}><FolderKanban size={16}/><span><b>{s.customerName}</b><small>{s.opportunityName}</small></span>{s.running>0&&<LoaderCircle size={13} className="spin" aria-label="有专家正在执行"/>}</button>
    {s.id===spaceId&&detail?.space.id===s.id&&<div className="ps-threads" role="navigation" aria-label="空间会话">
     {detail.threads.map((t:Any)=><button key={t.id} className={'ps-thread'+(t.id===detail.activeThreadId?' selected':'')} onClick={()=>openThread(t.id)}>
      {t.kind==='main'?<MessagesSquare size={14}/>:<ThreadStatusIcon status={t.status}/>}
      <span>{t.kind==='main'?'项目群聊':t.title}{t.kind==='expert'&&<small>{expertOf(t.expertId)?.name}</small>}</span>
     </button>)}
    </div>}
   </div>):<p className="ps-empty">还没有项目空间。从一个商机开始，邀请成员和专家协同推进。</p>}
  </aside>
  <section className="ps-main">
   {error&&<div className="ps-error" role="alert"><CircleAlert size={15}/><span>{error}</span><button aria-label="关闭错误" onClick={()=>setError('')}><X size={15}/></button></div>}
   {detail?<SpaceView key={detail.space.id} api={api} user={user} detail={detail} onThread={openThread} onChanged={()=>run(async()=>{await loadDetail();await loadSpaces();})} onError={setError}/>:spaceId?<div className="ps-loading"><LoaderCircle className="spin" size={20}/>正在打开项目空间…</div>:<div className="ps-placeholder"><FolderKanban size={34}/><p>选择左侧的项目空间，或新建一个。</p></div>}
  </section>
  {creating&&<NewSpaceDialog api={api} onClose={()=>setCreating(false)} onCreated={(s:Any)=>{setCreating(false);run(async()=>{await loadSpaces();openSpace(s.id);});}}/>}
 </div>;
}

function ThreadStatusIcon({status}:Any){return status==='running'?<LoaderCircle size={14} className="spin ps-st-running"/>:status==='failed'?<CircleAlert size={14} className="ps-st-failed"/>:<Check size={14} className="ps-st-done"/>;}

function SpaceView({api,user,detail,onThread,onChanged,onError}:Any){
 const {space,threads,messages,activeThreadId,todos}=detail;
 const thread=threads.find((t:Any)=>t.id===activeThreadId);const isMain=thread?.kind==='main';
 const [memberOpen,setMemberOpen]=useState(false);
 const act=(f:()=>Promise<unknown>)=>f().then(onChanged).catch((e:Error)=>onError(e.message));
 function setStage(id:string){if(id===space.stage)return;const st=spaceStages.find(s=>s.id===id)!;if(!confirm(`将业务主线推进到 ${st.id} ${st.name}？`))return;act(()=>api('/project-spaces/'+space.id,{method:'PATCH',body:{stage:id}}));}
 function setConfidence(){const v=prompt('赢单信心度（0–100）',String(space.winConfidence));if(v===null)return;const n=Math.round(Number(v));if(!Number.isFinite(n)||n<0||n>100){onError('赢单信心度需为 0–100 的整数');return;}act(()=>api('/project-spaces/'+space.id,{method:'PATCH',body:{winConfidence:n}}));}
 const stageIndex=spaceStages.findIndex(s=>s.id===space.stage);
 return <div className="ps-space-view">
  <header className="ps-head">
   <dl className="ps-fields">
    <div><dt>客户</dt><dd>{space.customerName}</dd></div>
    <div><dt>商机名称</dt><dd>{space.opportunityName}</dd></div>
    <div><dt>赢单信心度</dt><dd><button className="ps-confidence" title="调整赢单信心度" onClick={setConfidence}><span className="ps-meter"><i style={{width:space.winConfidence+'%'}}/></span>{space.winConfidence}%</button></dd></div>
   </dl>
   <ol className="ps-stages" aria-label="业务主线">{spaceStages.map((s,i)=><li key={s.id} className={i<stageIndex?'passed':i===stageIndex?'current':''}><button onClick={()=>setStage(s.id)} aria-current={i===stageIndex?'step':undefined}><b>{s.id}</b><span>{s.name}</span></button></li>)}</ol>
  </header>
  <div className="ps-body">
   <div className="ps-chat">
    {isMain?<div className="ps-chat-title"><MessagesSquare size={16}/><b>项目群聊</b><small>{space.members.filter((m:Any)=>m.kind==='user').length} 位成员 · {space.members.filter((m:Any)=>m.kind==='expert').length} 位专家</small></div>
     :<div className="ps-chat-title sub"><button className="ps-back" onClick={()=>onThread(space.id+':main')}><ArrowLeft size={15}/>项目群聊</button><ChevronRight size={14}/><span className="ps-expert-chip"><Bot size={13}/>{expertOf(thread?.expertId)?.name}</span><b>{thread?.title}</b><span className={'ps-status '+thread?.status}>{statusText[thread?.status]}</span></div>}
    <Messages messages={messages} isMain={isMain} thread={thread} onThread={onThread}/>
    {!isMain&&thread?.status==='failed'&&<div className="ps-failed"><CircleAlert size={15}/><span>{thread.error||'专家未完成任务'}</span><button onClick={()=>act(()=>api('/project-spaces/threads/'+thread.id+'/retry',{method:'POST',body:{}}))}><RotateCcw size={14}/>重试</button></div>}
    <Composer key={activeThreadId} api={api} space={space} thread={thread} isMain={isMain} modelConfigured={detail.modelConfigured} onSent={onChanged} onError={onError}/>
   </div>
   <aside className="ps-side" aria-label="成员与待办">
    {todos.length>0&&<section><div className="ps-side-head"><h3><Check size={15}/>待办</h3></div>
     <ul className="ps-todos">{todos.map((t:Any)=><li key={t.id} className={t.status}><button className="ps-check" aria-label={(t.status==='completed'?'取消完成：':'完成：')+t.title} aria-pressed={t.status==='completed'} disabled={t.assigneeId!==user.id} title={t.assigneeId!==user.id?'只有负责人可以更新':''} onClick={()=>act(()=>api('/project-spaces/todos/'+t.id,{method:'PATCH',body:{status:t.status==='completed'?'pending':'completed'}}))}>{t.status==='completed'&&<Check size={12}/>}</button><span><b>{t.title}</b><small>{t.assigneeName}{t.dueAt?' · '+t.dueAt.slice(5).replace('-','/')+' 前':''}</small>{t.threadId&&<button className="ps-link" onClick={()=>onThread(t.threadId)}>来源子会话</button>}</span></li>)}</ul>
    </section>}
    <section><div className="ps-side-head"><h3><Users size={15}/>成员</h3><button className="ps-icon-btn" aria-label="添加成员或专家" title="添加成员或专家" onClick={()=>setMemberOpen(true)}><UserPlus size={15}/></button></div>
     <ul className="ps-members">{space.members.map((m:Any)=><li key={m.id}><Avatar member={m}/><span><b>{m.name}</b><small>{m.kind==='expert'?expertOf(m.expertId)?.duty:m.role}</small></span></li>)}</ul>
    </section>
   </aside>
  </div>
  {memberOpen&&<AddMemberDialog api={api} space={space} onClose={()=>setMemberOpen(false)} onAdded={()=>{setMemberOpen(false);onChanged();}} onError={onError}/>}
 </div>;
}

function Avatar({member,author}:Any){const a=member||author;if(a.kind==='expert')return <span className="ps-avatar expert" aria-hidden><Sparkles size={14}/></span>;if(a.kind==='system')return null;return <span className="ps-avatar" aria-hidden>{a.name?.[0]}</span>;}

function Messages({messages,isMain,thread,onThread}:Any){
 const end=useRef<HTMLDivElement>(null),box=useRef<HTMLDivElement>(null),count=useRef(0);
 useEffect(()=>{const el=box.current;if(!el)return;const nearBottom=el.scrollHeight-el.scrollTop-el.clientHeight<160;if(messages.length!==count.current&&(nearBottom||count.current===0))end.current?.scrollIntoView({block:'end'});count.current=messages.length;},[messages.length]);
 let lastDay='';
 return <div className="ps-messages" ref={box} aria-live="polite">
  {messages.map((m:Any)=>{const d=dayLabel(m.createdAt),sep=d!==lastDay;lastDay=d;return <React.Fragment key={m.id}>
   {sep&&<div className="ps-day">{d}</div>}
   {m.author.kind==='system'?<div className="ps-system">{m.content}<small>{clock(m.createdAt)}</small></div>
    :m.card?<TaskCard message={m} onOpen={()=>onThread(m.card.threadId)}/>
    :<div className={'ps-msg '+m.author.kind}><Avatar author={m.author}/><div className="ps-msg-body"><div className="ps-msg-meta"><b>{m.author.name}</b><span>{m.author.kind==='expert'?'AI 专家':m.author.role}</span><small>{clock(m.createdAt)}</small></div>
     {m.author.kind==='expert'?<div className="ps-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown></div>:<p className="ps-text">{highlight(m.content)}</p>}</div></div>}
  </React.Fragment>;})}
  {!isMain&&thread?.status==='running'&&<div className="ps-msg expert"><span className="ps-avatar expert" aria-hidden><Sparkles size={14}/></span><div className="ps-msg-body"><div className="ps-msg-meta"><b>{expertOf(thread.expertId)?.name}</b><span>AI 专家</span></div><p className="ps-typing"><LoaderCircle size={14} className="spin"/>正在执行任务…</p></div></div>}
  <div ref={end}/>
 </div>;
}

const mentionNames=spaceExperts.map(e=>'@'+e.name);
function highlight(text:string){const split=new RegExp('('+[...mentionNames].sort((a,b)=>b.length-a.length).join('|')+')');return text.split(split).map((part,i)=>mentionNames.includes(part)?<span key={i} className="ps-mention">{part}</span>:part);}

function TaskCard({message,onOpen}:Any){const c=message.card;const e=expertOf(c.expertId);
 return <div className="ps-msg expert"><span className="ps-avatar expert" aria-hidden><Sparkles size={14}/></span><div className="ps-msg-body"><div className="ps-msg-meta"><b>{e?.name}</b><span>AI 专家</span><small>{clock(message.createdAt)}</small></div>
  <button className={'ps-task '+c.status} onClick={onOpen} aria-label={'打开子会话：'+c.title}><div><span className="ps-task-label">子会话</span><b>{c.title}</b><span className={'ps-status '+c.status}>{c.status==='running'&&<LoaderCircle size={12} className="spin"/>}{statusText[c.status]}</span></div>{c.summary&&<p>{c.summary}</p>}<span className="ps-task-open">查看执行过程<ChevronRight size={14}/></span></button>
 </div></div>;}

function Composer({api,space,thread,isMain,modelConfigured,onSent,onError}:Any){
 const [text,setText]=useState(''),[picker,setPicker]=useState(false),[busy,setBusy]=useState(false);const area=useRef<HTMLTextAreaElement>(null);
 const inSpace=new Set(space.members.filter((m:Any)=>m.kind==='expert').map((m:Any)=>m.expertId));
 const options=[...spaceExperts].sort((a,b)=>Number(inSpace.has(b.id))-Number(inSpace.has(a.id)));
 const mentions=spaceExperts.filter(e=>text.includes('@'+e.name)).map(e=>e.id);
 const running=!isMain&&thread?.status==='running';
 function insert(name:string){const el=area.current;const pos=el?.selectionStart??text.length;const before=text.slice(0,pos).replace(/@$/,''),after=text.slice(pos);const next=before+'@'+name+' '+after;setText(next);setPicker(false);requestAnimationFrame(()=>{el?.focus();const at=(before+'@'+name+' ').length;el?.setSelectionRange(at,at);});}
 async function send(){const content=text.trim();if(!content||busy)return;setBusy(true);try{await api(`/project-spaces/${space.id}/threads/${encodeURIComponent(thread.id)}/messages`,{method:'POST',body:{content,mentions:isMain?mentions:[]}});setText('');onSent();}catch(e:Any){onError(e.message);}finally{setBusy(false);}}
 return <div className="ps-composer">
  {isMain&&mentions.length>0&&<div className="ps-dispatch"><Bot size={13}/>发送后将由 {mentions.map(id=>expertOf(id)?.name).join('、')} 在子会话中执行{!modelConfigured&&'（在线模型未配置，专家暂时无法执行）'}</div>}
  {picker&&<div className="ps-picker" role="listbox" aria-label="选择专家">{options.map(e=><button key={e.id} role="option" aria-selected={false} onClick={()=>insert(e.name)}><Sparkles size={14}/><span><b>{e.name}</b><small>{e.duty}</small></span>{!inSpace.has(e.id)&&<em>将加入空间</em>}</button>)}</div>}
  <div className="ps-input">
   {isMain&&<button className="ps-icon-btn" aria-label="@ 专家" title="@ 专家" onClick={()=>setPicker(!picker)}><AtSign size={16}/></button>}
   <textarea ref={area} aria-label={isMain?'在项目群聊中发言':'继续和专家沟通'} rows={1} value={text} disabled={running} placeholder={running?'专家正在执行，完成后可继续追问':isMain?'和项目成员沟通，@ 专家派发任务…':'继续向'+(expertOf(thread?.expertId)?.name||'专家')+'追问…'}
    onChange={e=>{setText(e.target.value);if(isMain&&e.target.value.endsWith('@'))setPicker(true);}}
    onKeyDown={e=>{if(e.key==='Escape')setPicker(false);if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send();}}}/>
   <button className="ps-send" aria-label="发送" disabled={!text.trim()||busy||running} onClick={()=>void send()}>{busy?<LoaderCircle size={16} className="spin"/>:<ArrowUp size={16}/>}</button>
  </div>
 </div>;
}

function AddMemberDialog({api,space,onClose,onAdded,onError}:Any){
 const [tab,setTab]=useState<'user'|'expert'>('user'),[people,setPeople]=useState<Any[]>([]),[userId,setUserId]=useState(''),[role,setRole]=useState<string>('SC'),[busy,setBusy]=useState(false);
 useEffect(()=>{void api('/project-spaces/options/members').then(setPeople).catch((e:Error)=>onError(e.message));},[]);
 const taken=new Set(space.members.map((m:Any)=>m.kind==='user'?m.userId:m.expertId));
 async function add(body:Any){setBusy(true);try{await api('/project-spaces/'+space.id+'/members',{method:'POST',body});onAdded();}catch(e:Any){onError(e.message);}finally{setBusy(false);}}
 return <div className="ps-mask" onClick={onClose}><div className="ps-dialog" role="dialog" aria-label="添加成员或专家" onClick={e=>e.stopPropagation()}>
  <div className="ps-dialog-head"><h3>添加到项目空间</h3><button className="ps-icon-btn" aria-label="关闭" onClick={onClose}><X size={16}/></button></div>
  <div className="ps-tabs" role="tablist">{[['user','项目成员'],['expert','AI 专家']].map(([k,l])=><button key={k} role="tab" aria-selected={tab===k} className={tab===k?'selected':''} onClick={()=>setTab(k as Any)}>{l}</button>)}</div>
  {tab==='user'?<div className="ps-form">
   <label>成员<select value={userId} onChange={e=>setUserId(e.target.value)}><option value="">选择成员</option>{people.filter(p=>!taken.has(p.id)).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
   <label>角色<select value={role} onChange={e=>setRole(e.target.value)}>{memberRoles.map(r=><option key={r}>{r}</option>)}</select></label>
   <button className="ps-primary" disabled={!userId||busy} onClick={()=>void add({kind:'user',userId,role})}>邀请加入</button>
  </div>:<ul className="ps-expert-list">{spaceExperts.map(e=><li key={e.id}><span className="ps-avatar expert"><Sparkles size={14}/></span><span><b>{e.name}</b><small>{e.duty}</small></span>{taken.has(e.id)?<em>已在空间</em>:<button className="ps-secondary" disabled={busy} onClick={()=>void add({kind:'expert',expertId:e.id})}>添加</button>}</li>)}</ul>}
 </div></div>;
}

function NewSpaceDialog({api,onClose,onCreated}:Any){
 const [q,setQ]=useState(''),[rows,setRows]=useState<Any[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{const t=setTimeout(()=>void api('/project-spaces/options/opportunities?q='+encodeURIComponent(q)).then(setRows).catch((e:Error)=>setError(e.message)),200);return()=>clearTimeout(t);},[q]);
 async function create(id:string){setBusy(true);try{onCreated(await api('/project-spaces',{method:'POST',body:{opportunityId:id}}));}catch(e:Any){setError(e.message);}finally{setBusy(false);}}
 return <div className="ps-mask" onClick={onClose}><div className="ps-dialog" role="dialog" aria-label="新建项目空间" onClick={e=>e.stopPropagation()}>
  <div className="ps-dialog-head"><h3>新建项目空间</h3><button className="ps-icon-btn" aria-label="关闭" onClick={onClose}><X size={16}/></button></div>
  <p className="ps-hint">一个商机对应一个项目空间。</p>
  <input aria-label="搜索商机" placeholder="搜索商机名称或编号" value={q} onChange={e=>setQ(e.target.value)} autoFocus/>
  {error&&<p className="ps-error-text" role="alert">{error}</p>}
  <ul className="ps-opps">{rows.map(o=><li key={o.id}><button disabled={busy} onClick={()=>void create(o.id)}><span><b>{o.customerName} · {o.name}</b><small>{o.id} · CRM {o.stage}</small></span><ChevronRight size={15}/></button></li>)}{!rows.length&&<li className="ps-empty">没有可用的商机</li>}</ul>
 </div></div>;
}

/** 小Cue 里的“项目空间待办”。 */
export function SpaceTodos({api,onOpen}:Any){
 const [rows,setRows]=useState<Any[]|null>(null),[error,setError]=useState('');
 const load=()=>api('/project-spaces/todos/mine').then(setRows).catch((e:Error)=>setError(e.message));
 useEffect(()=>{void load();},[]);
 if(error)return <p className="cue-error" role="alert">{error}</p>;
 if(!rows?.length)return null;
 return <section className="ps-cue" aria-label="项目空间待办"><h2 className="cue-magic-title">项目空间待办</h2>
  <ul>{rows.map(t=><li key={t.id}><button className="ps-check" aria-label={'完成：'+t.title} onClick={()=>void api('/project-spaces/todos/'+t.id,{method:'PATCH',body:{status:'completed'}}).then(load).catch((e:Error)=>setError(e.message))}/><span><b>{t.title}</b><small>{t.spaceName}{t.dueAt?' · '+t.dueAt.slice(5).replace('-','/')+' 前':''}</small></span><button className="ps-secondary" onClick={()=>onOpen({space:t.spaceId,thread:t.threadId||''})}>进入项目空间<ChevronRight size={14}/></button></li>)}</ul>
 </section>;
}
