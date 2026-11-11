// P9.4 招标文件（接后端）：空态（上传整包 / 选样本）→ 解析中（标书解析流水线四步）→ 已解析（文件角色、关键字段、修订引用、拆标分解条目）。
// 解析结果按「类别 + 文件」合并成分解条目写回投标（bid_item），点条目可展开看它包含的原始要求。
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, CircleCheck, Download, FileUp, FolderInput, FolderOpen, Globe, HardDrive, Info, Loader, Send, Upload } from 'lucide-react';
import type { DecompItem, ExcludedClause, TenderJob, TenderParseResult, TenderProgress } from '../../../../../packages/contracts/tender';
import { TENDER_CATEGORIES } from '../../../../../packages/contracts/tender';
import { CAT_LABEL, DecompCard, DecompRow, ExcludedCard, FieldsCard, FilesCard, JudgeNote, Kpi, OverridesCard, exportCsv, fmtSize, type ReviewFn } from '../../tender/TenderResult';
import { mapPlan } from '../live';
import { useP9 } from '../store';
import { Btn, Pill, cx } from '../ui';

type Sample = { id: string; name: string; kind: 'single' | 'package'; files: number; size: number };
type WorkItem = { id: string; title: string; category: string; sourceClause: string; assigneeRole: string; reviewerRole?: string; end: string; status: string; requirementIds?: string[]; requirementCount?: number; mandatoryCount?: number; riskCount?: number; reviewCount?: number; amended?: boolean; deliverable?: string; grouping?: 'model' | 'fallback' };
type Bundle = { doc: { filename: string; version: string; size: string } | null; result: TenderParseResult | null; items: WorkItem[]; job?: TenderJob | null; canReview?: boolean };
const STEPS: [TenderProgress['stage'], string, string][] = [['extract', '文件抽取', '读取正文 / 规范 / 修订 / 澄清 / 报价表 / 图纸'], ['judge', '条款判断', '配置了模型时逐批判断，否则按规则打标'], ['summary', '生成拆标分解条目', '按类别 + 文件合并，写回投标']];
const POLL_MS = 1500;
const STATUS: Record<string, string> = { pending: '待开始', in_progress: '进行中', done: '已完成', blocked: '阻塞' };
const token = () => localStorage.getItem('sb-token') || '';

function Empty({ onSample, onUpload }: { onSample: (s: Sample) => void; onUpload: (files: FileList | null) => void }) {
  const { api, notify } = useP9();
  const file = useRef<HTMLInputElement>(null);
  const dir = useRef<HTMLInputElement>(null);
  const [samples, setSamples] = useState<Sample[] | null>(null);
  const openSamples = () => { if (samples) setSamples(null); else void api('/tender/samples').then((r: { packages: Sample[] }) => setSamples(r.packages)).catch(() => notify('样本库读取失败')); };
  return (
    <div className="p9-docs-empty">
      <span className="p9-empty-ic"><FileUp size={30} /></span>
      <h2>还没有上传招标文件</h2>
      <p>可以一次传整包（正文、技术规范、修订、澄清、报价表、图纸都放进来），AI 会识别每个文件的角色，拆出要求并归到技术 / 交付 / 价格 / 商务 / 偏差，再生成拆标分解条目。</p>
      <div className="p9-btn-row is-center">
        <input ref={file} type="file" hidden multiple onChange={e => onUpload(e.target.files)} />
        <input ref={dir} type="file" hidden multiple {...({ webkitdirectory: '' } as Record<string, string>)} onChange={e => onUpload(e.target.files)} />
        <Btn kind="primary" size="lg" icon={Upload} onClick={() => file.current?.click()}>上传招标文件</Btn>
        <Btn kind="outline" size="lg" icon={FolderOpen} onClick={() => dir.current?.click()}>上传整包文件夹</Btn>
        <Btn kind="outline" size="lg" icon={FolderInput} onClick={openSamples}>从样本库选择</Btn>
        <Btn kind="outline" size="lg" icon={HardDrive} onClick={() => notify('从V盘导入：即将上线')}>从V盘导入</Btn>
        <Btn kind="outline" size="lg" icon={Globe} onClick={() => notify('从客户网站导入：即将上线')}>从客户网站导入</Btn>
      </div>
      {samples && (
        <div className="p9-parse-card p9-sample-pick">
          <div className="p9-parse-head"><b>样本库</b><span className="p9-grow" /><span className="p9-muted">{samples.length} 个</span></div>
          {samples.map(s => (
            <button type="button" key={s.id} className="p9-tree-row" onClick={() => onSample(s)}>
              {s.kind === 'package' ? <FolderOpen size={12} /> : <FileUp size={12} />}<span className="p9-grow">{s.name}</span><small>{s.kind === 'package' ? `${s.files} 个 · ` : ''}{fmtSize(s.size)}</small>
            </button>
          ))}
        </div>
      )}
      <div className="p9-steps3">
        {[['上传招标整包', 'PDF / Word / Excel，可一次传多份'], ['AI 解析并拆解', '按「标书解析规则」生成条目、责任人与截止'], ['BSD 审核后派发', '审核通过自动建任务、发钉钉、建群']].map(([t, s], i) => (
          <div key={t}><span className="p9-num tone-blue">{i + 1}</span><div><b>{t}</b><small>{s}</small></div></div>
        ))}
      </div>
    </div>
  );
}

