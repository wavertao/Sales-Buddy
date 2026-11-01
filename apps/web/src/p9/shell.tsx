// P9 布局外壳：左侧栏（对话记录 + 功能板块）、详情页顶栏 / 节点条 / Tab 行、右侧常驻投标助理。
import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowUp, AtSign, Bot, CalendarDays, Check, ChevronRight, ChevronUp, ChevronsRight, Clock3, Compass, FileText, Gavel,
  LayoutGrid, Lightbulb, MessageSquare, Mic, PanelLeft, Plus, Radar, Settings, Sparkles, SquarePen, BriefcaseBusiness, TrendingUp, Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import * as D from './demo';
import { TABS, useP9 } from './store';
import { cx } from './ui';

const HISTORY: [string, string[]][] = [['今天', ['CATL 组织架构与决策链', '宁德时代 · 续约策略', '本周商机推进复盘']], ['昨天', ['比亚迪储能项目报价', '华东区线索转化分析']], ['更早', ['写今天的日报']]];
const FEATURES: [string, LucideIcon, string][] = [
  ['投标全流程', Gavel, 'p9'], ['线索与商机', TrendingUp, 'crm'], ['客户360', Compass, 'crm'], ['商务活动', CalendarDays, 'crm'],
  ['资讯雷达', Radar, 'advisor'], ['我的日报', FileText, 'advisor'], ['我的工具箱', BriefcaseBusiness, 'knowledge'], ['好想法', Lightbulb, 'advisor'],
];

export function Sidebar() {
  const { exit, setView, user } = useP9();
  const [histOpen, setHistOpen] = useState(true);
  const [featOpen, setFeatOpen] = useState(true);
  const name = user?.name || '张小小';
  return (
    <aside className="p9-side">
      <div className="p9-side-brand">
        <span className="p9-logo"><Sparkles size={15} /></span><b>Sales Buddy</b><span className="p9-grow" />
        <button type="button" className="p9-plain" onClick={() => exit('advisor')} title="返回工作空间"><PanelLeft size={16} /></button>
      </div>
      <section className="p9-side-panel is-history">
        <header><MessageSquare size={15} className="ic-blue" /><b>对话记录</b><span className="p9-grow" />
          <button type="button" className="p9-side-btn tone-blue" title="新对话" onClick={() => exit('advisor')}><Plus size={14} /></button>
          <button type="button" className="p9-side-btn" title={histOpen ? '收起' : '展开'} onClick={() => setHistOpen(!histOpen)}><ChevronUp size={14} className={cx(!histOpen && 'rot-180')} /></button>
        </header>
        {histOpen && <div className="p9-side-body">{HISTORY.map(([label, items], gi) => (
          <React.Fragment key={label}>
            <div className="p9-side-label">{label}</div>
            {items.map((t, i) => <button type="button" key={t} className={cx('p9-hist', gi === 0 && i === 0 && 'is-on')} onClick={() => exit('advisor')}><MessageSquare size={14} /><span>{t}</span></button>)}
          </React.Fragment>
        ))}</div>}
      </section>
      <section className="p9-side-panel">
        <header><LayoutGrid size={15} className="ic-blue" /><b>功能板块</b><span className="p9-grow" />
          <button type="button" className="p9-side-btn" onClick={() => setFeatOpen(!featOpen)} title={featOpen ? '收起' : '展开'}><ChevronUp size={14} className={cx(!featOpen && 'rot-180')} /></button>
        </header>
        {featOpen && <div className="p9-side-body is-feature">{FEATURES.map(([label, Icon, page]) => (
          <button type="button" key={label} className={cx('p9-feat', page === 'p9' && 'is-on')} onClick={() => page === 'p9' ? setView('list') : exit(page)}>
            <Icon size={16} /><span>{label}</span><ChevronRight size={14} />
          </button>
        ))}</div>}
      </section>
      <div className="p9-grow" />
      <div className="p9-side-user"><span className="p9-user-av">{name.slice(0, 1)}</span><span className="p9-grow">{name}</span><button type="button" className="p9-plain" onClick={() => exit('settings')} title="设置"><Settings size={16} /></button></div>
    </aside>
  );
}

