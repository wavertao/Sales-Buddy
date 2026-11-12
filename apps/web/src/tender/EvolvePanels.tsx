import React, { useEffect, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, ChevronLeft, FileText, Loader2, RotateCcw, ShieldAlert, Sparkles, UserCheck, X, Zap } from "lucide-react";
import "./evolve.css";

type Api = (path: string, options?: Record<string, unknown>) => Promise<any>;
type Metrics = { total: number; requirementAcc: number; categoryAcc: number; vetoRecall: number | null; strongRecall: number | null; strongFalse: number; agreement: number };
type Replay = { at: string; base: number; before: Metrics; after: Metrics; passed: boolean; gates: { label: string; ok: boolean; detail: string }[]; changed: { text: string; before: string; after: string; gold: string }[]; durationMs: number };
type Example = { text: string; isRequirement: boolean; category?: string; strength?: string; note?: string };
export type Suggestion = {
  id: string; no: number; kind: 'examples' | 'policy' | 'veto'; title: string; detail: string; change: { policies?: string[]; examples?: Example[] };
  basis: string[]; status: 'draft' | 'blocked' | 'published' | 'rejected'; replay?: Replay; createdAt: string; createdBy: string; decidedBy?: string; publishedVersion?: number; rejectNote?: string;
};
type LibRow = { id: string; at: string; bid: string; text: string; machine: string; human: string; note: string; by: string; status: 'conflict' | 'example' | 'suggested' | 'unused' | 'confirmed'; suggestion: number | null };
type Lib = { rows: LibRow[]; stats: { total: number; changed: number; examples: number; suggested: number; conflicts: number; unused: number; bids: number; reviewers: number } };
type Version = { version: number; updatedAt: string; updatedBy: string; changeNote: string; policies: number; examples: number; source: 'auto' | 'suggestion' | 'rollback' | 'default' | 'manual'; changed: number; items: number; rate: number | null };

const KIND: Record<Suggestion['kind'], [string, string]> = { examples: ['新增示例', 'blue'], policy: ['公司口径', 'purple'], veto: ['放宽否决', 'red'] };
const SOURCE: Record<Version['source'], [string, string]> = { auto: ['自动生效', 'green'], suggestion: ['改进建议审批', 'purple'], rollback: ['回滚', 'orange'], default: ['系统默认', 'gray'], manual: ['人工编辑', 'gray'] };
const at = (s?: string) => (s ? s.slice(5, 16).replace('T', ' ') : '');
const pct = (v: number | null) => (v === null ? '—' : `${v}%`);
const delta = (a: number | null, b: number | null, unit = ' 个点') => (a === null || b === null ? '' : b === a ? '持平' : `${b > a ? '+' : ''}${Math.round((b - a) * 10) / 10}${unit}`);

function Kpi({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: string }) {
  return <div className={'ev-kpi' + (tone ? ' is-' + tone : '')}><span>{label}</span><b>{value}</b>{hint && <small>{hint}</small>}</div>;
}

