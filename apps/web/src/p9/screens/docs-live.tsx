// P9.4 标书拆解（接后端）：空态（上传整包 / 选样本）→ 解析中（后台任务真实进度）→ 已解析。
// 已解析分三个子 Tab：拆标分解表（默认，列表 / 左右两种视图，复核在表内完成）、解析概况、已排除。
import React, { useEffect, useRef, useState } from 'react';
import { CircleCheck, Download, FileArchive, FileUp, FolderInput, FolderOpen, Globe, HardDrive, Info, Loader, Send, Upload } from 'lucide-react';
import type { ExcludedClause, TenderJob, TenderParseResult, TenderProgress } from '../../../../../packages/contracts/tender';
import { Coverage, ExcludedCard, FieldsCard, FilesCard, JudgeNote, Kpi, OverridesCard, fmtSize, type ReviewFn } from '../../tender/TenderResult';
import { TenderBreakdown, type WorkItem } from '../../tender/TenderBreakdown';
import { exportBreakdownXlsx } from '../../tender/export-xlsx';
import { openTenderFile } from '../../tender/open-file';
import { mapPlan } from '../live';
import { useP9 } from '../store';
import { Btn } from '../ui';

type Sample = { id: string; name: string; kind: 'single' | 'package'; files: number; size: number };
type Bundle = { doc: { filename: string; version: string; size: string } | null; result: TenderParseResult | null; items: WorkItem[]; job?: TenderJob | null; canReview?: boolean; canBsd?: boolean; bsd?: Bsd | null };
type Bsd = { status: 'pending' | 'approved' | 'rejected'; version: string; submittedBy: string; submittedAt: string; reviewedBy?: string; reviewedAt?: string; notes?: string; dispatched?: number };
const at = (s?: string) => (s ? s.slice(5, 16).replace('T', ' ') : '');
const STEPS: [TenderProgress['stage'], string, string][] = [['extract', '文件抽取', '读取正文 / 规范 / 修订 / 澄清 / 报价表 / 图纸'], ['judge', '条款判断', '配置了模型时逐批判断，否则按规则打标'], ['summary', '归纳工作项', '模型按工作项归纳，写回投标']];
const POLL_MS = 1500;
type Sub = 'breakdown' | 'overview' | 'excluded';
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

