import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Check, ChevronDown, ChevronRight, Download, FileText, FlaskConical, FolderOpen, GitBranch, History,
  ListChecks, Loader2, Plus, RotateCcw, Save, ScanSearch, Search, Settings2, Trash2, Upload, X,
} from 'lucide-react';
import type {
  DecompItem, FieldSummary, FileRole, RulePreviewClause, Severity, Strength, TenderCategory, TenderParseResult, TenderRuleSet,
} from '../../../../packages/contracts/tender';
import { TENDER_CATEGORIES } from '../../../../packages/contracts/tender';
import './tender.css';

type Api = (path: string, options?: Record<string, unknown>) => Promise<any>;
type Sample = { id: string; name: string; kind: 'single' | 'package'; files: number; size: number };

const CAT_LABEL = Object.fromEntries(TENDER_CATEGORIES.map((c) => [c.key, c.label])) as Record<TenderCategory, string>;
const ROLE_LABEL: Record<FileRole, string> = {
  notice: '招标公告', itb: '招标正文', contract: '合同 / 协议', technical_spec: '技术规范', amendment: '修订 / 补遗',
  clarification: '澄清 / 答疑', boq: '报价清单', drawing: '图纸', form: '格式表单', integrity: '廉洁协议', result: '中标结果', reference: '参考资料', other: '其他',
};
const STRENGTH_LABEL: Record<Strength, string> = { mandatory: '强制', prohibited: '禁止 / 否决', recommended: '建议' };
const SEV_LABEL: Record<Severity, string> = { high: '高', medium: '中', low: '低' };
const STATUS_LABEL: Record<string, string> = { ok: '已解析', partial_scanned: '部分无文字层', scanned: '扫描件', unsupported: '不支持', error: '读取失败' };
const FIELD_STATUS: Record<FieldSummary['status'], [string, string]> = {
  single: ['单一来源', 'gray'], consistent: ['多处一致', 'green'], overridden: ['已被修订', 'blue'], conflict: ['待核对', 'orange'],
};
const fmtSize = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const token = () => localStorage.getItem('sb-token') || '';

/** 标书解析：解析工作台（选样本 / 上传整包 → 看结果）+ 规则配置（解析用到的全部规则都在这里改）。 */
export function TenderWorkspace({ api }: { api: Api }) {
  const [tab, setTab] = useState<'parse' | 'rules' | 'runs'>('parse');
  const [result, setResult] = useState<TenderParseResult | null>(null);
  return (
    <div className="tp-root">
      <header className="tp-head">
        <div>
          <h1><ScanSearch size={20} />标书解析</h1>
          <p>招标整包 → 文件角色 → 章节条款 → 强制项 / 风险 / 关键字段 → 拆标分解表（技术 · 交付 · 价格 · 商务 · 偏差）</p>
        </div>
        <nav className="tp-tabs">
          {([['parse', '解析工作台', ListChecks], ['rules', '规则配置', Settings2], ['runs', '解析记录', History]] as const).map(([k, label, Icon]) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}><Icon size={14} />{label}</button>
          ))}
        </nav>
      </header>
      {tab === 'parse' && <ParseBench api={api} result={result} setResult={setResult} />}
      {tab === 'rules' && <RuleConfig api={api} />}
      {tab === 'runs' && <Runs api={api} open={(r) => { setResult(r); setTab('parse'); }} />}
    </div>
  );
}

// ======================= 解析工作台 =======================
function ParseBench({ api, result, setResult }: { api: Api; result: TenderParseResult | null; setResult: (r: TenderParseResult) => void }) {
  const [samples, setSamples] = useState<{ root: string; packages: Sample[] } | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const dirInput = useRef<HTMLInputElement>(null);
  useEffect(() => { api('/tender/samples').then(setSamples).catch((e) => setError(e.message)); }, []);

  async function parseSample(s: Sample) {
    setBusy(s.id); setError('');
    try { setResult(await api('/tender/parse', { method: 'POST', body: { sample: s.id } })); }
    catch (e) { setError((e as Error).message); } finally { setBusy(''); }
  }
  async function upload(list: FileList | null) {
    if (!list?.length) return;
    const form = new FormData();
    const first = (list[0] as File & { webkitRelativePath?: string }).webkitRelativePath?.split('/')[0];
    form.append('name', first || list[0].name);
    for (const f of Array.from(list)) form.append('files', f, (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name);
    setBusy('upload'); setError('');
    try {
      const r = await fetch('/api/tender/upload', { method: 'POST', headers: { Authorization: 'Bearer ' + token() }, body: form });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || j.error);
      setResult(j);
    } catch (e) { setError((e as Error).message); } finally { setBusy(''); if (fileInput.current) fileInput.current.value = ''; if (dirInput.current) dirInput.current.value = ''; }
  }

  const packages = samples?.packages.filter((p) => p.kind === 'package') || [];
  const singles = samples?.packages.filter((p) => p.kind === 'single') || [];
  return (
    <div className="tp-bench">
      <aside className="tp-card tp-samples">
        <div className="tp-card-head"><FolderOpen size={14} /><b>招标文件</b><span className="tp-muted">{samples?.packages.length ?? 0} 个</span></div>
        <div className="tp-upload">
          <button className="tp-btn primary" disabled={!!busy} onClick={() => dirInput.current?.click()}><Upload size={13} />上传整包文件夹</button>
          <button className="tp-btn" disabled={!!busy} onClick={() => fileInput.current?.click()}><FileText size={13} />选文件</button>
          <input ref={fileInput} type="file" multiple hidden onChange={(e) => upload(e.target.files)} />
          <input ref={dirInput} type="file" multiple hidden {...({ webkitdirectory: '' } as Record<string, string>)} onChange={(e) => upload(e.target.files)} />
        </div>
        {busy === 'upload' && <div className="tp-busy"><Loader2 size={13} className="tp-spin" />正在上传并解析…</div>}
        <div className="tp-sample-group">样本整包 · {packages.length}</div>
        {packages.map((s) => <SampleRow key={s.id} s={s} busy={busy} onClick={() => parseSample(s)} active={result?.packageName === s.name} />)}
        <div className="tp-sample-group">单文件 · {singles.length}</div>
        {singles.map((s) => <SampleRow key={s.id} s={s} busy={busy} onClick={() => parseSample(s)} active={result?.packageName === s.name} />)}
        {samples && !samples.packages.length && <p className="tp-muted tp-pad">样本目录为空：{samples.root}</p>}
        <p className="tp-foot">样本目录：{samples?.root || '…'}（可用 TENDER_SAMPLE_DIR 改）</p>
      </aside>
      <section className="tp-main">
        {error && <div className="tp-alert red"><AlertTriangle size={14} />{error}</div>}
        {!result && !busy && <Empty />}
        {busy && busy !== 'upload' && !result && <div className="tp-card tp-pad tp-busy"><Loader2 size={14} className="tp-spin" />正在解析，整包较大时约需 10–70 秒…</div>}
        {result && <ResultView r={result} busy={!!busy} />}
      </section>
    </div>
  );
}

