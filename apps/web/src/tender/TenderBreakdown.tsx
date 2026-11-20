import React, { useEffect, useMemo, useState, createContext, useContext } from 'react';
import { Check, ChevronDown, ChevronRight, ChevronUp, Columns2, ExternalLink, List, ListFilter, Search, Users, X } from "lucide-react";
import type { DecompItem, Strength, TenderCategory, TenderParseResult } from "../../../../packages/contracts/tender";
import { TENDER_CATEGORIES } from "../../../../packages/contracts/tender";
import { CAT_LABEL, STRENGTH_LABEL, type ReviewFn } from "./TenderResult";
import "./tender-breakdown.css";

/**
 * 标书拆解 · 拆标分解表：两种视图共用一条工具栏（类别、筛选、搜索）。
 * 列表下拉：工作项 → 要求 → 条款详情逐级展开；左右清单：左边要求清单，右边条款详情。复核都在条款详情里完成。
 */
export type WorkItem = {
  id: string; title: string; category: string; sourceClause: string; assigneeRole: string; reviewerRole?: string; end: string; status: string;
  requirementIds?: string[]; requirementCount?: number; mandatoryCount?: number; riskCount?: number; reviewCount?: number;
  amended?: boolean; deliverable?: string; grouping?: 'model' | 'fallback'; tenderKey?: string;
};
export type BreakdownMode = 'list' | 'split';
/** 「其他 X 要求」和兜底分组排在本类最后 */
const tailOf = (w: WorkItem) => (w.grouping === 'fallback' || /^其他.+要求$/.test(w.title) ? 1 : 0);

const STATUS: Record<string, string> = { pending: '待开始', in_progress: '进行中', done: '已完成', blocked: '阻塞' };
const PARTY: [string, string][] = [['bidder', '我方'], ['owner', '业主'], ['other', '其他承包商']];
const strong = (s?: Strength) => s === 'mandatory' || s === 'prohibited';
const sourceLabel = (it: DecompItem) => (it.source === 'human' ? '人工' : it.source === 'rule' ? '规则' : 'AI');
const where = (it: DecompItem) => `${it.fileName.replace(/\.[^.]+$/, '').slice(0, 28)} · p${it.page}`;

/** 表头：上面是列名，下面一行灰色小字说明这一列是什么 */
const Th = ({ label, hint, w }: { label: string; hint: string; w?: number }) => (
  <div className="tb-th" style={w ? { width: w, flex: 'none' } : undefined}><b>{label}</b><small>{hint}</small></div>
);

function Dot({ label }: { label: string }) {
  return <span className="tb-dot"><i />{label}</span>;
}

/** 审查项名称：解析结果带审查项快照，Breakdown 渲染时注入 */
let ITEM_NAMES = new Map<string, string>();
const reviewItemName = (id: string) => ITEM_NAMES.get(id) || '';

/** 从原文加词：主管 / 管理员在原文里选中一段，直接加成规则关键词（发布新规则版本，下次解析生效） */
export type WordKind = 'prohibited' | 'mandatory' | 'required' | 'risk';
export type AddWordFn = (kind: WordKind, word: string) => Promise<void>;
const AddWord = createContext<AddWordFn | undefined>(undefined);

/** 原文：模型引用的依据句加左侧黄条，前后文淡显；对不上就整段显示 */
function Source({ it }: { it: DecompItem }) {
  const addWord = useContext(AddWord);
  const [pick, setPick] = useState('');
  useEffect(() => setPick(''), [it.id]);
  const onUp = () => { if (!addWord) return; const s = (window.getSelection()?.toString() || '').replace(/\s+/g, ' ').trim(); setPick(s.length >= 2 && s.length <= 60 ? s : ''); };
  const add = (k: WordKind) => { void addWord?.(k, pick); setPick(''); window.getSelection()?.removeAllRanges(); };
  const bar = addWord && pick && (
    <div className="tb-pick"><span>把「<b>{pick}</b>」加为</span>
      <button type="button" className="is-red" onClick={() => add('prohibited')}>否决词</button><button type="button" onClick={() => add('mandatory')}>强制词</button>
      <button type="button" onClick={() => add('required')}>一般要求词</button><button type="button" className="is-orange" onClick={() => add('risk')}>风险词</button>
      <button type="button" className="tb-pick-x" onClick={() => setPick('')} aria-label="取消"><X size={12} /></button></div>
  );
  const at = it.quote ? it.text.toLowerCase().indexOf(it.quote.toLowerCase()) : -1;
  if (at < 0) return <div className="tb-src" onMouseUp={onUp}><p className="is-quote">{it.text}</p>{bar}</div>;
  const before = it.text.slice(0, at).trim(), hit = it.text.slice(at, at + it.quote!.length), after = it.text.slice(at + it.quote!.length).trim();
  return (
    <div className="tb-src" onMouseUp={onUp}>
      {before && <p>{before}</p>}
      <p className="is-quote">{hit}</p>
      {after && <p>{after}</p>}
      {bar}
    </div>
  );
}

