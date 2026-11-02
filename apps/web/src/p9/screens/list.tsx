// P9.0 入口层：投标列表、商机详情 · 投标 Tab、发起投标（填写 → 结果）、搜索字段面板。
import React, { useMemo, useState } from 'react';
import { ArrowDownWideNarrow, ArrowLeft, ArrowRight, Bell, Check, ChevronDown, ChevronRight, ChevronUp, CircleAlert, CircleCheck, Ellipsis, History, Lock, PenLine, Plus, Search, Send, Smartphone, Sparkles, Users, X } from 'lucide-react';
import * as D from '../demo';
import { useP9 } from '../store';
import { Dock, Sidebar } from '../shell';
import { Btn, Modal, Pill, cx } from '../ui';
import type { Tone } from '../ui';

const STATUS_TONE: Record<string, Tone> = { 进行中: 'blue', 风险: 'orange', 已逾期: 'red', 已交标: 'green', 已定标: 'green', 已流标: 'gray' };
export const nodePct = (node: number) => Math.min(100, (node + 1) * 10);

function NodeCell({ node }: { node: number }) {
  return <div className="p9-nodecell"><b>{D.NODES[node] === '投标策略' ? '投标策略制定' : D.NODES[node]}</b><span className="p9-mini-track is-wide"><i className="tone-blue" style={{ width: nodePct(node) + '%' }} /></span></div>;
}

const SEARCH_FIELDS: [string, string][] = [['客户', '默认搜索字段'], ['商机', '默认搜索字段'], ['投标编号', '如 BID-20261010-003'], ['轮次', '首轮 / 第二轮'], ['SPP 团队', '储能 / 光伏 / 汽车'], ['当前节点', '如 标书分解'], ['发起人', '姓名'], ['负责人', '姓名'], ['交标日', '如 2026-11']];

/** P9.0.4 搜索下拉面板：最近搜索 + 按字段搜索。 */
function SearchPanel({ onClose, onSearch }: { onClose: () => void; onSearch: (q: string) => void }) {
  const [vals, setVals] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(true);
  return (
    <div className="p9-search-panel" onClick={e => e.stopPropagation()}>
      <div className="p9-sp-label">最近搜索</div>
      {['宁德时代', 'BID-20261010-003', '储能项目'].map(t => (
        <button type="button" key={t} className="p9-sp-recent" onClick={() => { onSearch(t); onClose(); }}><History size={12} /><span className="p9-grow">{t}</span><X size={10} /></button>
      ))}
      <div className="p9-sp-divider" />
      <div className="p9-sp-row"><span className="p9-sp-label">搜索字段</span><Pill tone="blue">默认：客户 + 商机</Pill><span className="p9-grow" /><button type="button" className="p9-link-gray" onClick={() => setOpen(!open)}>{open ? '收起' : '展开'}{open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}</button></div>
      {open && <div className="p9-sp-fields">{SEARCH_FIELDS.map(([k, ph], i) => (
        <label key={k} className="p9-sp-field"><span className={cx(i < 2 && 'is-strong')}>{k}</span><input value={vals[k] || ''} placeholder={ph} onChange={e => setVals({ ...vals, [k]: e.target.value })} /></label>
      ))}</div>}
      <div className="p9-sp-foot"><span>填任意字段即按该字段搜索</span><span className="p9-grow" />
        <button type="button" className="p9-link-gray" onClick={onClose}>取消</button>
        <Btn kind="primary" size="sm" iconRight={ArrowRight} onClick={() => { onSearch(Object.values(vals).filter(Boolean).join(' ')); onClose(); }}>搜索</Btn>
      </div>
    </div>
  );
}

const SORTS: [string, (a: D.BidRow, b: D.BidRow) => number][] = [
  ['按交标日升序', (a, b) => a.due.localeCompare(b.due)],
  ['按交标日降序', (a, b) => b.due.localeCompare(a.due)],
  ['按发起时间（新→旧）', (a, b) => b.fromDate.localeCompare(a.fromDate)],
  ['按当前节点（靠前优先）', (a, b) => a.node - b.node],
  ['按状态（风险优先）', (a, b) => ['已逾期', '风险', '进行中', '已交标', '已定标', '已流标'].indexOf(a.status) - ['已逾期', '风险', '进行中', '已交标', '已定标', '已流标'].indexOf(b.status)],
];

/** 排序下拉（P9.0.1 筛选条右侧）。 */
function SortMenu({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="p9-sort-wrap" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false); }}>
      <button type="button" className={cx('p9-sort', open && 'is-open')} onClick={e => { e.stopPropagation(); setOpen(!open); }} aria-haspopup="listbox" aria-expanded={open}>{value}<ArrowDownWideNarrow size={12} /></button>
      {open && <span className="p9-sort-menu" role="listbox">{SORTS.map(([k]) => (
        <button type="button" role="option" aria-selected={k === value} key={k} className={cx(k === value && 'is-on')} onClick={e => { e.stopPropagation(); onChange(k); setOpen(false); }}>{k}{k === value && <Check size={11} />}</button>
      ))}</span>}
    </span>
  );
}

