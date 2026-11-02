// P9.4 招标文件（接后端）：空态（上传整包 / 选样本）→ 解析中（标书解析流水线四步）→ 已解析（文件角色、关键字段、修订引用、拆标分解条目）。
// 解析结果按「类别 + 文件」合并成分解条目写回投标（bid_item），点条目可展开看它包含的原始要求。
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, CircleCheck, Download, FileUp, FolderInput, FolderOpen, Globe, HardDrive, Info, Loader, Send, Upload } from 'lucide-react';
import type { DecompItem, TenderParseResult } from '../../../../../packages/contracts/tender';
import { TENDER_CATEGORIES } from '../../../../../packages/contracts/tender';
import { CAT_LABEL, DecompCard, DecompRow, FieldsCard, FilesCard, Kpi, OverridesCard, exportCsv, fmtSize } from '../../tender/TenderResult';
import { useP9 } from '../store';
import { Btn, Pill, cx } from '../ui';

type Sample = { id: string; name: string; kind: 'single' | 'package'; files: number; size: number };
type WorkItem = { id: string; title: string; category: string; sourceClause: string; assigneeRole: string; reviewerRole?: string; end: string; status: string; requirementIds?: string[]; requirementCount?: number; mandatoryCount?: number; riskCount?: number; amended?: boolean };
type Bundle = { doc: { filename: string; version: string; size: string } | null; result: TenderParseResult | null; items: WorkItem[] };
const STEPS: [string, string][] = [['文件抽取与角色识别', '正文 / 规范 / 修订 / 澄清 / 报价表 / 图纸'], ['切章节', '按「章节标题」规则'], ['条款打标', '分类、强制项、风险、关键字段'], ['生成拆标分解条目', '按类别 + 文件合并，写回投标']];
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

function Parsing({ name }: { name: string }) {
  const [pct, setPct] = useState(4);
  useEffect(() => {
    const t = window.setInterval(() => setPct(p => Math.min(92, p + (p < 60 ? 3 : 1))), 400);
    return () => window.clearInterval(t);
  }, []);
  const step = pct < 25 ? 1 : pct < 55 ? 2 : pct < 80 ? 3 : 4;
  return (
    <div className="p9-docs-empty">
      <span className="p9-ring" style={{ '--pct': pct } as React.CSSProperties}><b>{pct}%</b></span>
      <h2>正在解析招标文件…</h2>
      <p>{name} · 整包较大时约需 10–70 秒</p>
      <div className="p9-parse-card">
        <div className="p9-parse-head"><b>解析进度</b><span className="p9-grow" /><span className="tone-blue">{step} / 4 步</span></div>
        <div className="p9-parse-bar"><i style={{ width: pct + '%' }} /></div>
        {STEPS.map(([t, s], i) => {
          const st = i + 1 < step ? 'done' : i + 1 === step ? 'now' : 'todo';
          return (
            <div key={t} className={'p9-parse-step is-' + st}>
              <span className="p9-parse-ic">{st === 'done' ? <CircleCheck size={12} /> : st === 'now' ? <Loader size={11} className="spin" /> : null}</span>
              <div><b>{t}</b><small>{s}</small></div>
            </div>
          );
        })}
      </div>
      <p className="p9-hint-line"><Info size={11} />解析规则在左侧「标书解析规则」页维护</p>
    </div>
  );
}