/** 条款详情：左原文，右判断。改了任一字段再确认即为改判，结论会记入改进库。 */
export function ClauseDetail({ it, workItems, current, onReview, onDone, layout }: {
  it: DecompItem; workItems: WorkItem[]; current?: WorkItem; onReview?: ReviewFn; onDone?: () => void; layout: 'inline' | 'panel';
}) {
  const [category, setCategory] = useState<TenderCategory>(it.category);
  const [strength, setStrength] = useState<Strength | ''>(it.strength || '');
  const [party, setParty] = useState('bidder');
  const [wi, setWi] = useState(current?.tenderKey || '');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setCategory(it.category); setStrength(it.strength || ''); setParty('bidder'); setWi(current?.tenderKey || ''); }, [it.id, it.category, it.strength, current?.tenderKey]);
  const changed = category !== it.category || strength !== (it.strength || '') || (wi && wi !== current?.tenderKey) || party !== 'bidder';
  const submit = async (body: Parameters<ReviewFn>[1]) => {
    if (!onReview || !it.clauseKey) return;
    setBusy(true);
    try { await onReview(it.clauseKey, body); onDone?.(); } finally { setBusy(false); }
  };
  const confirm = () => submit({
    isRequirement: true, category, strength: strength || undefined,
    party: party === 'bidder' ? undefined : party as 'owner' | 'other',
    workItemKey: wi && wi !== current?.tenderKey ? wi : undefined,
  });
  const ro = !onReview;
  const sameCat = workItems.filter((w) => w.category === CAT_LABEL[category] || w.tenderKey === current?.tenderKey);
  const fields = (
    <div className="tb-fields">
      <label><span>类别{it.ruleCategory && it.source !== 'rule' && <em>规则：{CAT_LABEL[it.ruleCategory]}</em>}</span>
        <select disabled={ro} value={category} onChange={(e) => setCategory(e.target.value as TenderCategory)}>{TENDER_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></label>
      <label><span>强度{it.source !== 'rule' && <em>规则：{it.ruleStrength ? STRENGTH_LABEL[it.ruleStrength] : '无'}</em>}</span>
        <select disabled={ro} value={strength} onChange={(e) => setStrength(e.target.value as Strength | '')}><option value="">无强度</option>{Object.entries(STRENGTH_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      <label><span>适用方</span>
        <select disabled={ro} value={party} onChange={(e) => setParty(e.target.value)}>{PARTY.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      <label><span>所属工作项</span>
        <select disabled={ro} value={wi} onChange={(e) => setWi(e.target.value)}>{sameCat.map((w) => <option key={w.id} value={w.tenderKey}>{w.title}</option>)}</select></label>
    </div>
  );
  const actions = !ro && (
    <div className="tb-actions">
      <button type="button" className="tb-btn primary" disabled={busy} onClick={() => void confirm()}><Check size={13} />{changed ? '保存改判' : layout === 'panel' ? '确认，下一条' : '确认'}</button>
      <button type="button" className="tb-btn" disabled={busy} onClick={() => void submit({ isRequirement: true, category, strength: strength || undefined, party: 'other' })}><Users size={13} />归他方</button>
      <button type="button" className="tb-btn" disabled={busy} onClick={() => void submit({ isRequirement: false })}><X size={13} />不是要求</button>
      {layout === 'inline' && <span className="tb-hint">改了字段再确认即为改判，会记入改进库</span>}
    </div>
  );
  const why = it.needsReview && it.reviewReasons?.length ? <div className="tb-why"><Dot label={it.reviewReasons.join('；')} /></div> : null;
  const reason = it.reason && <p className="tb-reason"><span>{it.source === 'human' ? '复核说明' : '模型理由'}</span>{it.reason}</p>;
  // 审查项和程序校验：和 AI 结论并排，标明来源
  const itemName = it.reviewItem ? reviewItemName(it.reviewItem) : '';
  const checks = (itemName || it.checks?.length) ? (
    <div className="tb-checks">
      {itemName && <div><span className="tb-src-tag is-purple">审查项</span>{itemName}</div>}
      {it.checks?.map((c, i) => <div key={i} className={c.hit ? 'is-hit' : ''}><span className="tb-src-tag is-green">程序</span>{c.detail}</div>)}
    </div>
  ) : null;

  if (layout === 'inline') {
    return (
      <div className="tb-inline">
        <div className="tb-inline-src">
          <div className="tb-meta">{it.fileName} · 第 {it.page} 页 · {it.section}</div>
          <Source it={it} />
          {it.summary && <p className="tb-zh"><span>中文要点</span>{it.summary}</p>}
        </div>
        <div className="tb-inline-judge">{why}{checks}{fields}{reason}{actions}</div>
      </div>
    );
  }
  return (
    <>
      <div className="tb-panel-body">
        <section><h5>原文<span className="tb-meta">{it.fileName} · 第 {it.page} 页 · {it.section}</span></h5><Source it={it} /></section>
        {it.summary && <section><h5>中文要点</h5><p className="tb-zh-p">{it.summary}</p></section>}
        <section><h5>判断<span className="tb-meta">{sourceLabel(it)}{it.confidence !== undefined ? ` · 置信度 ${it.confidence}` : ''}</span></h5>{why}{checks}{fields}{reason}</section>
      </div>
      {actions && <div className="tb-panel-foot">{actions}<span className="tb-hint">改了字段再确认即为改判，会记入改进库</span></div>}
    </>
  );
}

export function TenderBreakdown(props: { result: TenderParseResult; items: WorkItem[]; onReview?: ReviewFn; excludedCount: number; onAddWord?: AddWordFn }) {
  ITEM_NAMES = new Map((props.result.reviewItems || []).map((i) => [i.id, i.name]));
  return <AddWord.Provider value={props.onAddWord}><Breakdown {...props} /></AddWord.Provider>;
}
function Breakdown({ result, items, onReview, excludedCount }: {
  result: TenderParseResult; items: WorkItem[]; onReview?: ReviewFn; excludedCount: number;
}) {
  const [mode, setMode] = useState<BreakdownMode>(() => (localStorage.getItem('tb-mode') === 'split' ? 'split' : 'list'));
  const [cat, setCat] = useState<string>('all');
  const [flags, setFlags] = useState({ review: false, strong: false, risk: false });
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [openReq, setOpenReq] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => { try { localStorage.setItem('tb-mode', mode); } catch { /* 存不了就算了 */ } }, [mode]);

  const byId = useMemo(() => new Map(result.items.map((i) => [i.id, i])), [result]);
  const itemOf = useMemo(() => { const m = new Map<string, WorkItem>(); for (const w of items) for (const id of w.requirementIds || []) m.set(id, w); return m; }, [items]);
  const pass = (it: DecompItem, w: WorkItem) => (!flags.review || it.needsReview) && (!flags.strong || strong(it.strength)) && (!flags.risk || it.risks.length > 0)
    && (!q || (w.title + it.text + (it.summary || '') + it.title).toLowerCase().includes(q.toLowerCase()));
  const filtering = flags.review || flags.strong || flags.risk || !!q;
  const groups = useMemo(() => TENDER_CATEGORIES.map((c) => ({
    label: c.label,
    rows: items.filter((w) => w.category === c.label && (cat === 'all' || cat === c.label)).sort((a, b) => tailOf(a) - tailOf(b)).map((w) => ({ w, reqs: (w.requirementIds || []).map((id) => byId.get(id)).filter((x): x is DecompItem => !!x).filter((it) => pass(it, w)) }))
      .filter((r) => !filtering || r.reqs.length),
  })).filter((g) => g.rows.length), [items, byId, cat, flags, q]);
  const visible = groups.flatMap((g) => g.rows.flatMap((r) => r.reqs));
  const all = result.items;
  const counts = { review: all.filter((i) => i.needsReview).length, strong: all.filter((i) => strong(i.strength)).length, risk: all.filter((i) => i.risks.length).length };
  const reviewed = all.filter((i) => i.source === 'human').length;
  const selected = (sel && byId.get(sel)) || visible[0];

  const next = () => {
    const at = visible.findIndex((v) => v.id === selected?.id);
    const after = [...visible.slice(at + 1), ...visible.slice(0, Math.max(0, at))];
    setSel((after.find((v) => v.needsReview) || after[0])?.id || null);
  };
  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const isOpen = (id: string) => filtering || open.has(id);

  const toolbar = (
    <>
      <div className="tb-toolbar">
        <div className="tb-seg">
          <button type="button" className={mode === 'list' ? 'on' : ''} onClick={() => setMode('list')}><List size={12} />列表</button>
          <button type="button" className={mode === 'split' ? 'on' : ''} onClick={() => setMode('split')}><Columns2 size={12} />左右</button>
        </div>
        <span className="tb-vr" />
        <div className="tb-cats">
          <button type="button" className={cat === 'all' ? 'on' : ''} onClick={() => setCat('all')}>全部 <span>{items.length}</span></button>
          {TENDER_CATEGORIES.map((c) => { const n = items.filter((w) => w.category === c.label).length; return n ? <button type="button" key={c.key} className={cat === c.label ? 'on' : ''} onClick={() => setCat(c.label)}>{c.label} <span>{n}</span></button> : null; })}
        </div>
        <span className="tb-grow" />
        <span className="tb-filter-label"><ListFilter size={12} />筛选</span>
        {([['review', `待确认 ${counts.review}`], ['strong', `强制 / 否决 ${counts.strong}`], ['risk', `有风险 ${counts.risk}`]] as const).map(([k, l]) => (
          <label key={k} className={'tb-check' + (flags[k] ? ' on' : '')}><input type="checkbox" checked={flags[k]} onChange={(e) => setFlags({ ...flags, [k]: e.target.checked })} />{l}</label>
        ))}
        <label className="tb-search"><Search size={12} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜工作项、要求、原文" /></label>
      </div>
      <div className="tb-status">
        <b>{all.length} 条要求</b><span>强制 / 否决 {counts.strong}</span><span className="is-red">高风险 {result.stats.risks.high}</span>
        <span className="is-green">已复核 {reviewed}</span><span className="is-orange">待确认 {counts.review}</span>
        {excludedCount > 0 && <em>· 业主、其他承包商的责任和非要求条款共 {excludedCount} 条，在「已排除」</em>}
      </div>
    </>
  );

  if (mode === 'list') {
    return (
      <div className="tb-root">
        {toolbar}
        <div className="tb-table">
          <div className="tb-tr is-head">
            <span className="tb-chev" />
            <Th label="工作项 / 交付物" hint="工作项与对应交付物" />
            <Th label="要求" hint="条数 / 强制" w={110} />
            <Th label="待确认" hint="待确认条数" w={70} />
            <Th label="负责 / 复核" hint="主责 + 复核角色" w={100} />
            <Th label="截止" hint="响应截止日" w={64} />
            <Th label="状态" hint="推进状态" w={64} />
          </div>
          {groups.map((g) => (
            <React.Fragment key={g.label}>
              <div className="tb-group"><b>{g.label}</b><span>{g.rows.length} 个工作项 · {g.rows.reduce((n, r) => n + r.reqs.length, 0)} 条要求</span></div>
              {g.rows.map(({ w, reqs }) => (
                <React.Fragment key={w.id}>
                  <button type="button" className="tb-tr tb-wi" onClick={() => toggle(w.id)}>
                    <span className="tb-chev">{isOpen(w.id) ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</span>
                    <span className="tb-td tb-wi-main"><b>{w.title}{w.amended && <em className="tb-tag">含修订</em>}</b><small>{w.deliverable ? `交付：${w.deliverable}` : w.sourceClause}</small></span>
                    <span className="tb-td" style={{ width: 110 }}>{w.requirementCount} 条 · 强制 {w.mandatoryCount}</span>
                    <span className="tb-td" style={{ width: 70 }}>{w.reviewCount ? <Dot label={String(w.reviewCount)} /> : <span className="tb-muted">—</span>}</span>
                    <span className="tb-td" style={{ width: 100 }}>{w.assigneeRole}{w.reviewerRole ? ' / ' + w.reviewerRole : ''}</span>
                    <span className="tb-td tb-muted" style={{ width: 64 }}>{w.end?.slice(5)}</span>
                    <span className="tb-td tb-muted" style={{ width: 64 }}>{STATUS[w.status] || w.status}</span>
                  </button>
                  {isOpen(w.id) && (
                    <div className="tb-sub">
                      <div className="tb-subtable">
                        <div className="tb-tr is-head is-sub">
                          <Th label="编号" hint="要求编号" w={60} />
                          <Th label="要求" hint="要求要点" />
                          <Th label="强度" hint="否决 / 强制 / 一般" w={96} />
                          <Th label="待确认" hint="原因" w={110} />
                          <Th label="判断来源" hint="AI / 规则 / 人工" w={96} />
                          <Th label="出处" hint="文件 / 页码" w={170} />
                        </div>
                        {reqs.map((it) => (
                          <React.Fragment key={it.id}>
                            <button type="button" className={'tb-tr tb-req' + (openReq === it.id ? ' open' : '')} onClick={() => setOpenReq(openReq === it.id ? null : it.id)}>
                              <span className="tb-td tb-muted" style={{ width: 60 }}>{openReq === it.id ? <ChevronDown size={11} /> : <ChevronRight size={11} />}{it.id.slice(1)}</span>
                              <span className="tb-td tb-req-text">{it.summary || it.title}</span>
                              <span className={'tb-td' + (strong(it.strength) ? ' is-bold' : ' tb-muted')} style={{ width: 96 }}>{it.strength ? STRENGTH_LABEL[it.strength] : '—'}</span>
                              <span className="tb-td" style={{ width: 110 }}>{it.needsReview ? <Dot label={(it.reviewReasons?.[0] || '待确认').replace(/（.*/, '').slice(0, 8)} /> : <span className="tb-muted">—</span>}</span>
                              <span className={'tb-td tb-src-' + (it.source || 'rule')} style={{ width: 96 }}>{sourceLabel(it)}</span>
                              <span className="tb-td tb-muted" style={{ width: 170 }}>{where(it)}</span>
                            </button>
                            {openReq === it.id && <ClauseDetail it={it} workItems={items} current={w} onReview={onReview} layout="inline" />}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  )}
                </React.Fragment>
              ))}
            </React.Fragment>
          ))}
          {!groups.length && <div className="tb-empty">没有符合条件的要求</div>}
        </div>
      </div>
    );
  }

  const cur = selected ? itemOf.get(selected.id) : undefined;
  const pos = selected ? visible.findIndex((v) => v.id === selected.id) : -1;
  return (
    <div className="tb-root">
      {toolbar}
      <div className="tb-split">
        <div className="tb-list">
          {groups.map((g) => (
            <React.Fragment key={g.label}>
              <div className="tb-list-cat">{g.label}</div>
              {g.rows.map(({ w, reqs }) => {
                const o = isOpen(w.id) || reqs.some((r) => r.id === selected?.id);
                return (
                  <React.Fragment key={w.id}>
                    <button type="button" className="tb-list-wi" onClick={() => toggle(w.id)}>
                      {o ? <ChevronDown size={13} /> : <ChevronRight size={13} />}<b>{w.title}</b><span>{reqs.length} 条</span>
                      <span className="tb-grow" />{!!w.reviewCount && <Dot label={`${w.reviewCount} 待确认`} />}
                    </button>
                    {o && reqs.map((it) => (
                      <button type="button" key={it.id} className={'tb-list-req' + (selected?.id === it.id ? ' on' : '')} onClick={() => setSel(it.id)}>
                        <span><b>{it.summary || it.title}</b><small>{it.strength ? STRENGTH_LABEL[it.strength] : '无强度'} · {where(it)}{it.source === 'human' ? ' · 已复核' : ''}</small></span>
                        {it.needsReview && <i className="tb-dot-only" />}
                      </button>
                    ))}
                  </React.Fragment>
                );
              })}
            </React.Fragment>
          ))}
          {!groups.length && <div className="tb-empty">没有符合条件的要求</div>}
        </div>
        <div className="tb-panel">
          {selected ? (
            <>
              <div className="tb-panel-head">
                <div className="tb-crumb"><span>{CAT_LABEL[selected.category]}  /  {cur?.title || '—'}  /  {selected.id}</span>
                  <span className="tb-nav"><span>{pos + 1} / {visible.length}</span>
                    <button type="button" aria-label="上一条" disabled={pos <= 0} onClick={() => setSel(visible[pos - 1]?.id || null)}><ChevronUp size={15} /></button>
                    <button type="button" aria-label="下一条" disabled={pos >= visible.length - 1} onClick={() => setSel(visible[pos + 1]?.id || null)}><ChevronDown size={15} /></button></span></div>
                <h4>{selected.summary || selected.title}</h4>
                <div className="tb-panel-state">{selected.needsReview ? <Dot label={`待确认${selected.confidence !== undefined ? ` · 模型置信度 ${selected.confidence}` : ''}`} /> : selected.source === 'human' ? <span className="is-green">已复核</span> : <span className="tb-muted">无需确认</span>}
                  {cur && <span className="tb-muted">负责 {cur.assigneeRole}</span>}{cur?.end && <span className="tb-muted">截止 {cur.end.slice(5)}</span>}
                  <a className="tb-link" title={selected.fileName}><ExternalLink size={11} />{selected.fileName.slice(0, 32)}</a></div>
              </div>
              <ClauseDetail it={selected} workItems={items} current={cur} onReview={onReview} onDone={next} layout="panel" />
            </>
          ) : <div className="tb-empty">左侧选一条要求</div>}
        </div>
      </div>
    </div>
  );
}