export function BidList() {
  const { bids, openBid, setModal, setView, dockOpen, setDockOpen } = useP9();
  const [filter, setFilter] = useState('全部');
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [archived, setArchived] = useState(false);
  const [sort, setSort] = useState(SORTS[0][0]);
  const rows = useMemo(() => bids.filter(b =>
    (filter === '全部' || (filter === '待我处理' ? b.mine : b.status === filter)) &&
    (!q || q.split(/\s+/).every(k => (b.number + b.customer + b.project + b.owner + b.team + D.NODES[b.node]).includes(k)))
  ).sort(SORTS.find(s => s[0] === sort)![1]), [bids, filter, q, sort]);
  const count = (f: string) => f === '全部' ? bids.length + 2 : f === '待我处理' ? bids.filter(b => b.mine).length : bids.filter(b => b.status === f).length + (f === '已交标' ? 2 : f === '已定标' ? 2 : f === '已流标' ? 1 : 0);
  return (
    <div className="p9-page" onClick={() => setSearching(false)}>
      <Sidebar />
      <main className="p9-main">
        <div className="p9-topbar">
          <div className="p9-topbar-left"><h1 className="p9-h1">投标</h1><span className="p9-count-tag">{bids.length + 2} 个在跟 · {bids.filter(b => b.mine).length} 个待我处理</span></div>
          <div className="p9-topbar-right">
            <button type="button" className="p9-mobile-link" onClick={() => setView('mobile')}><Smartphone size={13} />移动端</button>
            <div className="p9-search-wrap" onClick={e => e.stopPropagation()}>
              <label className={cx('p9-search', searching && 'is-focus')}><Search size={13} /><input value={q} onFocus={() => setSearching(true)} onChange={e => setQ(e.target.value)} placeholder="搜索客户 / 项目名称" /></label>
              {searching && <SearchPanel onClose={() => setSearching(false)} onSearch={setQ} />}
            </div>
            <button type="button" className={cx('p9-ai-btn', dockOpen && 'is-on')} onClick={() => setDockOpen(!dockOpen)} aria-pressed={dockOpen}><Sparkles size={13} />和纵横对话</button>
            <Btn kind="primary" icon={Plus} onClick={() => setModal({ kind: 'create' })}>新建投标</Btn>
          </div>
        </div>
        <div className="p9-work">
          <div className="p9-body">
            <div className="p9-filter-row">
              {D.LIST_FILTERS.map(([f]) => <button type="button" key={f} className={cx('p9-chip', filter === f && 'is-on')} onClick={() => setFilter(f)}>{f} {count(f)}</button>)}
              <span className="p9-grow" />
              <SortMenu value={sort} onChange={setSort} />
            </div>
            <div className="p9-stat-row">
              {D.LIST_STATS.map(s => <div key={s.label} className="p9-stat"><span>{s.label}</span><b className={'tone-' + s.tone}>{s.label === '进行中' ? bids.filter(b => b.status === '进行中').length : s.value}</b><small>{s.note}</small></div>)}
            </div>
            <section className="p9-card is-fill">
              <header className="p9-card-head is-48">
                <div className="p9-card-head-left"><h3>我参与的投标</h3><span className="p9-card-hint">点行进入当前节点工作页</span></div>
                <div className="p9-card-head-right"><span className="p9-card-hint">共 {bids.length + 2} 个 · 显示 {rows.length}</span><Btn kind="primary" icon={Plus} onClick={() => setModal({ kind: 'create' })}>发起投标</Btn></div>
              </header>
              <div className="p9-table" style={{ '--cols': 'minmax(0,1fr) 50px 80px 50px 78px 88px 72px 44px 12px' } as React.CSSProperties}>
                <div className="p9-tr is-head">{['投标', '当前轮次', '当前节点', '负责人', 'SPP 团队', '交标 · 剩余', '发起', '状态', ''].map((h, i) => <div key={i} className="p9-th">{h}</div>)}</div>
                {rows.map(b => (
                  <div key={b.id} className="p9-tr is-click is-56" role="button" onClick={() => openBid(b.id)}>
                    <div className="p9-td-stack"><b className="p9-mono">{b.number}</b><small>{b.customer} · {b.project}</small></div>
                    <div className="p9-td-c">{b.round}</div>
                    <NodeCell node={b.node} />
                    <div className="p9-td-c">{b.owner}</div>
                    <div className="p9-td-c is-muted">{b.team}</div>
                    <div className="p9-td-stack"><span>{b.due}</span><small className={b.leftTone ? 'tone-' + b.leftTone : ''}>{b.left}</small></div>
                    <div className="p9-td-stack"><span>{b.from}</span><small className="is-9">{b.fromDate}</small></div>
                    <div className="p9-td-c"><Pill tone={STATUS_TONE[b.status]} shape="tag">{b.status}</Pill></div>
                    <ChevronRight size={12} className="ic-gray" />
                  </div>
                ))}
                {!rows.length && <div className="p9-empty-row">没有符合条件的投标</div>}
              </div>
              <span className="p9-grow" />
              <footer className="p9-card-foot">显示 {rows.length} / {bids.length + 2} · 另有 2 个已归档（流标 / 放弃）· <button type="button" className="p9-link" onClick={() => setArchived(!archived)}>{archived ? '收起归档' : '查看归档'}</button>
                {archived && <span className="p9-muted">　BID-20260901-002 已流标 · BID-20260815-001 已放弃（编号不回收）</span>}
              </footer>
            </section>
          </div>
          <Dock context={{ badges: [`${D.BIDS[0].number} · R2`, `共 ${bids.length + 2} 个在跟`, `待我处理 ${bids.filter(b => b.mine).length}`], note: '已接入：列表 / 节点 / 剩余天数' }} />
        </div>
      </main>
      <EntryModals />
    </div>
  );
}