function Parsing({ name, progress }: { name: string; progress?: TenderProgress }) {
  // 进度全部来自后台任务，不做模拟：抽取占 20%，判断占 70%，汇总占 10%
  const step = STEPS.findIndex(([k]) => k === (progress?.stage || 'extract'));
  const ratio = progress && progress.total ? progress.done / progress.total : 0;
  const pct = Math.round(step === 0 ? ratio * 20 : step === 1 ? 20 + ratio * 70 : 90 + ratio * 10);
  return (
    <div className="p9-docs-empty">
      <span className="p9-ring" style={{ '--pct': pct } as React.CSSProperties}><b>{pct}%</b></span>
      <h2>正在解析招标文件…</h2>
      <p>{name} · 配置模型后大包可能要几分钟，可以先离开，回来会继续显示进度</p>
      <div className="p9-parse-card">
        <div className="p9-parse-head"><b>解析进度</b><span className="p9-grow" /><span className="tone-blue">{step + 1} / {STEPS.length} 步</span></div>
        <div className="p9-parse-bar"><i style={{ width: pct + '%' }} /></div>
        {STEPS.map(([k, t, s], i) => {
          const st = i < step ? 'done' : i === step ? 'now' : 'todo';
          return (
            <div key={k} className={'p9-parse-step is-' + st}>
              <span className="p9-parse-ic">{st === 'done' ? <CircleCheck size={12} /> : st === 'now' ? <Loader size={11} className="spin" /> : null}</span>
              <div><b>{t}</b><small>{st === 'now' && progress?.message ? progress.message : s}</small></div>
            </div>
          );
        })}
      </div>
      <p className="p9-hint-line"><Info size={11} />解析规则在左侧「标书解析规则」页维护</p>
    </div>
  );
}