/** 详情页顶栏 + 节点条 + 11 个 Tab。 */
export function DetailHeader({ right }: { right?: React.ReactNode }) {
  const { bid, node, setView, tab, setTab, setModal, notify, live, call, dockOpen, setDockOpen } = useP9();
  const daysLeft = live?.daysLeft ?? 12;
  const curRound = 'R2';
  return (
    <>
      <div className="p9-topbar">
        <div className="p9-topbar-left">
          <button type="button" className="p9-back" onClick={() => setView('list')} aria-label="返回投标列表"><ArrowLeft size={14} /></button>
          <span className="p9-bid-no">{bid.number} · {curRound}</span>
          <span className="p9-slash">/</span>
          <b className="p9-bid-name">{bid.customer} · {bid.project}</b>
          <span className="p9-status-pill"><i />进行中 · 节点 {D.NODE_NO[node]} {D.NODES[node]}</span>
        </div>
        <div className="p9-topbar-right">
          {right ?? <>
            <span className="p9-time-pill"><Clock3 size={11} />距开标 {daysLeft} 天</span>
            <button type="button" className={cx('p9-ai-btn', dockOpen && 'is-on')} onClick={() => setDockOpen(!dockOpen)} aria-pressed={dockOpen}><Sparkles size={13} />和纵横对话</button>
            <button type="button" className="p9-group-btn" onClick={async () => { const r = await call(`/bids/${encodeURIComponent(bid.id)}/group`, 'POST', {}); notify(r?.url ? '已建群：' + r.url : '已发起建群：SPP 团队 6 人已拉入钉钉群'); }}><Users size={13} />一键建群</button>
          </>}
        </div>
      </div>
      <div className="p9-nodebar">
        {D.NODES.map((n, i) => {
          const state = i < node ? 'done' : i === node ? 'now' : 'todo';
          const date = i === node ? `剩 ${daysLeft} 天` : D.NODE_DATES[i] === '剩 12 天' ? '10-14' : D.NODE_DATES[i];
          return (
            <button type="button" key={n} className={cx('p9-node', 'is-' + state)} disabled={state === 'todo'}
              onClick={() => setModal(i === node ? { kind: 'advance' } : { kind: 'rollback', to: i })}
              title={i === node ? '点击推进到下一节点' : state === 'done' ? `回退到「${n}」` : n}>
              <span className="p9-node-top"><span className="p9-node-dot">{state === 'done' ? <Check size={9} strokeWidth={3} /> : state === 'now' ? <i /> : null}</span>{i < 9 && <span className="p9-node-line" />}</span>
              <span className="p9-node-name">{n}</span>
              <span className="p9-node-date">{date}</span>
              {state === 'now' && <span className="p9-node-badge">3</span>}
            </button>
          );
        })}
      </div>
      <nav className="p9-tabs" role="tablist">
        {TABS.map(([id, label, dot]) => (
          <button type="button" role="tab" aria-selected={tab === id} key={id} className={cx('p9-tab', tab === id && 'is-on')} onClick={() => setTab(id)}>
            {label}{dot && <i className="p9-tab-dot" />}
          </button>
        ))}
      </nav>
    </>
  );
}

const REPLIES: [RegExp, string][] = [
  [/风险|有救/, '真正的风险只有两处：技术标 12 项强制响应、报价未过 BSD。今天若闭环，按时交标没问题。'],
  [/待办/, '我的待办 5 项，其中 2 条逾期、1 条今日到期：先闭环「补齐 3 个基本信息字段」与「指派 2 条拆解条目的责任人」。'],
  [/进度|到哪/, '当前节点 ③ 标书分解，距交标 12 天，健康度 68（安全线 80），3 个卡点、2 条逾期任务。'],
  [/催/, '已催办：报价过会已发给李明与 BSD，18:00 前未回将升级 L3，并同步到部门主管的日报。'],
  [/响应清单|技术标/, '技术标 12 项强制响应：已完成 8 项，陈磊名下还有 4 项待回填参数（4.3 消防认证、UL9540A、并网测试、可用率测算）。'],
];