function WorkItems({ items, result }: { items: WorkItem[]; result: TenderParseResult }) {
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
                  <span className="p9-doc-title" title={r.sourceClause}>{r.title}{r.amended && <Pill tone="blue" shape="tag">含修订</Pill>}</span>
                  <span className="p9-td-c">{r.requirementCount} · <b>{r.mandatoryCount}</b> · <span className={cx(!!r.riskCount && 'tone-red is-bold')}>{r.riskCount}</span></span>
                  <span className="p9-td-c">{r.assigneeRole}{r.reviewerRole ? ' / ' + r.reviewerRole : ''}</span>
                  <span className="p9-td-c is-muted p9-mono">{r.end?.slice(5)}</span>
                  <span className="p9-td-c">{STATUS[r.status] || r.status}</span>
                </button>
                {isOpen && (
                  <div className="p9-req-box">
                    <table className="tp-table tp-decomp">
                      <thead><tr><th>编号</th><th>类别</th><th>要求</th><th>强度</th><th>风险</th><th>出处</th><th>负责 / 复核</th><th>截止</th></tr></thead>
                      <tbody>{reqs.map(it => <DecompRow key={it.id} it={it} open={req === it.id} toggle={() => setReq(req === it.id ? null : it.id)} />)}</tbody>
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
  const { api, bid, notify, setTab } = useP9();
  const [data, setData] = useState<Bundle | null>(null);
  const [busy, setBusy] = useState('');
  const [view, setView] = useState<'items' | 'reqs'>('items');
  const [submitted, setSubmitted] = useState(false);
  const reupload = useRef<HTMLInputElement>(null);
  const base = '/bids/' + encodeURIComponent(bid.id);
  useEffect(() => { setData(null); void api(base + '/tender').then(setData).catch(() => setData({ doc: null, result: null, items: [] })); }, [base]);

  const done = (j: { result: TenderParseResult; items: WorkItem[] }) => {
    notify(`解析完成：${j.result.stats.items} 条要求，生成 / 更新 ${j.items.length} 个拆标分解条目`);
    return api(base + '/tender').then(setData);
  };
  async function parseSample(s: Sample) {
    setBusy(s.name);
    try { await done(await api(base + '/tender/parse', { method: 'POST', body: { sample: s.id } })); }
    catch (e) { notify('解析失败：' + (e as Error).message); } finally { setBusy(''); }
  }
  async function upload(list: FileList | null) {
    if (!list?.length) return;
    const form = new FormData();
    const first = (list[0] as File & { webkitRelativePath?: string }).webkitRelativePath?.split('/')[0];
    form.append('name', first || list[0].name);
    for (const f of Array.from(list)) form.append('files', f, (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name);
    setBusy(first || list[0].name);
    try {
      const r = await fetch('/api' + base + '/tender/upload', { method: 'POST', headers: { Authorization: 'Bearer ' + token() }, body: form });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || j.error);
      await done(j);
    } catch (e) { notify('解析失败：' + (e as Error).message); } finally { setBusy(''); if (reupload.current) reupload.current.value = ''; }
  }

  if (busy) return <Parsing name={busy} />;
  if (!data) return <div className="p9-docs-empty"><Loader size={16} className="spin" /></div>;
  if (!data.result) return <Empty onSample={parseSample} onUpload={upload} />;
  const r = data.result;
  const s = r.stats;
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
        {!!r.warnings.length && <div className="tp-alert orange p9-docs-warn"><div>{r.warnings.map(w => <div key={w}>{w}</div>)}</div></div>}
      </section>
      <div className="tp-two"><FilesCard r={r} /><FieldsCard fields={r.fields} /></div>
      {!!r.overrides.length && <OverridesCard r={r} />}
      <section className="p9-card">
        <header className="p9-card-head">
          <div className="p9-card-head-left"><h3>拆标分解表</h3><span className="p9-card-hint">{data.items.length} 个条目 · {s.items} 条要求 · 按「类别 + 文件」合并，点条目看原始要求</span></div>
          <div className="p9-card-head-right">
            <div className="tp-seg">
              <button type="button" className={view === 'items' ? 'on' : ''} onClick={() => setView('items')}>按条目</button>
              <button type="button" className={view === 'reqs' ? 'on' : ''} onClick={() => setView('reqs')}>按要求（{s.items}）</button>
            </div>
          </div>
        </header>
        {view === 'items' ? <WorkItems items={data.items} result={r} /> : <DecompCard r={r} />}
        <footer className="p9-card-foot"><span>{TENDER_CATEGORIES.map(c => `${CAT_LABEL[c.key]} ${s.byCategory[c.key]}`).join(' · ')}</span></footer>
      </section>
    </div>
  );
}
