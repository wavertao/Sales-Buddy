// P9.3 计划：初版（阶段级，无招标文件）· 条目级甘特 + 排期助手 · 编辑态；另含 RACI / 按人负荷视图。
import React, { useRef, useState } from 'react';
import { CalendarDays, Check, ChevronDown, CircleAlert, Download, GripVertical, PenLine, Plus, Trash2, Upload } from 'lucide-react';
import * as D from '../demo';
import type { PlanItem, PlanStatus } from '../demo';
import { useP9 } from '../store';
import { Btn, Pill, RoundTag, cx } from '../ui';
import type { Tone } from '../ui';

const DAYS = 28; // WK1–WK4，10/17 起
const ST_TONE: Record<PlanStatus, Tone> = { 未开始: 'gray', 进行中: 'blue', 已完成: 'green', 已逾期: 'red' };
const BAR: Record<string, string> = { 技术: 'blue', 交付: 'green', 商务: 'purple' };
const dayIdx = (d: string) => Math.round((new Date(d).getTime() - new Date(D.PLAN_START).getTime()) / 86400000);
const addDays = (d: string, n: number) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const mmdd = (d: string) => d.slice(5);

function Legend() {
  return <span className="p9-legend">{(['未开始', '进行中', '已完成', '已逾期'] as PlanStatus[]).map(s => <span key={s}><i className={'tone-' + ST_TONE[s]} />{s}</span>)}</span>;
}
function Weeks() {
  return <div className="p9-weeks">{['WK1', 'WK2', 'WK3', 'WK4'].map(w => <span key={w}>{w}</span>)}</div>;
}

/** 甘特条：可拖动整体改期，拖两端改起止；松手后回写拆解表。 */
function Bar({ item, editable, onChange }: { item: PlanItem; editable: boolean; onChange: (start: string, end: string) => void }) {
  const track = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ dx: number; mode: 'move' | 'l' | 'r' } | null>(null);
  const s = dayIdx(item.start), e = dayIdx(item.end);
  const toDays = (px: number) => Math.round(px / ((track.current?.clientWidth || 240) / DAYS));
  const shift = drag ? toDays(drag.dx) : 0;
  const ns = drag?.mode === 'r' ? s : s + shift, ne = drag?.mode === 'l' ? e : e + shift;
  const left = Math.max(0, ns) / DAYS * 100, width = Math.max(1, Math.min(DAYS, ne + 1) - Math.max(0, ns)) / DAYS * 100;
  const tone = item.status === '已逾期' ? 'red' : item.status === '已完成' ? 'green' : editable ? 'blue' : BAR[item.cat];
  const start = (mode: 'move' | 'l' | 'r') => (ev: React.PointerEvent) => {
    ev.stopPropagation();
    const x0 = ev.clientX;
    (ev.target as HTMLElement).setPointerCapture(ev.pointerId);
    setDrag({ dx: 0, mode });
    const move = (m: PointerEvent) => setDrag({ dx: m.clientX - x0, mode });
    const up = (m: PointerEvent) => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      setDrag(null);
      const d = toDays(m.clientX - x0);
      if (!d) return;
      const a = mode === 'r' ? s : s + d, b = mode === 'l' ? e : e + d;
      if (a > b || a < 0 || b >= DAYS) return;
      onChange(addDays(D.PLAN_START, a), addDays(D.PLAN_START, b));
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  return (
    <div className="p9-gantt-track" ref={track}>
      <div className={cx('p9-gantt-bar', 'tone-' + tone, editable && 'is-edit', drag && 'is-drag')} style={{ left: left + '%', width: width + '%' }}
        onPointerDown={start('move')} title={`${mmdd(addDays(D.PLAN_START, ns))} → ${mmdd(addDays(D.PLAN_START, ne))} · 拖动改期`}>
        {editable && <><i className="p9-handle is-l" onPointerDown={start('l')} /><i className="p9-handle is-r" onPointerDown={start('r')} /></>}
      </div>
    </div>
  );
}

/** 起止日期：按 MM-DD 输入，失焦时校验并补年份。 */
function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <input key={value} defaultValue={mmdd(value)} aria-label="日期 MM-DD" onBlur={e => { const v = e.target.value.trim(); if (/^\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(value.slice(0, 4) + '-' + v))) onChange(value.slice(0, 4) + '-' + v); else e.target.value = mmdd(value); }} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />;
}

function PeopleSelect({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <span className={cx('p9-cell-input', !value && 'is-warn')}>
      <select value={value} onChange={e => onChange(e.target.value)}><option value="">{placeholder ?? '选择责任人'}</option>{D.PEOPLE.map(p => <option key={p}>{p}</option>)}</select>
      <ChevronDown size={10} />
    </span>
  );
}

