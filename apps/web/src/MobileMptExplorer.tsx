import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Maximize2,Minimize2,X} from 'lucide-react';
import './mobile-mpt.css';
type Any=any;
const axes=[['M','项目落地成熟度'],['P','订单归属'],['T','独立采购阶段']];
const risk=(m:number,p:number)=>m>=4&&p<=2?'late':m===1&&p>=4?'pending':p>=4?'locked':p>=2?'grow':'explore';
const categories=[['explore','观察与核真'],['grow','培育'],['locked','重点投入'],['late','风险控投'],['pending','规则待补']];
function Strategy({row,current=false}:{row?:string[];current?:boolean}){
 return <article className="mpt-mobile-strategy" aria-label="M乘P推进建议">{row?<><div className="mpt-strategy-label"><b>{row[0]} × {row[1]}</b><span>{current?'当前项目':'阶段参考'}</span></div><h4>{row[2]}</h4>{row[3]&&<p>{row[3]}</p>}{[['推进建议',row[4]],['风险关注',row[5]],['资源投入',row[6]],['下一步',row[7]]].filter(([,text])=>text).map(([title,text])=><section key={title}><h5>{title}</h5><p>{text}</p></section>)}</>:<p>尚未确认M×P定位</p>}</article>;
}
export function MobileMptExplorer({knowledge,profile}:{knowledge:Any;profile:Any}){
 const [overlay,setOverlay]=useState(''),[axis,setAxis]=useState('M'),[full,setFull]=useState(false);
 const [selected,setSelected]=useState<string[]>([]),dialog=useRef<HTMLElement>(null);
 const currentRow=profile.assessed?knowledge.matrix.find((r:string[])=>r[0]===profile.stages.M&&r[1]===profile.stages.P):undefined;
 const definition=(stage:string)=>knowledge.stages.find((r:string[])=>r[1]===stage);
 const isCurrent=(m:string,p:string)=>!!profile.assessed&&profile.stages.M===m&&profile.stages.P===p;
 const close=()=>{setOverlay('');setFull(false);};
 const openMap=()=>{setSelected(currentRow||[]);setFull(false);setOverlay('map');};
 useEffect(()=>{if(!overlay)return;const previous=document.activeElement as HTMLElement;dialog.current?.querySelector<HTMLButtonElement>('[aria-label="关闭阶段弹窗"]')?.focus();const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();if(full)setFull(false);else close();}if(event.key==='Tab'){const controls=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),[href],select,[tabindex="0"]')||[]).filter(e=>e.getClientRects().length);const first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}};document.addEventListener('keydown',key,true);return()=>{document.removeEventListener('keydown',key,true);previous?.focus();};},[overlay,full]);
 return <section className="mpt-stage-overview" aria-label="项目当前阶段">
  <header><h3>当前项目阶段</h3><button type="button" onClick={()=>{setAxis('M');setOverlay('definitions');}}>查看阶段定义</button></header>
  <div className="mpt-current-stages">{axes.map(([code,label])=>{const stage=profile.assessed?profile.stages[code]:undefined,def=definition(stage);return <section key={code} aria-label={label}><small>{label}</small><b><span>{stage||code+'待明确'}</span>{def?.[2]}</b>{def?.[3]&&<p>{def[3]}</p>}</section>;})}</div>
  <button type="button" className="mpt-map-trigger" onClick={openMap}>查看阶段定位图</button>
  <div className="mpt-current-advice"><Strategy row={currentRow} current/></div>
  {overlay&&createPortal(<div className="mpt-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)close();}}><section ref={dialog} className={'mpt-stage-dialog'+(full?' is-fullscreen':'')} role="dialog" aria-modal="true" aria-label={overlay==='map'?'阶段定位图':'各阶段定义'}><header><h2>{overlay==='map'?'阶段定位图':'阶段定义'}</h2><div>{overlay==='map'&&<button type="button" aria-label={full?'退出全屏':'全屏展示'} onClick={()=>setFull(!full)}>{full?<Minimize2 size={18}/>:<Maximize2 size={18}/>}</button>}<button type="button" aria-label="关闭阶段弹窗" onClick={close}><X size={20}/></button></div></header>
   {overlay==='definitions'?<><div className="mpt-definition-tabs" role="tablist" aria-label="阶段维度">{axes.map(([code,label])=><button key={code} role="tab" aria-selected={axis===code} aria-controls={'mpt-definition-'+code} id={'mpt-axis-'+code} onClick={()=>setAxis(code)}>{code} · {label}</button>)}</div><div className="mpt-definition-list" role="tabpanel" id={'mpt-definition-'+axis} aria-labelledby={'mpt-axis-'+axis}>{knowledge.stages.filter((r:string[])=>r[0]===axis).map((r:string[])=><section key={r[1]} className={profile.assessed&&profile.stages[axis]===r[1]?'current':''}><h3>{r[1]} · {r[2]}{profile.assessed&&profile.stages[axis]===r[1]&&<span>当前阶段</span>}</h3><p>{r[3]}</p></section>)}</div></>:<div className="mpt-map-content"><p className="mpt-map-current">{profile.assessed?'当前 '+(profile.stages.M||'M待明确')+' × '+(profile.stages.P||'P待明确'):'尚未确认项目定位'}</p><div className="mpt-mini-grid" aria-label="阶段定位矩阵"><span className="mpt-mini-origin">P ↑<br/>M →</span>{[0,1,2,3,4,5].map(i=><b className="mpt-map-axis" data-stage={'M'+i} key={'m'+i}><span>M{i}</span><small>{definition('M'+i)?.[2]}</small></b>)}{[5,4,3,2,1,0].map(j=><React.Fragment key={j}><b className="mpt-map-axis" data-stage={'P'+j}><span>P{j}</span><small>{definition('P'+j)?.[2]}</small></b>{[0,1,2,3,4,5].map(i=>{const m='M'+i,p='P'+j,current=isCurrent(m,p),row=knowledge.matrix.find((r:string[])=>r[0]===m&&r[1]===p);return <button type="button" key={i} className={'risk-'+risk(i,j)+(current?' current':'')+(selected[0]===m&&selected[1]===p?' selected':'')} aria-label={m+'与'+p+(current?'，当前阶段':'')+'，查看建议'} aria-pressed={selected[0]===m&&selected[1]===p} onClick={()=>setSelected(row||[])}>{current?<span>● 当前</span>:<span>{row?.[2]}</span>}</button>;})}</React.Fragment>)}</div><div className="mpt-mini-legend">{categories.map(([s,t])=><span key={s}><i className={'risk-'+s}/>{t}</span>)}</div>{selected.length>0&&<Strategy row={selected} current={isCurrent(selected[0],selected[1])}/>}</div>}
  </section></div>,document.body)}
 </section>;
}
