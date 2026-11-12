import React, { useEffect, useState } from "react";
import { AlertCircle, AlertTriangle, Check, CheckCircle2, ChevronLeft, FileText, Loader2, RotateCcw, ShieldAlert, Sparkles, UserCheck, X, Zap } from "lucide-react";
import "./evolve.css";

/** 标书解析规则页的自进化三块：改进建议（含回放报告）、改进库、历史版本。布局和配色按 Pencil 原型 R1–R4。 */
type Api = (path: string, options?: Record<string, unknown>) => Promise<any>;
type Metrics = { total: number; requirementAcc: number; categoryAcc: number; vetoRecall: number | null; strongRecall: number | null; strongFalse: number; agreement: number };
type Replay = { at: string; base: number; before: Metrics; after: Metrics; passed: boolean; gates: { label: string; ok: boolean; detail: string }[]; changed: { text: string; before: string; after: string; gold: string }[]; durationMs: number };
type Example = { text: string; isRequirement: boolean; category?: string; strength?: string; note?: string };
export type Suggestion = {
  id: string; no: number; kind: 'examples' | 'policy' | 'veto'; title: string; detail: string; change: { policies?: string[]; examples?: Example[] };
  basis: string[]; status: 'draft' | 'blocked' | 'published' | 'rejected'; replay?: Replay; createdAt: string; createdBy: string; decidedBy?: string; decidedAt?: string; publishedVersion?: number; rejectNote?: string;
};
type LibRow = { id: string; at: string; bid: string; text: string; machine: string; human: string; note: string; by: string; status: 'conflict' | 'example' | 'suggested' | 'unused' | 'confirmed'; suggestion: number | null };
type Lib = { rows: LibRow[]; stats: { total: number; changed: number; examples: number; suggested: number; conflicts: number; unused: number; bids: number; reviewers: number } };
type Version = {
  version: number; updatedAt: string; updatedBy: string; changeNote: string; policies: number; examples: number; policyList: string[]; batchSize?: number; concurrency?: number; minConfidence?: number;
  source: 'auto' | 'suggestion' | 'rollback' | 'default' | 'manual'; replay: string; changed: number; items: number; rate: number | null;
};

