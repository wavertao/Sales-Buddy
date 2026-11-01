// P9.3 计划：初版（阶段级，无招标文件）· 条目级甘特 + 排期助手 · 编辑态；另含 RACI / 按人负荷视图。
import React, { useRef, useState } from 'react';
import { CalendarDays, Check, ChevronDown, CircleAlert, CloudUpload, Download, FileSpreadsheet, FileText, GripVertical, PenLine, Plus, Trash2, Upload, X } from 'lucide-react';
import * as D from '../demo';
import type { PlanItem, PlanStatus } from '../demo';
import { useP9 } from '../store';
import { Btn, Modal, Pill, RoundTag, cx } from '../ui';
import type { Tone } from '../ui';

const ST_TONE: Record<PlanStatus, Tone> = { 未开始: 'gray', 进行中: 'blue', 已完成: 'green', 已逾期: 'red' };
const BAR: Record<string, string> = { 技术: 'blue', 交付: 'green', 商务: 'purple' };
const toDate = (d: string) => new Date(d + 'T00:00:00');
const fmt = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
const addDays = (d: string, n: number) => { const x = toDate(d); x.setDate(x.getDate() + n); return fmt(x); };
const diffDays = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86400000);
const dayIdx = (d: string) => diffDays(D.PLAN_START, d);
const mmdd = (d: string) => d.slice(5);
const cn = (d: string) => `${Number(d.slice(5, 7))}月${Number(d.slice(8, 10))}日`;
/** 所在周的周一（ISO 周从周一开始）。 */
const monday = (d: string) => { const x = toDate(d); return addDays(d, -((x.getDay() + 6) % 7)); };
/** ISO 8601 周数：与当年度日历周一致（WK01 = 含该年第一个周四的那一周）。 */
function isoWeek(d: string) {
  const x = toDate(d); x.setDate(x.getDate() + 3 - ((x.getDay() + 6) % 7));
  const w1 = new Date(x.getFullYear(), 0, 4);
  return 1 + Math.round(((x.getTime() - w1.getTime()) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7);
}

/** 甘特时间轴：从计划最早开始前 pad 周的周一，到最晚截止后 pad 周的周日；dayW 为每天像素宽。 */
export interface Timeline { start: string; days: number; dayW: number; today: string }
function makeTimeline(ranges: { start: string; end: string }[], pad: number, dayW: number, today: string): Timeline {
  const starts = ranges.map(r => r.start).sort(), ends = ranges.map(r => r.end).sort();
  const start = addDays(monday(starts[0] || D.PLAN_START), -7 * pad);
  const end = addDays(monday(ends[ends.length - 1] || D.PLAN_START), 7 * pad + 6);
  return { start, days: diffDays(start, end) + 1, dayW, today };
}

function Legend() {
  return <span className="p9-legend">{(['未开始', '进行中', '已完成', '已逾期'] as PlanStatus[]).map(s => <span key={s}><i className={'tone-' + ST_TONE[s]} />{s}</span>)}</span>;
}
/** 周刻度：WKxx（当年度 ISO 周），悬停显示该周起止日期。 */
function Weeks({ tl }: { tl: Timeline }) {
  const weeks = Array.from({ length: Math.ceil(tl.days / 7) }, (_, i) => addDays(tl.start, i * 7));
  return (
    <div className="p9-weeks is-px" style={{ width: tl.days * tl.dayW }}>
      {weeks.map(w => (
        <span key={w} style={{ width: 7 * tl.dayW }} title={`${w.slice(0, 4)} 年第 ${isoWeek(w)} 周：${cn(w)} – ${cn(addDays(w, 6))}`} className={cx(tl.today >= w && tl.today <= addDays(w, 6) && 'is-now')}>
          WK{String(isoWeek(w)).padStart(2, '0')}{tl.dayW >= 14 && <small>{mmdd(w).replace('-', '/')}</small>}
        </span>
      ))}
    </div>
  );
}
/** 轨道背景：周分隔线 + 今天竖线。 */
function Track({ tl, children, innerRef }: { tl: Timeline; children?: React.ReactNode; innerRef?: React.Ref<HTMLDivElement> }) {
  const t = diffDays(tl.start, tl.today);
  return (
    <div className="p9-gantt-track is-px" ref={innerRef} style={{ width: tl.days * tl.dayW, backgroundSize: `${7 * tl.dayW}px 100%` }}>
      {t >= 0 && t < tl.days && <i className="p9-today" style={{ left: t * tl.dayW + tl.dayW / 2 }} />}
      {children}
    </div>
  );
}

/** 甘特条：可拖动整体改期，拖两端改起止；松手后回写拆解表。 */
function Bar({ item, editable, tl, onChange }: { item: PlanItem; editable: boolean; tl: Timeline; onChange: (start: string, end: string) => void }) {
  const [drag, setDrag] = useState<{ dx: number; mode: 'move' | 'l' | 'r' } | null>(null);
  const s = diffDays(tl.start, item.start), e = diffDays(tl.start, item.end);
  const toDays = (px: number) => Math.round(px / tl.dayW);
  const shift = drag ? toDays(drag.dx) : 0;
  const ns = drag?.mode === 'r' ? s : s + shift, ne = drag?.mode === 'l' ? e : e + shift;
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
      if (a > b || a < 0 || b >= tl.days) return;
      onChange(addDays(tl.start, a), addDays(tl.start, b));
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  return (
    <Track tl={tl}>
      <div className={cx('p9-gantt-bar', 'tone-' + tone, editable && 'is-edit', drag && 'is-drag')} style={{ left: ns * tl.dayW + 1, width: Math.max(1, ne - ns + 1) * tl.dayW - 2 }}
        onPointerDown={start('move')} title={`${cn(addDays(tl.start, ns))} – ${cn(addDays(tl.start, ne))}（${ne - ns + 1} 天）· 拖动改期`}>
        {editable && <><i className="p9-handle is-l" onPointerDown={start('l')} /><i className="p9-handle is-r" onPointerDown={start('r')} /></>}
      </div>
    </Track>
  );
}

const PADS: [number, string][] = [[2, '前后 2 周'], [4, '前后 4 周'], [8, '前后 8 周']];
/** 甘特工具条：时间范围（计划前后 N 周）+ 缩放（每天宽度）。 */
function GanttTools({ pad, setPad, dayW, setDayW, onToday }: { pad: number; setPad: (n: number) => void; dayW: number; setDayW: (n: number) => void; onToday: () => void }) {
  return (
    <div className="p9-gantt-tools">
      <span className="p9-muted">时间范围</span>
      <span className="p9-seg">{PADS.map(([n, l]) => <button type="button" key={n} className={cx(pad === n && 'is-on')} onClick={() => setPad(n)}>{l}</button>)}</span>
      <span className="p9-muted">缩放</span>
      <span className="p9-seg">
        <button type="button" onClick={() => setDayW(Math.max(8, dayW - 4))} aria-label="缩小" disabled={dayW <= 8}>−</button>
        <button type="button" className="is-on" onClick={() => setDayW(18)} title="恢复默认">{dayW} px/天</button>
        <button type="button" onClick={() => setDayW(Math.min(40, dayW + 4))} aria-label="放大" disabled={dayW >= 40}>+</button>
      </span>
      <button type="button" className="p9-link" onClick={onToday}>定位到今天</button>
      <span className="p9-grow" />
      <span className="p9-muted">左右滑动查看更多周 · 悬停 WK 看起止日期</span>
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
  const { live } = useP9();
  const [pad, setPad] = useState(2);
  const [dayW, setDayW] = useState(18);
  const scroller = useRef<HTMLDivElement>(null);
  const stageRows = D.STAGES.map(st => ({ ...st, start: addDays(D.PLAN_START, st.start), end: addDays(D.PLAN_START, st.start + st.len - 1) }));
  const tl = makeTimeline(stage ? stageRows : rows, pad, dayW, live?.today || '2026-10-24');
  const leftCols = stage ? '170px 76px 84px 60px' : mode === 'edit' ? '210px 84px 84px 66px 92px 16px' : '180px 70px 84px 60px';
  const leftW = leftCols.split(' ').reduce((n, c) => n + parseInt(c, 10), 0) + (leftCols.split(' ').length - 1) * 6 + 24;
  const gridStyle = { '--left': leftCols, gridTemplateColumns: `${leftW}px ${tl.days * dayW}px` } as React.CSSProperties;
  const span = (stage ? stageRows : rows);
  const planRange = span.length ? `${mmdd([...span].map(r => r.start).sort()[0]).replace('-', '/')} – 11/05` : '—';
  const toToday = () => { const el = scroller.current; if (el) el.scrollTo({ left: Math.max(0, diffDays(tl.start, tl.today) * dayW - (el.clientWidth - leftW) / 2), behavior: 'smooth' }); };
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
      <div className="p9-card-head-left"><h3>倒排排期 · {planRange}</h3><span className="p9-card-hint">{stage ? '阶段级' : '关键路径 12 天 · 缓冲 3 天'}</span></div>
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
        <GanttTools pad={pad} setPad={setPad} dayW={dayW} setDayW={setDayW} onToday={toToday} />
        <div className="p9-gantt-scroll" ref={scroller}>
          <div className="p9-gr is-head" style={gridStyle}>
            <div className="p9-gl">{['阶段', '负责人', '参与人', '状态'].map(h => <div key={h} className="p9-th">{h}</div>)}</div>
            <Weeks tl={tl} />
          </div>
          {stageRows.map(s => (
            <div key={s.name} className="p9-gr is-40" style={gridStyle}>
              <div className="p9-gl">
                <div className="p9-gantt-name"><i className={'p9-dot tone-' + ST_TONE[s.status]} /><b>{s.name}</b><span className="p9-grow" /><RoundTag round={s.round} /></div>
                <div className="p9-td-c is-muted">{s.owner}</div><div className="p9-td-c is-muted">{s.part}</div>
                <div><Pill tone={ST_TONE[s.status]}>{s.status}</Pill></div>
              </div>
              <Track tl={tl}><div className={cx('p9-gantt-bar', 'is-stage', 'tone-' + (s.status === '已逾期' ? 'red' : s.status === '进行中' ? 'blue' : 'gray'))}
                style={{ left: diffDays(tl.start, s.start) * tl.dayW + 1, width: (diffDays(s.start, s.end) + 1) * tl.dayW - 2 }} title={`${cn(s.start)} – ${cn(s.end)}`} /></Track>
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
        <>
          <GanttTools pad={pad} setPad={setPad} dayW={dayW} setDayW={setDayW} onToday={toToday} />
          <div className={cx('p9-gantt-scroll', mode === 'edit' && 'is-edit')} ref={scroller}
            onKeyDown={e => { if (mode !== 'edit') return; if (e.key === 'Enter') { setPlan(draft); setMode('view'); notify('计划已保存'); } if (e.key === 'Escape') { setDraft(plan); setMode('view'); } }}>
            <div className="p9-gr is-head" style={gridStyle}>
              <div className="p9-gl">{['拆解条目', '负责人', '参与人', '状态', ...(mode === 'edit' ? ['起止', ''] : [])].map((h, i) => <div key={i} className="p9-th">{h}</div>)}</div>
              <Weeks tl={tl} />
            </div>
            {rows.map(it => mode === 'edit' ? (
              <div key={it.id} {...dragRow(it.id)} className={cx('p9-gr is-44', dragRow(it.id).className)} style={gridStyle}>
                <div className="p9-gl">
                  <div className="p9-gantt-name">{grip(it.id)}<i className={'p9-dot tone-' + BAR[it.cat]} /><input className="p9-cell-input is-text" value={it.title} onChange={e => patch(it.id, { title: e.target.value })} /><RoundTag round={it.round} /></div>
                  <PeopleSelect value={it.owner} onChange={v => patch(it.id, { owner: v })} />
                  <span className="p9-cell-input"><input value={it.part} onChange={e => patch(it.id, { part: e.target.value })} /><Plus size={10} /></span>
                  <span className="p9-cell-status"><select value={it.status} onChange={e => patch(it.id, { status: e.target.value as PlanStatus })}>{(['未开始', '进行中', '已完成', '已逾期'] as PlanStatus[]).map(s => <option key={s}>{s}</option>)}</select><Pill tone={ST_TONE[it.status]}>{it.status}</Pill><ChevronDown size={9} /></span>
                  <span className="p9-cell-input is-date"><DateInput value={it.start} onChange={v => patch(it.id, { start: v })} /><CalendarDays size={10} /><DateInput value={it.end} onChange={v => patch(it.id, { end: v })} /></span>
                  <button type="button" className="p9-plain is-danger" onClick={() => setDraft(ds => ds.filter(d => d.id !== it.id))} aria-label="删除"><Trash2 size={11} /></button>
                </div>
                <Bar item={it} editable tl={tl} onChange={(a, b) => reschedule(it, a, b)} />
              </div>
            ) : (
              <div key={it.id} {...dragRow(it.id)} className={cx('p9-gr is-34', dragRow(it.id).className)} style={gridStyle}>
                <div className="p9-gl">
                  <div className={cx('p9-gantt-name', it.status === '已逾期' && 'tone-red')}>{grip(it.id)}<i className={'p9-dot tone-' + (it.status === '已逾期' ? 'red' : BAR[it.cat])} /><span>{it.title}</span><span className="p9-grow" /><RoundTag round={it.round} /></div>
                  <div className="p9-td-c is-muted">{it.owner || '未派'}</div><div className="p9-td-c is-muted">{it.part}</div>
                  <div><Pill tone={ST_TONE[it.status]}>{it.status}</Pill></div>
                </div>
                <Bar item={it} editable={false} tl={tl} onChange={(a, b) => reschedule(it, a, b)} />
              </div>
            ))}
          </div>
        </>
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
            const days = mine.reduce((n, r) => n + diffDays(r.start, r.end) + 1, 0);
            return <div key={p} className="p9-load-row"><b>{p} · {D.ROLE_OF[p]}</b><span className="p9-load-track"><i className={days > 10 ? 'tone-red' : 'tone-blue'} style={{ width: Math.min(100, days / 14 * 100) + '%' }} /></span><span>{mine.length} 条 · {days} 人日{days > 10 ? ' · 超负荷' : ''}</span></div>;
          })}
          <div className="p9-load-row is-warn"><b>未派</b><span className="p9-muted">{rows.filter(r => !r.owner).map(r => r.title).join('、') || '无'}</span></div>
        </div>
      )}
      <span className="p9-grow" />{foot}{importModal}
    </section>
  );
}