/** 右侧常驻投标助理。variant="cockpit" 为驾驶舱的渐变头像 + 会话版；其余屏为上下文条 + 快捷问。 */
export function Dock({ variant = 'default', context, initial }: { variant?: 'default' | 'cockpit'; context?: { badges: string[]; note: string }; initial?: D.ChatMsg[] }) {
  const { bid, call, live, dockOpen, setDockOpen } = useP9();
  const [msgs, setMsgs] = useState<D.ChatMsg[]>(initial ?? [D.DOCK_WELCOME]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs]);
  const send = async (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    const now = new Date().toTimeString().slice(0, 5);
    setMsgs(m => [...m, { who: 'me', text: t, meta: now }]);
    setQ(''); setBusy(true);
    const r = await call(`/bids/${encodeURIComponent(bid.id)}/assistant/chat`, 'POST', { question: t });
    const canned = REPLIES.find(([re]) => re.test(t))?.[1] ?? `已引用本标数据回答：健康度 ${live?.health?.score ?? 68}，3 个卡点里「技术标缺 12 项强制响应」最危险。结论仅供内部参考。`;
    setMsgs(m => [...m, { who: 'ai', text: r?.reply || r?.answer || canned, meta: now + ' · 已引用本标数据' }]);
    setBusy(false);
  };
  // 收起态不占位，点顶栏「和纵横对话」展开
  if (!dockOpen) return null;
  const ctx = context ?? { badges: [`${bid.number} · R2`, '节点 ③ 标书分解', `健康度 ${live?.health?.score ?? 68}`], note: '已接入：健康度 / 卡点 / 逾期任务 / 澄清 · 实时' };
  return (
    <aside className={cx('p9-dock', 'is-' + variant)}>
      <header className="p9-dock-head">
        <span className={cx('p9-dock-av', variant === 'cockpit' && 'is-grad')}>{variant === 'cockpit' ? <Sparkles size={14} /> : <Bot size={14} />}</span>
        <div className="p9-grow"><b>投标助理</b><small>AI · 已接入本标 21 项数据</small></div>
        <button type="button" className={cx('p9-dock-btn', variant === 'cockpit' && 'tone-blue')} title="新对话" onClick={() => setMsgs([D.DOCK_WELCOME])}><SquarePen size={13} /></button>
        <button type="button" className="p9-dock-btn" title="收起" aria-label="收起投标助理" onClick={() => setDockOpen(false)}><ChevronsRight size={13} /></button>
      </header>
      {variant === 'default' && <>
        <div className="p9-dock-ctx">
          <div className="p9-dock-badges">{ctx.badges.map((b, i) => <span key={b} className={cx(i === 0 && 'is-main')}>{b}</span>)}</div>
          <small>{ctx.note}</small>
        </div>
        <div className="p9-dock-quick">{D.DOCK_QUICK.map(x => <button type="button" key={x} onClick={() => void send(x)}>{x}</button>)}</div>
      </>}
      <div className="p9-dock-chat">
        {variant === 'cockpit' && <div className="p9-dock-date"><span>今天 · 10-24 · 本标会话</span></div>}
        {msgs.map((m, i) => m.who === 'me'
          ? <div key={i} className="p9-msg-me"><p>{m.text}</p><small>{m.meta}</small></div>
          : <div key={i} className="p9-msg-ai"><span className="p9-msg-tag"><Bot size={11} />投标助理</span><p>{m.text}</p>
            {m.chips && <div className="p9-msg-chips">{m.chips.map(c => <button type="button" key={c} onClick={() => void send(c)}>{c}</button>)}</div>}
            <small>{m.meta}</small></div>)}
        {busy && <div className="p9-msg-ai is-busy"><span className="p9-msg-tag"><Bot size={11} />投标助理</span><p>正在查本标数据…</p></div>}
        <div ref={end} />
      </div>
      <div className="p9-dock-input">
        <div className="p9-dock-box">
          <textarea value={q} rows={2} onChange={e => setQ(e.target.value)} placeholder="问问这个标的事，或说一句「催一下报价过会」…" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(q); } }} />
          <div className="p9-dock-ctrl">
            <Plus size={14} />{variant === 'cockpit' ? <AtSign size={14} /> : <Mic size={14} />}<span className="p9-grow" />
            {variant === 'cockpit' && <Mic size={14} />}
            <button type="button" className="p9-send" onClick={() => void send(q)} aria-label="发送"><ArrowUp size={13} /></button>
          </div>
        </div>
        <small>AI 会引用本标数据回答 · 结论仅供内部参考</small>
      </div>
    </aside>
  );
}