export function LiveDocs() {
  const { api, bid, notify, setTab, setPlan, today } = useP9();
  const [data, setData] = useState<Bundle | null>(null);
  const [job, setJob] = useState<TenderJob | null>(null);
  const [sub, setSub] = useState<Sub>('breakdown');
  const [excluded, setExcluded] = useState<ExcludedClause[]>([]);
  const [bsdBusy, setBsdBusy] = useState(false);
  const [rejectNote, setRejectNote] = useState<string | null>(null);
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
      setData(b); setJob(null);
      if (j.status === 'done' && b.result) notify(`解析完成：${b.result.stats.items} 条要求，${b.items.length} 个拆标分解条目`);
    }).catch((e: Error) => { if (alive) { notify('读取解析进度失败：' + e.message); setJob(null); } });
    let timer = window.setTimeout(tick, POLL_MS);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [jobId, base]);

  const runId = data?.result?.id;
  useEffect(() => {
    if (sub !== 'excluded' || !runId) return;
    void api(base + '/tender/excluded').then(setExcluded).catch((e: Error) => notify('读取已排除条款失败：' + e.message));
  }, [sub, runId, base]);
  const review: ReviewFn = async (key, body) => {
    try {
      const b: Bundle = await api(`${base}/tender/clauses/${key}`, { method: 'PATCH', body });
      setData(b);
      if (sub === 'excluded') setExcluded(await api(base + '/tender/excluded'));
      void api(base + '/plan').then((p: { items?: Record<string, unknown>[] }) => { if (p?.items?.length) setPlan(mapPlan(p.items, today)); }).catch(() => undefined);
      notify(!body.isRequirement || (body.party && body.party !== 'bidder') ? '已移到「已排除」，需要时可以捞回' : '已保存复核结果');
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
  const bsd = data.bsd || null;
  const refreshPlan = () => void api(base + '/plan').then((p: { items?: Record<string, unknown>[] }) => { if (p?.items?.length) setPlan(mapPlan(p.items, today)); }).catch(() => undefined);
  const bsdCall = async (path: string, body: Record<string, unknown>, done: (b: Bundle) => string) => {
    setBsdBusy(true);
    try { const b: Bundle = await api(base + '/tender/bsd/' + path, { method: 'POST', body }); setData(b); notify(done(b)); refreshPlan(); }
    catch (e) { notify((e as Error).message); } finally { setBsdBusy(false); }
  };
  const submitBsd = () => void bsdCall('submit', {}, () => '已提交 BSD 审核：这一版已锁定，BSD 收到审核待办');
  const approveBsd = () => void bsdCall('review', { decision: 'approve' }, (b) => `已通过 BSD 审核，下发 ${b.bsd?.dispatched ?? 0} 个任务到计划和待办`);
  const rejectBsd = () => { if (!rejectNote?.trim()) { notify('请写明修改意见'); return; } void bsdCall('review', { decision: 'reject', notes: rejectNote.trim() }, () => '已退回，PM 收到修改待办').then(() => setRejectNote(null)); };
  const excludedCount = r.judge?.excluded ?? 0;
  const addWord = async (kind: string, word: string) => {
    const label = { prohibited: '否决词', mandatory: '强制词', required: '一般要求词', risk: '风险词' }[kind];
    try { const r = await api('/tender/rules/keyword', { method: 'POST', body: { kind, word } }); notify(`已把「${word}」加为${label}，规则更新为 v${r.version}，下次解析生效`); }
    catch (e) { notify('加词失败：' + (e as Error).message); }
  };
  const openFile = (fileId: string, name: string) => { void openTenderFile(bid.id, fileId, name).catch((e: Error) => notify(e.message)); };
  return (
    <div className="p9-docs-live tb-page">
      <div className="tb-subtabs">
        <nav>
          {([['breakdown', '拆标分解表', data.items.length], ['overview', '解析概况', null], ['excluded', '已排除', excludedCount]] as [Sub, string, number | null][]).map(([k, l, n]) => (
            <button type="button" key={k} className={sub === k ? 'on' : ''} onClick={() => setSub(k)}>{l}{n !== null && <span>{n}</span>}</button>
          ))}
        </nav>
        <div className="tb-subtabs-right">
          <span className="tb-subtabs-meta"><FileArchive size={12} /> {r.packageName} · {data.doc?.version} · {r.createdAt.slice(5, 10)} 解析 · {r.judge?.mode === 'model' ? '模型判断' : '规则判断'}</span>
          <input ref={reupload} type="file" hidden multiple onChange={e => upload(e.target.files)} />
          <Btn kind="outline" size="sm" icon={Upload} disabled={bsd?.status === 'pending'} onClick={() => reupload.current?.click()}>上传新版</Btn>
          <Btn kind="outline" size="sm" icon={Download} onClick={() => { void api(base + '/tender/excluded').catch(() => []).then((ex: ExcludedClause[]) => exportBreakdownXlsx(r, data.items, ex)).then(() => notify('已导出拆标分解表（Excel：工作项、要求明细、已排除）')).catch((e: Error) => notify('导出失败：' + e.message)); }}>导出</Btn>
          <Btn kind="primary" size="sm" icon={Send} disabled={bsdBusy || bsd?.status === 'pending' || bsd?.status === 'approved'} onClick={submitBsd}>{bsd?.status === 'pending' ? 'BSD 审核中' : bsd?.status === 'approved' ? '已通过 BSD' : bsd?.status === 'rejected' ? '重新提交 BSD' : '提交 BSD 审核'}</Btn>
        </div>
      </div>
      {bsd && (
        <div className={'tb-bsd is-' + bsd.status}>
          {bsd.status === 'pending' && <><b>BSD 审核中</b><span>{bsd.version} · {bsd.submittedBy} {at(bsd.submittedAt)} 提交，审核完成前分解表只读</span></>}
          {bsd.status === 'approved' && <><b>已通过 BSD 审核</b><span>{bsd.reviewedBy} {at(bsd.reviewedAt)} 通过，下发 {bsd.dispatched ?? 0} 个任务{bsd.notes ? `；意见：${bsd.notes}` : ''}。如需修改请上传新版</span><button type="button" className="tb-linkbtn" onClick={() => setTab('plan')}>去计划查看</button></>}
          {bsd.status === 'rejected' && <><b>BSD 已退回</b><span>{bsd.reviewedBy} {at(bsd.reviewedAt)}：{bsd.notes}。改完后重新提交</span></>}
          {bsd.status === 'pending' && data.canBsd && (
            <span className="tb-bsd-actions">
              {rejectNote === null
                ? <><Btn kind="primary" size="sm" disabled={bsdBusy} onClick={approveBsd}>通过并下发</Btn><Btn kind="outline" size="sm" disabled={bsdBusy} onClick={() => setRejectNote('')}>退回</Btn></>
                : <><input autoFocus value={rejectNote} maxLength={500} placeholder="写明修改意见" onChange={e => setRejectNote(e.target.value)} /><Btn kind="primary" size="sm" disabled={bsdBusy} onClick={rejectBsd}>确认退回</Btn><Btn kind="ghost" size="sm" onClick={() => setRejectNote(null)}>取消</Btn></>}
            </span>
          )}
        </div>
      )}
      <div className="tb-tabbody">
        {sub === 'breakdown' && <TenderBreakdown result={r} items={data.items} onReview={onReview} excludedCount={excludedCount} onAddWord={data.canBsd ? addWord : undefined} />}
        {sub === 'overview' && (
          <div className="tb-overview">
            <section className="p9-card">
              <header className="p9-card-head"><div className="p9-card-head-left"><FileUp size={14} className="ic-blue" /><h3>解析总结</h3><span className="p9-card-hint">规则 v{r.ruleVersion} · 用时 {(r.durationMs / 1000).toFixed(1)} 秒</span></div></header>
              <div className="tp-kpis p9-docs-kpis">
                <Kpi label="文件 / 页" value={`${s.files} / ${s.pages}`} />
                <Kpi label="我方要求" value={s.items} tone="blue" />
                <Kpi label="工作项" value={data.items.length} tone="blue" />
                <Kpi label="强制 / 否决" value={s.mandatory} />
                <Kpi label="高风险" value={s.risks.high} tone={s.risks.high ? 'red' : undefined} />
                <Kpi label="修订 / 澄清引用" value={r.overrides.length} />
              </div>
              <div className="p9-docs-warn"><Coverage r={r} onOpen={openFile} /></div>
              <div className="p9-docs-warn"><JudgeNote r={r} /></div>
              {!!r.warnings.length && <div className="tp-alert orange p9-docs-warn"><div>{r.warnings.map(w => <div key={w}>{w}</div>)}</div></div>}
            </section>
            <FieldsCard fields={r.fields} />
            <FilesCard r={r} onOpen={openFile} />
            {!!r.overrides.length && <OverridesCard r={r} />}
          </div>
        )}
        {sub === 'excluded' && <div className="tb-excluded"><ExcludedCard rows={excluded} onReview={onReview} /></div>}
      </div>
    </div>
  );
}
