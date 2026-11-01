// P9.8 交标与结果（AI 交标体检 + 标书清单 + 交标结果）· P9.9 BAFO 对比 · P9.10 定标复盘
import React, { useRef, useState } from 'react';
import {
  Archive, ArrowRight, BookOpen, ChevronDown, ChevronRight, Download, FileDiff, FileText, Flag, FolderOpen, GitCompare, Loader, MessageSquare,
  NotebookPen, PenLine, Play, Plus, Send, ShieldCheck, Sparkles, Upload, Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import * as D from '../demo';
import { useP9 } from '../store';
import { Btn, Card, Num, Pill, SectionHead, cx } from '../ui';
import type { Tone } from '../ui';

const SEC_TONE: Record<string, Tone> = { 偏差未闭环: 'red', 待检查: 'orange', 未复查: 'orange', 已通过: 'green' };

export function Submit() {
  const { notify, setTab, setTodoId, setClarId, todos, call, bid } = useP9();
  // 「去处理」直接打开对应待办 / 澄清详情；接口数据里按标题匹配同一条待办
  const goItem = (s: D.CheckSection, it: NonNullable<D.CheckSection['items']>[number]) => {
    if (it.clar) { setTab('todos'); setClarId(it.clar); return; }
    if (it.todo) { const t = todos.find(x => x.id === it.todo) || todos.find(x => it.title.includes(x.title.slice(0, 6))); setTab('todos'); if (t) setTodoId(t.id); return; }
    setTab(s.key === 'checklist' ? 'files' : 'bafo');
  };
  const [sections, setSections] = useState(D.CHECK_SECTIONS);
  const [open, setOpen] = useState('todo');
  const [checking, setChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState('10-24 09:40');
  const [files, setFiles] = useState(D.TENDER_FILES);
  const [signing, setSigning] = useState(false);
  const upload = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<string | null>(null);
  const runCheck = async () => {
    setChecking(true);
    await call(`/bids/${encodeURIComponent(bid.id)}/ai/check`, 'POST', {});
    window.setTimeout(() => { setChecking(false); setLastCheck(new Date().toTimeString().slice(0, 5)); notify('AI 交标体检完成：齐备性 5 项缺 1，四源核查 3 项偏差未闭环'); }, 900);
  };
  const missing = files.filter(f => !f.uploaded).length;
  return (
    <div className="p9-col is-gap12">
      <Card icon={Sparkles} title="AI 交标体检" hint={`手动发起 · 上次检查 ${lastCheck}`} right={<><Pill tone="orange">风险：中</Pill><Btn kind="primary" size="sm" icon={checking ? Loader : Play} disabled={checking} onClick={() => void runCheck()}>{checking ? '检查中…' : '开始检查'}</Btn></>}>
        <div className="p9-secs is-tight">
          <div className="p9-ai-summary"><Sparkles size={11} />{D.CHECK_SUMMARY.replace('齐备性 5 项缺 1（报价表待上传）', missing ? `齐备性 5 项缺 ${missing}（报价表待上传）` : '齐备性 5 项齐全')}</div>
          {sections.map(s => {
            const isOpen = open === s.key && !!s.items;
            return (
              <div key={s.key} className="p9-sec">
                <SectionHead name={s.name} summary={s.summary} bar={s.bar}
                  badge={<Pill tone={SEC_TONE[s.state]}>{s.state}</Pill>}
                  action={s.action ? <span className="tone-blue">{s.action}</span> : <>{isOpen ? '收起' : '展开'}{isOpen ? <ChevronDown size={10} className="rot-180" /> : <ChevronRight size={10} />}</>}
                  onAction={() => s.action ? (setSections(ss => ss.map(x => x.key === s.key ? { ...x, state: '待检查', summary: '王强（技术负责人）· 已发起，待签字' } : x)), notify('已发起人工复查：王强收到签字待办')) : setOpen(isOpen ? '' : s.key)} />
                {isOpen && (
                  <div className="p9-check-items">
                    {s.items!.map(it => (
                      <div key={it.title} className="p9-check-item">
                        <i className="p9-dot tone-red" /><b>{it.title}</b><span className="p9-grow" /><small>{it.meta}</small>
                        <button type="button" className="p9-link" onClick={() => notify('已催办：' + it.meta.split(' ')[0])}>催办</button>
                        <Btn kind="primary" size="sm" onClick={() => goItem(s, it)}>去处理</Btn>
                      </div>
                    ))}
                    {s.note && <small className="p9-check-note">{s.note}</small>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
      <Card icon={FolderOpen} title={`标书清单 · ${files.length}`} hint="上传后 AI 自动核对齐备性与强制响应条款" right={<Btn kind="primary" size="sm" icon={Upload} onClick={() => { setTarget(null); upload.current?.click(); }}>上传标书</Btn>} flush>
        <input ref={upload} type="file" hidden onChange={e => {
          const f = e.target.files?.[0]; if (!f) return;
          const meta = `${target ? 'v1' : 'v1'} · ${(f.size / 1048576).toFixed(1)} MB · 刚刚`;
          setFiles(fs => target ? fs.map(x => x.name === target ? { ...x, uploaded: true, meta } : x) : [...fs, { name: f.name, meta, uploaded: true }]);
          notify('已上传，AI 正在核对齐备性与强制响应条款'); e.target.value = '';
        }} />
        <div className="p9-filelist">
          {files.map(f => (
            <div key={f.name} className="p9-filelist-row">
              <FileText size={12} className="ic-gray" /><b>{f.name}</b><small>{f.meta}</small><span className="p9-grow" />
              <Pill tone={f.uploaded ? 'green' : 'orange'}>{f.uploaded ? '已上传' : '待上传'}</Pill>
              <Btn kind="outline" size="sm" onClick={() => { setTarget(f.name); upload.current?.click(); }}>{f.uploaded ? '替换' : '上传'}</Btn>
            </div>
          ))}
        </div>
      </Card>
      <Card icon={Flag} title="交标结果" hint={undefined} right={<Btn kind="primary" size="sm" icon={PenLine} disabled={signing} onClick={() => { setSigning(true); notify(missing ? '已发起签章流程（提示：报价表盖章版尚未上传）' : '已发起投标签章流程，审批单号回写后自动更新'); }}>{signing ? '签章流程审批中' : '发起投标签章流程'}</Btn>} flush>
        <div className="p9-result-rows">
          <div><span>交标时间</span><b className="tone-orange">2026-11-05 14:00 · 待交标</b></div>
          <div><span>递交人</span><b>李明 SLS · 陪同 王强 PM</b></div>
          <div><span>交标凭证</span><b>待上传 · 上传后节点 ⑦ 自动完成</b></div>
        </div>
      </Card>
    </div>
  );
}

export function Bafo() {
  const { notify, live, rounds } = useP9();
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const pending = D.BAFO_DIFFS.filter(d => !d.ok && !confirmed.has(d.f)).length;
  const cur = rounds.find(r => r.state === 'now');
  // 报价单严格权限：后端 quote-visibility 不可见时只展示状态（不展示金额 / 文件）
  const locked = live?.quoteVisible === false;
  return (
    <div className="p9-col is-gap12">
      <section className="p9-card p9-final-bar">
        <span className="p9-final-text">最终版 = 最新技术方案 v3 + 报价单 v3（严格权限）</span><span className="p9-grow" />
        <Btn kind="primary" size="lg" icon={Send} disabled={submitted || locked} onClick={() => { setSubmitted(true); notify('最终版已提交：技术方案 v3 + 报价单 v3，报价单按权限分发'); }}>{submitted ? '已提交最终版' : '提交最终版'}</Btn>
      </section>
      <Card icon={GitCompare} title="BAFO 版本差异对比" hint="AI 逐字段比对 · 只呈现差异，不给定价建议" right={<Pill tone="blue">当前 {cur?.no} · {cur?.no === 'R2' ? '短名单' : cur?.label}</Pill>}
        footer={<><span>R1 → R2 共 3 处差异 · 版本与流程记录已归档</span><button type="button" className="p9-link" onClick={() => notify(locked ? '报价版本文件仅 SPP PM / SLS 可见' : '已打开版本文件：技术方案 v1–v3 · 报价单 v1–v3')}>查看版本文件<ChevronRight size={10} /></button></>} flush>
        <div className="p9-table" style={{ '--cols': '90px 190px minmax(0,1fr) 64px' } as React.CSSProperties}>
          <div className="p9-tr is-head">{['轮次', '版本', '关键差异', '结论'].map(h => <div key={h} className="p9-th">{h}</div>)}</div>
          {D.BAFO_ROUNDS.map(r => (
            <div key={r.r} className="p9-tr is-72 is-top">
              <div className="p9-td-stack"><b>{r.r}</b><small>{r.time}</small></div>
              <div className="p9-td-stack"><b>{locked && r.v !== '待提交' ? '已报价' : r.v}</b><small>{r.vNote}</small></div>
              <div className="p9-td-c">{r.diff}</div>
              <div><Pill tone={r.tone as Tone}>{r.concl}</Pill></div>
            </div>
          ))}
        </div>
      </Card>
      <Card icon={FileDiff} title="AI 字段级差异 · R1 → R2" hint="仅列差异项，相同字段不展示" right={<Pill tone="orange">{D.BAFO_DIFFS.length} 处差异 · {pending} 处待确认</Pill>}
        footer={<><span>AI 仅记录差异与流程，不评估价格影响；付款节点差异待业务确认</span><button type="button" className="p9-link" onClick={() => notify('已导出差异对比（PDF）')}>导出差对比<Download size={10} /></button></>} flush>
        <div className="p9-diffs">
          {D.BAFO_DIFFS.map(d => {
            const ok = d.ok || confirmed.has(d.f);
            return (
              <div key={d.f} className="p9-diff">
                <b>{d.f}</b><span className="p9-diff-old">{d.old}</span><ArrowRight size={11} className="ic-gray" />
                <span className={cx('p9-diff-new', ok ? 'tone-green' : 'tone-orange')}>{d.next}</span>
                <button type="button" className="p9-diff-state" disabled={ok} onClick={() => { setConfirmed(s => new Set(s).add(d.f)); notify(`「${d.f}」差异已确认`); }}><Pill tone={ok ? 'green' : 'orange'}>{ok ? '已确认' : '待确认'}</Pill></button>
              </div>
            );
          })}
        </div>
      </Card>
      <section className="p9-card p9-access">
        <div className="p9-access-head"><b>报价单权限 · 严格管控</b><span className="p9-grow" /><Pill tone="red">仅 2 角色可见</Pill></div>
        <p>报价单不随标书群发：默认仅 SPP PM / SLS 可见；其他人只看到「已报价」状态，下载需审批并加水印，全部操作留痕。</p>
        {locked && <p className="p9-locked">报价内容仅 admin 与投标 pricingTeam 成员可见 —— 你当前只能看到「已报价」状态。</p>}
        {D.QUOTE_ACCESS.map(([who, perm, st, tone]) => <div key={who} className="p9-access-row"><b>{who}</b><span>{perm}</span><span className="p9-grow" /><Pill tone={tone as Tone}>{st}</Pill></div>)}
      </section>
    </div>
  );
}

const SINK_ICON: Record<string, LucideIcon> = { 'book-open': BookOpen, users: Users, 'message-square': MessageSquare, 'shield-check': ShieldCheck };

export function Review() {
  const { notify, call, bid } = useP9();
  const [reasons, setReasons] = useState<Set<string>>(new Set(['价格', '技术未达']));
  const [note, setNote] = useState('');
  const [written, setWritten] = useState<Set<number>>(new Set());
  const [confirmed, setConfirmed] = useState(false);
  return (
    <div className="p9-col is-gap12">
      <Card icon={Sparkles} iconTone="purple" title="AI 复盘结论" hint="基于 R1–R3 版本差异、评标反馈与偏差台账生成" right={<Pill tone={confirmed ? 'green' : 'purple'}>{confirmed ? '已确认' : '草稿 · 待确认'}</Pill>}>
        <div className="p9-review">
          <p className="p9-review-main">{D.REVIEW.conclusion}</p>
          <div className="p9-reasons"><span>落标原因</span>
            {D.REVIEW.reasons.map(r => <button type="button" key={r} className={cx('p9-reason-chip', reasons.has(r) && 'is-on')} onClick={() => setReasons(s => { const n = new Set(s); n.has(r) ? n.delete(r) : n.add(r); return n; })}>{r}</button>)}
            <small>AI 预选，可改；中标时切换为赢单原因</small>
          </div>
          <div className="p9-attrib"><Sparkles size={11} />{D.REVIEW.attribution}</div>
          <input className="p9-note-input" value={note} onChange={e => setNote(e.target.value)} placeholder="补充说明（选填）：评标现场问答要点、客户口头反馈…" />
          <div className="p9-btn-row"><Btn kind="primary" size="sm" onClick={async () => { setConfirmed(true); await call(`/bids/${encodeURIComponent(bid.id)}/close`, 'POST', { result: 'lost', reason: [...reasons].join('、'), lessons: D.REVIEW.lessons.map(l => l[0]) }); notify('复盘结论已确认归档，沉淀去向开始生成'); }} disabled={confirmed}>确认结论并归档</Btn></div>
        </div>
      </Card>
      <Card icon={NotebookPen} title={`经验沉淀 · ${D.REVIEW.lessons.length} 条 Lesson`} hint="确认后写入案例库 · 同步竞对库" right={<Pill tone={written.size === 3 ? 'green' : 'orange'}>{written.size === 3 ? '已写入' : '待确认'}</Pill>}
        footer={<><span>3 条 Lesson 均已预生成 · 确认后归档</span><button type="button" className="p9-link" onClick={() => notify('已导出复盘报告（PDF）')}>导出复盘报告<Download size={10} /></button></>} flush>
        <div className="p9-lessons">
          {D.REVIEW.lessons.map(([t, s], i) => (
            <div key={t} className="p9-lesson"><Num n={i + 1} tone="blue" /><div className="p9-grow"><b>{t}</b><small>{s}</small></div>
              <Btn kind="outline" size="sm" icon={written.has(i) ? undefined : Plus} disabled={written.has(i)} onClick={() => { setWritten(w => new Set(w).add(i)); notify(`「${t}」已写入案例库`); }}>{written.has(i) ? '已写入' : '写入案例库'}</Btn>
            </div>
          ))}
        </div>
      </Card>
      <Card icon={Archive} title="沉淀去向 · 结论归档后自动生成" right={<Pill tone="gray">3 项待生成 · 1 项可带入</Pill>} flush>
        <div className="p9-sinks">
          {D.REVIEW.sinks.map(([k, v, st, ic]) => {
            const Icon = SINK_ICON[ic] || FileText;
            return <div key={k} className="p9-sink"><Icon size={12} className="ic-gray" /><b>{k}</b><span className="p9-grow">{v}</span>{st === '可带入' && <button type="button" className="p9-link" onClick={() => notify('合同 register 预览：3 项偏差将带入合同评审')}>查看<ChevronRight size={10} /></button>}<Pill tone={st === '可带入' ? 'purple' : confirmed ? 'green' : 'gray'}>{confirmed && st !== '可带入' ? '已生成' : st}</Pill></div>;
          })}
        </div>
      </Card>
    </div>
  );
}