function WorkItems({ items, result, onReview }: { items: WorkItem[]; result: TenderParseResult; onReview?: ReviewFn }) {
  const [open, setOpen] = useState<string | null>(null);
  const [req, setReq] = useState<string | null>(null);
  const byId = useMemo(() => new Map(result.items.map(i => [i.id, i])), [result]);
  const groups = TENDER_CATEGORIES.map(c => ({ label: c.label, rows: items.filter(i => i.category === c.label) })).filter(g => g.rows.length);
  return (
    <div className="p9-table" style={{ '--cols': '14px minmax(0,1fr) 120px 70px 64px 60px' } as React.CSSProperties}>
      <div className="p9-tr is-head"><div /><div className="p9-th">条目 / 来源</div><div className="p9-th">要求 · 强制 · 风险</div><div className="p9-th">负责 / 复核</div><div className="p9-th">截止</div><div className="p9-th">状态</div></div>
      {groups.map(g => (
        <React.Fragment key={g.label}>
          <div className="p9-tr is-group"><b>{g.label}</b><small>{g.rows.length} 个条目 · {g.rows.reduce((n, r) => n + (r.requirementCount || 0), 0)} 条要求</small></div>
          {g.rows.map(r => {
            const isOpen = open === r.id;
            const reqs = (r.requirementIds || []).map(id => byId.get(id)).filter(Boolean) as DecompItem[];
            return (
              <React.Fragment key={r.id}>
                <button type="button" className="p9-tr is-32 p9-tr-btn" onClick={() => setOpen(isOpen ? null : r.id)}>
                  {isOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  <span className="p9-doc-title" title={r.sourceClause}>
                    <span className="p9-wi-title">{r.title}{r.amended && <Pill tone="blue" shape="tag">含修订</Pill>}{!!r.reviewCount && <Pill tone="orange" shape="tag">待确认 {r.reviewCount}</Pill>}</span>
                    <small className="p9-wi-sub">{r.deliverable ? `交付：${r.deliverable}` : r.sourceClause}</small>
                  </span>
                  <span className="p9-td-c">{r.requirementCount} · <b>{r.mandatoryCount}</b> · <span className={cx(!!r.riskCount && 'tone-red is-bold')}>{r.riskCount}</span></span>
                  <span className="p9-td-c">{r.assigneeRole}{r.reviewerRole ? ' / ' + r.reviewerRole : ''}</span>
                  <span className="p9-td-c is-muted p9-mono">{r.end?.slice(5)}</span>
                  <span className="p9-td-c">{STATUS[r.status] || r.status}</span>
                </button>
                {isOpen && (
                  <div className="p9-req-box">
                    <table className="tp-table tp-decomp">
                      <thead><tr><th>编号</th><th>类别</th><th>要求</th><th>强度</th><th>风险</th><th>出处</th><th>负责 / 复核</th><th>截止</th></tr></thead>
                      <tbody>{reqs.map(it => <DecompRow key={it.id} it={it} open={req === it.id} toggle={() => setReq(req === it.id ? null : it.id)} onReview={onReview} />)}</tbody>
                    </table>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
}

export function LiveDocs() {
  const { api, bid, notify, setTab, setPlan, today } = useP9();
  const [data, setData] = useState<Bundle | null>(null);
  const [job, setJob] = useState<TenderJob | null>(null);
  const [view, setView] = useState<'items' | 'reqs' | 'excluded'>('items');
  const [excluded, setExcluded] = useState<ExcludedClause[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [uploading, setUploading] = useState('');
  const reupload = useRef<HTMLInputElement>(null);
  const base = '/bids/' + encodeURIComponent(bid.id);
  useEffect(() => {
    setData(null); setJob(null);
    void api(base + '/tender').then((b: Bundle) => { setData(b); setJob(b.job || null); }).catch(() => setData({ doc: null, result: null, items: [] }));
  }, [base]);

  const jobId = job?.id;
  useEffect(() => {
    if (!jobId) return;
    let alive = true;
    const tick = () => void api('/tender/jobs/' + jobId).then(async (j: TenderJob) => {
      if (!alive) return;
      if (j.status === 'running') { setJob(j); timer = window.setTimeout(tick, POLL_MS); return; }
      if (j.status === 'failed') notify('解析失败：' + (j.error || '未知原因'));
      else void api(base + '/plan').then((p: { items?: Record<string, unknown>[] }) => { if (p?.items?.length) setPlan(mapPlan(p.items, today)); }).catch(() => undefined);
      const b: Bundle = await api(base + '/tender');
      if (!alive) return;
      setData(b); setJob(null); setSubmitted(false);
      if (j.status === 'done' && b.result) notify(`解析完成：${b.result.stats.items} 条要求，${b.items.length} 个拆标分解条目`);
    }).catch((e: Error) => { if (alive) { notify('读取解析进度失败：' + e.message); setJob(null); } });
    let timer = window.setTimeout(tick, POLL_MS);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [jobId, base]);

  const runId = data?.result?.id;
  useEffect(() => {
    if (view !== 'excluded' || !runId) return;
    void api(base + '/tender/excluded').then(setExcluded).catch((e: Error) => notify('读取已排除条款失败：' + e.message));
  }, [view, runId, base]);
  const review: ReviewFn = async (key, body) => {
    try {
      const b: Bundle = await api(`${base}/tender/clauses/${key}`, { method: 'PATCH', body });
      setData(b);
      if (view === 'excluded') setExcluded(await api(base + '/tender/excluded'));
      void api(base + '/plan').then((p: { items?: Record<string, unknown>[] }) => { if (p?.items?.length) setPlan(mapPlan(p.items, today)); }).catch(() => undefined);
      notify(body.isRequirement ? '已保存复核结果' : '已排除，可以在「已排除」里捞回');
    } catch (e) { notify('保存失败：' + (e as Error).message); }
  };
  async function parseSample(s: Sample) {
    try { setJob(await api(base + '/tender/parse', { method: 'POST', body: { sample: s.id } })); }
    catch (e) { notify('解析失败：' + (e as Error).message); }
  }
  async function upload(list: FileList | null) {
    if (!list?.length) return;
    const form = new FormData();
    const first = (list[0] as File & { webkitRelativePath?: string }).webkitRelativePath?.split('/')[0];
    form.append('name', first || list[0].name);
    for (const f of Array.from(list)) form.append('files', f, (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name);
    setUploading(first || list[0].name);
    try {
      const r = await fetch('/api' + base + '/tender/upload', { method: 'POST', headers: { Authorization: 'Bearer ' + token() }, body: form });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || j.error);
      setJob(j);
    } catch (e) { notify('解析失败：' + (e as Error).message); } finally { setUploading(''); if (reupload.current) reupload.current.value = ''; }
  }

  if (uploading) return <Parsing name={uploading} />;
  if (job) return <Parsing name={job.packageName} progress={job.progress} />;
  if (!data) return <div className="p9-docs-empty"><Loader size={16} className="spin" /></div>;
  if (!data.result) return <Empty onSample={parseSample} onUpload={upload} />;
  const r = data.result;
  const s = r.stats;
  const onReview = data.canReview ? review : undefined;
  return (
    <div className="p9-docs-live">
      <section className="p9-card">
        <header className="p9-card-head">
          <div className="p9-card-head-left"><FileUp size={14} className="ic-blue" /><h3>{r.packageName}</h3><span className="p9-card-hint">{data.doc?.version} · 规则 v{r.ruleVersion} · {r.createdAt.slice(0, 16).replace('T', ' ')} · 用时 {(r.durationMs / 1000).toFixed(1)} 秒</span></div>
          <div className="p9-card-head-right">
            <input ref={reupload} type="file" hidden multiple onChange={e => upload(e.target.files)} />
            <Btn kind="outline" size="sm" icon={Upload} onClick={() => reupload.current?.click()}>上传新版</Btn>
            <Btn kind="outline" size="sm" icon={Download} onClick={() => { exportCsv(r); notify('已导出拆标分解表（CSV）'); }}>导出</Btn>
            <Btn kind="primary" size="sm" icon={Send} disabled={submitted} onClick={() => { setSubmitted(true); notify('已提交 BSD 审核：拆解表版本已锁定，BSD 收到待办'); window.setTimeout(() => setTab('plan'), 900); }}>{submitted ? '已提交 BSD' : '提交 BSD 审核'}</Btn>
          </div>
        </header>
        <div className="tp-kpis p9-docs-kpis">
          <Kpi label="文件 / 页" value={`${s.files} / ${s.pages}`} />
          <Kpi label="拆出要求" value={s.items} tone="blue" />
          <Kpi label="分解条目" value={data.items.length} tone="blue" />
          <Kpi label="强制 / 否决项" value={s.mandatory} />
          <Kpi label="高风险" value={s.risks.high} tone={s.risks.high ? 'red' : undefined} />
          <Kpi label="修订 / 澄清引用" value={r.overrides.length} />
        </div>
        <div className="p9-docs-warn"><JudgeNote r={r} /></div>
        {!!r.warnings.length && <div className="tp-alert orange p9-docs-warn"><div>{r.warnings.map(w => <div key={w}>{w}</div>)}</div></div>}
      </section>
      <div className="tp-two"><FilesCard r={r} /><FieldsCard fields={r.fields} /></div>
      {!!r.overrides.length && <OverridesCard r={r} />}
      <section className="p9-card">
        <header className="p9-card-head">
          <div className="p9-card-head-left"><h3>拆标分解表</h3><span className="p9-card-hint">{data.items.length} 个条目 · {s.items} 条要求 · {data.items.some((i) => i.grouping === 'model') ? '模型按工作项归纳' : '按「类别 + 文件」合并'}，点条目看原始要求</span></div>
          <div className="p9-card-head-right">
            <div className="tp-seg">
              <button type="button" className={view === 'items' ? 'on' : ''} onClick={() => setView('items')}>按条目</button>
              <button type="button" className={view === 'reqs' ? 'on' : ''} onClick={() => setView('reqs')}>按要求（{s.items}）</button>
              <button type="button" className={view === 'excluded' ? 'on' : ''} onClick={() => setView('excluded')}>已排除（{r.judge?.excluded ?? 0}）</button>
            </div>
          </div>
        </header>
        {view === 'items' && <WorkItems items={data.items} result={r} onReview={onReview} />}
        {view === 'reqs' && <DecompCard r={r} onReview={onReview} />}
        {view === 'excluded' && <ExcludedCard rows={excluded} onReview={onReview} />}
        <footer className="p9-card-foot"><span>{TENDER_CATEGORIES.map(c => `${CAT_LABEL[c.key]} ${s.byCategory[c.key]}`).join(' · ')}</span></footer>
      </section>
    </div>
  );
}
