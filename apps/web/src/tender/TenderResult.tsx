import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronDown, ChevronRight, FileText, GitBranch, ListChecks, RotateCcw, Search, Sparkles, X } from "lucide-react";
import type { ClauseReview, DecompItem, ExcludedClause, FieldSummary, FileRole, JudgeSource, Severity, Strength, TenderCategory, TenderParseResult } from "../../../../packages/contracts/tender";
import { TENDER_CATEGORIES } from "../../../../packages/contracts/tender";
import "./tender.css";

/** 标书解析结果的展示件：投标「招标文件」Tab 与规则试跑共用。 */
export const CAT_LABEL = Object.fromEntries(TENDER_CATEGORIES.map((c) => [c.key, c.label])) as Record<TenderCategory, string>;
export const ROLE_LABEL: Record<FileRole, string> = {
  notice: '招标公告', itb: '招标正文', contract: '合同 / 协议', technical_spec: '技术规范', amendment: '修订 / 补遗',
  clarification: '澄清 / 答疑', boq: '报价清单', drawing: '图纸', form: '格式表单', integrity: '廉洁协议', result: '中标结果', reference: '参考资料', other: '其他',
};
export const STRENGTH_LABEL: Record<Strength, string> = { prohibited: '禁止 / 否决', mandatory: '强制', required: '一般要求', recommended: '建议' };
export const SEV_LABEL: Record<Severity, string> = { high: '高', medium: '中', low: '低' };
export const STATUS_LABEL: Record<string, string> = { ok: '已解析', partial_scanned: '部分无文字层', scanned: '扫描件', unsupported: '不支持', error: '读取失败' };
export const FIELD_STATUS: Record<FieldSummary['status'], [string, string]> = {
  single: ['单一来源', 'gray'], consistent: ['多处一致', 'green'], multiple: ['多个取值', 'gray'], overridden: ['已被修订', 'blue'], conflict: ['待核对', 'orange'],
};
export const fmtSize = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
export const SOURCE_LABEL: Record<JudgeSource, string> = { model: '模型', rule: '规则', mock: '测试判断', human: '人工' };
/** 提交一条人工结论；不传时分解表只读。 */
export type ReviewFn = (clauseKey: string, body: ClauseReview) => Promise<void>;