/** P9.0.2 商机详情 · 投标 Tab */
export function OppBids() {
  const { openBid, setModal, setView, notify, bids, dockOpen, setDockOpen } = useP9();
  const [tab, setTab] = useState('投标');
  return (
    <div className="p9-page">
      <Sidebar />
      <main className="p9-main">
        <div className="p9-topbar">
          <div className="p9-topbar-left">
            <button type="button" className="p9-back" onClick={() => setView('list')} aria-label="返回"><ArrowLeft size={14} /></button>
            <span className="p9-muted-11">{D.OPP.customer}</span><span className="p9-slash">/</span><b className="p9-bid-name is-15">{D.OPP.project}</b>
            <span className="p9-status-pill"><i />{D.OPP.stage}</span><span className="p9-muted-105">{D.OPP.spec}</span>
          </div>
          <div className="p9-topbar-right">
            <button type="button" className={cx('p9-ai-btn', dockOpen && 'is-on')} onClick={() => setDockOpen(!dockOpen)} aria-pressed={dockOpen}><Sparkles size={13} />和纵横对话</button>
            <button type="button" className="p9-group-btn" onClick={() => notify('已发起建群：SPP 团队 6 人已拉入钉钉群')}><Users size={13} />一键建群</button>
            <button type="button" className="p9-sq-btn" aria-label="通知"><Bell size={15} /></button>
            <button type="button" className="p9-sq-btn" aria-label="更多"><Ellipsis size={15} /></button>
            <Btn kind="outline" icon={PenLine} onClick={() => notify('已打开记录进展：说一句或打一段字即可')}>记录进展</Btn>
          </div>
        </div>
        <nav className="p9-tabs is-opp">{['概览', '投标', '商务活动', '报价与合同', '附件'].map(t => <button type="button" key={t} className={cx('p9-tab', tab === t && 'is-on')} onClick={() => setTab(t)}>{t}</button>)}</nav>
        <div className="p9-work">
          <div className="p9-body">
            {tab !== '投标' ? <section className="p9-card is-fill p9-center-note">「{tab}」由商机详情模块提供，本期投标流程只改造「投标」Tab。</section> : (
              <section className="p9-card is-fill is-r16">
                <header className="p9-card-head is-52">
                  <div className="p9-card-head-left"><h3 className="is-14">投标</h3><span className="p9-card-hint">3 条 · 同一商机可挂多条投标，每条内部走多轮</span></div>
                  <Btn kind="primary" icon={Plus} onClick={() => setModal({ kind: 'create' })}>发起投标</Btn>
                </header>
                <div className="p9-table" style={{ '--cols': 'minmax(0,1fr) 130px 70px 100px 44px 64px 56px 40px 12px' } as React.CSSProperties}>
                  <div className="p9-tr is-head is-32">{['投标编号', '轮次', '当前节点', '交标日', '负责人', 'SPP 团队', '发起', '状态', ''].map((h, i) => <div key={i} className={cx('p9-th', i === 1 && 'is-center')}>{h}</div>)}</div>
                  {D.OPP_BIDS.map(b => (
                    <div key={b.id} className="p9-tr is-click is-64" role="button" onClick={() => openBid(bids.find(x => x.number === b.id)?.id || D.BIDS[0].id)}>
                      <div className="p9-td-stack"><b className="p9-mono">{b.id}</b><small>{b.sub}</small></div>
                      <div className="p9-td-tags">{b.rounds.map(([t, k]) => <span key={t} className={cx('p9-rtag', k === 'now' && 'is-now')}>{t}</span>)}</div>
                      <NodeCell node={b.node} />
                      <div className="p9-td-c is-105">{b.due}</div>
                      <div className="p9-td-c">{b.owner}</div>
                      <div className="p9-td-c is-muted">{b.team}</div>
                      <div className="p9-td-stack"><span className="is-105">{b.from}</span><small className="is-9">{b.fromDate}</small></div>
                      <div className="p9-td-c"><Pill tone={STATUS_TONE[b.status]} shape="tag">{b.status}</Pill></div>
                      <ChevronRight size={12} className="ic-gray" />
                    </div>
                  ))}
                </div>
                <p className="p9-note-line">流标后在本商机下新建投标并继承材料；轮次在投标内开启，不新增投标。</p>
              </section>
            )}
          </div>
          <Dock context={{ badges: [`${D.BIDS[0].number} · R2`, '投标 3 条', '当前 R2'], note: '已接入：健康度 / 卡点 / 逾期任务 / 澄清 · 实时' }} />
        </div>
      </main>
      <EntryModals />
    </div>
  );
}

