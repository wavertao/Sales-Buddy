// P9.3 计划：初版（阶段级，无招标文件）· 条目级甘特 + 排期助手 · 编辑态；另含 RACI / 按人负荷视图。
import React, { useRef, useState } from 'react';
import { CalendarDays, Check, ChevronDown, CircleAlert, CloudUpload, Download, FileSpreadsheet, FileText, GripVertical, PenLine, Plus, Trash2, Upload, X } from 'lucide-react';
import * as D from '../demo';
import type { PlanItem, PlanStatus } from '../demo';
import { useP9 } from '../store';
import { Btn, Modal, Pill, RoundTag, cx } from '../ui';
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

const TEMPLATE_HEAD = '条目,轮次,负责人,参与人,状态,开始,截止';
/** 解析导入的 CSV：列顺序同导出模板；日期支持 YYYY-MM-DD / MM-DD。 */
function parsePlanCsv(text: string): PlanItem[] {
  const norm = (d: string) => /^\d{2}-\d{2}$/.test(d) ? '2026-' + d : d;
  return text.replace(/^﻿/, '').split(/\r?\n/).slice(1).map(l => l.split(',').map(x => x.trim())).filter(c => c[0])
    .map((c, i) => ({
      id: 'imp-' + Date.now() + '-' + i, title: c[0], round: c[1] || 'R2', owner: c[2] === '未派' ? '' : (c[2] || ''), part: c[3] || '',
      status: (['未开始', '进行中', '已完成', '已逾期'].includes(c[4]) ? c[4] : '未开始') as PlanStatus,
      start: norm(c[5] || D.PLAN_START), end: norm(c[6] || c[5] || D.PLAN_START),
      cat: (/商务|付款|报价|资质/.test(c[0]) ? '商务' : /交付|物流/.test(c[0]) ? '交付' : '技术') as PlanItem['cat'],
    }));
}

/** P9.3 计划 · 导入：文件上传弹窗（拖拽 / 选择文件 → 预览 → 追加或替换）。 */
function ImportPlanModal({ onClose, onImport }: { onClose: () => void; onImport: (items: PlanItem[], replace: boolean) => void }) {
  const [file, setFile] = useState<{ name: string; size: string } | null>(null);
  const [rows, setRows] = useState<PlanItem[]>([]);
  const [error, setError] = useState('');
  const [replace, setReplace] = useState(false);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const pick = async (f?: File) => {
    if (!f) return;
    setFile({ name: f.name, size: f.size > 1048576 ? (f.size / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(f.size / 1024)) + ' KB' });
    setError('');
    if (/\.csv$/i.test(f.name)) {
      const items = parsePlanCsv(await f.text());
      setRows(items);
      if (!items.length) setError('没有识别到条目：请按模板第一行表头填写');
    } else if (/\.(xlsx|xls|mpp)$/i.test(f.name)) {
      // Excel / Project 由后端解析；演示环境按模板示例行预览
      setRows(D.PLAN_ITEMS.slice(0, 3).map((p, i) => ({ ...p, id: 'imp-' + Date.now() + '-' + i, title: p.title + '（导入）' })));
    } else { setRows([]); setError('仅支持 Excel（.xlsx / .xls）、CSV 与 Project（.mpp）'); }
  };
  const template = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + TEMPLATE_HEAD + '\n4.4 储能变流器响应,R2,陈磊,王强,未开始,10-26,10-29\n'], { type: 'text/csv;charset=utf-8' }));
    a.download = '计划导入模板.csv'; a.click(); URL.revokeObjectURL(a.href);
  };
  return (
    <Modal icon={Upload} title="导入计划" width={520} onClose={onClose} footer={<>
      <span className="p9-modal-foot-note">导入的条目自动挂当前轮次，可在编辑态继续调整</span><span className="p9-grow" />
      <Btn kind="outline" size="lg" onClick={onClose}>取消</Btn>
      <Btn kind="primary" size="lg" icon={Check} disabled={!rows.length} onClick={() => onImport(rows, replace)}>导入{rows.length ? ` ${rows.length} 条` : ''}</Btn>
    </>}>
      <div className={cx('p9-drop', drag && 'is-drag')} onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); void pick(e.dataTransfer.files[0]); }}>
        <input ref={input} type="file" hidden accept=".xlsx,.xls,.csv,.mpp" onChange={e => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
        <span><CloudUpload size={15} className="ic-blue" />拖拽文件到这里，或 <button type="button" className="p9-link" onClick={() => input.current?.click()}>选择文件</button></span>
        <small>支持 Excel / CSV / Project（.mpp），单个不超过 20 MB</small>
      </div>
      <div className="p9-import-tip"><FileSpreadsheet size={11} className="ic-green" />列顺序：条目 · 轮次 · 负责人 · 参与人 · 状态 · 开始 · 截止<span className="p9-grow" /><button type="button" className="p9-link" onClick={template}><Download size={10} />下载模板</button></div>
      {file && <div className="p9-attached"><FileText size={10} />{file.name}<small>· {file.size}{rows.length ? ` · 识别 ${rows.length} 条` : ''}</small><span className="p9-grow" /><button type="button" className="p9-plain" onClick={() => { setFile(null); setRows([]); setError(''); }} aria-label="移除文件"><X size={10} /></button></div>}
      {error && <p className="p9-import-err"><CircleAlert size={11} />{error}</p>}
      {rows.length > 0 && <div className="p9-import-preview">
        <div className="p9-import-row is-head"><span>条目</span><span>负责人</span><span>起止</span><span>状态</span></div>
        {rows.slice(0, 5).map(r => <div key={r.id} className="p9-import-row"><span>{r.title}</span><span>{r.owner || '未派'}</span><span>{mmdd(r.start)} → {mmdd(r.end)}</span><span>{r.status}</span></div>)}
        {rows.length > 5 && <small>另有 {rows.length - 5} 条…</small>}
      </div>}
      <div className="p9-mf"><span className="p9-mf-label is-strong">导入方式</span>
        <div className="p9-outcomes is-2">{([['追加到现有计划', false], ['替换「未开始」的条目', true]] as [string, boolean][]).map(([k, v]) => <button type="button" key={k} className={cx(replace === v && 'is-on')} onClick={() => setReplace(v)}><i className="p9-radio" />{k}</button>)}</div>
      </div>
    </Modal>
  );
}