function SampleRow({ s, busy, onClick, active }: { s: Sample; busy: string; onClick: () => void; active: boolean }) {
  return (
    <button className={'tp-sample' + (active ? ' on' : '')} disabled={!!busy} onClick={onClick} title={s.id}>
      {busy === s.id ? <Loader2 size={14} className="tp-spin" /> : s.kind === 'package' ? <FolderOpen size={14} /> : <FileText size={14} />}
      <span className="tp-grow">{s.name}</span>
      <span className="tp-muted">{s.kind === 'package' ? `${s.files} 个 · ` : ''}{fmtSize(s.size)}</span>
    </button>
  );
}

function Empty() {
  const steps = ['文件抽取', '文件角色识别', '章节切分', '条款打标', '拆标分解表'];
  return (
    <div className="tp-card tp-empty">
      <ScanSearch size={30} />
      <h2>选左侧一个样本，或上传一个招标整包</h2>
      <p>解析完全按「规则配置」里的规则执行，改了规则重新解析就能看到差别。</p>
      <div className="tp-steps">{steps.map((s, i) => <React.Fragment key={s}><span>{i + 1} {s}</span>{i < steps.length - 1 && <ChevronRight size={14} />}</React.Fragment>)}</div>
    </div>
  );
}

function ResultView({ r, busy }: { r: TenderParseResult; busy: boolean }) {
  const s = r.stats;
  const extracted = r.files.filter((f) => f.clauses > 0);
  const clauses = r.files.reduce((n, f) => n + f.clauses, 0);
  return (
    <div className={'tp-result' + (busy ? ' dim' : '')}>
      <div className="tp-card tp-summary">
        <div className="tp-summary-title">
          <b>{r.packageName}</b>
          <span className="tp-pill gray">规则 v{r.ruleVersion}</span>
          <span className="tp-muted">{r.createdAt.slice(0, 16).replace('T', ' ')} · 用时 {(r.durationMs / 1000).toFixed(1)} 秒</span>
          <span className="tp-grow" />
          <button className="tp-btn" onClick={() => exportCsv(r)}><Download size={13} />导出分解表</button>
        </div>
        <div className="tp-kpis">
          <Kpi label="文件 / 页" value={`${s.files} / ${s.pages}`} />
          <Kpi label="拆出要求" value={s.items} tone="blue" />
          <Kpi label="强制 / 否决项" value={s.mandatory} />
          <Kpi label="高风险" value={s.risks.high} tone={s.risks.high ? 'red' : undefined} />
          <Kpi label="字段待核对" value={s.conflicts} tone={s.conflicts ? 'orange' : undefined} />
          <Kpi label="修订 / 澄清引用" value={r.overrides.length} />
        </div>
        <div className="tp-flow">
          <FlowStep n={1} label="文件抽取" detail={`${s.files} 个文件，${s.scannedFiles} 个扫描件，${s.unsupportedFiles} 个不支持`} />
          <FlowStep n={2} label="文件角色" detail={`${new Set(r.files.map((f) => f.role)).size} 类角色，${extracted.length} 个文件拆条款`} />
          <FlowStep n={3} label="章节切分" detail={`${r.files.reduce((n, f) => n + f.sections, 0)} 个章节，${clauses} 条条款`} />
          <FlowStep n={4} label="条款打标" detail={`${s.items} 条进分解表`} />
          <FlowStep n={5} label="包级汇总" detail={`${r.fields.length} 个字段，${r.overrides.length} 处修订引用`} last />
        </div>
        {!!r.warnings.length && <div className="tp-alert orange"><AlertTriangle size={14} /><div>{r.warnings.map((w) => <div key={w}>{w}</div>)}</div></div>}
      </div>
      <div className="tp-two">
        <FilesCard r={r} />
        <FieldsCard fields={r.fields} />
      </div>
      {!!r.overrides.length && <OverridesCard r={r} />}
      <DecompCard r={r} />
    </div>
  );
}

