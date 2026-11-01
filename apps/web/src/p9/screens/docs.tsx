// P9.4 招标文件：空态（四种导入）→ AI 解析中（四步进度）→ 已解析（章节树 + 拆标分解表）。
import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, CircleCheck, Download, FileText, FileUp, FolderInput, Globe, HardDrive, Info, Loader, Send, Sparkles, Upload } from 'lucide-react';
import * as D from '../demo';
import { useP9 } from '../store';
import { Btn, Check, Pill, cx } from '../ui';

const DOC_TONE = { 进行中: 'blue', 待开始: 'gray', 阻塞: 'red', 已完成: 'green' } as const;

function Empty({ onStart }: { onStart: (name: string) => void }) {
  const file = useRef<HTMLInputElement>(null);
  return (
    <div className="p9-docs-empty">
      <span className="p9-empty-ic"><FileUp size={30} /></span>
      <h2>还没有上传招标文件</h2>
      <p>上传后 AI 会解析章节结构、生成拆标分解条目，并按配置表带出默认责任人与工期。</p>
      <div className="p9-btn-row is-center">
        <input ref={file} type="file" hidden accept=".pdf,.doc,.docx" multiple onChange={e => { const f = e.target.files?.[0]; if (f) onStart(f.name); }} />
        <Btn kind="primary" size="lg" icon={Upload} onClick={() => file.current?.click()}>上传招标文件</Btn>
        <Btn kind="outline" size="lg" icon={FolderInput} onClick={() => onStart('XX储能项目招标文件_终版.pdf')}>从商机附件导入</Btn>
        <Btn kind="outline" size="lg" icon={HardDrive} onClick={() => onStart('XX储能项目招标文件_终版.pdf')}>从V盘导入</Btn>
        <Btn kind="outline" size="lg" icon={Globe} onClick={() => onStart('XX储能项目招标文件_终版.pdf')}>从客户网站导入</Btn>
      </div>
      <div className="p9-steps3">
        {[['上传招标文件', '支持 PDF / Word，可一次传多份'], ['AI 解析并拆解', '按配置表生成条目、责任人与工期'], ['BSD 审核后派发', '审核通过自动建任务、发钉钉、建群']].map(([t, s], i) => (
          <div key={t}><span className="p9-num tone-blue">{i + 1}</span><div><b>{t}</b><small>{s}</small></div></div>
        ))}
      </div>
    </div>
  );
}

function Parsing({ name, onDone }: { name: string; onDone: () => void }) {
  const [pct, setPct] = useState(8);
  useEffect(() => {
    const t = window.setInterval(() => setPct(p => { if (p >= 100) { window.clearInterval(t); window.setTimeout(onDone, 400); return 100; } return p + 3; }), 160);
    return () => window.clearInterval(t);
  }, [onDone]);
  const step = pct < 25 ? 1 : pct < 60 ? 2 : pct < 85 ? 3 : 4;
  return (
    <div className="p9-docs-empty">
      <span className="p9-ring" style={{ '--pct': pct } as React.CSSProperties}><b>{pct}%</b></span>
      <h2>正在解析招标文件…</h2>
      <p>{name} · 42 页 · 预计还需约 {Math.max(0, Math.round((100 - pct) * 0.8))} 秒</p>
      <div className="p9-parse-card">
        <div className="p9-parse-head"><b>解析进度</b><span className="p9-grow" /><span className="tone-blue">{Math.min(step, 4)} / 4 步</span></div>
        <div className="p9-parse-bar"><i style={{ width: pct + '%' }} /></div>
        {D.PARSE_STEPS.map(([t, s], i) => {
          const st = i + 1 < step || pct >= 100 ? 'done' : i + 1 === step ? 'now' : 'todo';
          return (
            <div key={t} className={'p9-parse-step is-' + st}>
              <span className="p9-parse-ic">{st === 'done' ? <CircleCheck size={12} /> : st === 'now' ? <Loader size={11} className="spin" /> : null}</span>
              <div><b>{t}</b><small>{st === 'done' && i === 2 ? '34 条候选要求' : s}</small></div>
            </div>
          );
        })}
      </div>
      <p className="p9-hint-line"><Info size={11} />解析在后台进行，可以先去其他 Tab，完成后会通知你</p>
    </div>
  );
}