const KIND: Record<Suggestion['kind'], [string, string]> = { examples: ['新增示例', 'blue'], policy: ['公司口径', 'purple'], veto: ['放宽否决', 'red'] };
const SOURCE: Record<Version['source'], [string, string]> = { auto: ['自动生效', 'green'], suggestion: ['改进建议审批', 'purple'], rollback: ['回滚', 'orange'], default: ['系统默认', 'gray'], manual: ['人工编辑', 'gray'] };
const at = (s?: string) => (s ? s.slice(5, 16).replace('T', ' ') : '');
const signed = (n: number, unit: string) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(Math.round(n * 10) / 10)}${unit}`;
const fmt = (v: number | null, u: string) => (v === null ? '—' : `${v}${u}`);
/** 回放一行摘要：只挑有变化或最关键的几项 */
function replayLine(r: Replay) {
  const parts: string[] = [];
  if (r.after.strongFalse !== r.before.strongFalse) parts.push(`强制误判 ${signed(r.after.strongFalse - r.before.strongFalse, ' 条')}`);
  if (r.before.vetoRecall !== null) parts.push(`否决召回 ${r.before.vetoRecall}%${r.after.vetoRecall === r.before.vetoRecall ? ' 不变' : ` → ${r.after.vetoRecall}%`}`);
  if (r.before.strongRecall !== null) parts.push(`强制召回 ${r.before.strongRecall}%${r.after.strongRecall === r.before.strongRecall ? ' 不变' : ` → ${r.after.strongRecall}%`}`);
  parts.push(`类别准确率 ${r.before.categoryAcc}% → ${r.after.categoryAcc}%`);
  parts.push(`与人工一致 ${r.before.agreement}% → ${r.after.agreement}%`);
  return parts.join(' · ');
}

function Kpi({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: string }) {
  return <div className={'ev-kpi' + (tone ? ' is-' + tone : '')}><span>{label}</span><b>{value}</b>{hint && <small>{hint}</small>}</div>;
}
const Tag = ({ tone, children }: { tone: string; children: React.ReactNode }) => <span className={'ev-tag is-' + tone}>{children}</span>;

function useAction(load: () => Promise<unknown>, onChanged: () => void) {
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ tone: string; text: string } | null>(null);
  const run = async (key: string, f: () => Promise<unknown>, ok: (r: any) => string) => {
    setBusy(key); setMsg(null);
    try { const r = await f(); await load(); onChanged(); setMsg({ tone: 'green', text: ok(r) }); }
    catch (e) { setMsg({ tone: 'red', text: (e as Error).message }); } finally { setBusy(''); }
  };
  return { busy, msg, setMsg, run };
}

// ======================= R1 改进建议 =======================
export function SuggestionsPanel({ api, canEdit, version, onChanged }: { api: Api; canEdit: boolean; version: number; onChanged: () => void }) {
  const [list, setList] = useState<Suggestion[] | null>(null);
  const [lib, setLib] = useState<Lib | null>(null);
  const [vers, setVers] = useState<Version[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const load = () => Promise.all([api('/tender/evolve/suggestions').then(setList), api('/tender/evolve/library').then(setLib), api('/tender/evolve/versions').then(setVers)]);
  const { busy, msg, setMsg, run } = useAction(load, onChanged);
  useEffect(() => { load().catch((e) => setMsg({ tone: 'red', text: e.message })); }, []);
  if (!list || !lib) return <div className="ev-card ev-pad">{msg?.text || '正在读取…'}</div>;
  const replayIt = (s: Suggestion) => run(s.id + 'v', () => api(`/tender/evolve/suggestions/${s.id}/replay`, { method: 'POST', body: {} }), (x) => (x.status === 'published' ? `回放通过，示例已自动生效（v${x.publishedVersion}）` : x.status === 'blocked' ? '回放没通过，已拦截' : '回放通过，等主管审批发布'));
  const publishIt = (s: Suggestion) => run(s.id + 'p', () => api(`/tender/evolve/suggestions/${s.id}/publish`, { method: 'POST', body: {} }), (x) => `已发布为 v${x.publishedVersion}，下次解析生效`);
  const rejectIt = (s: Suggestion) => run(s.id + 'r', () => api(`/tender/evolve/suggestions/${s.id}/reject`, { method: 'POST', body: {} }), () => '已驳回');
  const detail = open ? list.find((s) => s.id === open) : null;
  if (detail) return <ReplayDetail s={detail} lib={lib} version={version} canEdit={canEdit} busy={busy} msg={msg} onBack={() => setOpen(null)} onPublish={() => publishIt(detail)} onReject={() => rejectIt(detail)} />;
  const active = list.filter((s) => s.status === 'draft' || s.status === 'blocked');
  const autoExamples = list.filter((s) => s.kind === 'examples' && s.status === 'published');
  const rated = vers.filter((v) => v.rate !== null);
  const [now, before] = [rated[0], rated[1]];
  return (
    <div className="ev-page">
      <div className="ev-kpis">
        <Kpi label="改进库" value={`${lib.stats.changed} 条改判`} hint={`来自 ${lib.stats.bids} 个投标，主管复核`} />
        <Kpi label="自动生效" value={`${autoExamples.reduce((n, s) => n + (s.change.examples?.length || 0), 0)} 条示例`} hint="验证通过即上线" />
        <Kpi label="待审批" value={`${active.length} 条建议`} hint="口径 / 规则修改" tone={active.length ? 'orange' : undefined} />
        <Kpi label="上线后改判率" value={now ? (before ? `${before.rate}% → ${now.rate}%` : `${now.rate}%`) : '—'} hint={now && before ? `v${before.version} → v${now.version}，${(now.rate || 0) <= (before.rate || 0) ? '下降' : '上升'} ${Math.abs(Math.round(((before.rate || 0) - (now.rate || 0)) * 10) / 10)} 个点` : '复核记录够了才能统计'} tone={now && before ? ((now.rate || 0) <= (before.rate || 0) ? 'green' : 'red') : undefined} />
      </div>
      <div className="ev-split">
        <div className="ev-col">
          {msg && <div className={'ev-msg is-' + msg.tone}>{msg.text}</div>}
          {!active.length && (
            <div className="ev-card ev-empty">
              <p>没有待处理的建议。</p>
              <p className="ev-muted">{lib.stats.unused ? `改进库里有 ${lib.stats.unused} 条改判还没用上。` : '在投标的「标书拆解」里改判后，改判会进入改进库。'}</p>
              <button className="ev-btn primary" disabled={!canEdit || !!busy || !lib.stats.unused} onClick={() => run('gen', () => api('/tender/evolve/suggestions/generate', { method: 'POST', body: {} }), (r) => `生成了 ${r.length} 条建议，回放验证后发布`)}>
                {busy === 'gen' ? <Loader2 size={13} className="ev-spin" /> : <Sparkles size={13} />}根据改判生成改进建议
              </button>
            </div>
          )}
          {active.map((s) => {
            const r = s.replay;
            return (
              <section key={s.id} className={'ev-card ev-sug' + (s.status === 'blocked' ? ' is-blocked' : '')}>
                <header>
                  <Tag tone={KIND[s.kind][1]}>{KIND[s.kind][0]}</Tag>
                  <b>{s.title}</b>
                  <span className="ev-grow" />
                  {!r ? <Tag tone="gray">待回放</Tag> : r.passed ? <Tag tone="green">回放 通过</Tag> : <Tag tone="red">回放 已拦截</Tag>}
                </header>
                <p className="ev-detail">{s.kind === 'policy' ? `把这条口径写进判断提示词：${s.detail}` : s.detail}</p>
                <div className="ev-basis">
                  <div><FileText size={12} />依据 {s.basis.length} 条改判 · {s.createdBy} · {at(s.createdAt)}{s.change.examples?.length ? ` · 新增示例 ${s.change.examples.length} 条` : ''}</div>
                  {r && <div className={r.passed ? 'is-green' : 'is-red'}>{r.passed ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}{r.passed ? replayLine(r) : r.gates.filter((g) => !g.ok).map((g) => `${g.label.replace(/不下降|下降不超过 1 个点/, '')} ${g.detail}（标注集被拦截）`).join(' · ')}</div>}
                </div>
                <footer>
                  {r && <button className="ev-btn" onClick={() => setOpen(s.id)}><FileText size={13} />查看回放报告</button>}
                  {(!r || r.base !== version) && <button className="ev-btn" disabled={!canEdit || !!busy} onClick={() => replayIt(s)}>{busy === s.id + 'v' ? <Loader2 size={13} className="ev-spin" /> : <RotateCcw size={13} />}{r ? '规则已更新，重新回放' : '回放验证'}</button>}
                  <button className="ev-btn danger" disabled={!canEdit || !!busy} onClick={() => rejectIt(s)}><X size={13} />驳回</button>
                  {s.kind !== 'examples' && r?.passed && r.base === version && <button className="ev-btn primary" disabled={!canEdit || !!busy} onClick={() => publishIt(s)}><Check size={13} />通过并发布 v{version + 1}</button>}
                </footer>
              </section>
            );
          })}
        </div>
        <aside className="ev-side">
          <section className="ev-card ev-pad">
            <h4>怎么上线</h4>
            <div className="ev-how"><Zap size={14} className="is-green" /><div><b>新增示例</b><small>回放不退步即自动生效</small></div></div>
            <div className="ev-how"><UserCheck size={14} className="is-blue" /><div><b>口径 / 规则修改</b><small>回放通过后由主管审批</small></div></div>
            <div className="ev-how"><ShieldAlert size={14} className="is-red" /><div><b>放宽否决</b><small>始终人工确认，回放退步直接拦截</small></div></div>
            <p className="ev-note">回放用改进库里 {lib.stats.total - lib.stats.conflicts} 条无冲突的人工结论当标准答案；否决、强制召回下降即不通过。</p>
          </section>
          <section className="ev-card ev-pad">
            <h4>最近自动生效的示例</h4>
            {!autoExamples.length && <p className="ev-note">还没有</p>}
            {autoExamples.slice(0, 3).flatMap((s) => (s.change.examples || []).slice(0, 2).map((e, i) => (
              <div key={s.id + i} className="ev-recent"><b>{e.text.slice(0, 40)} → {e.isRequirement ? `${e.category ? { technical: '技术', delivery: '交付', price: '价格', commercial: '商务', deviation: '偏差' }[e.category] : ''} · ${e.strength ? { prohibited: '否决', mandatory: '强制', required: '一般要求', recommended: '建议' }[e.strength] : ''}` : '不是要求'}</b><small>{at(s.decidedAt)} · v{s.publishedVersion}</small></div>
            )))}
            <p className="ev-note is-link"><RotateCcw size={12} />任一版本都可在「历史版本」回滚</p>
          </section>
        </aside>
      </div>
    </div>
  );
}

// ======================= R2 回放验证报告 =======================
function ReplayDetail({ s, lib, version, canEdit, busy, msg, onBack, onPublish, onReject }: { s: Suggestion; lib: Lib; version: number; canEdit: boolean; busy: string; msg: { tone: string; text: string } | null; onBack: () => void; onPublish: () => void; onReject: () => void }) {
  const r = s.replay!;
  const basis = lib.rows.filter((x) => s.basis.includes(x.id));
  const next = r.base + 1;
  const rows: [string, number | null, number | null, string, string, boolean][] = [
    ['否决召回', r.before.vetoRecall, r.after.vetoRecall, '%', '不得下降', false],
    ['强制召回', r.before.strongRecall, r.after.strongRecall, '%', '不得下降', false],
    ['强制误判（把一般要求判成强制）', r.before.strongFalse, r.after.strongFalse, ' 条', '越少越好', true],
    ['是否要求准确率', r.before.requirementAcc, r.after.requirementAcc, '%', '不得下降超过 1 个点', false],
    ['类别准确率', r.before.categoryAcc, r.after.categoryAcc, '%', '不得下降超过 1 个点', false],
    ['与人工结论完全一致', r.before.agreement, r.after.agreement, '%', '—', false],
  ];
  const fixed = r.changed.filter((c) => c.after === c.gold).length;
  const still = r.changed.length - fixed;
  return (
    <div className="ev-page">
      <div className="ev-card ev-head">
        <button className="ev-icon" onClick={onBack} aria-label="返回"><ChevronLeft size={16} /></button>
        <div className="ev-head-main">
          <div><Tag tone={KIND[s.kind][1]}>{KIND[s.kind][0]}</Tag><b>{s.title}</b>{r.passed ? <Tag tone="green">回放通过</Tag> : <Tag tone="red">回放已拦截</Tag>}</div>
          {r.base !== version && <small className="is-red">回放后规则已更新到 v{version}，建议回到列表重新回放再发布</small>}
          <small>回放数据：标准答案 {r.after.total} 条（改进库里无冲突的人工结论） · 对比 v{r.base}（回放时的当前版本）与应用本建议后 · 用时 {Math.floor(r.durationMs / 60000) ? `${Math.floor(r.durationMs / 60000)} 分 ` : ''}{Math.round((r.durationMs % 60000) / 1000)} 秒</small>
        </div>
        <span className="ev-grow" />
        {msg && <span className={'ev-msg is-' + msg.tone}>{msg.text}</span>}
        {s.status !== 'published' && s.status !== 'rejected' && <>
          <button className="ev-btn danger" disabled={!canEdit || !!busy} onClick={onReject}><X size={13} />驳回</button>
          {s.kind !== 'examples' && r.passed && r.base === version && <button className="ev-btn primary" disabled={!canEdit || !!busy} onClick={onPublish}><Check size={13} />通过并发布 v{version + 1}</button>}
        </>}
      </div>
      <div className="ev-split">
        <div className="ev-col">
          <section className="ev-card">
            <h4 className="ev-pad">指标对比</h4>
            <table className="ev-table">
              <thead><tr><th>指标</th><th>v{r.base} 当前</th><th>v{next} 应用后</th><th>变化</th><th>门槛</th></tr></thead>
              <tbody>{rows.map(([l, a, b, u, gate, lowerBetter]) => {
                const d = a === null || b === null ? null : b - a;
                const good = d !== null && d !== 0 && (lowerBetter ? d < 0 : d > 0);
                return <tr key={l}><td><b>{l}</b></td><td>{fmt(a, u)}</td><td>{fmt(b, u)}</td><td className={d === null || d === 0 ? '' : good ? 'is-green' : 'is-red'}>{d === null ? '—' : d === 0 ? '持平' : signed(d, u === '%' ? ' 个点' : u)}</td><td className="ev-muted">{gate}</td></tr>;
              })}</tbody>
            </table>
          </section>
          <section className="ev-card">
            <div className="ev-bar ev-pad"><h4>结论变化的条款 · {r.changed.length} 条</h4><span className="ev-grow" /><small className="ev-muted">{fixed} 条改对 · {still} 条仍需人工</small></div>
            {!r.changed.length ? <p className="ev-note ev-pad">应用后没有条款的结论发生变化</p> : (
              <table className="ev-table">
                <thead><tr><th>条款</th><th>v{r.base}</th><th>v{next}</th><th>标准答案</th></tr></thead>
                <tbody>{r.changed.map((c, i) => <tr key={i}><td className="ev-text">{c.text}</td><td>{c.before}</td><td className={c.after === c.gold ? 'is-green' : 'is-red'}>{c.after}</td><td>{c.gold}</td></tr>)}</tbody>
              </table>
            )}
          </section>
        </div>
        <aside className="ev-side">
          <section className="ev-card ev-pad">
            <h4>改动内容</h4>
            {!!s.change.policies?.length && <small className="ev-muted">公司口径（追加 {s.change.policies.length} 条）</small>}
            {s.change.policies?.map((p) => <div key={p} className="ev-policy">+ {p}</div>)}
            {!!s.change.examples?.length && <p className="ev-note">新增示例 {s.change.examples.length} 条（来自依据的改判）</p>}
          </section>
          <section className="ev-card ev-pad">
            <h4>依据的人工改判 · {basis.length} 条</h4>
            {basis.slice(0, 6).map((b) => <div key={b.id} className="ev-recent"><b>{b.text.replace(/^[-\s]+/, '').slice(0, 48)}：{b.machine.split(' · ').slice(1).join(' · ')} → {b.human.replace('改判 · ', '')}</b><small>{b.by} · {b.bid}</small></div>)}
            {basis.length > 6 && <p className="ev-note">另有 {basis.length - 6} 条，见「改进库」</p>}
          </section>
          {still > 0 && <div className="ev-card ev-orange"><AlertCircle size={13} />有 {still} 条在 v{next} 下与标准答案不一致，发布后会进入待确认，不会直接下判。</div>}
        </aside>
      </div>
    </div>
  );
}

// ======================= R3 改进库 =======================
const LIB_STATUS: Record<LibRow['status'], [string, string]> = { conflict: ['有冲突', 'red'], example: ['已转示例', 'green'], suggested: ['纳入建议', 'purple'], unused: ['未使用', 'gray'], confirmed: ['仅确认', 'gray'] };
export function LibraryPanel({ api, canEdit, onChanged }: { api: Api; canEdit: boolean; onChanged: () => void }) {
  const [lib, setLib] = useState<Lib | null>(null);
  const [f, setF] = useState<'all' | LibRow['status']>('all');
  const load = () => api('/tender/evolve/library').then(setLib);
  const { busy, msg, setMsg, run } = useAction(load, onChanged);
  useEffect(() => { load().catch((e) => setMsg({ tone: 'red', text: e.message })); }, []);
  if (!lib) return <div className="ev-card ev-pad">{msg?.text || '正在读取…'}</div>;
  const rows = lib.rows.filter((r) => f === 'all' || r.status === f);
  const chips: [typeof f, string, number][] = [['all', '全部', lib.stats.total], ['unused', '未使用', lib.stats.unused], ['example', '已转示例', lib.stats.examples], ['suggested', '纳入建议', lib.stats.suggested], ['conflict', '有冲突', lib.stats.conflicts]];
  return (
    <div className="ev-page">
      <div className="ev-kpis">
        <Kpi label="人工改判" value={`${lib.stats.changed} 条`} hint={`${lib.stats.bids} 个投标 · ${lib.stats.reviewers} 位复核人`} />
        <Kpi label="已转成示例" value={`${lib.stats.examples} 条`} hint="验证通过自动生效" />
        <Kpi label="纳入改进建议" value={`${lib.stats.suggested} 条`} hint="建议待审批或已发布" />
        <Kpi label="有冲突" value={`${lib.stats.conflicts} 条`} hint="同类条款两人判法不同" tone={lib.stats.conflicts ? 'red' : undefined} />
      </div>
      <section className="ev-card">
        <div className="ev-chips">
          {chips.map(([k, l, n]) => <button key={k} className={f === k ? 'on' : ''} onClick={() => setF(k)}>{l} {n}</button>)}
          <span className="ev-grow" />
          {msg && <span className={'ev-msg is-' + msg.tone}>{msg.text}</span>}
          <button className="ev-btn primary" disabled={!canEdit || !!busy || !lib.stats.unused} onClick={() => run('gen', () => api('/tender/evolve/suggestions/generate', { method: 'POST', body: {} }), (r) => `生成了 ${r.length} 条建议，到「改进建议」回放验证`)}>
            {busy === 'gen' ? <Loader2 size={13} className="ev-spin" /> : <Sparkles size={13} />}根据改判生成改进建议
          </button>
        </div>
        {!rows.length ? <p className="ev-note ev-pad">{lib.stats.total ? '没有符合条件的记录' : '还没有人工复核记录。在投标的「标书拆解」里确认或改判后会出现在这里。'}</p> : (
          <table className="ev-table">
            <thead><tr><th>时间</th><th>投标</th><th>条款</th><th>机器原判</th><th>人工结论</th><th>复核人</th><th>去向</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id}>
                <td className="ev-muted">{at(r.at)}</td><td>{r.bid}</td>
                <td className="ev-text" title={r.text}><b>{r.text.replace(/^[-\s]+/, '').slice(0, 80)}</b>{r.note && <small>说明：{r.note}</small>}</td>
                <td className="ev-muted">{r.machine}</td><td><b>{r.human.replace('改判 · ', '')}</b></td><td>{r.by}</td>
                <td><Tag tone={LIB_STATUS[r.status][1]}>{r.status === 'suggested' ? `纳入建议 #${r.suggestion}` : LIB_STATUS[r.status][0]}</Tag></td>
              </tr>
            ))}</tbody>
          </table>
        )}
        {lib.stats.conflicts > 0 && <div className="ev-warn"><AlertCircle size={13} />有冲突的改判不会进入改进建议，需要复核人先统一口径。</div>}
      </section>
    </div>
  );
}