export function Plan() {
  const { plan, setPlan, docsState, notify, call, bid, setTab } = useP9();
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [view, setView] = useState<'甘特图' | 'RACI' | '按人负荷'>('甘特图');
  const [draft, setDraft] = useState<PlanItem[]>(plan);
  const stage = docsState === 'empty';
  const rows = mode === 'edit' ? draft : plan;
  const [importing, setImporting] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  // 行上下拖拽排序：拖左侧把手，落在目标行上即插到该行之前
  const reorder = (from: string, to: string) => {
    if (from === to) return;
    const move = (list: PlanItem[]) => { const src = list.find(x => x.id === from)!; const rest = list.filter(x => x.id !== from); const i = rest.findIndex(x => x.id === to); return [...rest.slice(0, i), src, ...rest.slice(i)]; };
    if (mode === 'edit') setDraft(move); else { setPlan(move(plan)); notify('排序已调整，拆标分解表同步'); }
  };
  const dragRow = (id: string) => ({
    onDragOver: (e: React.DragEvent) => { if (!dragId) return; e.preventDefault(); setOverId(id); },
    onDrop: (e: React.DragEvent) => { e.preventDefault(); if (dragId) reorder(dragId, id); setDragId(null); setOverId(null); },
    className: cx(dragId === id && 'is-dragging', overId === id && dragId !== id && 'is-drop'),
  });
  const grip = (id: string) => <span className="p9-grip" draggable title="拖动调整顺序" onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id); setDragId(id); }} onDragEnd={() => { setDragId(null); setOverId(null); }}><GripVertical size={11} /></span>;
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
        <Btn kind="ghost" size="sm" icon={Upload} onClick={() => setImporting(true)}>导入</Btn>
        <Btn kind="ghost" size="sm" icon={Download} onClick={exportCsv}>导出</Btn>
        {!stage && <span className="p9-seg">{(['甘特图', 'RACI', '按人负荷'] as const).map(v => <button type="button" key={v} className={cx(view === v && 'is-on')} onClick={() => setView(v)}>{v}</button>)}</span>}
        {mode !== 'edit' && <Legend />}
      </div>
    </header>
  );

  const importModal = importing && <ImportPlanModal onClose={() => setImporting(false)} onImport={(items, replace) => {
    const next = replace ? [...plan.filter(p => p.status !== '未开始'), ...items] : [...plan, ...items];
    setPlan(next); setDraft(next); setImporting(false);
    notify(`已导入 ${items.length} 条计划条目${replace ? '，未开始的旧条目已替换' : ''}`);
  }} />;
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
        <span className="p9-grow" />{foot}{importModal}
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
            <div key={it.id} {...dragRow(it.id)} className={cx('p9-tr is-44', dragRow(it.id).className)}>
              <div className="p9-gantt-name">{grip(it.id)}<i className={'p9-dot tone-' + BAR[it.cat]} /><input className="p9-cell-input is-text" value={it.title} onChange={e => patch(it.id, { title: e.target.value })} /><RoundTag round={it.round} /></div>
              <PeopleSelect value={it.owner} onChange={v => patch(it.id, { owner: v })} />
              <span className="p9-cell-input"><input value={it.part} onChange={e => patch(it.id, { part: e.target.value })} /><Plus size={10} /></span>
              <span className="p9-cell-status"><select value={it.status} onChange={e => patch(it.id, { status: e.target.value as PlanStatus })}>{(['未开始', '进行中', '已完成', '已逾期'] as PlanStatus[]).map(s => <option key={s}>{s}</option>)}</select><Pill tone={ST_TONE[it.status]}>{it.status}</Pill><ChevronDown size={9} /></span>
              <span className="p9-cell-input is-date"><DateInput value={it.start} onChange={v => patch(it.id, { start: v })} /><CalendarDays size={10} /><DateInput value={it.end} onChange={v => patch(it.id, { end: v })} /></span>
              <Bar item={it} editable onChange={(a, b) => reschedule(it, a, b)} />
              <button type="button" className="p9-plain is-danger" onClick={() => setDraft(ds => ds.filter(d => d.id !== it.id))} aria-label="删除"><Trash2 size={11} /></button>
            </div>
          ) : (
            <div key={it.id} {...dragRow(it.id)} className={cx('p9-tr is-34', dragRow(it.id).className)}>
              <div className={cx('p9-gantt-name', it.status === '已逾期' && 'tone-red')}>{grip(it.id)}<i className={'p9-dot tone-' + (it.status === '已逾期' ? 'red' : BAR[it.cat])} /><span>{it.title}</span><span className="p9-grow" /><RoundTag round={it.round} /></div>
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
      <span className="p9-grow" />{foot}{importModal}
    </section>
  );
}