const Kpi = ({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) => (
  <div className="tp-kpi"><span>{label}</span><b className={tone ? 'tone-' + tone : ''}>{value}</b></div>
);
const FlowStep = ({ n, label, detail, last }: { n: number; label: string; detail: string; last?: boolean }) => (
  <>
    <div className="tp-flow-step"><i>{n}</i><div><b>{label}</b><span>{detail}</span></div></div>
    {!last && <ChevronRight size={14} className="tp-flow-arrow" />}
  </>
);

function FilesCard({ r }: { r: TenderParseResult }) {
  const files = [...r.files].sort((a, b) => b.precedence - a.precedence);
  return (
    <div className="tp-card">
      <div className="tp-card-head"><FileText size={14} /><b>文件角色</b><span className="tp-muted">按效力顺序（澄清 &gt; 修订 &gt; 规范 / 合同 &gt; 正文）</span></div>
      <table className="tp-table">
        <thead><tr><th>文件</th><th>角色</th><th>页</th><th>章节 / 条款</th><th>状态</th></tr></thead>
        <tbody>
          {files.map((f) => (
            <tr key={f.id}>
              <td className="tp-file" title={f.path}>{f.name}</td>
              <td><span className={'tp-role r-' + f.role}>{ROLE_LABEL[f.role]}</span></td>
              <td className="tp-num">{f.pages || '–'}</td>
              <td className="tp-num">{f.clauses ? `${f.sections} / ${f.clauses}` : <span className="tp-muted">只登记</span>}</td>
              <td title={f.note}><span className={'tp-pill ' + (f.status === 'ok' ? 'green' : f.status === 'partial_scanned' ? 'gray' : 'orange')}>{STATUS_LABEL[f.status]}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FieldsCard({ fields }: { fields: FieldSummary[] }) {
  return (
    <div className="tp-card">
      <div className="tp-card-head"><GitBranch size={14} /><b>关键字段</b><span className="tp-muted">采用效力最高的文件里的值；多值时列出其余取值</span></div>
      {!fields.length && <p className="tp-muted tp-pad">没有命中任何字段规则</p>}
      <table className="tp-table">
        <tbody>
          {fields.map((f) => {
            const [label, tone] = FIELD_STATUS[f.status];
            const others = f.values.filter((v) => v.value !== f.value).slice(0, 4);
            return (
              <tr key={f.key}>
                <td className="tp-field-label">{f.label}</td>
                <td><b>{f.value}</b><div className="tp-muted tp-small" title={f.source}>{f.source}</div></td>
                <td><span className={'tp-pill ' + tone}>{label}</span></td>
                <td className="tp-small tp-muted">{others.map((v) => v.normalized).join(' · ')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function OverridesCard({ r }: { r: TenderParseResult }) {
  const [open, setOpen] = useState(false);
  const shown = open ? r.overrides : r.overrides.slice(0, 6);
  return (
    <div className="tp-card">
      <div className="tp-card-head"><RotateCcw size={14} /><b>修订 / 澄清引用</b><span className="tp-muted">修订文件里提到的条款号，能定位到原文的会在分解表里标「已修订」</span></div>
      <div className="tp-overrides">
        {shown.map((o, i) => (
          <div key={i} className="tp-override">
            <span className={'tp-role r-' + o.role}>{ROLE_LABEL[o.role]}</span>
            <b>{o.ref}</b>
            <span className="tp-muted tp-small">{o.fileName} · 第 {o.page} 页</span>
            {o.target ? <span className="tp-pill blue">→ {o.target.fileName} · {o.target.section.slice(0, 36)}</span> : <span className="tp-pill gray">未定位到原条款</span>}
            <div className="tp-snippet">{o.snippet}</div>
          </div>
        ))}
      </div>
      {r.overrides.length > 6 && <button className="tp-link" onClick={() => setOpen(!open)}>{open ? '收起' : `展开全部 ${r.overrides.length} 处`}<ChevronDown size={12} className={open ? 'rot' : ''} /></button>}
    </div>
  );
}

function DecompCard({ r }: { r: TenderParseResult }) {
  const [cat, setCat] = useState<TenderCategory | 'all'>('all');
  const [only, setOnly] = useState<'all' | 'strong' | 'risk' | 'amended'>('all');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { setPage(0); }, [cat, only, q, r.id]);
  const rows = useMemo(() => r.items.filter((it) =>
    (cat === 'all' || it.category === cat)
    && (only === 'all' || (only === 'strong' && (it.strength === 'mandatory' || it.strength === 'prohibited')) || (only === 'risk' && it.risks.length > 0) || (only === 'amended' && it.amended))
    && (!q || (it.text + it.fileName + it.section).toLowerCase().includes(q.toLowerCase()))), [r, cat, only, q]);
  const PAGE = 40;
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const shown = rows.slice(page * PAGE, page * PAGE + PAGE);
  return (
    <div className="tp-card">
      <div className="tp-card-head"><ListChecks size={14} /><b>拆标分解表</b><span className="tp-muted">{r.items.length} 条{r.truncated ? '（已截断）' : ''} · 负责 / 复核按「责任分工」规则，截止按投标截止倒排</span></div>
      <div className="tp-filters">
        <div className="tp-seg">
          <button className={cat === 'all' ? 'on' : ''} onClick={() => setCat('all')}>全部 {r.items.length}</button>
          {TENDER_CATEGORIES.map((c) => <button key={c.key} className={cat === c.key ? 'on' : ''} onClick={() => setCat(c.key)}><i className={'tp-dot c-' + c.key} />{c.label} {r.stats.byCategory[c.key]}</button>)}
        </div>
        <select value={only} onChange={(e) => setOnly(e.target.value as typeof only)}>
          <option value="all">全部要求</option><option value="strong">只看强制 / 否决</option><option value="risk">只看有风险</option><option value="amended">只看被修订章节</option>
        </select>
        <label className="tp-search"><Search size={13} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜条款原文、文件、章节" /></label>
      </div>
      <table className="tp-table tp-decomp">
        <thead><tr><th>编号</th><th>类别</th><th>要求</th><th>强度</th><th>风险</th><th>出处</th><th>负责 / 复核</th><th>截止</th></tr></thead>
        <tbody>
          {shown.map((it) => <DecompRow key={it.id} it={it} open={open === it.id} toggle={() => setOpen(open === it.id ? null : it.id)} />)}
          {!shown.length && <tr><td colSpan={8} className="tp-muted tp-pad">没有符合条件的要求</td></tr>}
        </tbody>
      </table>
      <div className="tp-pager">
        <span className="tp-muted">共 {rows.length} 条</span>
        <button className="tp-btn" disabled={page === 0} onClick={() => setPage(page - 1)}>上一页</button>
        <span>{page + 1} / {pages}</span>
        <button className="tp-btn" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>下一页</button>
      </div>
    </div>
  );
}

function DecompRow({ it, open, toggle }: { it: DecompItem; open: boolean; toggle: () => void }) {
  const top = it.risks.reduce<Severity | null>((m, x) => (!m || (x.severity === 'high') || (x.severity === 'medium' && m === 'low') ? x.severity : m), null);
  return (
    <>
      <tr className={'tp-row' + (open ? ' open' : '')} onClick={toggle}>
        <td className="tp-num tp-muted">{it.id}</td>
        <td><span className={'tp-cat c-' + it.category}>{CAT_LABEL[it.category]}</span></td>
        <td className="tp-req">
          {it.amended && <span className="tp-pill blue">已修订</span>}
          {it.fileRole === 'clarification' && <span className="tp-pill purple">澄清</span>}
          {it.title}
        </td>
        <td>{it.strength ? <span className={'tp-pill ' + (it.strength === 'prohibited' ? 'red' : it.strength === 'mandatory' ? 'dark' : 'gray')}>{STRENGTH_LABEL[it.strength]}</span> : <span className="tp-muted">–</span>}</td>
        <td>{top ? <span className={'tp-pill sev-' + top}>{SEV_LABEL[top]} · {it.risks.length}</span> : <span className="tp-muted">–</span>}</td>
        <td className="tp-src" title={`${it.fileName} · ${it.section}`}>{it.fileName}<span>第 {it.page} 页 · {it.section}</span></td>
        <td className="tp-owner">{it.owner}<span>{it.reviewer}</span></td>
        <td className="tp-num">{it.dueDate?.slice(5) || <span className="tp-muted">–</span>}</td>
      </tr>
      {open && (
        <tr className="tp-detail"><td /><td colSpan={7}>
          <p>{it.text}</p>
          {it.risks.map((x) => <div key={x.label} className={'tp-risk sev-' + x.severity}><AlertTriangle size={12} /><b>{x.label}</b>{x.advice}</div>)}
          <div className="tp-muted tp-small">分类得分 {it.score} · 来源文件角色：{ROLE_LABEL[it.fileRole]}</div>
        </td></tr>
      )}
    </>
  );
}

function exportCsv(r: TenderParseResult) {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['编号', '类别', '要求', '原文', '强度', '风险', '处理建议', '文件', '文件角色', '章节', '页', '负责', '复核', '截止', '已修订'];
  const lines = r.items.map((it) => [
    it.id, CAT_LABEL[it.category], it.title, it.text, it.strength ? STRENGTH_LABEL[it.strength] : '',
    it.risks.map((x) => `${SEV_LABEL[x.severity]}·${x.label}`).join('；'), it.risks.map((x) => x.advice).join('；'),
    it.fileName, ROLE_LABEL[it.fileRole], it.section, it.page, it.owner, it.reviewer, it.dueDate || '', it.amended ? '是' : '',
  ].map(esc).join(','));
  const blob = new Blob(['﻿' + [head.map(esc).join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `拆标分解表_${r.packageName}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ======================= 解析记录 =======================
function Runs({ api, open }: { api: Api; open: (r: TenderParseResult) => void }) {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => { api('/tender/runs').then(setRows).catch(() => setRows([])); }, []);
  return (
    <div className="tp-card tp-runs">
      <div className="tp-card-head"><History size={14} /><b>解析记录</b><span className="tp-muted">最近 50 次</span></div>
      <table className="tp-table">
        <thead><tr><th>整包</th><th>时间</th><th>规则</th><th>文件 / 页</th><th>要求</th><th>高风险</th><th>操作人</th><th /></tr></thead>
        <tbody>
          {(rows || []).map((x) => (
            <tr key={x.id}>
              <td>{x.packageName}</td><td className="tp-num">{x.createdAt.slice(0, 16).replace('T', ' ')}</td><td>v{x.ruleVersion}</td>
              <td className="tp-num">{x.stats.files} / {x.stats.pages}</td><td className="tp-num">{x.stats.items}</td><td className="tp-num">{x.stats.risks.high}</td><td>{x.by}</td>
              <td><button className="tp-link" onClick={() => api('/tender/runs/' + x.id).then(open)}>查看<ChevronRight size={12} /></button></td>
            </tr>
          ))}
          {rows && !rows.length && <tr><td colSpan={8} className="tp-muted tp-pad">还没有解析记录</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// ======================= 规则配置 =======================
type GroupKey = 'fileRoles' | 'headings' | 'categories' | 'mandatory' | 'fields' | 'risks' | 'owners' | 'options';
const GROUPS: { key: GroupKey; label: string; step: string; hint: string }[] = [
  { key: 'fileRoles', label: '文件角色识别', step: '第 2 步', hint: '文件名正则命中 +3 分、前两页关键词命中 +1 分，取最高分的角色。效力顺序决定同一字段多文件取值时以谁为准；「拆条款」关掉的角色只登记不拆。' },
  { key: 'headings', label: '章节标题', step: '第 3 步', hint: '一行文字（≤120 字）命中任一正则就当作章节标题，后面的条款都挂在这个章节下。修订文件里引用的条款号也靠这里切出来的章节编号来定位。' },
  { key: 'categories', label: '拆标分类', step: '第 4 步', hint: '条款原文每命中一个关键词 +1（同一词最多计 3 次），所在章节标题命中再 +1，乘以权重后取得分最高的类别。英文关键词自动加左词界，支持 non-?compliance 这类正则简写。' },
  { key: 'mandatory', label: '强制项判定', step: '第 4 步', hint: '条款命中多条时取最强的：禁止 / 否决 > 强制 > 建议。只有强制或禁止、且分类得分达到下限的条款才进分解表（带风险的条款无条件进）。' },
  { key: 'fields', label: '关键字段', step: '第 5 步', hint: '正则的第 1 个捕获组是取值。数字类字段会统一单位（GWh 折成 MWh），日期统一成年-月-日。打开「查矛盾」后，多文件取值不一致会标「待核对」，修订 / 澄清文件给出的新值会标「已被修订」。' },
  { key: 'risks', label: '风险提示', step: '第 4 步', hint: '命中即在分解表里挂风险标签和处理建议，并按风险等级排序优先保留。' },
  { key: 'owners', label: '责任分工', step: '第 5 步', hint: '每一类要求默认的负责角色、复核角色，以及在投标截止日前多少天完成（倒排）。' },
  { key: 'options', label: '解析参数', step: '全局', hint: '扫描件判定、读取页数上限、条款长度与进表门槛。' },
];
const ROLE_OPTIONS = Object.entries(ROLE_LABEL) as [FileRole, string][];
const TEAM_ROLES = ['SLS', 'PM', 'SC', 'QA', 'AMD', 'BSD'];

function regexError(src: string): string | null { try { new RegExp(src, 'iu'); return null; } catch (e) { return (e as Error).message; } }
const newId = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}`;

function RuleConfig({ api }: { api: Api }) {
  const [saved, setSaved] = useState<TenderRuleSet | null>(null);
  const [draft, setDraft] = useState<TenderRuleSet | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [group, setGroup] = useState<GroupKey>('fileRoles');
  const [msg, setMsg] = useState<{ tone: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<{ version: number; updatedAt: string; updatedBy: string }[] | null>(null);
  const [testOpen, setTestOpen] = useState(false);

  const load = () => api('/tender/rules').then((j) => { setSaved(j.rules); setDraft(structuredClone(j.rules)); setCanEdit(j.canEdit); });
  useEffect(() => { load().catch((e) => setMsg({ tone: 'red', text: e.message })); }, []);
  const dirty = useMemo(() => !!saved && !!draft && JSON.stringify(saved) !== JSON.stringify(draft), [saved, draft]);
  const invalid = useMemo(() => {
    if (!draft) return 0;
    const pats = [...draft.fileRoles.flatMap((r) => r.namePatterns), ...draft.headings.map((h) => h.pattern), ...draft.mandatory.map((m) => m.pattern), ...draft.fields.map((f) => f.pattern), ...draft.risks.map((r) => r.pattern)];
    return pats.filter((p) => regexError(p)).length;
  }, [draft]);
  if (!draft || !saved) return <div className="tp-card tp-pad">{msg ? msg.text : '正在读取规则…'}</div>;

  const set = <K extends keyof TenderRuleSet>(k: K, v: TenderRuleSet[K]) => setDraft({ ...draft, [k]: v });
  const flash = (tone: string, text: string) => { setMsg({ tone, text }); setTimeout(() => setMsg(null), 5000); };
  async function save() {
    setBusy(true);
    try { const r = await api('/tender/rules', { method: 'PUT', body: draft }); setSaved(r); setDraft(structuredClone(r)); flash('green', `已保存为 v${r.version}，下次解析生效`); }
    catch (e) { flash('red', (e as Error).message); } finally { setBusy(false); }
  }
  async function reset() {
    if (!confirm('恢复出厂规则？当前规则会留在历史版本里，可以再回滚。')) return;
    setBusy(true);
    try { const r = await api('/tender/rules/reset', { method: 'POST', body: {} }); setSaved(r); setDraft(structuredClone(r)); flash('green', `已恢复默认（v${r.version}）`); }
    catch (e) { flash('red', (e as Error).message); } finally { setBusy(false); }
  }
  async function restore(version: number) {
    setBusy(true);
    try { const r = await api('/tender/rules/restore', { method: 'POST', body: { version } }); setSaved(r); setDraft(structuredClone(r)); setHistory(null); flash('green', `已回滚到 v${version} 的内容，保存为 v${r.version}`); }
    catch (e) { flash('red', (e as Error).message); } finally { setBusy(false); }
  }
  const g = GROUPS.find((x) => x.key === group)!;
  const count = (k: GroupKey) => (k === 'options' ? 5 : (draft[k] as unknown[]).length);

  return (
    <div className="tp-rules">
      <div className="tp-card tp-rulebar">
        <b>规则 v{saved.version}</b>
        <span className="tp-muted">{saved.updatedBy} · {saved.updatedAt.slice(0, 16).replace('T', ' ')}</span>
        {dirty && <span className="tp-pill orange">有未保存的修改</span>}
        {invalid > 0 && <span className="tp-pill red">{invalid} 条正则无效</span>}
        {!canEdit && <span className="tp-pill gray">只读：主管或管理员才能保存</span>}
        <span className="tp-grow" />
        {msg && <span className={'tp-msg tone-' + msg.tone}>{msg.text}</span>}
        <button className="tp-btn" onClick={() => setTestOpen(!testOpen)}><FlaskConical size={13} />试跑</button>
        <div className="tp-dropdown">
          <button className="tp-btn" onClick={() => (history ? setHistory(null) : api('/tender/rules/history').then(setHistory))}><History size={13} />历史版本</button>
          {history && (
            <div className="tp-menu">
              {history.map((h) => (
                <button key={h.version} disabled={!canEdit || h.version === saved.version || busy} onClick={() => restore(h.version)}>
                  <b>v{h.version}</b><span>{h.updatedBy}</span><span className="tp-muted">{h.updatedAt.slice(5, 16).replace('T', ' ')}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="tp-btn" disabled={!dirty || busy} onClick={() => setDraft(structuredClone(saved))}><X size={13} />放弃修改</button>
        <button className="tp-btn" disabled={!canEdit || busy} onClick={reset}><RotateCcw size={13} />恢复默认</button>
        <button className="tp-btn primary" disabled={!canEdit || !dirty || busy || invalid > 0} onClick={save}>{busy ? <Loader2 size={13} className="tp-spin" /> : <Save size={13} />}保存</button>
      </div>
      {testOpen && <RuleTester api={api} draft={draft} dirty={dirty} />}
      <div className="tp-rule-body">
        <nav className="tp-card tp-groups">
          {GROUPS.map((x) => (
            <button key={x.key} className={group === x.key ? 'on' : ''} onClick={() => setGroup(x.key)}>
              <span className="tp-grow">{x.label}</span><span className="tp-muted">{x.step}</span><i>{count(x.key)}</i>
            </button>
          ))}
        </nav>
        <section className="tp-card tp-group">
          <div className="tp-card-head"><b>{g.label}</b><span className="tp-muted">{g.step}</span></div>
          <p className="tp-hint">{g.hint}</p>
          <fieldset disabled={!canEdit} className="tp-fieldset">
            {group === 'fileRoles' && (
              <RuleList items={draft.fileRoles} onChange={(v) => set('fileRoles', v)} add={() => ({ id: newId('fr'), role: 'other' as FileRole, label: '新角色', namePatterns: [], contentKeywords: [], precedence: 30, extractClauses: true, enabled: true })}
                render={(r, up) => (<>
                  <Row label="名称"><input value={r.label} onChange={(e) => up({ label: e.target.value })} /></Row>
                  <Row label="角色"><select value={r.role} onChange={(e) => up({ role: e.target.value as FileRole })}>{ROLE_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Row>
                  <Row label="效力顺序"><input type="number" min={0} max={100} value={r.precedence} onChange={(e) => up({ precedence: Number(e.target.value) })} className="tp-narrow" /><label className="tp-check"><input type="checkbox" checked={r.extractClauses} onChange={(e) => up({ extractClauses: e.target.checked })} />拆条款</label></Row>
                  <Row label="文件名正则" wide><Tags values={r.namePatterns} onChange={(v) => up({ namePatterns: v })} regex /></Row>
                  <Row label="内容关键词" wide><Tags values={r.contentKeywords} onChange={(v) => up({ contentKeywords: v })} /></Row>
                </>)} />
            )}
            {group === 'headings' && (
              <RuleList items={draft.headings} onChange={(v) => set('headings', v)} add={() => ({ id: newId('h'), label: '新标题规则', pattern: '^\\s*', level: 2, enabled: true })}
                render={(r, up) => (<>
                  <Row label="名称"><input value={r.label} onChange={(e) => up({ label: e.target.value })} /></Row>
                  <Row label="层级"><select value={r.level} onChange={(e) => up({ level: Number(e.target.value) })}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} 级</option>)}</select></Row>
                  <Row label="正则" wide><Regex value={r.pattern} onChange={(v) => up({ pattern: v })} /></Row>
                </>)} />
            )}
            {group === 'categories' && (
              <RuleList items={draft.categories} onChange={(v) => set('categories', v)} add={() => ({ id: newId('c'), category: 'technical' as TenderCategory, label: '新分类词表', keywords: [], weight: 1, enabled: true })}
                render={(r, up) => (<>
                  <Row label="名称"><input value={r.label} onChange={(e) => up({ label: e.target.value })} /></Row>
                  <Row label="归入类别"><select value={r.category} onChange={(e) => up({ category: e.target.value as TenderCategory })}>{TENDER_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></Row>
                  <Row label="权重"><input type="number" step={0.1} min={0} max={10} value={r.weight} onChange={(e) => up({ weight: Number(e.target.value) })} className="tp-narrow" /></Row>
                  <Row label={`关键词 · ${r.keywords.length}`} wide><Tags values={r.keywords} onChange={(v) => up({ keywords: v })} /></Row>
                </>)} />
            )}
            {group === 'mandatory' && (
              <RuleList items={draft.mandatory} onChange={(v) => set('mandatory', v)} add={() => ({ id: newId('m'), label: '新强制项规则', pattern: '', strength: 'mandatory' as Strength, enabled: true })}
                render={(r, up) => (<>
                  <Row label="名称"><input value={r.label} onChange={(e) => up({ label: e.target.value })} /></Row>
                  <Row label="强度"><select value={r.strength} onChange={(e) => up({ strength: e.target.value as Strength })}>{Object.entries(STRENGTH_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Row>
                  <Row label="正则" wide><Regex value={r.pattern} onChange={(v) => up({ pattern: v })} /></Row>
                </>)} />
            )}
            {group === 'fields' && (
              <RuleList items={draft.fields} onChange={(v) => set('fields', v)} add={() => ({ id: newId('f'), key: 'new_field', label: '新字段', pattern: '(...)', normalize: 'text' as const, checkConflict: false, enabled: true })}
                render={(r, up) => (<>
                  <Row label="名称"><input value={r.label} onChange={(e) => up({ label: e.target.value })} /></Row>
                  <Row label="字段 key"><input value={r.key} onChange={(e) => up({ key: e.target.value })} className="tp-mono" /></Row>
                  <Row label="归一化"><select value={r.normalize} onChange={(e) => up({ normalize: e.target.value as 'number' | 'date' | 'text' })}><option value="number">数字</option><option value="date">日期</option><option value="text">文本</option></select><input value={r.unit || ''} onChange={(e) => up({ unit: e.target.value || undefined })} placeholder="单位" className="tp-narrow" /><label className="tp-check"><input type="checkbox" checked={r.checkConflict} onChange={(e) => up({ checkConflict: e.target.checked })} />查矛盾</label></Row>
                  <Row label="正则" wide><Regex value={r.pattern} onChange={(v) => up({ pattern: v })} /></Row>
                </>)} />
            )}
            {group === 'risks' && (
              <RuleList items={draft.risks} onChange={(v) => set('risks', v)} add={() => ({ id: newId('r'), label: '新风险', pattern: '', severity: 'medium' as Severity, category: 'commercial' as TenderCategory, advice: '', enabled: true })}
                render={(r, up) => (<>
                  <Row label="名称"><input value={r.label} onChange={(e) => up({ label: e.target.value })} /></Row>
                  <Row label="等级 / 类别"><select value={r.severity} onChange={(e) => up({ severity: e.target.value as Severity })}>{Object.entries(SEV_LABEL).map(([k, l]) => <option key={k} value={k}>{l}风险</option>)}</select><select value={r.category} onChange={(e) => up({ category: e.target.value as TenderCategory })}>{TENDER_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></Row>
                  <Row label="正则" wide><Regex value={r.pattern} onChange={(v) => up({ pattern: v })} /></Row>
                  <Row label="处理建议" wide><input value={r.advice} onChange={(e) => up({ advice: e.target.value })} /></Row>
                </>)} />
            )}
            {group === 'owners' && (
              <table className="tp-table tp-owners">
                <thead><tr><th>类别</th><th>负责角色</th><th>复核角色</th><th>截止前天数</th></tr></thead>
                <tbody>
                  {draft.owners.map((o, i) => {
                    const up = (p: Partial<typeof o>) => set('owners', draft.owners.map((x, j) => (j === i ? { ...x, ...p } : x)));
                    return (
                      <tr key={o.category}>
                        <td><span className={'tp-cat c-' + o.category}>{CAT_LABEL[o.category]}</span></td>
                        <td><select value={o.role} onChange={(e) => up({ role: e.target.value as typeof o.role })}>{TEAM_ROLES.map((r) => <option key={r}>{r}</option>)}</select></td>
                        <td><select value={o.reviewer} onChange={(e) => up({ reviewer: e.target.value as typeof o.role })}>{TEAM_ROLES.map((r) => <option key={r}>{r}</option>)}</select></td>
                        <td><input type="number" min={0} max={60} value={o.dueOffsetDays} onChange={(e) => up({ dueOffsetDays: Number(e.target.value) })} className="tp-narrow" /> 天</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {group === 'options' && (
              <div className="tp-options">
                {([
                  ['minCharsPerPage', '每页少于多少字算扫描页', '字'], ['maxPagesPerFile', '单文件最多读多少页', '页'],
                  ['clauseMinLength', '条款最短长度（更短的并到上一条）', '字'], ['clauseMaxLength', '条款最长长度（更长的按句切开）', '字'],
                  ['minCategoryScore', '强制项进分解表的分类得分下限', '分'],
                ] as const).map(([k, label, unit]) => (
                  <Row key={k} label={label}><input type="number" value={draft.options[k]} onChange={(e) => set('options', { ...draft.options, [k]: Number(e.target.value) })} className="tp-narrow" /><span className="tp-muted">{unit}</span></Row>
                ))}
              </div>
            )}
          </fieldset>
        </section>
      </div>
    </div>
  );
}

function RuleList<T extends { id: string; enabled: boolean }>({ items, onChange, add, render }: {
  items: T[]; onChange: (v: T[]) => void; add: () => T; render: (r: T, up: (p: Partial<T>) => void) => React.ReactNode;
}) {
  return (
    <div className="tp-rule-list">
      {items.map((r, i) => {
        const up = (p: Partial<T>) => onChange(items.map((x, j) => (j === i ? { ...x, ...p } : x)));
        return (
          <div key={r.id} className={'tp-rule' + (r.enabled ? '' : ' off')}>
            <div className="tp-rule-side">
              <label className="tp-switch" title={r.enabled ? '已启用' : '已停用'}><input type="checkbox" checked={r.enabled} onChange={(e) => up({ enabled: e.target.checked } as Partial<T>)} /><i /></label>
              <button className="tp-icon" title="删除" onClick={() => onChange(items.filter((_, j) => j !== i))}><Trash2 size={13} /></button>
            </div>
            <div className="tp-rule-grid">{render(r, up)}</div>
          </div>
        );
      })}
      <button className="tp-btn tp-add" onClick={() => onChange([...items, add()])}><Plus size={13} />新增规则</button>
    </div>
  );
}

const Row = ({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) => (
  <div className={'tp-row-f' + (wide ? ' wide' : '')}><span>{label}</span><div>{children}</div></div>
);

function Regex({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const err = regexError(value);
  return (
    <div className="tp-regex">
      <input className={'tp-mono' + (err ? ' bad' : '')} value={value} onChange={(e) => onChange(e.target.value)} spellCheck={false} />
      {err ? <span className="tone-red tp-small" title={err}>正则无效</span> : <Check size={13} className="tone-green" />}
    </div>
  );
}

function Tags({ values, onChange, regex }: { values: string[]; onChange: (v: string[]) => void; regex?: boolean }) {
  const [text, setText] = useState('');
  const commit = () => {
    const add = text.split(/[,，\n]/).map((s) => s.trim()).filter((s) => s && !values.includes(s));
    if (add.length) onChange([...values, ...add]);
    setText('');
  };
  return (
    <div className="tp-tags">
      {values.map((v) => (
        <span key={v} className={'tp-tag' + (regex && regexError(v) ? ' bad' : '')}>{v}<button onClick={() => onChange(values.filter((x) => x !== v))}><X size={10} /></button></span>
      ))}
      <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }} onBlur={commit} placeholder="输入后回车，逗号可批量" />
    </div>
  );
}

const SAMPLE_TEXT = `第三章 技术要求
3.1 储能系统额定容量 200MW/400MWh，往返效率不低于 88%，电芯循环寿命不少于 8000 次循环。
3.2 ★投标人必须提供 UL9540A 大规模燃烧测试报告，否则按无效投标处理。
Section 5 Commercial Terms
5.2 The Contractor shall pay liquidated damages at 0.5% per week, subject to a cap of 10% of the Contract Price.
5.3 Bidders must submit a Bid Security of INR 4,21,600 along with the bid. Conditional bids will be rejected.
第四章 投标须知
投标截止时间：2026年11月20日 10:00，投标有效期 90 日历天。`;

function RuleTester({ api, draft, dirty }: { api: Api; draft: TenderRuleSet; dirty: boolean }) {
  const [text, setText] = useState(SAMPLE_TEXT);
  const [res, setRes] = useState<{ clauses: RulePreviewClause[]; sections: string[] } | null>(null);
  const [err, setErr] = useState('');
  async function run() {
    setErr('');
    try { setRes(await api('/tender/rules/preview', { method: 'POST', body: { text, rules: draft } })); }
    catch (e) { setErr((e as Error).message); }
  }
  return (
    <div className="tp-card tp-tester">
      <div className="tp-card-head"><FlaskConical size={14} /><b>规则试跑</b><span className="tp-muted">{dirty ? '用页面上未保存的规则' : '用当前已保存的规则'}跑第 3–5 步，不落库</span></div>
      <div className="tp-tester-body">
        <div className="tp-tester-in">
          <textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
          <button className="tp-btn primary" onClick={run}><FlaskConical size={13} />运行</button>
          {err && <div className="tone-red tp-small">{err}</div>}
        </div>
        <div className="tp-tester-out">
          {!res && <p className="tp-muted">贴一段招标文件原文，点「运行」看每条条款被切成什么、命中了哪些规则。</p>}
          {res && <div className="tp-muted tp-small">识别到 {res.sections.length} 个章节、{res.clauses.length} 条条款</div>}
          {res?.clauses.map((c, i) => (
            <div key={i} className="tp-pv">
              <div className="tp-pv-tags">
                {c.category ? <span className={'tp-cat c-' + c.category}>{CAT_LABEL[c.category]} {c.score}</span> : <span className="tp-pill gray">未分类</span>}
                {c.strength && <span className={'tp-pill ' + (c.strength === 'prohibited' ? 'red' : c.strength === 'mandatory' ? 'dark' : 'gray')} title={c.mandatoryRule}>{STRENGTH_LABEL[c.strength]}</span>}
                {c.risks.map((r) => <span key={r} className="tp-pill sev-high">{r}</span>)}
                {c.fields.map((f) => <span key={f.label} className="tp-pill blue">{f.label}：{f.value}</span>)}
                <span className="tp-muted tp-small">{c.section}</span>
              </div>
              <div className="tp-pv-text">{c.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