// ======================= 改进建议 =======================
export function SuggestionsPanel({ api, canEdit, onChanged }: { api: Api; canEdit: boolean; onChanged: () => void }) {
  const [list, setList] = useState<Suggestion[] | null>(null);
  const [lib, setLib] = useState<Lib | null>(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ tone: string; text: string } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const load = () => Promise.all([api('/tender/evolve/suggestions').then(setList), api('/tender/evolve/library').then(setLib)]);
  useEffect(() => { load().catch((e) => setMsg({ tone: 'red', text: e.message })); }, []);
  const run = async (key: string, f: () => Promise<unknown>, ok: (r: any) => string) => {
    setBusy(key); setMsg(null);
    try { const r = await f(); await load(); onChanged(); setMsg({ tone: 'green', text: ok(r) }); }
    catch (e) { setMsg({ tone: 'red', text: (e as Error).message }); } finally { setBusy(''); }
  };
  if (!list || !lib) return <div className="ev-card ev-pad">{msg?.text || '正在读取…'}</div>;
  const active = list.filter((s) => s.status === 'draft' || s.status === 'blocked');
  const recent = list.filter((s) => s.status === 'published').slice(0, 6);
  const detail = open ? list.find((s) => s.id === open) : null;
  if (detail) return <ReplayDetail s={detail} lib={lib} canEdit={canEdit} busy={busy} msg={msg} onBack={() => setOpen(null)}
    onPublish={() => run(detail.id + 'p', () => api(`/tender/evolve/suggestions/${detail.id}/publish`, { method: 'POST', body: {} }), (r) => `已发布为 v${r.publishedVersion}，下次解析生效`)}
    onReject={() => run(detail.id + 'r', () => api(`/tender/evolve/suggestions/${detail.id}/reject`, { method: 'POST', body: {} }), () => '已驳回')} />;
  return (
    <div className="ev-page">
      <div className="ev-kpis">
        <Kpi label="改进库" value={`${lib.stats.changed} 条改判`} hint={`来自 ${lib.stats.bids} 个投标，${lib.stats.reviewers} 位复核人`} />
        <Kpi label="自动生效" value={`${list.filter((s) => s.kind === 'examples' && s.status === 'published').length} 次示例`} hint="回放通过即上线" />
        <Kpi label="待审批" value={`${active.length} 条建议`} hint="口径 / 放宽否决要人工" tone={active.length ? 'orange' : undefined} />
        <Kpi label="还没用上的改判" value={`${lib.stats.unused} 条`} hint={lib.stats.conflicts ? `另有 ${lib.stats.conflicts} 条冲突待统一口径` : '无冲突'} tone={lib.stats.conflicts ? 'red' : undefined} />
      </div>
      <div className="ev-split">
        <div className="ev-col">
          <div className="ev-bar">
            {msg && <span className={'ev-msg is-' + msg.tone}>{msg.text}</span>}
            <span className="ev-grow" />
            <button className="ev-btn primary" disabled={!canEdit || !!busy || !lib.stats.unused} onClick={() => run('gen', () => api('/tender/evolve/suggestions/generate', { method: 'POST', body: {} }), (r) => `生成了 ${r.length} 条建议，先回放验证再发布`)}>
              {busy === 'gen' ? <Loader2 size={13} className="ev-spin" /> : <Sparkles size={13} />}根据改判生成改进建议
            </button>
          </div>
          {!active.length && <div className="ev-card ev-empty">没有待处理的建议。改进库里攒够新的改判后，点「根据改判生成改进建议」。</div>}
          {active.map((s) => {
            const r = s.replay;
            return (
              <section key={s.id} className={'ev-card ev-sug' + (s.status === 'blocked' ? ' is-blocked' : '')}>
                <header>
                  <span className={'ev-tag is-' + KIND[s.kind][1]}>{KIND[s.kind][0]}</span>
                  <b>#{s.no} {s.title}</b>
                  <span className="ev-grow" />
                  {!r ? <span className="ev-tag is-gray">未回放</span> : r.passed ? <span className="ev-tag is-green">回放通过</span> : <span className="ev-tag is-red">回放已拦截</span>}
                </header>
                <p className="ev-detail">{s.detail}</p>
                {!!s.change.policies?.length && <div className="ev-policy">{s.change.policies.map((p) => <div key={p}>+ {p}</div>)}</div>}
                <div className="ev-basis">
                  <div><FileText size={12} />依据 {s.basis.length} 条改判{s.change.examples?.length ? ` · 新增示例 ${s.change.examples.length} 条` : ''}</div>
                  {r && <div className={r.passed ? '' : 'is-red'}>{r.gates.map((g) => `${g.ok ? '' : '✕ '}${g.label.replace(/不下降|下降不超过 1 个点/, '')} ${g.detail}`).join(' · ')}</div>}
                </div>
                <footer>
                  {r && <button className="ev-btn" onClick={() => setOpen(s.id)}><FileText size={13} />查看回放报告</button>}
                  <button className="ev-btn" disabled={!canEdit || !!busy} onClick={() => run(s.id + 'v', () => api(`/tender/evolve/suggestions/${s.id}/replay`, { method: 'POST', body: {} }), (x) => (x.status === 'published' ? `回放通过，示例已自动生效（v${x.publishedVersion}）` : x.status === 'blocked' ? '回放没通过，已拦截' : '回放通过，等你审批发布'))}>
                    {busy === s.id + 'v' ? <Loader2 size={13} className="ev-spin" /> : <RotateCcw size={13} />}{r ? '重新回放' : '回放验证'}
                  </button>
                  <button className="ev-btn danger" disabled={!canEdit || !!busy} onClick={() => run(s.id + 'r', () => api(`/tender/evolve/suggestions/${s.id}/reject`, { method: 'POST', body: {} }), () => '已驳回')}><X size={13} />驳回</button>
                  {s.kind !== 'examples' && r?.passed && <button className="ev-btn primary" disabled={!canEdit || !!busy} onClick={() => run(s.id + 'p', () => api(`/tender/evolve/suggestions/${s.id}/publish`, { method: 'POST', body: {} }), (x) => `已发布为 v${x.publishedVersion}，下次解析生效`)}><Check size={13} />通过并发布</button>}
                </footer>
              </section>
            );
          })}
        </div>
        <aside className="ev-side">
          <section className="ev-card ev-pad">
            <h4>怎么上线</h4>
            <div className="ev-how"><Zap size={14} className="is-green" /><div><b>新增示例</b><small>回放不退步即自动生效</small></div></div>
            <div className="ev-how"><UserCheck size={14} className="is-blue" /><div><b>公司口径</b><small>回放通过后由主管审批发布</small></div></div>
            <div className="ev-how"><ShieldAlert size={14} className="is-red" /><div><b>放宽否决</b><small>始终人工确认，回放退步直接拦截</small></div></div>
            <p className="ev-note">回放用改进库里无冲突的人工结论当标准答案，当前版本和应用建议后各判一遍；否决召回、强制召回不许下降。</p>
          </section>
          <section className="ev-card ev-pad">
            <h4>最近生效</h4>
            {!recent.length && <p className="ev-note">还没有</p>}
            {recent.map((s) => <div key={s.id} className="ev-recent"><b>#{s.no} {s.title}</b><small>v{s.publishedVersion} · {s.decidedBy}</small></div>)}
            <p className="ev-note">任一版本都可在「历史版本」回滚。</p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function ReplayDetail({ s, lib, canEdit, busy, msg, onBack, onPublish, onReject }: { s: Suggestion; lib: Lib; canEdit: boolean; busy: string; msg: { tone: string; text: string } | null; onBack: () => void; onPublish: () => void; onReject: () => void }) {
  const r = s.replay!;
  const basis = lib.rows.filter((x) => s.basis.includes(x.id));
  const rows: [string, number | null, number | null, string, string][] = [
    ['否决召回', r.before.vetoRecall, r.after.vetoRecall, '%', '不得下降'],
    ['强制召回', r.before.strongRecall, r.after.strongRecall, '%', '不得下降'],
    ['强制误判（一般要求判成强制）', r.before.strongFalse, r.after.strongFalse, ' 条', '越少越好'],
    ['是否要求准确率', r.before.requirementAcc, r.after.requirementAcc, '%', '下降不超过 1 个点'],
    ['类别准确率', r.before.categoryAcc, r.after.categoryAcc, '%', '下降不超过 1 个点'],
    ['与人工结论完全一致', r.before.agreement, r.after.agreement, '%', '—'],
  ];
  return (
    <div className="ev-page">
      <div className="ev-card ev-head">
        <button className="ev-icon" onClick={onBack} aria-label="返回"><ChevronLeft size={16} /></button>
        <span className={'ev-tag is-' + KIND[s.kind][1]}>{KIND[s.kind][0]}</span>
        <b>#{s.no} {s.title}</b>
        {r.passed ? <span className="ev-tag is-green">回放通过</span> : <span className="ev-tag is-red">回放已拦截</span>}
        <small>标准答案 {r.after.total} 条人工结论 · 对比 v{r.base}（当前）与应用建议后 · 用时 {Math.round(r.durationMs / 1000)} 秒 · {at(r.at)}</small>
        <span className="ev-grow" />
        {msg && <span className={'ev-msg is-' + msg.tone}>{msg.text}</span>}
        {s.status !== 'published' && s.status !== 'rejected' && <>
          <button className="ev-btn danger" disabled={!canEdit || !!busy} onClick={onReject}><X size={13} />驳回</button>
          {s.kind !== 'examples' && r.passed && <button className="ev-btn primary" disabled={!canEdit || !!busy} onClick={onPublish}><Check size={13} />通过并发布</button>}
        </>}
      </div>
      <div className="ev-split">
        <div className="ev-col">
          <section className="ev-card">
            <h4 className="ev-pad">指标对比</h4>
            <table className="ev-table">
              <thead><tr><th>指标</th><th>v{r.base} 当前</th><th>应用后</th><th>变化</th><th>门槛</th></tr></thead>
              <tbody>{rows.map(([l, a, b, u, gate]) => {
                const d = delta(a, b, u === '%' ? ' 个点' : u);
                const worse = a !== null && b !== null && (l.startsWith('强制误判') ? b > a : b < a);
                return <tr key={l}><td><b>{l}</b></td><td>{a ?? '—'}{a !== null ? u : ''}</td><td>{b ?? '—'}{b !== null ? u : ''}</td><td className={worse ? 'is-red' : d && d !== '持平' ? 'is-green' : ''}>{d || '—'}</td><td className="ev-muted">{gate}</td></tr>;
              })}</tbody>
            </table>
          </section>
          <section className="ev-card">
            <h4 className="ev-pad">结论变化的条款 · {r.changed.length} 条</h4>
            {!r.changed.length ? <p className="ev-note ev-pad">应用后没有条款的结论发生变化</p> : (
              <table className="ev-table">
                <thead><tr><th>条款</th><th>当前</th><th>应用后</th><th>人工结论</th></tr></thead>
                <tbody>{r.changed.map((c, i) => <tr key={i}><td className="ev-text">{c.text}</td><td>{c.before}</td><td className={c.after === c.gold ? 'is-green' : 'is-red'}>{c.after}</td><td>{c.gold}</td></tr>)}</tbody>
              </table>
            )}
          </section>
        </div>
        <aside className="ev-side">
          <section className="ev-card ev-pad">
            <h4>改动内容</h4>
            {s.change.policies?.map((p) => <div key={p} className="ev-policy">+ {p}</div>)}
            {!!s.change.examples?.length && <p className="ev-note">新增示例 {s.change.examples.length} 条</p>}
          </section>
          <section className="ev-card ev-pad">
            <h4>依据的人工改判 · {basis.length} 条</h4>
            {basis.slice(0, 8).map((b) => <div key={b.id} className="ev-recent"><b>{b.text.slice(0, 60)}</b><small>{b.machine} → {b.human.replace('改判 · ', '')} · {b.by} · {b.bid}</small></div>)}
          </section>
          <section className="ev-card ev-pad ev-gates">
            {r.gates.map((g) => <div key={g.label} className={g.ok ? 'is-green' : 'is-red'}>{g.ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}{g.label}：{g.detail}</div>)}
          </section>
        </aside>
      </div>
    </div>
  );
}

// ======================= 改进库 =======================
const LIB_STATUS: Record<LibRow['status'], [string, string]> = { conflict: ['有冲突', 'red'], example: ['已转示例', 'green'], suggested: ['纳入建议', 'purple'], unused: ['未使用', 'gray'], confirmed: ['仅确认', 'gray'] };
export function LibraryPanel({ api }: { api: Api }) {
  const [lib, setLib] = useState<Lib | null>(null);
  const [f, setF] = useState<'all' | LibRow['status']>('all');
  const [err, setErr] = useState('');
  useEffect(() => { api('/tender/evolve/library').then(setLib).catch((e) => setErr(e.message)); }, []);
  if (!lib) return <div className="ev-card ev-pad">{err || '正在读取…'}</div>;
  const rows = lib.rows.filter((r) => f === 'all' || r.status === f);
  const chips: [typeof f, string, number][] = [['all', '全部', lib.stats.total], ['unused', '未使用', lib.stats.unused], ['example', '已转示例', lib.stats.examples], ['suggested', '纳入建议', lib.stats.suggested], ['conflict', '有冲突', lib.stats.conflicts]];
  return (
    <div className="ev-page">
      <div className="ev-kpis">
        <Kpi label="人工改判" value={`${lib.stats.changed} 条`} hint={`另有 ${lib.stats.total - lib.stats.changed} 条只是确认 · ${lib.stats.bids} 个投标`} />
        <Kpi label="已转成示例" value={`${lib.stats.examples} 条`} hint="回放通过后自动生效" />
        <Kpi label="纳入改进建议" value={`${lib.stats.suggested} 条`} />
        <Kpi label="有冲突" value={`${lib.stats.conflicts} 条`} hint="同一条款两人判法不同" tone={lib.stats.conflicts ? 'red' : undefined} />
      </div>
      <section className="ev-card">
        <div className="ev-chips">{chips.map(([k, l, n]) => <button key={k} className={f === k ? 'on' : ''} onClick={() => setF(k)}>{l} {n}</button>)}</div>
        {!rows.length ? <p className="ev-note ev-pad">{lib.stats.total ? '没有符合条件的记录' : '还没有人工复核记录。在投标的「标书拆解」里确认或改判后会出现在这里。'}</p> : (
          <table className="ev-table">
            <thead><tr><th>时间</th><th>投标</th><th>条款</th><th>机器原判</th><th>人工结论</th><th>复核人</th><th>去向</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id}>
                <td className="ev-muted">{at(r.at)}</td><td>{r.bid}</td>
                <td className="ev-text" title={r.text}><b>{r.text.slice(0, 90)}</b>{r.note && <small>说明：{r.note}</small>}</td>
                <td className="ev-muted">{r.machine}</td><td><b>{r.human}</b></td><td>{r.by}</td>
                <td><span className={'ev-tag is-' + LIB_STATUS[r.status][1]}>{r.status === 'suggested' ? `纳入建议 #${r.suggestion}` : LIB_STATUS[r.status][0]}</span></td>
              </tr>
            ))}</tbody>
          </table>
        )}
        {lib.stats.conflicts > 0 && <div className="ev-warn"><AlertTriangle size={13} />有冲突的改判不会进入改进建议，需要复核人先统一口径（在投标里把同一条款改成一致的结论）。</div>}
      </section>
    </div>
  );
}