export function Docs() {
  const { docsState, setDocsState, notify, call, bid, setTab } = useP9();
  const [fileName, setFileName] = useState('XX储能项目招标文件_终版.pdf');
  const [openCh, setOpenCh] = useState('第四章 技术要求');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const reupload = useRef<HTMLInputElement>(null);
  if (docsState === 'empty') return <Empty onStart={n => { setFileName(n); setDocsState('parsing'); }} />;
  if (docsState === 'parsing') return <Parsing name={fileName} onDone={() => { setDocsState('parsed'); notify('解析完成：已生成 34 条拆标分解条目，命中配置表 28 条'); }} />;
  return (
    <div className="p9-docs">
      <section className="p9-card p9-chapters">
        <header className="p9-card-head"><div className="p9-card-head-left"><FileText size={14} className="ic-blue" /><h3>招标文件</h3></div><span className="p9-card-hint">v3.0 终版</span></header>
        <p className="p9-chapters-meta">XX储能项目招标文件.pdf · 42 页 · 已解析 34 条</p>
        <div className="p9-tree">
          {D.CHAPTERS.map(c => (
            <React.Fragment key={c.name}>
              <button type="button" className={cx('p9-tree-row', openCh === c.name && 'is-open')} onClick={() => setOpenCh(openCh === c.name ? '' : c.name)}>
                {openCh === c.name ? <ChevronDown size={11} /> : <ChevronRight size={11} />}<span className="p9-grow">{c.name}</span><small>{c.count} 条</small>
              </button>
              {openCh === c.name && (c.subs || []).map(s => <div key={s} className="p9-tree-sub"><i />{s}</div>)}
            </React.Fragment>
          ))}
        </div>
        <span className="p9-grow" />
        <input ref={reupload} type="file" hidden onChange={e => { const f = e.target.files?.[0]; if (f) { setFileName(f.name); setDocsState('parsing'); } }} />
        <footer className="p9-card-foot is-left"><button type="button" className="p9-link" onClick={() => reupload.current?.click()}><Upload size={11} />上传新版招标文件</button></footer>
      </section>
      <section className="p9-card is-grow">
        <header className="p9-card-head">
          <div className="p9-card-head-left"><h3>拆标分解表</h3><span className="p9-card-hint">34 条 · 命中 28/34</span></div>
          <div className="p9-card-head-right">
            <Btn kind="ai" size="sm" icon={Sparkles} onClick={async () => { await call(`/bids/${encodeURIComponent(bid.id)}/ai/decompose`, 'POST', {}); notify('AI 已重新解析：人工改过的条目不覆盖，新增 0 条'); }}>AI 解析</Btn>
            <button type="button" className="p9-sq-btn is-sm" aria-label="导入" onClick={() => reupload.current?.click()}><Upload size={12} /></button>
            <button type="button" className="p9-sq-btn is-sm" aria-label="导出" onClick={() => notify('已导出拆标分解表（Excel）')}><Download size={12} /></button>
            <Btn kind="primary" size="sm" icon={Send} disabled={submitted} onClick={() => { setSubmitted(true); notify('已提交 BSD 审核：拆解表版本已锁定，BSD 收到待办'); window.setTimeout(() => setTab('plan'), 900); }}>{submitted ? '已提交 BSD' : '提交 BSD 审核'}</Btn>
          </div>
        </header>
        <div className="p9-table" style={{ '--cols': '18px minmax(0,1fr) 56px 84px 86px 60px' } as React.CSSProperties}>
          <div className="p9-tr is-head"><div /><div className="p9-th">条目 / 来源条款</div><div className="p9-th">类别</div><div className="p9-th">责任人</div><div className="p9-th">排期</div><div className="p9-th">状态</div></div>
          {D.DOC_GROUPS.map(g => (
            <React.Fragment key={g.cat}>
              <div className="p9-tr is-group"><b>{g.cat}</b><small>{g.count} 条</small></div>
              {g.rows.map(r => {
                const blocked = r.status === '阻塞';
                return (
                  <div key={r.title} className="p9-tr is-32">
                    <Check checked={checked.has(r.title)} onChange={() => setChecked(s => { const n = new Set(s); n.has(r.title) ? n.delete(r.title) : n.add(r.title); return n; })} label={r.title} />
                    <span className={cx('p9-doc-title', blocked && 'tone-red')}>{r.title}</span>
                    <span><Pill tone={g.cat === '技术' ? 'blue' : g.cat === '交付' ? 'green' : 'purple'} shape="tag">{g.cat}</Pill></span>
                    <span className={cx('p9-td-c', !r.owner && 'tone-red is-bold')}>{r.owner || '未派'}</span>
                    <span className="p9-td-c is-muted p9-mono">{r.date}</span>
                    <span className={'p9-status-dot tone-' + DOC_TONE[r.status]}><i />{r.status}</span>
                  </div>
                );
              })}
            </React.Fragment>
          ))}
          {showAll && <div className="p9-tr is-group is-muted-row"><span className="p9-muted">其余 25 条（第一 / 二 / 三 / 六章）已按配置表派发，筛选「未派」可只看 6 条待指派</span></div>}
        </div>
        <footer className="p9-card-foot"><span>共 34 条 · 已派 22 · 未派 6 · 已完成 6</span><button type="button" className="p9-link" onClick={() => setShowAll(!showAll)}>{showAll ? '收起' : '展开其余 25 条'}</button></footer>
      </section>
    </div>
  );
}