/** 条款详情里的复核表单：确认、改类别和强度、排除。 */
function ReviewForm({ it, onReview }: { it: DecompItem; onReview: ReviewFn }) {
  const [category, setCategory] = useState<TenderCategory>(it.category);
  const [strength, setStrength] = useState<Strength | ''>(it.strength || '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const changed = category !== it.category || strength !== (it.strength || '');
  const submit = async (isRequirement: boolean) => {
    setBusy(true);
    try { await onReview(it.clauseKey!, { isRequirement, category: isRequirement ? category : undefined, strength: isRequirement && strength ? strength : undefined, note: note.trim() || undefined }); }
    finally { setBusy(false); }
  };
  return (
    <div className="tp-review-form" onClick={(e) => e.stopPropagation()}>
      <select value={category} onChange={(e) => setCategory(e.target.value as TenderCategory)} aria-label="类别">{TENDER_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select>
      <select value={strength} onChange={(e) => setStrength(e.target.value as Strength | '')} aria-label="强度"><option value="">无强度</option>{Object.entries(STRENGTH_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="说明（可选）" maxLength={300} />
      <button type="button" className="tp-btn primary" disabled={busy} onClick={() => void submit(true)}><Check size={12} />{changed ? '保存改判' : '确认无误'}</button>
      <button type="button" className="tp-btn" disabled={busy} onClick={() => void submit(false)}><X size={12} />不是要求</button>
    </div>
  );
}

/** 没进分解表的条款：看看漏了什么，有用的捞回来。 */
export function ExcludedCard({ rows, onReview }: { rows: ExcludedClause[]; onReview?: ReviewFn }) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [q]);
  const hit = useMemo(() => rows.filter((e) => !q || (e.text + e.fileName + e.section + e.reason).toLowerCase().includes(q.toLowerCase())), [rows, q]);
  const PAGE = 20;
  const pages = Math.max(1, Math.ceil(hit.length / PAGE));
  return (
    <div className="tp-card">
      <div className="tp-filters"><span className="tp-muted">这些条款没有进分解表，可以核对后捞回</span><label className="tp-search"><Search size={13} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜条款原文、文件、原因" /></label></div>
      <table className="tp-table tp-decomp">
        <thead><tr><th>条款原文</th><th>没进表的原因</th><th>出处</th>{onReview && <th />}</tr></thead>
        <tbody>
          {hit.slice(page * PAGE, page * PAGE + PAGE).map((e) => (
            <tr key={e.clauseKey}>
              <td className="tp-req">{e.text}</td>
              <td className="tp-small">{e.reason}</td>
              <td className="tp-src" title={`${e.fileName} · ${e.section}`}>{e.fileName}<span>第 {e.page} 页 · {e.section}</span></td>
              {onReview && <td><button type="button" className="tp-btn" onClick={() => void onReview(e.clauseKey, { isRequirement: true, category: e.ruleCategory || 'commercial', strength: e.ruleStrength })}><RotateCcw size={12} />捞回</button></td>}
            </tr>
          ))}
          {!hit.length && <tr><td colSpan={4} className="tp-muted tp-pad">没有符合条件的条款</td></tr>}
        </tbody>
      </table>
      <div className="tp-pager">
        <span className="tp-muted">共 {hit.length} 条</span>
        <button type="button" className="tp-btn" disabled={page === 0} onClick={() => setPage(page - 1)}>上一页</button>
        <span>{page + 1} / {pages}</span>
        <button type="button" className="tp-btn" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>下一页</button>
      </div>
    </div>
  );
}

/** 说清这次结果是谁判的：模型判了多少、排除多少、要人看多少；没过模型的明确写出来。 */
export function JudgeNote({ r }: { r: TenderParseResult }) {
  const j = r.judge;
  if (!j || j.mode === 'rule') return <div className="tp-alert orange"><AlertTriangle size={13} /><div>本次结果未经模型复核，类别和强度只来自关键词规则。配置模型后重新解析即可启用模型判断。</div></div>;
  return (
    <div className="tp-alert blue"><Sparkles size={13} /><div>
      {SOURCE_LABEL[j.mode]}{j.model ? `（${j.model}）` : ''}判断了 {j.candidates} 条候选，排除 {j.excluded} 条非要求，<b>{j.needsReview} 条待确认</b>。
      {j.cached > 0 && ` ${j.cached} 条沿用之前的判断。`}
      {j.unverified > 0 && ` ${j.unverified} 条模型未复核，用的是规则结果。`}
      {j.failedBatches > 0 && ` ${j.failedBatches} 批调用失败。`}
    </div></div>
  );
}

export const Kpi = ({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) => (
  <div className="tp-kpi"><span>{label}</span><b className={tone ? 'tone-' + tone : ''}>{value}</b></div>
);
export const FlowStep = ({ n, label, detail, last }: { n: number; label: string; detail: string; last?: boolean }) => (
  <>
    <div className="tp-flow-step"><i>{n}</i><div><b>{label}</b><span>{detail}</span></div></div>
    {!last && <ChevronRight size={14} className="tp-flow-arrow" />}
  </>
);

export function FilesCard({ r }: { r: TenderParseResult }) {
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

export function FieldsCard({ fields }: { fields: FieldSummary[] }) {
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

export function OverridesCard({ r }: { r: TenderParseResult }) {
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

export function DecompCard({ r, onReview }: { r: TenderParseResult; onReview?: ReviewFn }) {
  const [cat, setCat] = useState<TenderCategory | 'all'>('all');
  const [only, setOnly] = useState<'all' | 'strong' | 'risk' | 'amended' | 'review'>('all');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { setPage(0); }, [cat, only, q, r.id]);
  const rows = useMemo(() => r.items.filter((it) =>
    (cat === 'all' || it.category === cat)
    && (only === 'all' || (only === 'strong' && (it.strength === 'mandatory' || it.strength === 'prohibited')) || (only === 'risk' && it.risks.length > 0) || (only === 'amended' && it.amended) || (only === 'review' && it.needsReview))
    && (!q || (it.text + (it.summary || '') + it.fileName + it.section).toLowerCase().includes(q.toLowerCase()))), [r, cat, only, q]);
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
          <option value="all">全部要求</option><option value="strong">只看强制 / 否决</option><option value="risk">只看有风险</option><option value="amended">只看被修订章节</option><option value="review">只看待确认</option>
        </select>
        <label className="tp-search"><Search size={13} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜条款原文、摘要、文件、章节" /></label>
      </div>
      <table className="tp-table tp-decomp">
        <thead><tr><th>编号</th><th>类别</th><th>要求</th><th>强度</th><th>风险</th><th>出处</th><th>负责 / 复核</th><th>截止</th></tr></thead>
        <tbody>
          {shown.map((it) => <DecompRow key={it.id} it={it} open={open === it.id} toggle={() => setOpen(open === it.id ? null : it.id)} onReview={onReview} />)}
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

export function DecompRow({ it, open, toggle, onReview }: { it: DecompItem; open: boolean; toggle: () => void; onReview?: ReviewFn }) {
  const top = it.risks.reduce<Severity | null>((m, x) => (!m || (x.severity === 'high') || (x.severity === 'medium' && m === 'low') ? x.severity : m), null);
  return (
    <>
      <tr className={'tp-row' + (open ? ' open' : '')} onClick={toggle}>
        <td className="tp-num tp-muted">{it.id}</td>
        <td><span className={'tp-cat c-' + it.category}>{CAT_LABEL[it.category]}</span></td>
        <td className="tp-req">
          {it.amended && <span className="tp-pill blue">已修订</span>}
          {it.fileRole === 'clarification' && <span className="tp-pill purple">澄清</span>}
          {it.needsReview && <span className="tp-pill orange" title={it.reviewReasons?.join('；')}>待确认</span>}
          {it.source === 'human' && <span className="tp-pill green">已复核</span>}
          {it.summary || it.title}
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
          {!!it.reviewReasons?.length && <div className="tp-review"><AlertTriangle size={12} /><b>待确认</b>{it.reviewReasons.join('；')}</div>}
          {it.quote && <div className="tp-evidence"><b>依据原文</b>{it.quote}</div>}
          {it.reason && <div className="tp-evidence"><b>判断理由</b>{it.reason}</div>}
          {it.risks.map((x) => <div key={x.label} className={'tp-risk sev-' + x.severity}><AlertTriangle size={12} /><b>{x.label}</b>{x.advice}</div>)}
          <div className="tp-muted tp-small">
            结论来源：{SOURCE_LABEL[it.source || 'rule']}{it.confidence !== undefined ? ` · 置信度 ${it.confidence}` : ''}
            {it.source !== 'rule' && it.ruleCategory && it.ruleCategory !== it.category ? ` · 规则判为${CAT_LABEL[it.ruleCategory]}` : ''}
            {it.source !== 'rule' && it.ruleStrength && it.ruleStrength !== it.strength ? ` · 规则判为${STRENGTH_LABEL[it.ruleStrength]}` : ''}
            {' '}· 分类得分 {it.score} · 来源文件角色：{ROLE_LABEL[it.fileRole]}
          </div>
          {onReview && it.clauseKey && <ReviewForm key={`${it.category}-${it.strength}`} it={it} onReview={onReview} />}
        </td></tr>
      )}
    </>
  );
}

export function exportCsv(r: TenderParseResult) {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['编号', '类别', '要求', '原文', '判断依据', '待确认', '结论来源', '强度', '风险', '处理建议', '文件', '文件角色', '章节', '页', '负责', '复核', '截止', '已修订'];
  const lines = r.items.map((it) => [
    it.id, CAT_LABEL[it.category], it.summary || it.title, it.text, it.quote || '', it.reviewReasons?.join('；') || '', SOURCE_LABEL[it.source || 'rule'], it.strength ? STRENGTH_LABEL[it.strength] : '',
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