export function Plan() {
  const { plan, setPlan, docsState, notify, call, bid, setTab } = useP9();
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [view, setView] = useState<'甘特图' | 'RACI' | '按人负荷'>('甘特图');
  const [draft, setDraft] = useState<PlanItem[]>(plan);
  const stage = docsState === 'empty';
  const rows = mode === 'edit' ? draft : plan;
  const patch = (id: string, p: Partial<PlanItem>) => {
    if (mode === 'edit') setDraft(ds => ds.map(d => d.id === id ? { ...d, ...p } : d));
    else setPlan(plan.map(d => d.id === id ? { ...d, ...p } : d));
  };
  const reschedule = (it: PlanItem, start: string, end: string) => {
    patch(it.id, { start, end });
    if (mode === 'view') {
      void call(`/bids/${encodeURIComponent(bid.id)}/plan/items/${encodeURIComponent(it.id)}/reschedule`, 'POST', { start, end });
      notify(`「${it.title}」已改期为 ${mmdd(start)} → ${mmdd(end)}，已回写拆标分解表`);
    }
  };
  const exportCsv = () => {
    const head = '条目,轮次,负责人,参与人,状态,开始,截止';
    const body = rows.map(r => [r.title, r.round, r.owner || '未派', r.part, r.status, r.start, r.end].join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + head + '\n' + body], { type: 'text/csv' }));
    a.download = `${bid.number}-进度表.csv`; a.click(); URL.revokeObjectURL(a.href);
  };

  const head = (
    <header className="p9-card-head">
      <div className="p9-card-head-left"><h3>倒排排期 · 10/17 – 11/05</h3><span className="p9-card-hint">{stage ? '阶段级' : '关键路径 12 天 · 缓冲 3 天'}</span></div>
      <div className="p9-card-head-right">
        {mode === 'edit' ? <>
          <Pill tone="orange"><PenLine size={9} />编辑中 · 未保存</Pill>
          <Btn kind="primary" size="sm" icon={Check} onClick={() => { setPlan(draft); setMode('view'); notify('计划已保存，排期已回写拆标分解表并同步待办'); }}>保存</Btn>
          <Btn kind="outline" size="sm" onClick={() => { setDraft(plan); setMode('view'); }}>取消</Btn>
        </> : <Btn kind="ghost" size="sm" icon={PenLine} onClick={() => { if (stage) { notify('阶段级计划由 SPP 模板生成，上传招标文件后可编辑条目'); return; } setDraft(plan); setMode('edit'); }}>编辑</Btn>}
        <Btn kind="ghost" size="sm" icon={Upload} onClick={() => setTab('docs')}>导入</Btn>
        <Btn kind="ghost" size="sm" icon={Download} onClick={exportCsv}>导出</Btn>
        {!stage && <span className="p9-seg">{(['甘特图', 'RACI', '按人负荷'] as const).map(v => <button type="button" key={v} className={cx(view === v && 'is-on')} onClick={() => setView(v)}>{v}</button>)}</span>}
        {mode !== 'edit' && <Legend />}
      </div>
    </header>
  );

  const foot = <footer className="p9-card-foot"><span>拖动任务条可改期，联动回写拆标分解表</span><button type="button" className="p9-link" onClick={exportCsv}>导出进度表</button></footer>;

  if (stage) {
    return (
      <section className="p9-card is-fill">
        {head}
        <div className="p9-banner tone-orange"><CircleAlert size={12} />招标文件还没上传，先按开标时间 + SPP 团队模板排出大节点。上传解析后会自动补出条目级任务。</div>
        <div className="p9-table p9-gantt" style={{ '--cols': 'minmax(0,1fr) 86px 86px 66px 300px' } as React.CSSProperties}>
          <div className="p9-tr is-head">{['阶段', '负责人', '参与人', '状态'].map(h => <div key={h} className="p9-th">{h}</div>)}<Weeks /></div>
          {D.STAGES.map(s => (
            <div key={s.name} className="p9-tr is-40">
              <div className="p9-gantt-name"><i className={'p9-dot tone-' + ST_TONE[s.status]} /><b>{s.name}</b><span className="p9-grow" /><RoundTag round={s.round} /></div>
              <div className="p9-td-c is-muted">{s.owner}</div><div className="p9-td-c is-muted">{s.part}</div>
              <div><Pill tone={ST_TONE[s.status]}>{s.status}</Pill></div>
              <div className="p9-gantt-track"><div className={cx('p9-gantt-bar', 'is-stage', 'tone-' + (s.status === '已逾期' ? 'red' : s.status === '进行中' ? 'blue' : 'gray'))} style={{ left: s.start / 40 * 100 + '%', width: s.len / 40 * 100 + '%' }} /></div>
            </div>
          ))}
        </div>
        <span className="p9-grow" />{foot}
      </section>
    );
  }

  return (
    <section className="p9-card is-fill">
      {head}
      {mode === 'edit' && <div className="p9-banner tone-blue"><PenLine size={12} />编辑中：条目名可直接改 · 负责人单选 / 参与人多选 · 起止日期可调 · 行尾可删除；回车保存，Esc 取消</div>}
      {view === '甘特图' && (
        <div className={cx('p9-table p9-gantt', mode === 'edit' && 'is-edit')} style={{ '--cols': mode === 'edit' ? 'minmax(0,1fr) 84px 84px 66px 92px 214px 16px' : 'minmax(0,1fr) 84px 84px 60px 280px' } as React.CSSProperties}
          onKeyDown={e => { if (mode !== 'edit') return; if (e.key === 'Enter') { setPlan(draft); setMode('view'); notify('计划已保存'); } if (e.key === 'Escape') { setDraft(plan); setMode('view'); } }}>
          <div className="p9-tr is-head">{['拆解条目', '负责人', '参与人', '状态', ...(mode === 'edit' ? ['起止'] : [])].map(h => <div key={h} className="p9-th">{h}</div>)}<Weeks />{mode === 'edit' && <div />}</div>
          {rows.map(it => mode === 'edit' ? (
            <div key={it.id} className="p9-tr is-44">
              <div className="p9-gantt-name"><GripVertical size={11} className="ic-line" /><i className={'p9-dot tone-' + BAR[it.cat]} /><input className="p9-cell-input is-text" value={it.title} onChange={e => patch(it.id, { title: e.target.value })} /><RoundTag round={it.round} /></div>
              <PeopleSelect value={it.owner} onChange={v => patch(it.id, { owner: v })} />
              <span className="p9-cell-input"><input value={it.part} onChange={e => patch(it.id, { part: e.target.value })} /><Plus size={10} /></span>
              <span className="p9-cell-status"><select value={it.status} onChange={e => patch(it.id, { status: e.target.value as PlanStatus })}>{(['未开始', '进行中', '已完成', '已逾期'] as PlanStatus[]).map(s => <option key={s}>{s}</option>)}</select><Pill tone={ST_TONE[it.status]}>{it.status}</Pill><ChevronDown size={9} /></span>
              <span className="p9-cell-input is-date"><DateInput value={it.start} onChange={v => patch(it.id, { start: v })} /><CalendarDays size={10} /><DateInput value={it.end} onChange={v => patch(it.id, { end: v })} /></span>
              <Bar item={it} editable onChange={(a, b) => reschedule(it, a, b)} />
              <button type="button" className="p9-plain is-danger" onClick={() => setDraft(ds => ds.filter(d => d.id !== it.id))} aria-label="删除"><Trash2 size={11} /></button>
            </div>
          ) : (
            <div key={it.id} className="p9-tr is-34">
              <div className={cx('p9-gantt-name', it.status === '已逾期' && 'tone-red')}><i className={'p9-dot tone-' + (it.status === '已逾期' ? 'red' : BAR[it.cat])} /><span>{it.title}</span><span className="p9-grow" /><RoundTag round={it.round} /></div>
              <div className="p9-td-c is-muted">{it.owner || '未派'}</div><div className="p9-td-c is-muted">{it.part}</div>
              <div><Pill tone={ST_TONE[it.status]}>{it.status}</Pill></div>
              <Bar item={it} editable={false} onChange={(a, b) => reschedule(it, a, b)} />
            </div>
          ))}
        </div>
      )}
      {view === 'RACI' && (
        <div className="p9-table" style={{ '--cols': 'minmax(0,1fr) repeat(5, 70px)' } as React.CSSProperties}>
          <div className="p9-tr is-head"><div className="p9-th">拆解条目</div>{D.PEOPLE.map(p => <div key={p} className="p9-th is-center">{p} · {D.ROLE_OF[p]}</div>)}</div>
          {rows.map(it => (
            <div key={it.id} className="p9-tr is-34"><div className="p9-gantt-name"><span>{it.title}</span></div>
              {D.PEOPLE.map(p => { const r = it.owner === p ? 'R' : it.part.includes(p) ? 'C' : p === '王强' ? 'A' : p === '李明' ? 'I' : ''; return <div key={p} className="p9-td-c is-center">{r && <span className={'p9-raci is-' + r}>{r}</span>}</div>; })}
            </div>
          ))}
        </div>
      )}
      {view === '按人负荷' && (
        <div className="p9-load">
          {D.PEOPLE.map(p => {
            const mine = rows.filter(r => r.owner === p);
            const days = mine.reduce((n, r) => n + dayIdx(r.end) - dayIdx(r.start) + 1, 0);
            return <div key={p} className="p9-load-row"><b>{p} · {D.ROLE_OF[p]}</b><span className="p9-load-track"><i className={days > 10 ? 'tone-red' : 'tone-blue'} style={{ width: Math.min(100, days / 14 * 100) + '%' }} /></span><span>{mine.length} 条 · {days} 人日{days > 10 ? ' · 超负荷' : ''}</span></div>;
          })}
          <div className="p9-load-row is-warn"><b>未派</b><span className="p9-muted">{rows.filter(r => !r.owner).map(r => r.title).join('、') || '无'}</span></div>
        </div>
      )}
      <span className="p9-grow" />{foot}
    </section>
  );
}