function Select({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return <span className="p9-select"><select value={value} onChange={e => onChange(e.target.value)}>{options.map(o => <option key={o}>{o}</option>)}</select><ChevronDown size={12} /></span>;
}

/** P9.0.3a 发起投标 · 填写基本信息 → P9.0.3 发起投标结果 */
export function EntryModals() {
  const { modal, setModal, createBid, openBid, bids } = useP9();
  const [country, setCountry] = useState('中国');
  const [form, setForm] = useState('公开招标');
  const [target, setTarget] = useState('开发商');
  const [busy, setBusy] = useState(false);
  if (modal?.kind === 'create') {
    return (
      <Modal icon={Send} title="发起投标" width={440} onClose={() => setModal(null)} footer={<>
        <Btn kind="outline" size="lg" onClick={() => setModal(null)}>取消</Btn>
        <Btn kind="primary" size="lg" icon={Check} disabled={busy} onClick={async () => { setBusy(true); await createBid({ country, form, target }); setBusy(false); }}>发起投标</Btn>
      </>}>
        <p className="p9-modal-desc">先确认 4 个基本信息，提交后生成投标编号并进入「投标详情 · 基本信息」，其余字段按 ATB 表继续补填。</p>
        <div className="p9-mf"><span className="p9-mf-label">商机名称<i className="p9-req">*</i></span><span className="p9-mf-box is-locked">宁德时代 · 储能项目<Lock size={11} /></span></div>
        <div className="p9-mf"><span className="p9-mf-label">国家<i className="p9-req">*</i></span><Select value={country} options={D.COUNTRIES} onChange={setCountry} /></div>
        <div className="p9-mf"><span className="p9-mf-label">招标形式<i className="p9-req">*</i></span><Select value={form} options={D.BID_FORMS} onChange={setForm} /><small>可选：{D.BID_FORMS.join(' / ')}</small></div>
        <div className="p9-mf"><span className="p9-mf-label">招标对象<i className="p9-req">*</i></span><Select value={target} options={D.BID_TARGETS} onChange={setTarget} /><small>可选：{D.BID_TARGETS.join(' / ')}</small></div>
      </Modal>
    );
  }
  if (modal?.kind === 'created') {
    const go = () => { const b = bids.find(x => x.number === modal.number); setModal(null); openBid(b?.id || modal.number, 'basic'); };
    return (
      <Modal title={<span className="p9-created-title"><span className="p9-created-ic"><CircleCheck size={14} /></span>投标已发起</span>} width={440} onClose={() => setModal(null)} footer={<>
        <span className="p9-modal-foot-note">可在投标列表中随时进入</span><span className="p9-grow" />
        <Btn kind="outline" size="lg" onClick={() => setModal(null)}>关闭</Btn>
        <Btn kind="primary" size="lg" iconRight={ArrowRight} onClick={go}>前往投标详情</Btn>
      </>}>
        <p className="p9-created-desc">已基于「宁德时代 / 储能项目」创建投标，当前 R1 首轮，节点「商机判断」。</p>
        <div className="p9-kv-box">
          <div><span>投标编号</span><b className="tone-blue p9-mono">{modal.number} · R1</b></div>
          <div><span>客户 / 商机</span><b>宁德时代 / 储能项目</b></div>
          <div><span>SPP 团队</span><b>储能 SPP</b></div>
          <div><span>负责人</span><b>李明 · SLS</b></div>
        </div>
        <p className="p9-warn-line"><CircleAlert size={11} />ATB 还有 19 项待补 —— 不阻断发起，进入「商机判断」后逐项补录，缺失项自动生成待澄清</p>
      </Modal>
    );
  }
  return null;
}