// ======================= 历史版本 =======================
export function VersionsPanel({ api, canEdit, current, onChanged }: { api: Api; canEdit: boolean; current: number; onChanged: () => void }) {
  const [rows, setRows] = useState<Version[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: string; text: string } | null>(null);
  const load = () => api('/tender/evolve/versions').then(setRows);
  useEffect(() => { load().catch((e) => setMsg({ tone: 'red', text: e.message })); }, [current]);
  if (!rows) return <div className="ev-card ev-pad">{msg?.text || '正在读取…'}</div>;
  const restore = async (v: number) => {
    if (!confirm(`回滚到 v${v}？会生成一个新版本，不删除任何历史；下一次解析按新版本判断。`)) return;
    setBusy(true);
    try { const r = await api('/tender/rules/restore', { method: 'POST', body: { version: v } }); await load(); onChanged(); setMsg({ tone: 'green', text: `已回滚到 v${v} 的内容，保存为 v${r.version}` }); }
    catch (e) { setMsg({ tone: 'red', text: (e as Error).message }); } finally { setBusy(false); }
  };
  const rated = rows.filter((r) => r.rate !== null).slice(0, 6).reverse();
  const max = Math.max(1, ...rated.map((r) => r.rate || 0));
  const cur = rows.find((r) => r.version === current), prev = rows.find((r) => r.version < current);
  return (
    <div className="ev-split">
      <section className="ev-card ev-col">
        <div className="ev-bar ev-pad"><h4>历史版本 · {rows.length} 个</h4><span className="ev-grow" />{msg && <span className={'ev-msg is-' + msg.tone}>{msg.text}</span>}<small className="ev-muted">每次保存、采纳建议、自动生效、回滚都生成新版本</small></div>
        <table className="ev-table">
          <thead><tr><th>版本</th><th>时间</th><th>来源</th><th>改动</th><th>口径 / 示例</th><th>改判率</th><th /></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.version} className={r.version === current ? 'is-current' : ''}>
              <td><b>v{r.version}</b></td><td className="ev-muted">{at(r.updatedAt)}</td>
              <td><span className={'ev-tag is-' + SOURCE[r.source][1]}>{SOURCE[r.source][0]}</span><small className="ev-muted"> {r.updatedBy.replace(/（.*$/, '')}</small></td>
              <td className="ev-text">{r.changeNote || (r.source === 'manual' ? '在规则页手工修改' : r.source === 'default' ? '出厂规则' : '—')}</td>
              <td className="ev-muted">{r.policies} / {r.examples}</td>
              <td>{r.rate === null ? <span className="ev-muted">—</span> : `${r.rate}%`}<small className="ev-muted">{r.items ? ` ${r.changed}/${r.items}` : ''}</small></td>
              <td>{r.version === current ? <span className="ev-tag is-blue">当前</span> : <button className="ev-link" disabled={!canEdit || busy} onClick={() => restore(r.version)}>回滚到此版</button>}</td>
            </tr>
          ))}</tbody>
        </table>
      </section>
      <aside className="ev-side">
        <section className="ev-card ev-pad">
          <h4>各版本上线后的改判率</h4>
          <p className="ev-note">改判率 = 人工改判条数 / 这个版本解析、且有人复核过的要求条数；越低说明判断越准。</p>
          {!rated.length ? <p className="ev-note">还没有足够的复核记录</p> : (
            <div className="ev-bars">{rated.map((r) => <div key={r.version} className={r.version === current ? 'on' : ''}><small>{r.rate}%</small><i style={{ height: `${Math.max(6, ((r.rate || 0) / max) * 110)}px` }} /><span>v{r.version}</span></div>)}</div>
          )}
        </section>
        {cur && prev && <section className="ev-card ev-pad">
          <h4>v{cur.version} 对比 v{prev.version}</h4>
          <div className="ev-diff">口径 {prev.policies} → {cur.policies}，示例 {prev.examples} → {cur.examples}</div>
          {cur.changeNote && <div className="ev-diff">{cur.changeNote}</div>}
        </section>}
        <p className="ev-note ev-pad"><RotateCcw size={12} /> 回滚会生成一个新版本，不删除任何历史；回滚后下一次解析按新版本判断，旧的模型判断缓存自动失效。</p>
      </aside>
    </div>
  );
}