// ======================= R4 历史版本与回滚 =======================
export function VersionsPanel({ api, canEdit, current, onChanged }: { api: Api; canEdit: boolean; current: number; onChanged: () => void }) {
  const [rows, setRows] = useState<Version[] | null>(null);
  const [drafts, setDrafts] = useState<Suggestion[]>([]);
  const [pick, setPick] = useState<number | null>(null);
  const load = () => Promise.all([api('/tender/evolve/versions').then(setRows), api('/tender/evolve/suggestions').then((s: Suggestion[]) => setDrafts(s.filter((x) => x.status === 'draft' && x.replay?.passed)))]);
  const { busy, msg, setMsg, run } = useAction(load, onChanged);
  useEffect(() => { load().catch((e) => setMsg({ tone: 'red', text: e.message })); }, [current]);
  if (!rows) return <div className="ev-card ev-pad">{msg?.text || '正在读取…'}</div>;
  const restore = (v: number) => {
    if (!confirm(`回滚到 v${v}？会生成一个新版本，不删除任何历史；下一次解析按新版本判断。`)) return;
    void run('restore', () => api('/tender/rules/restore', { method: 'POST', body: { version: v } }), (r) => `已回滚到 v${v} 的内容，保存为 v${r.version}`);
  };
  const rated = rows.filter((r) => r.rate !== null).slice(0, 6).reverse();
  const max = Math.max(1, ...rated.map((r) => r.rate || 0));
  const focus = rows.find((r) => r.version === (pick ?? current)) || rows[0];
  const prev = rows.find((r) => r.version < (focus?.version ?? 0));
  const diff: [string, string][] = [];
  if (focus && prev) {
    for (const p of focus.policyList) if (!prev.policyList.includes(p)) diff.push(['+', `新增口径：${p}`]);
    for (const p of prev.policyList) if (!focus.policyList.includes(p)) diff.push(['−', `删除口径：${p}`]);
    if (focus.examples !== prev.examples) diff.push([focus.examples > prev.examples ? '+' : '−', `示例 ${prev.examples} → ${focus.examples} 条`]);
    if (focus.batchSize !== prev.batchSize || focus.concurrency !== prev.concurrency) diff.push(['~', `每批条数 ${prev.batchSize} → ${focus.batchSize}，并发 ${prev.concurrency} → ${focus.concurrency}`]);
    if (focus.minConfidence !== prev.minConfidence) diff.push(['~', `待确认置信度 ${prev.minConfidence} → ${focus.minConfidence}`]);
    if (!diff.length) diff.push(['~', focus.changeNote || '规则细节调整（模型判断配置未变）']);
  }
  return (
    <div className="ev-split">
      <section className="ev-card ev-col ev-flat">
        <div className="ev-bar ev-pad"><h4>历史版本 · {rows.length} 个</h4><span className="ev-grow" />{msg && <span className={'ev-msg is-' + msg.tone}>{msg.text}</span>}<small className="ev-muted">每次保存、审批、自动生效、回滚都会生成新版本</small></div>
        <table className="ev-table">
          <thead><tr><th>版本</th><th>时间</th><th>来源</th><th>改动</th><th>回放</th><th /></tr></thead>
          <tbody>
            {drafts.map((d) => (
              <tr key={d.id}><td><b>v{current + 1}</b></td><td className="ev-muted">待发布</td><td><Tag tone="purple">改进建议审批</Tag></td><td className="ev-text">{d.title}</td><td className="ev-muted">{d.replay ? replayLine(d.replay).split(' · ').slice(0, 2).join(' · ') : ''}</td><td><Tag tone="orange">草稿</Tag></td></tr>
            ))}
            {rows.map((r) => (
              <tr key={r.version} className={(r.version === current ? 'is-current ' : '') + (pick === r.version ? 'is-pick' : '')} onClick={() => setPick(r.version)}>
                <td><b className={r.version === current ? 'is-blue' : ''}>v{r.version}</b></td><td className="ev-muted">{at(r.updatedAt)}</td>
                <td><Tag tone={r.source === 'rollback' ? 'orange' : SOURCE[r.source][1]}>{r.source === 'rollback' ? (r.updatedBy.match(/回滚到 v\d+/)?.[0] || '回滚') : SOURCE[r.source][0]}</Tag></td>
                <td className="ev-text">{r.changeNote.replace(/^#\d+\s*/, '') || (r.source === 'manual' ? `${r.updatedBy} 在规则页修改` : r.source === 'default' ? '出厂规则' : '—')}</td>
                <td className="ev-muted">{r.replay || (r.source === 'manual' || r.source === 'default' ? '—' : '')}</td>
                <td>{r.version === current ? <Tag tone="blue">当前</Tag> : <span className="ev-actions"><button className="ev-link" onClick={(e) => { e.stopPropagation(); setPick(r.version); }}>对比</button><button className="ev-link" disabled={!canEdit || !!busy} onClick={(e) => { e.stopPropagation(); restore(r.version); }}>回滚到此版</button></span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <aside className="ev-side">
        <section className="ev-card ev-pad">
          <h4>各版本上线后的改判率</h4>
          <p className="ev-note">改判率 = 人工改判条数 / 模型判断条数，越低说明判断越准</p>
          {!rated.length ? <p className="ev-note">还没有足够的复核记录</p> : (
            <div className="ev-bars">{rated.map((r) => <div key={r.version} className={r.version === current ? 'on' : ''}><small>{r.rate}%</small><i style={{ height: `${Math.max(6, ((r.rate || 0) / max) * 100)}px` }} /><span>v{r.version}</span></div>)}</div>
          )}
        </section>
        {focus && prev && <section className="ev-card ev-pad">
          <h4>v{focus.version} 对比 v{prev.version}</h4>
          {diff.map(([k, t], i) => <div key={i} className={'ev-diff ' + (k === '+' ? 'is-add' : k === '−' ? 'is-del' : 'is-mod')}><span>{k}</span>{t}</div>)}
        </section>}
        <p className="ev-note ev-pad is-link"><RotateCcw size={12} />回滚会生成一个新版本，不删除任何历史；回滚后下一次解析按新版本判断，旧的模型判断缓存自动失效。</p>
      </aside>
    </div>
  );
}
