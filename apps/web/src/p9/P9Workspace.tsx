import React, { useEffect, useRef, useState } from 'react';
import './p9.css';
import { ATB_GROUPS, BAFO_DIFFS, BAFO_ROUNDS, BIDS, BLOCKERS, CHAPTERS, CHECKS, CLARS, DOC_ITEMS, FILES, HEALTH_DIMS, LESSONS, MAIN_BID_LABEL, MEETINGS, NODE_BAR, OPP_BIDS, OVERDUE, PIPELINE_LABEL, PIPELINE_STEPS, PLAN_ITEMS, STAGE_ROWS, STRATEGY_FIELDS, STRATEGY_SECTIONS, TODOS } from './data';
import type { Any, PlanItem } from './data';

type Tab = 'cockpit' | 'basic' | 'strategy' | 'plan' | 'docs' | 'meetings' | 'files' | 'todos' | 'submit' | 'bafo' | 'review';
const TABS: [Tab, string][] = [['cockpit', '驾驶舱'], ['basic', '基本信息'], ['strategy', '投标策略'], ['plan', '计划'], ['docs', '招标文件'], ['meetings', '会议'], ['files', '文件'], ['todos', '待办与澄清'], ['submit', '交标与结果'], ['bafo', 'BAFO 对比'], ['review', '定标复盘']];
const fmtDate = (d: string) => d.slice(5).replace('-', '-');
const dayIdx = (d: string) => Math.round((new Date(d).getTime() - new Date('2026-10-17').getTime()) / 86400000);
const addDays = (d: string, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };

export function P9Workspace({ api, user }: { api: (p: string, o?: Any) => Promise<Any>; user?: Any }) {
  const [view, setView] = useState<'list' | 'opp' | 'detail' | 'mobile'>('list');
  const [tab, setTab] = useState<Tab>('cockpit');
  const [bid, setBid] = useState(BIDS[0]);
  const [planMode, setPlanMode] = useState<'stage' | 'item' | 'edit'>('item');
  const [docsMode, setDocsMode] = useState<'empty' | 'parsing' | 'parsed'>('parsed');
  const [meeting, setMeeting] = useState<Any | null>(null);
  const [todoId, setTodoId] = useState<string | null>(null);
  const [modal, setModal] = useState<'' | 'create' | 'search' | 'complete' | 'comment' | 'group'>('');
  const [toast, setToast] = useState('');
  const [demo, setDemo] = useState(true);
  const [searchQ, setSearchQ] = useState('');
  const [listFilter, setListFilter] = useState('全部');
  const [showArchive, setShowArchive] = useState(false);
  const [todos, setTodos] = useState(TODOS);
  const [plan, setPlan] = useState<PlanItem[]>(PLAN_ITEMS);
  const [showAllDocs, setShowAllDocs] = useState(false);
  const [clarFilter, setClarFilter] = useState<'全部' | '未闭环' | '已进标书'>('全部');
  const [todoFilter, setTodoFilter] = useState<'全部' | '我的' | '逾期' | '提醒'>('全部');
  const [voiceText, setVoiceText] = useState('');
  const [quoteRole, setQuoteRole] = useState('SLS');
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [meetingSaved, setMeetingSaved] = useState(false);
  const [strategyNote, setStrategyNote] = useState('');
  // ---- AI 协管流水线（§8）：状态存 localStorage，键以投标编号区分 ----
  const [pipe, setPipe] = useState(() => localStorage.getItem('p9-ai-status-' + BIDS[0].id) || 'executing');
  const [paused, setPaused] = useState(false);
  const [draftPending, setDraftPending] = useState(false);
  const [strategyVersions, setStrategyVersions] = useState([
    { v: 'v1', date: '2026-10-12', state: '已采用', note: '首版方向：全生命周期 IRR / LTSA 主线。' },
    { v: 'v2（草稿）', date: '2026-10-24', state: '待确认', note: '再制作触发：新澄清（远程调试）+ BAFO R2 口径变化；变更：质保 10 年可选项单独报价、付款 3-3-4。' },
  ]);
  const [checkRun, setCheckRun] = useState(false);
  useEffect(() => { try { localStorage.setItem('p9-ai-status-' + bid.id, pipe); } catch { /* ignore */ } }, [pipe, bid.id]);
  useEffect(() => {
    // 按 §3 契约尝试拉取列表；后端未接通时走演示数据（不改契约、不冒充服务端数据）。
    api('/bids').then((r: Any) => { if (Array.isArray(r) || Array.isArray(r?.bids) || Array.isArray(r?.records)) setDemo(false); }).catch(() => setDemo(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const call = async (path: string, method = 'GET', body?: Any) => {
    if (demo) return null;
    try { return await api(path, method === 'GET' ? undefined : { method, body }); } catch { return null; }
  };
  const notify = (s: string) => { setToast(s); setTimeout(() => setToast(''), 4500); };
  const openDetail = (b: Any) => { setBid(b); setView('detail'); setTab('cockpit'); setMeeting(null); setTodoId(null); };
  const createGroup = async () => {
    const r = await call('/bids/' + bid.id + '/group', 'POST', {});
    setModal('group'); if (r?.url) notify('已建群：' + r.url); else if (!demo) notify('建群接口已调用，返回占位链接见弹层。');
  };
  // ---- 甘特拖拽：原生 HTML5 拖拽；非演示模式下先调 reschedule，失败回滚 ----
  const ganttRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; x: number; item: PlanItem } | null>(null);
  const reschedule = async (item: PlanItem, days: number) => {
    if (!days) return;
    const next = { ...item, start: addDays(item.start, days), end: addDays(item.end, days) };
    if (dayIdx(next.end) > 19 || dayIdx(next.start) < 0) { notify('改期超出排期范围（10/17–11/05），已回滚。'); return; }
    const snapshot = plan;
    setPlan(ps => ps.map(p => p.id === item.id ? next : p));
    if (demo) { notify('演示模式：后端未接通，改期仅本地生效（联调后以服务端校验为准）。'); return; }
    const r = await call('/bids/' + bid.id + '/plan/items/' + item.id + '/reschedule', 'POST', { start: next.start, end: next.end });
    if (!r) { setPlan(snapshot); notify('后端校验未通过/未接通，改期已回滚。'); }
    else notify('改期已落库：' + next.start + ' → ' + next.end);
  };
  const gantt = (items: PlanItem[]) => (
    <div className="p9-gantt" ref={ganttRef}>
      <div className="p9-gantt-head"><span>WK1 · 10/17–10/23</span><span>WK2 · 10/24–10/30</span><span>WK3 · 10/31–11/05</span><span>交标 11-05 14:00</span></div>
      {items.map(it => {
        const left = Math.max(0, dayIdx(it.start)) / 20 * 100, width = Math.max(1, (dayIdx(it.end) - dayIdx(it.start) + 1)) / 20 * 100;
        return (
          <div className="p9-gantt-row" key={it.id}>
            <span className="p9-gantt-label">{it.title} · {it.owner}</span>
            <div className="p9-gantt-track">
              <div className={'p9-bar ' + (it.status === '已逾期' ? 'late' : it.status === '已完成' ? 'done' : 'run')} draggable
                style={{ left: left + '%', width: width + '%' }}
                title="拖动任务条可改期，联动回写拆标分解表"
                onDragStart={e => { dragRef.current = { id: it.id, x: e.clientX, item: it }; }}
                onDragEnd={e => { const d = dragRef.current; if (!d) return; const w = ganttRef.current?.clientWidth || 800; const days = Math.round((e.clientX - d.x) / w * 20); void reschedule(d.item, days); dragRef.current = null; }}>
                {fmtDate(it.start)} → {fmtDate(it.end)}
              </div>
            </div>
          </div>
        );
      })}
      <p className="p9-hint">拖动任务条可改期，联动回写拆标分解表；非演示模式下改期须经后端校验（截止、依赖、节点门禁），失败回滚。</p>
    </div>
  );
  // ---- AI 推进状态条（驾驶舱 + 计划屏共用）----
  const pipeIdx = PIPELINE_STEPS.findIndex(s => s.id === pipe);
  const pipeBar = (
    <section className="p9-card p9-pipe">
      <div className="p9-pipe-head">
        <b>🤖 AI 投标协管 · 正在推着流程走</b>
        <span className={'p9-pill ' + (paused ? 'amber' : 'green')}>{paused ? '已暂停' : PIPELINE_LABEL[pipe] || pipe}</span>
        <span className="p9-muted">{demo ? '演示 Mock（已标注）' : '已接后端'} · 状态持久化在投标上</span>
      </div>
      <div className="p9-pipe-steps">
        {PIPELINE_STEPS.map((s, i) => <span key={s.id} className={'p9-step ' + (i < pipeIdx ? 'done' : i === pipeIdx ? 'now' : '')}>{i < pipeIdx ? '✓ ' : ''}{s.label}</span>)}
      </div>
      <div className="p9-row">
        <button className="p9-btn" onClick={() => setPaused(!paused)}>{paused ? '▶ 恢复 AI 推进' : '⏸ 暂停 AI 推进'}</button>
        <button className="p9-btn soft" onClick={() => { if (paused) { notify('AI 已暂停，先恢复推进再模拟下一步。'); return; } const next = PIPELINE_STEPS[Math.min(pipeIdx + 1, PIPELINE_STEPS.length - 1)]; if (next.id === 'checking') setCheckRun(true); setPipe(next.id); notify('AI 推进（演示）：' + next.label); }}>AI 推进到下一步（演示）</button>
        <button className="p9-btn soft" onClick={() => { setPipe('planning'); setDraftPending(true); void call('/bids/' + bid.id + '/ai/plan', 'POST', {}); notify('AI 已重新启动排计划（POST /api/bids/:id/ai/plan）。'); }}>重新生成 AI 计划</button>
        <span className="p9-muted">检查不通过自动回执行中，不卡死；暂停后 AI 不再自动推进、提醒与升级。</span>
      </div>
    </section>
  );
  // ---- AI 计划草稿确认条（计划屏）----
  const draftBar = (
    <section className={'p9-card p9-draft ' + (draftPending ? 'pending' : '')}>
      <div><b>AI 计划草稿{draftPending ? ' · 待确认' : ' · 已确认并下发'}</b>
        <p>以交标 2026-11-05 14:00 为锚点倒排：{plan.length} 条任务、关键路径 12 天 · 缓冲 3 天；未派责任人 2 条已标出，确认后一次下发全部任务与待办，不用一步步点。</p></div>
      {draftPending
        ? <button className="p9-btn primary big" onClick={async () => { await call('/bids/' + bid.id + '/ai/dispatch', 'POST', {}); setDraftPending(false); setPipe('dispatched'); notify('已确认并下发：计划落库，任务与待办已按 RACI 分派。'); }}>✓ 确认并下发</button>
        : <><span className="p9-pill green">已下发 · {plan.length} 条任务</span><button className="p9-btn soft" onClick={() => { setDraftPending(true); setPipe('plan_draft'); void call('/bids/' + bid.id + '/ai/plan', 'POST', {}); }}>重新生成草稿</button></>}
    </section>
  );
  // ---- 常驻投标助理 Dock（每屏右侧）----
  const [dockQ, setDockQ] = useState('');
  const [dockMsgs, setDockMsgs] = useState([
    { who: '助理', text: '我在。这个标的待办、澄清、卡点、健康度我都能直接查；也可以让我催一下责任人。', time: '刚刚 · 已引用本屏数据' },
  ]);
  const dockSend = async (q: string) => {
    if (!q.trim()) return;
    setDockMsgs(m => [...m, { who: '我', text: q, time: '刚刚' }]);
    setDockQ('');
    await call('/bids/' + bid.id + '/assistant/chat', 'POST', { question: q });
    const a = q.includes('风险') ? '真正的风险只有两处：技术标 12 项强制响应、报价未过 BSD。今天若闭环，按时交标没问题。已引用健康度与节点进度。'
      : q.includes('待办') ? '我的待办 5 项，其中 2 条逾期、1 条今日到期：先闭环「补齐 3 个基本信息字段」与「指派 2 条拆解条目责任人」。'
      : q.includes('进度') ? '当前节点 ③ 标书分解，距交标 12 天，健康度 68（安全线 80），3 个卡点、2 条逾期任务。'
      : q.includes('催') ? '已催办：报价过会已发给李明与 BSD，18:00 前未回将进 L3，并同步到部门主管的日报。'
      : '已引用本标数据回答：健康度 68，3 个卡点里「技术标缺 12 项强制响应」最危险。结论仅供内部参考。';
    setDockMsgs(m => [...m, { who: '投标助理', text: a, time: '刚刚 · 已引用本标数据' }]);
  };
  const dock = (
    <aside className="p9-dock">
      <h3>投标助理</h3><small>AI · 已接入本标 21 项数据</small>
      <div className="p9-badge">{MAIN_BID_LABEL}<br />节点 ③ 标书分解 · 健康度 68</div>
      <p className="p9-muted">已接入：健康度 / 卡点 / 逾期任务 / 澄清 · 实时</p>
      <div className="p9-chips">{['这个标的风险？', '我的待办？', '进度到哪了？'].map(q => <button key={q} onClick={() => void dockSend(q)}>{q}</button>)}</div>
      <div className="p9-chat">{dockMsgs.map((m, i) => <div key={i} className={'p9-msg ' + (m.who === '我' ? 'me' : '')}><b>{m.who}</b><p>{m.text}</p><small>{m.time}</small></div>)}</div>
      <div className="p9-row"><input value={dockQ} onChange={e => setDockQ(e.target.value)} placeholder="问问这个标的事，或说一句『催一下报价过会』…" onKeyDown={e => { if (e.key === 'Enter') void dockSend(dockQ); }} /><button className="p9-btn primary" onClick={() => void dockSend(dockQ)}>发送</button></div>
      <p className="p9-foot">AI 会引用本标数据回答 · 结论仅供内部参考</p>
    </aside>
  );
  const topbar = (
    <div className="p9-topbar">
      <div><b>{MAIN_BID_LABEL} / 宁德时代 · 储能项目</b><p>进行中 · 节点 ③ 标书分解</p></div>
      <div className="p9-row"><span className="p9-pill">距开标 12 天</span><button className="p9-btn soft" onClick={() => { const el = document.querySelector<HTMLInputElement>('.p9-dock input'); el?.focus(); }}>和纵横对话</button><button className="p9-btn primary" onClick={() => void createGroup()}>一键建群</button></div>
    </div>
  );
  const nodeBar = <div className="p9-nodes">{NODE_BAR.map((n, i) => <span key={n.n} className={i === 2 ? 'now' : i < 2 ? 'done' : ''}>{i + 1} {n.n}<small>{n.d}</small></span>)}</div>;
  const tabsBar = <div className="p9-tabs">{TABS.map(([id, label]) => <button key={id} className={tab === id ? 'on' : ''} onClick={() => { setTab(id); setMeeting(null); setTodoId(null); }}>{label}</button>)}</div>;
  const detailShell = (body: React.ReactNode) => (
    <div className="p9-detail"><div className="p9-left"><div className="p9-brand">Sales Buddy</div><p className="p9-muted">今天：CATL 组织架构与决策链 / 宁德时代 · 续约策略 / 本周商机推进复盘<br />昨天：比亚迪储能项目报价 / 华东区线索转化分析</p><div className="p9-nav">{['投标全流程', '线索与商机', '客户 360', '商务活动', '资讯雷达', '我的日报', '我的工具箱', '好想法'].map(x => <span key={x} className={x === '投标全流程' ? 'on' : ''}>{x}</span>)}</div><p>👤 张小小</p><button className="p9-btn soft" onClick={() => setView('list')}>← 回投标列表</button></div>
      <div className="p9-main">{topbar}{nodeBar}{tabsBar}{body}</div>{dock}</div>
  );
  const filteredBids = BIDS.filter(b => (listFilter === '全部' || b.status === listFilter || (listFilter === '待我处理' && ['t1', 't2'].length)) && (b.name + b.id).includes(searchQ));
  const todo = todos.find(t => t.id === todoId);
  const checkPass = CHECKS.filter(c => c.state === '待检查').length === 0;
  const reminderOf = (t: Any) => t.status === '已完成' ? '已完成' : ['10-21', '10-22', '10-23'].includes(t.due) ? '逾期 · 已升级 L2' : t.due === '今天' || t.due === '10-25' ? '到期前提醒 · 今日/明日到期' : '正常';
  const todoRows = todos.filter(t => todoFilter === '全部' || (todoFilter === '我的' && t.mine) || (todoFilter === '逾期' && reminderOf(t).startsWith('逾期')) || (todoFilter === '提醒' && reminderOf(t).includes('提醒')));

  // ============ P9.0.1 投标列表 ============
  const listView = (
    <div className="p9-shell"><div className="p9-page">
      <h1>投标</h1><p className="p9-muted">8 个在跟 · 3 个待我处理</p>
      <div className="p9-row"><input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="搜索客户 / 项目名称" /><button className="p9-btn soft" onClick={() => setModal('search')}>表头列筛选</button><button className="p9-btn primary" onClick={() => setModal('create')}>新建投标</button><button className="p9-btn soft" onClick={() => setView('mobile')}>📱 移动端 390</button></div>
      <div className="p9-row">{['全部 8', '进行中 5', '待我处理 3', '已交标 2', '已定标 2', '已流标 1'].map(p => <button key={p} className={'p9-pill-btn ' + (listFilter === p.split(' ')[0] ? 'on' : '')} onClick={() => setListFilter(p.split(' ')[0])}>{p}</button>)}<span className="p9-muted">按交标日升序</span></div>
      <div className="p9-stats"><div><b>进行中 5</b><small>其中 2 个本周交标</small></div><div><b>待我处理 3</b><small>2 条阻塞 · 1 条今日到期</small></div><div><b>卡点 3</b><small>未派责任人 2 · 排期冲突 1</small></div><div><b>中标率 42%</b><small>近 12 个月 19 投 8 中</small></div></div>
      <table className="p9-table"><thead><tr><th>投标</th><th>当前轮次</th><th>当前节点</th><th>负责人</th><th>SPP 团队</th><th>交标 · 剩余</th><th>发起</th><th>状态</th></tr></thead>
        <tbody>{filteredBids.map(b => <tr key={b.id} onClick={() => openDetail(b)}><td><b>{b.id}</b><br />{b.name}</td><td>{b.round}</td><td>{b.node}</td><td>{b.owner}</td><td>{b.team}</td><td>{b.due} · {b.left}</td><td>{b.from} {b.fromDate}</td><td>{b.status}</td></tr>)}</tbody></table>
      <p className="p9-hint">点行进入当前节点工作页 · 共 8 个 · 显示 6 · 另有 2 个已归档（流标 / 放弃）</p>
      <button className="p9-btn soft" onClick={() => setShowArchive(!showArchive)}>{showArchive ? '收起归档' : '查看归档'}</button>
      {showArchive && <p className="p9-muted">归档（演示）：BID-20260901-002 已流标 · BID-20260815-001 已放弃，编号不回收。</p>}
      <button className="p9-btn soft" onClick={() => setView('opp')}>商机详情 · 投标 Tab（宁德时代）→</button>
    </div>{dock}</div>
  );
  // ============ P9.0.2 商机详情 · 投标 Tab ============
  const oppView = (
    <div className="p9-shell"><div className="p9-page">
      <h1>宁德时代 / 储能项目</h1><p>S4 商务谈判 · 赢单 75% · 200 MW / 400 MWh · DC Block 直采</p>
      <div className="p9-row"><button className="p9-btn primary" onClick={() => void createGroup()}>一键建群</button><button className="p9-btn soft" onClick={() => notify('记录进展：已记录到商机进展（演示）。')}>记录进展</button><button className="p9-btn soft" onClick={() => setView('list')}>← 回投标列表</button></div>
      <div className="p9-tabs">{['概览', '投标', '商务活动', '报价与合同', '附件'].map(x => <button key={x} className={x === '投标' ? 'on' : ''}>{x}</button>)}</div>
      <p><b>投标 3 条 · 同一商机可挂多条投标，每条内部走多轮</b><br /><span className="p9-muted">流标后在本商机下新建投标并继承材料；轮次在投标内开启，不新增投标。</span></p>
      <button className="p9-btn primary" onClick={() => setModal('create')}>发起投标</button>
      <table className="p9-table"><thead><tr><th>投标编号</th><th>轮次</th><th>当前节点</th><th>交标日</th><th>负责人</th><th>SPP 团队</th><th>发起</th><th>状态</th></tr></thead>
        <tbody>{OPP_BIDS.map(b => <tr key={b.id} onClick={() => openDetail(BIDS.find(x => x.id === b.id) || BIDS[0])}><td>{b.id}</td><td>{b.round}</td><td>{b.node}</td><td>{b.due}</td><td>{b.owner}</td><td>{b.team}</td><td>{b.from} {b.fromDate}</td><td>{b.status}</td></tr>)}</tbody></table>
    </div>{dock}</div>
  );
  // ============ 移动端 390（按逻辑卡②描述补齐）===========
  const mobileView = (
    <div className="p9-shell"><div className="p9-page p9-mobile">
      <h2>📱 我的投标清单 · 390</h2><p className="p9-muted">按到期升序 · 演示时钟 2026-10-24</p>
      {[...BIDS].sort((a, b) => a.due.localeCompare(b.due)).map(b => (
        <div key={b.id} className="p9-mcard" onClick={() => openDetail(b)}><b>{b.name}</b><small>{b.id} · 当前节点 {b.node}</small><small>我的待办 {todos.filter(t => t.owner === b.owner).length} · 最近到期 {b.due} · {b.left}</small></div>
      ))}
      <h3>投标待办 · 按角色分组</h3>
      {['SLS', 'PM', 'SC', 'QA', 'AMD'].map(role => (
        <div key={role}><b>{role}</b>{todos.filter(t => t.role === role).map(t => (
          <label key={t.id} className="p9-mtodo"><input type="checkbox" checked={t.status === '已完成'} onChange={() => { setTodoId(t.id); setModal('complete'); }} />{t.t} · {t.owner} · {t.due} · <span className="p9-pill">{reminderOf(t)}</span></label>
        ))}</div>
      ))}
      <h3>语音补进展</h3><textarea value={voiceText} onChange={e => setVoiceText(e.target.value)} placeholder="语音转写后回写到这里…" />
      <div className="p9-row"><button className="p9-btn soft" onClick={() => setVoiceText('语音转写（模拟）：消防方案细节已补充，待陈磊确认后回写分解条目。')}>🎤 语音补进展（模拟转写）</button><button className="p9-btn primary" onClick={() => notify('进展已回写投标实体（演示）。')}>回写投标实体</button></div>
      <h3>AI 听记</h3><p className="p9-muted">开工会 / 现场澄清会录音 → 纪要 + 澄清条目 + 任务，回写投标实体。</p>
      <button className="p9-btn soft" onClick={() => notify('AI 听记（演示）：已生成纪要草稿与 3 条待办，见会议 Tab。')}>开始 AI 听记</button>
      <button className="p9-btn soft" onClick={() => setView('list')}>← 回 PC 列表</button>
    </div>{dock}</div>
  );
  // ============ P9.1.1 驾驶舱 ============
  const cockpitBody = (
    <div>
      {pipeBar}
      <section className="p9-card"><div className="p9-row"><b>AI 投标驾驶舱</b><span className="p9-muted">AI 实时解析 · 10-24 09:40 更新</span><button className="p9-btn primary" onClick={() => notify('一键催办已发给 5 人（演示）。')}>一键催办 5 人</button></div>
        <p>已解析 ATB 评审表 43 字段、拆标分解 34 条任务与 8 次澄清：健康度 68（安全线 80），3 个卡点、2 条逾期任务，距交标 12 天 —— 建议今天先闭环「技术标 12 项强制响应」与「报价文件过 BSD」。</p>
        <div className="p9-stats"><div><b>健康度 68 / 100 · 需关注</b><small>安全线 80 · 较昨日 -4 · 下降 2 项</small></div><div><b>T-12 天 · 12 天 06 小时</b><small>交标 2026-11-05 14:00 · 首轮澄清 2026-10-25 · 剩 1 天</small></div><div><b>9 剩余工作日</b><small>已扣除周末 · 2 关键截止 · 4 未闭环任务</small></div></div>
        <p>标书定稿需在 11-01 前完成；标书制作仍需 18 人日，仅剩 9 个工作日 —— 建议拆商务 / 技术两组并行，报价会前置到 10-28。</p>
        <div className="p9-grid2"><div><h4>健康度 6 维 · 每 5 分钟刷新</h4>{HEALTH_DIMS.map(d => <div key={d.k} className="p9-bar-row"><span>{d.k}</span><div className="p9-track"><i style={{ width: d.v + '%' }} /></div><b>{d.v}</b></div>)}<p className="p9-muted">下降主因：技术部分 55（技术标缺 12 项强制响应）、报价文件 64（成本未过 BSD 评审）。</p></div>
          <div><h4>卡点 · AI 识别（废标影响 / 关键路径 / 超时）</h4>{BLOCKERS.map(b => <div key={b.t} className="p9-item"><b>{b.t}</b><small>{b.level} · {b.state} · {b.over} · 评分 {b.score} · {b.owner}</small><p>{b.note}</p><button className="p9-btn soft" onClick={() => notify(b.act + '已发送（演示）。')}>{b.act}</button></div>)}</div></div>
        <h4>逾期任务 · 自动升级（截止时间 + 依赖关系）</h4>{OVERDUE.map(o => <div key={o.t} className="p9-item"><b>{o.t}</b><small>{o.pri} · {o.state} · {o.over} · {o.owner}</small><button className="p9-btn soft" onClick={() => { setTab('todos'); }}>{o.act}</button></div>)}
        <p className="p9-muted">逾期超 72h 自动进 BPM。</p>
      </section>
    </div>
  );
  // ============ P9.2.1 基本信息 ============
  const atbFilled = ATB_GROUPS.reduce((n, g) => n + g.rows.filter(r => r.v !== '点击填写').length, 0);
  const basicBody = (
    <div><section className="p9-card"><h3>投标基本信息 · ATB 评审表</h3><p className="p9-muted">商机判断四组字段 + SPP 团队角色；缺失项按 ATB 表提示补填 · {atbFilled} / 43 已填</p>
      <h4>投标必要性判断</h4>{[['需求真实性', '有明确业主 / 资方与资金路径？'], ['可执行性', '并网、环评、土地、接入可行？'], ['商业合理性', '是否匹配战略与投产比？']].map(([k, q]) => <div key={k} className="p9-item"><b>{k}</b><span>{q}</span><span className="p9-row"><button className="p9-btn soft">是</button><button className="p9-btn soft">否</button><button className="p9-btn soft" onClick={() => notify('AI 提示（演示）：请附业主与资金路径证据。')}>AI 提示</button><button className="p9-btn soft">查看填写规则</button></span></div>)}
      {ATB_GROUPS.map(g => <details key={g.title} open><summary>{g.title} · {g.rows.filter(r => r.v !== '点击填写').length} / {g.total}</summary><div className="p9-fields">{g.rows.map(r => <label key={r.k}>{r.k}<input defaultValue={r.v} className={r.v === '点击填写' ? 'missing' : ''} /></label>)}</div></details>)}
      <p className="p9-hint">缺失项标黄但不阻断发起，生成待澄清标记；商机信息不全也可发起，缺口转待澄清。</p>
    </section></div>
  );
  // ============ P9.2.2 投标策略（含版本历史 + 重新生成闭环）===========
  const strategyBody = (
    <div><section className="p9-card"><h3>投标策略</h3><p className="p9-muted">三段模板化录入 · 归档到投标实体；AI 据此生成策略方向 · 已归档</p>
      {STRATEGY_SECTIONS.map(s => <div key={s.k} className="p9-item"><b>{s.k}</b><p>{s.v}</p><span className="p9-row"><button className="p9-btn soft">是</button><button className="p9-btn soft">否</button><button className="p9-btn soft">查看模板</button></span></div>)}
      <h4>策略字段 12 项 · 已归档到投标实体，12 / 12</h4><div className="p9-fields">{STRATEGY_FIELDS.map(([k, v]) => <label key={k}>{k}<input defaultValue={v} /></label>)}</div>
      <h4>分段策略</h4>{[['报价策略', '3 段：首轮锚定 / 短名单让价 / BAFO 收敛'], ['技术策略', '10 年质保 + LTSA 为主线，不承诺超配'], ['服务策略', '备件 2 年 + 4 小时响应'], ['团队分工', '技术中心主责技术标，商务主责报价']].map(([k, v]) => <details key={k}><summary>{k}</summary><p>{v}</p></details>)}
      <h4>AI 策略方向 · 基于上面三段生成 · 仅作方向建议</h4>
      <div className="p9-item"><b>主打点</b><p>用全生命周期 IRR 打穿：技术标写 LTSA + 10 年质保，商务标给 3-3-4 付款</p></div>
      <div className="p9-item"><b>避让点</b><p>不接纯价格战；EPC 总包与土建不在报价范围</p></div>
      <div className="p9-item"><b>报价姿态</b><p>锚定度电成本而非设备单价，首轮留 6-8%，BAFO 再收敛</p></div>
      <div className="p9-row"><button className="p9-btn soft" onClick={() => notify('策略方向已重新生成（演示）。')}>重新生成</button><button className="p9-btn primary" onClick={() => notify('已采用此方向，归档到投标实体。')}>采用此方向</button><button className="p9-btn soft" onClick={() => notify('已编辑后保存（演示）。')}>编辑后保存</button></div>
      <h4>策略版本历史 · 更新 → 再制作 → 确认闭环（与 BAFO 轮次关联快照）</h4>
      {strategyVersions.map(v => <div key={v.v} className="p9-item"><b>{v.v}</b><small>{v.date} · {v.state}</small><p>{v.note}</p>{v.state === '待确认' && <button className="p9-btn primary" onClick={() => { setStrategyVersions(vs => vs.map(x => x.v === v.v ? { ...x, state: '已采用' } : x)); notify('策略新版已确认并留存版本历史，闭环完成。'); }}>确认此版本</button>}</div>)}
      <div className="p9-row"><input value={strategyNote} onChange={e => setStrategyNote(e.target.value)} placeholder="策略再制作触发原因：新澄清 / BAFO 变化 / 卡点出现…" /><button className="p9-btn primary" onClick={async () => { await call('/bids/' + bid.id + '/strategy/regenerate', 'POST', { reason: strategyNote }); setStrategyVersions(vs => [...vs, { v: 'v' + (vs.length + 1) + '（草稿）', date: '2026-10-24', state: '待确认', note: '再制作：' + (strategyNote || '执行中变化触发') + '（POST /api/bids/:id/strategy/regenerate，演示 Mock 已标注）' }]); setStrategyNote(''); notify('策略已再制作，新版进入版本历史待确认。'); }}>重新生成（策略再制作）</button></div>
      <p className="p9-hint">执行中出现新澄清、BAFO 变化或卡点时可触发再评估；新版方向 + 变更说明经用户确认后留存，不自动覆盖已采用版。</p>
    </section></div>
  );

  // ============ P9.3 计划（初版 / 正式 / 编辑态）===========
  const planBody = (
    <div>{pipeBar}{draftBar}
      <section className="p9-card"><div className="p9-row"><b>倒排排期 · 10/17 – 11/05</b><span className="p9-muted">关键路径 12 天 · 缓冲 3 天</span>
        <span className="p9-row">{(['stage', 'item', 'edit'] as const).map(m => <button key={m} className={'p9-btn ' + (planMode === m ? 'primary' : 'soft')} onClick={() => setPlanMode(m)}>{m === 'stage' ? '初版（阶段级）' : m === 'item' ? '正式（条目级）' : '编辑态'}</button>)}</span>
        <button className="p9-btn soft" onClick={() => notify('导入（演示）：格式与来源原型未明确，未实际导入。')}>导入</button><button className="p9-btn soft" onClick={() => notify('导出进度表（演示）：Excel 导出由后端/协调人接线。')}>导出</button></div>
        {planMode === 'stage' && <><p className="p9-muted">招标文件还没上传，先按开标时间 + SPP 团队模板排出大节点。上传解析后会自动补出条目级任务。图例：未开始 / 进行中 / 已完成 / 已逾期</p>
          <table className="p9-table"><thead><tr><th>阶段</th><th>负责人</th><th>参与人</th><th>状态</th><th>WK1</th><th>WK2</th><th>WK3</th><th>WK4</th></tr></thead><tbody>{STAGE_ROWS.map(r => <tr key={r.s}><td>{r.s}</td><td>{r.owner}</td><td>{r.part}</td><td>{r.status}</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>)}</tbody></table></>}
        {planMode !== 'stage' && <>
          <div className="p9-row">{['甘特图', 'RACI', '按人负荷'].map(v => <button key={v} className="p9-pill-btn" onClick={() => notify(v + '视图（演示）：RACI / 按人负荷为原型仅标题能力，按负责人与参与人字段呈现。')}>{v}</button>)}</div>
          <table className="p9-table"><thead><tr><th>拆解条目</th><th>负责人</th><th>参与人</th><th>状态</th>{planMode === 'edit' && <th>起止</th>}<th>WK1</th><th>WK2</th><th>WK3</th><th>WK4</th>{planMode === 'edit' && <th>操作</th>}</tr></thead>
            <tbody>{plan.map(p => <tr key={p.id}><td>{planMode === 'edit' ? <input defaultValue={p.title} /> : p.title}</td><td>{planMode === 'edit' ? <select defaultValue={p.owner}><option>王强</option><option>陈磊</option><option>王芳</option><option>张伟</option><option>李明</option><option>未派</option></select> : p.owner}</td><td>{p.part}</td><td>{p.status}</td>{planMode === 'edit' && <td>{p.start} / {p.end}</td>}<td colSpan={4}>{fmtDate(p.start)} → {fmtDate(p.end)}</td>{planMode === 'edit' && <td><button className="p9-btn soft" onClick={() => { setPlan(ps => ps.filter(x => x.id !== p.id)); notify('已删除该行（演示，保存后落库）。'); }}>删除</button></td>}</tr>)}</tbody></table>
          {planMode === 'edit' && <p className="p9-hint">编辑中：条目名可直接改 · 负责人单选 / 参与人多选 · 起止日期可调 · 行尾可删除；回车保存，Esc 取消</p>}
          {gantt(plan)}
          {planMode === 'edit' && <div className="p9-row"><button className="p9-btn primary" onClick={() => { setPlanMode('item'); notify('已保存，回到正式态。'); }}>保存</button><button className="p9-btn soft" onClick={() => { setPlan(PLAN_ITEMS); setPlanMode('item'); notify('已取消，未保存修改已丢弃。'); }}>取消</button></div>}
          {planMode === 'item' && <button className="p9-btn soft" onClick={() => setPlanMode('edit')}>编辑</button>}
          <p className="p9-hint">排期助手：倒排甘特 + 拖动改期；配置表维护（管理员）为原型仅标题能力，入口见招标文件屏的配置表命中说明。</p>
        </>}
      </section></div>
  );
  // ============ P9.4 招标文件（空态 / 解析中 / 正式）===========
  const docsBody = (
    <div><section className="p9-card">
      <div className="p9-row">{(['empty', 'parsing', 'parsed'] as const).map(m => <button key={m} className={'p9-btn ' + (docsMode === m ? 'primary' : 'soft')} onClick={() => setDocsMode(m)}>{m === 'empty' ? '空态' : m === 'parsing' ? 'AI 解析中' : '已解析'}</button>)}</div>
      {docsMode === 'empty' && <div><h3>还没有上传招标文件</h3><p>上传后 AI 会解析章节结构、生成拆标分解条目，并按配置表带出默认责任人与工期。</p>
        <div className="p9-row"><button className="p9-btn primary" onClick={() => { setDocsMode('parsing'); void call('/bids/' + bid.id + '/documents', 'POST', {}); }}>上传招标文件</button><button className="p9-btn soft" onClick={() => notify('从商机附件导入（演示）：附件选择界面原型未明确。')}>从商机附件导入</button></div>
        <ol><li>上传招标文件：支持 PDF / Word，可一次传多份</li><li>AI 解析并拆解：按配置表生成条目、责任人与工期</li><li>BSD 审核后派发：审核通过自动建任务、发钉钉、建群</li></ol></div>}
      {docsMode === 'parsing' && <div><h3>正在解析招标文件… 53%</h3><p>XX储能项目招标文件_终版.pdf · 42 页 · 预计还需约 40 秒 · 解析进度 2 / 4 步</p>
        <ol><li>✓ 上传完成 · 42 页 · 18 MB</li><li>▶ 解析章节结构 · 正在识别第六章 投标文件格式…</li><li>抽取技术要求与商务条款 · 34 条候选要求</li><li>按配置表生成拆标分解条目 · 预计生成 34 条</li></ol>
        <p className="p9-muted">解析在后台进行，可以先去其他 Tab，完成后会通知你。</p>
        <button className="p9-btn primary" onClick={async () => { await call('/bids/' + bid.id + '/ai/decompose', 'POST', {}); setDocsMode('parsed'); setPipe('decomposing'); setDraftPending(true); notify('AI 拆解完成：解析结果已更新计划草稿，待确认并下发。'); }}>模拟解析完成 → 已解析</button></div>}
      {docsMode === 'parsed' && <div><h3>招标文件 · v3.0 终版</h3><p>XX储能项目招标文件.pdf · 42 页 · 已解析 {DOC_ITEMS.length} 条</p>
        <div className="p9-grid2"><div><h4>章节树</h4>{CHAPTERS.map(c => <div key={c.n} className="p9-item">{c.n}<b> {c.c} 条</b></div>)}<p className="p9-hint">章节条数由分解条目算出（合计 {DOC_ITEMS.length} 条）；原型章节原文合计与此不一致，见汇报。</p></div>
          <div><h4>拆标分解表 · {DOC_ITEMS.length} 条 · 命中 28/34</h4><div className="p9-row"><button className="p9-btn soft" onClick={() => setDocsMode('parsing')}>AI 解析</button><button className="p9-btn primary" onClick={() => { setPipe('dispatched'); notify('已提交 BSD 审核：拆解表版本已锁定，BSD 收到待办；按逻辑卡③去计划只读页。'); setTab('plan'); setPlanMode('item'); }}>提交 BSD 审核</button></div>
            <p className="p9-muted">共 {DOC_ITEMS.length} 条 · 已完成 {DOC_ITEMS.filter(d => d.status === '已完成').length} · 未派 {DOC_ITEMS.filter(d => d.owner === '未派').length} · 其余为进行中 / 待开始 / 阻塞（由条目算出；原型「已派 22 · 未派 6 · 已完成 6」汇总与此不一致，见汇报）</p></div></div>
        <table className="p9-table"><thead><tr><th>条目</th><th>来源条款</th><th>类别</th><th>责任人</th><th>排期</th><th>状态</th></tr></thead>
          <tbody>{(showAllDocs ? DOC_ITEMS : DOC_ITEMS.slice(0, 7)).map(d => <tr key={d.t}><td>{d.t}</td><td>{d.src}</td><td>{d.cat}</td><td>{d.owner}</td><td>{d.date}</td><td>{d.status}</td></tr>)}</tbody></table>
        <button className="p9-btn soft" onClick={() => setShowAllDocs(!showAllDocs)}>{showAllDocs ? '收起' : '展开其余 ' + (DOC_ITEMS.length - 7) + ' 条'}</button>
        <p className="p9-hint">拆解助手：改条目只产生草稿态，不影响已派发条目；已人工改过的条目重新解析不覆盖。</p>
        <button className="p9-btn soft" onClick={() => setDocsMode('parsing')}>上传新版招标文件</button></div>}
    </section></div>
  );
  // ============ P9.5 会议 ============
  const meetingsBody = meeting ? (
    <div><section className="p9-card"><button className="p9-btn soft" onClick={() => setMeeting(null)}>← 会议列表</button><h3>客户澄清会（第一轮）</h3><p className="p9-muted">顶栏会议时间 10-25 10:00–11:20 · AI 纪要 · {meetingSaved ? '已保存' : '编辑中 · 保存后写入纪要'}</p>
      <div className="p9-grid2"><div><h4>AI 纪要</h4><p><b>议题：</b>客户就 BESS 台数优化、质保年限延长、远程调试支持提出 3 个澄清问题。</p><p><b>讨论要点：</b>技术侧：18 台会影响可用率承诺，建议维持 20 台。商务侧：质保以 5 年为基础、10 年做可选包单独报价。远程调试可做，但需在技术标中明确边界（不含现场网络改造）。</p><p><b>决议：</b>维持 20 台报价；质保出 5 年 / 10 年两版；远程调试写入技术标作为加分项；剩余 1 项由陈磊 10-26 前书面答复。</p>
        <div className="p9-row"><button className="p9-btn soft" onClick={() => setMeetingSaved(false)}>取消</button><button className="p9-btn primary" onClick={() => setMeetingSaved(true)}>保存</button><button className="p9-btn soft">查看转写全文</button></div>
        <h4>本场结论 · 4 条</h4><ul><li>BESS 可按 20 台报价，不接受减至 18 台</li><li>质保以 5 年为基础版本，10 年作为可选项单独报价</li><li>远程调试要求写入技术标，作为加分项</li><li>澄清答复截止 10-25 18:00，逾期视为放弃</li></ul>
        <h4>本场待办 · 3 条</h4><ul><li>补充储能系统消防方案细节（陈磊 · 10-26 / 进行中）</li><li>明确远程调试实现方案与成本（陈磊 · 10-26 / 待开始）</li><li>质保 5 年 / 10 年两版重新报价（王芳 · 10-28 / 已完成）</li></ul>
        <button className="p9-btn primary" onClick={() => { notify('全部待办已派发到 RACI，澄清条目回写澄清 Tab。'); setTab('todos'); }}>全部派发</button></div>
        <div><h4>参与人（3 人）</h4><p>李明（SLS · 发起人）、陈磊（SC · 技术答复）、王芳（AMD · 商务答复）</p><h4>录音与转写</h4><p>客户澄清会录音.m4a · 80 分钟 · 32 MB · 转写已完成 · 98% 准确 · 发言 3 人 · 自动分离</p><button className="p9-btn soft">重转写</button><h4>本场关联</h4><p>澄清条目 3 条 · 已同步到澄清 Tab；会议待办 3 条 · 待派发；相关文件 客户澄清会录音.m4a</p></div></div>
      </section></div>
  ) : (
    <div><section className="p9-card"><div className="p9-row"><h3>会议</h3><span className="p9-muted">6 场 · 已出纪要 3 · 待纪要 1 · 待开 2</span><button className="p9-btn soft" onClick={() => notify('导入听记（演示）：录音转写后产出纪要、待办、澄清条目。')}>导入听记</button><button className="p9-btn soft">预约会议</button></div>
      <div className="p9-row">{['全部 6', '待开 2', '待纪要 1', '已出纪要 3'].map(p => <span key={p} className="p9-pill-btn">{p}</span>)}</div>
      <table className="p9-table"><thead><tr><th>会议名称</th><th>类型</th><th>时间</th><th>参与人</th><th>发起人</th><th>录音</th><th>待办</th><th>结论</th><th>状态</th><th>操作</th></tr></thead>
        <tbody>{MEETINGS.map(m => <tr key={m.name}><td>{m.name}</td><td>{m.type}</td><td>{m.time}</td><td>{m.people}</td><td>{m.from}</td><td>{m.rec}</td><td>{m.todo}</td><td>{m.concl}</td><td>{m.status}</td><td><button className="p9-btn soft" onClick={() => setMeeting(m)}>查看详情</button></td></tr>)}</tbody></table>
      <p className="p9-hint">6 场 · 已出纪要 3 · 待纪要 1 · 待开 2</p><button className="p9-btn soft">导出会议台账</button></section></div>
  );
  // ============ P9.6 文件 ============
  const filesBody = (
    <div><section className="p9-card"><div className="p9-row"><h3>文件清单</h3><span className="p9-muted">18 个文件 · 会议文档与投标文件统一管理</span><button className="p9-btn soft">上传文件</button><button className="p9-btn soft" onClick={() => notify('AI 核查建议已转成待办（演示）。')}>AI 核查</button></div>
      <div className="p9-row">{['全部文件 18', '投标文件 6', '会议文档 7', '澄清材料 3', '招标文件原件 2'].map(p => <span key={p} className="p9-pill-btn">{p}</span>)}</div>
      <table className="p9-table"><thead><tr><th>文件名</th><th>类型</th><th>版本</th><th>大小</th><th>上传人</th><th>更新时间</th><th>状态</th></tr></thead>
        <tbody>{FILES.map(f => <tr key={f.n}><td>{f.n}</td><td>{f.type}</td><td>{f.v}</td><td>{f.size}</td><td>{f.u}</td><td>{f.t}</td><td>{f.s}</td></tr>)}</tbody></table>
      <p className="p9-hint">商务标 · v2 为当前版本 · 定稿后自动锁版 · 展示 8 行，其余 10 行按分类折叠（分类数 6+7+3+2=18；资质证明行属原型分类外行，见汇报）。报价表下载受 BAFO 屏报价权限约束。</p><button className="p9-btn soft">批量下载</button></section></div>
  );

  // ============ P9.7 待办与澄清（含详情、完成确认、评论弹层）===========
  const dragTodoRef = useRef<string | null>(null);
  const [extraComments, setExtraComments] = useState<string[]>([]);
  const [completeResult, setCompleteResult] = useState('已完成');
  const [completeNote, setCompleteNote] = useState('已完成：项目地点补福建宁德；我司供货范围补 DC Block + PCS；投标保证金补 500 万元（2%）。');
  const [reviewReason, setReviewReason] = useState('价格');
  const todosBody = todo ? (
    <div><section className="p9-card"><button className="p9-btn soft" onClick={() => setTodoId(null)}>← 待办与澄清</button>
      <h3>{todo.t}</h3><p><span className="p9-pill">{todo.status}</span> 优先级 {todo.pri} · 来源 {todo.src}</p>
      <div className="p9-row"><button className="p9-btn soft" onClick={async () => { await call('/bids/' + bid.id + '/todos/' + todo.id + '/reopen', 'POST', {}); setTodos(ts => ts.map(x => x.id === todo.id ? { ...x, status: '进行中' } : x)); notify('已重新打开（任务可重新打开）。'); }}>重新打开</button><button className="p9-btn soft">编辑</button><button className="p9-btn soft" onClick={() => notify('已催办 ' + todo.owner + '（演示）。')}>催办</button></div>
      <p>负责人 {todo.owner}（{todo.role}）· 截止 {todo.due === '今天' ? '2026-10-25（今天）' : todo.due} · 创建人 王强 · 10-20 14:20 · 关联客户 宁德时代 · 关联商机 储能项目 200MW/400MWh · 关联线索 —</p>
      {todo.status === '已完成' && <div className="p9-item"><b>完成结果</b><p>李明 · 10-24 16:32 · 项目地点补福建宁德；我司供货范围补 DC Block + PCS；投标保证金补 500 万元（2%）。</p><p>附件 供货范围截图.png · 240 KB（完成弹层同附件标 1.2 MB，原型内冲突见汇报）</p><p className="p9-muted">已回写计划 · 已写入今日日报 · 完成后不可再修改结果，可继续评论</p></div>}
      <h4>评论与动态 · {4 + extraComments.length}</h4>
      <p>王强 10-24 16:40：收到，供货范围这块我和 C 厂再核一下 PCS 型号，明天给结论。</p>
      <p>李明 10-24 16:32：项目地点和保证金我先补了，供货范围还需要陈磊确认 PCS 是自研还是外采。</p>
      <p>系统 · 10-24 16:32：李明 将待办标记为「已完成」，并回写计划条目 ① 商机判断 · 基本信息</p>
      <p>李明 10-23 09:15：那个…项目地点是福建宁德还是福鼎？客户邮件里两个地方都提到了。</p>
      {extraComments.map((c, i) => <p key={i}>张小小 刚刚：{c}</p>)}
      <div className="p9-row"><input placeholder="写评论，@ 可提醒同事…" id="p9-comment-input" /><button className="p9-btn primary" onClick={() => { const el = document.getElementById('p9-comment-input') as HTMLInputElement | null; if (el?.value) { setExtraComments(cs => [...cs, el.value]); el.value = ''; notify('评论已同步给负责人与提出人。'); } }}>发送</button></div>
    </section></div>
  ) : (
    <div><section className="p9-card">
      <div className="p9-row"><h3>我的待办 · {todos.filter(t => t.mine).length} 项</h3><span className="p9-muted">与计划联动 · 勾选完成回写条目状态</span><button className="p9-btn soft" onClick={() => notify('新建待办（演示）：表单内容原型未明确。')}>新建</button></div>
      <div className="p9-row">{(['全部', '我的', '逾期', '提醒'] as const).map(f => <button key={f} className={'p9-btn ' + (todoFilter === f ? 'primary' : 'soft')} onClick={() => setTodoFilter(f)}>{f === '全部' ? '全部 12' : f === '我的' ? '我的 5' : f === '逾期' ? '逾期 ' + todos.filter(t => reminderOf(t).startsWith('逾期')).length : '到期前提醒'}</button>)}</div>
      <div className="p9-drop" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (dragTodoRef.current) { setTodoId(dragTodoRef.current); setModal('complete'); } }}>拖到此处完成待办（原生 HTML5 拖拽）→</div>
      <table className="p9-table"><thead><tr><th>✓</th><th>待办事项</th><th>来源</th><th>负责人</th><th>截止</th><th>优先级</th><th>提醒态</th><th>操作</th></tr></thead>
        <tbody>{todoRows.map(t => <tr key={t.id} draggable onDragStart={() => { dragTodoRef.current = t.id; }}><td><input type="checkbox" checked={t.status === '已完成'} onChange={() => { setTodoId(t.id); setModal('complete'); }} /></td><td>{t.t}</td><td>{t.src}</td><td>{t.owner}</td><td>{t.due}</td><td>{t.pri}</td><td><span className="p9-pill">{reminderOf(t)}</span></td><td><button className="p9-btn soft" onClick={() => setTodoId(t.id)}>查看详情</button><button className="p9-btn soft" onClick={() => { setTodoId(t.id); setModal('comment'); }}>评论 {t.comments}</button></td></tr>)}</tbody></table>
      <p className="p9-hint">已完成 {todos.filter(t => t.status === '已完成').length} 项 · 逾期 {todos.filter(t => reminderOf(t).startsWith('逾期')).length} 项 · 提醒态：到期前提醒（今日/明日到期）/ 逾期（已升级 L2，超 72h 自动进 BPM）/ 升级 L3 待触发</p>
      <h3>澄清条目 · 8 条 · 未闭环 {CLARS.filter(c => c.status === '待答复').length}</h3>
      <div className="p9-row">{(['全部', '未闭环', '已进标书'] as const).map(f => <button key={f} className={'p9-btn ' + (clarFilter === f ? 'primary' : 'soft')} onClick={() => setClarFilter(f)}>{f}</button>)}<button className="p9-btn soft">新建</button></div>
      <table className="p9-table"><thead><tr><th>类型</th><th>来源</th><th>问题</th><th>责任方</th><th>截止</th><th>状态</th><th>是否已进标书</th></tr></thead>
        <tbody>{CLARS.filter(c => clarFilter === '全部' || (clarFilter === '未闭环' && c.status === '待答复') || (clarFilter === '已进标书' && c.inBid)).map((c, i) => <tr key={i}><td>{c.type}</td><td>{c.dir}</td><td>{c.q}</td><td>{c.owner}</td><td>{c.due}</td><td>{c.status}</td><td>{c.inBid ? '已进标书' : '未闭环'}</td></tr>)}</tbody></table>
      <p className="p9-hint">已答复 5 · 待答复 3 · pre-bid 4 / post-bid 4（由条目算出）</p>
    </section></div>
  );
  // ============ P9.8 交标与结果（含检查报告）===========
  const submitBody = (
    <div><section className="p9-card"><h3>交标与结果</h3>
      <p className="p9-muted">AI 每 30 分钟自动核查一次{checkRun ? ' · 已复跑核查' : ''}</p>
      <div className={'p9-item ' + (checkPass ? 'ok' : 'warn')}><b>AI 交标体检 · 检查报告</b><p>齐备性 5 项已自动核对（3 项核验通过 / 2 项待核验）；最新版本一致性核查发现 3 项偏差未闭环 —— 建议先关偏差，再上传交标凭证。</p><p><b>风险：中 · {checkPass ? '可交标' : '不建议现在交标'}</b> · 流水线：{PIPELINE_LABEL[pipe]}</p></div>
      <h4>提交前检查 · 四源汇总（商务标 v2 · 技术标 v3 · 报价表 v1）</h4>
      {CHECKS.map(c => <div key={c.src} className="p9-item"><b>{c.src}</b><p>{c.detail}</p><span className="p9-pill">{c.state === '待检查' ? '待检查' : '不通过 · ' + c.state}</span></div>)}
      <p>人工复查：王强（技术负责人）· {pipe === 'review' || pipe === 'submitted' ? '已签字' : '待签字'} —— AI 只做检查，逐项确认后进入标书定稿</p>
      <h4>交标前 AI 最终检查清单 · 齐备性自动核对 · 不再人工勾选 · 3 / 5 已核验</h4>
      <ul><li>投标保证金 500 万元 · 保函编号 BZ-2026-0193，已缴纳 / 保函已开 → 已核验</li><li>份数 正本 1 份 · 副本 4 份 · 电子件（U 盘）齐备 → 已核验</li><li>递交方式与地点 现场递交 · 宁德市公共资源交易中心 · 递交人 李明 → 已核验</li><li>签字与密封 需检查骑缝章与法人章，密封与签章须符合招标要求 → 待核验</li><li>交标凭证 上传后节点 ⑦ 自动完成，并回写交标时间 → 待核验</li></ul>
      <div className="p9-row">
        <button className="p9-btn soft" onClick={async () => { await call('/bids/' + bid.id + '/ai/check', 'POST', {}); setCheckRun(true); setPipe('checking'); notify('AI 已复跑核查（POST /api/bids/:id/ai/check）。'); }}>AI 复跑核查</button>
        <button className="p9-btn soft" onClick={() => { setPipe('review'); notify('已进入人工复查（定标结果录入为原型仅标题能力，见定标复盘屏结论小卡）。'); }}>去人工复查</button>
        <button className="p9-btn soft" onClick={() => { if (!todos.some(t => t.t.includes('缺口'))) setTodos(ts => [...ts, { id: 'gap1', t: '缺口任务：UL9540A 报告补齐（检查回写）', src: '检查回写', owner: '陈磊', role: 'SC', due: '10-28', pri: 'P0', comments: 0, status: '待开始', mine: false }]); setPipe('executing'); notify('检查不通过：缺口已回写为任务，流水线回执行中，不卡死。'); }}>回写缺口任务 → 回执行中</button>
        <button className="p9-btn primary" onClick={() => { if (pipe !== 'review' && pipe !== 'submitted') { setPipe('review'); notify('请先去人工复查，逐项确认后上传凭证。'); return; } setPipe('submitted'); notify('交标凭证已上传，节点 ⑦ 自动完成，已交标。'); }}>上传交标凭证</button>
      </div>
      <p className="p9-hint">交标凭证上传后节点 ⑦ 自动完成；定标结果录入区原型未给出独立画面，结论在定标复盘屏确认。</p>
    </section></div>
  );
  // ============ P9.9 BAFO 对比（只做差异呈现，无权限看锁定占位，不含金额）===========
  const bafoBody = (
    <div><section className="p9-card"><div className="p9-row"><h3>BAFO 对比</h3><span className="p9-muted">最终版 = 最新技术方案 v3 + 报价单 v3（严格权限）</span>
      {demo && (<label>当前查看角色 <select value={quoteRole} onChange={e => setQuoteRole(e.target.value)}><option>SPP PM</option><option>SLS</option><option>SC</option><option>财务</option><option>其他成员</option></select></label>)}
      <button className="p9-btn soft" onClick={() => notify('提交最终版（演示）：状态变化原型未明确，未实际提交。')}>提交最终版</button><button className="p9-btn soft" onClick={async () => { await call('/bids/' + bid.id + '/bafo/rounds', 'POST', {}); notify('已开启新一轮（演示）。'); }}>开启新一轮</button></div>
      <table className="p9-table"><thead><tr><th>轮次</th><th>版本</th><th>关键差异</th><th>结论</th></tr></thead>
        <tbody>{BAFO_ROUNDS.map(r => <tr key={r.r}><td>{r.r}</td><td>{r.time}</td><td>{r.diff}</td><td>{r.concl}</td></tr>)}</tbody></table>
      <h4>AI 字段级差异 · R1 → R2 · 仅列差异项，相同字段不展示 · {BAFO_DIFFS.length} 处差异（由差异行算出）</h4>
      <table className="p9-table"><thead><tr><th>字段</th><th>旧值</th><th>→</th><th>新值</th><th>状态</th></tr></thead>
        <tbody>{BAFO_DIFFS.map(d => <tr key={d.f}><td>{d.f}</td><td>{d.old}</td><td>→</td><td>{d.next}</td><td>{d.state}</td></tr>)}</tbody></table>
      <p className="p9-hint">AI 逐字段比对 · 只呈现差异，不给定价建议；AI 仅记录差异与流程，不评估价格影响；付款节点差异待业务确认。本屏不做优劣判断、不做价格评分/排序/区间建议、不含金额。</p>
      <button className="p9-btn soft">查看版本文件</button><button className="p9-btn soft">导出差对比</button>
      <h4>报价单权限 · 严格管控 · 仅 2 角色可见</h4>
      {!demo ? (<div className="p9-item"><b>🔒 已报价</b><p>报价内容仅 admin 与投标 pricingTeam 成员可见（以后端校验为准）；当前登录角色：{user?.role || '—'} · 本界面不展示金额、不提供下载。</p></div>) : (quoteRole === 'SPP PM' || quoteRole === 'SLS') ? (
        <div className="p9-item"><p>报价单 v3（{quoteRole === 'SPP PM' ? '可见 · 可编辑 · 可下载' : '可见 · 只读 · 下载需审批'}）· 版本与字段信息可见，金额不在本演示界面展示。</p><button className="p9-btn soft" onClick={() => notify(quoteRole === 'SLS' ? '下载需审批（待审批），全部操作留痕。' : '下载已通过审批并加水印，全部操作留痕。')}>下载报价单</button></div>
      ) : (
        <div className="p9-item"><b>🔒 已报价</b><p>{quoteRole === 'SC' || quoteRole === '财务' ? 'SC / 财务仅状态 · 不含金额（受限）' : '其他成员不可见'} · 报价单不随标书群发，下载需审批并加水印，全部操作留痕。</p></div>
      )}
      {demo && (<p className="p9-muted">权限行：SPP PM（王强）可见·可编辑·可下载（通过）；SLS（李明）可见·只读·下载需审批（待审批）；SC / 财务仅状态·不含金额；其他成员不可见。</p>)}
    </section></div>
  );
  // ============ P9.10 定标复盘 ============
  const reviewBody = (
    <div><section className="p9-card"><h3>定标复盘</h3>
      <div className="p9-grid2"><div><div className="p9-item"><b>AI 复盘结论 · {reviewConfirmed ? '已确认' : '草稿 · 待确认'}</b><p>基于 R1–R3 版本差异、评标反馈与偏差台账生成。核心结论：报价高出中标方 6.2%、技术分差 6 分（消防认证未响应），两处都能提前规避；商务分在 R2 靠「质保扩到 10 年 + 单独报价」追回 5 分，说明主动改口径有效。</p></div>
        <h4>落标原因</h4>{['价格', '技术未达', '客户预算取消'].map(r => <label key={r} className="p9-row"><input type="radio" name="reason" checked={reviewReason === r} onChange={() => setReviewReason(r)} />{r}</label>)}
        <p>AI 归因：价格（同类项目我司均价高于中标方约 6%）与强制响应缺失是主因；评标反馈未提交付与售后失分，说明本次竞争的主战场是技术与价格。中标时本块自动切换为赢单原因分析。</p>
        <textarea placeholder="补充说明（选填）：评标现场问答要点、客户口头反馈…" />
        <button className="p9-btn primary" onClick={async () => { await call('/bids/' + bid.id + '/close', 'POST', { reason: reviewReason }); setReviewConfirmed(true); notify('复盘已确认，结论归档。'); }}>确认复盘结论</button></div>
        <div className="p9-item"><b>定标结论小卡（补齐：原型仅标题）</b><p>结论：落标 · 原因：{reviewReason} · 状态：{reviewConfirmed ? '已确认归档' : '草稿待确认'}</p><p>合同 register 可带入 3 项偏差：消防认证 / 质保口径 10 年 / 付款节点 3-3-4</p><button className="p9-btn soft">查看合同 register</button></div></div>
      <h4>经验沉淀 · 3 条 Lesson · 确认后写入案例库 · 同步竞对库</h4>
      {LESSONS.map((l, i) => <div key={l.t} className="p9-item"><b>{i + 1} {l.t}</b><p>{l.d}</p><button className="p9-btn soft" onClick={() => notify('已写入案例库（演示）。')}>写入案例库</button></div>)}
      <p className="p9-hint">3 条 Lesson 均已预生成 · 确认后归档</p>
      <h4>沉淀去向 · 结论归档后自动生成</h4><ul><li>案例库：本标过程、标书亮点与缺口结构化归档 → 待生成</li><li>竞对库：本标 5 家竞对格局、报价区间与评标反馈 → 待更新</li><li>评标反馈：客户评标意见与失分项逐条录入 → 待归档</li><li>合同 register：3 项偏差自动带入 → 查看 / 可带入</li></ul>
      <button className="p9-btn soft">导出复盘报告</button>
    </section></div>
  );
  const detailBody = tab === 'cockpit' ? cockpitBody : tab === 'basic' ? basicBody : tab === 'strategy' ? strategyBody : tab === 'plan' ? planBody : tab === 'docs' ? docsBody : tab === 'meetings' ? meetingsBody : tab === 'files' ? filesBody : tab === 'todos' ? todosBody : tab === 'submit' ? submitBody : tab === 'bafo' ? bafoBody : reviewBody;
  return (
    <div className="p9-root">
      {toast && <div className="p9-toast">{toast}</div>}
      {view === 'list' && listView}
      {view === 'opp' && oppView}
      {view === 'mobile' && mobileView}
      {view === 'detail' && detailShell(detailBody)}
      {/* P9.0.3 发起投标 · 结果 */}
      {modal === 'create' && <div className="p9-mask" onClick={() => setModal('')}><section className="p9-modal" onClick={e => e.stopPropagation()}><h2>投标已发起</h2><p>已基于「宁德时代 / 储能项目」创建投标，当前 R1 首轮，节点「商机判断」。</p><p>投标编号 BID-20261010-026 · R1 · 客户 / 商机 宁德时代 / 储能项目 · SPP 团队 储能 SPP · 负责人 李明 · SLS</p><p className="p9-muted">ATB 还有 19 项待补 —— 不阻断发起，进入「商机判断」后逐项补录，缺失项自动生成待澄清（19 与 P9.2.1 缺口 22 的原型冲突见汇报；界面 ATB 以 43 项口径为准）。</p><p className="p9-muted">可在投标列表中随时进入 · 发起后 AI 自动启动排计划与拆标书（§8 链路）。</p><div className="p9-row"><button className="p9-btn soft" onClick={() => setModal('')}>关闭</button><button className="p9-btn primary" onClick={() => { setModal(''); setPipe('planning'); setDraftPending(true); openDetail(BIDS[0]); }}>前往投标详情</button></div></section></div>}
      {/* P9.0.4 表头列筛选（内容实为搜索） */}
      {modal === 'search' && <div className="p9-mask" onClick={() => setModal('')}><section className="p9-modal" onClick={e => e.stopPropagation()}><h2>表头列筛选</h2><p className="p9-muted">最近搜索：宁德时代 / BID-20261010-003 / 储能项目</p><p>搜索字段：客户 + 商机（默认）；可填：客户、商机、投标编号、轮次（首轮 / 第二轮）、SPP 团队（储能 / 光伏 / 汽车）、当前节点、发起人、负责人、交标日。填任意字段即按该字段搜索。</p><input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="客户 / 商机 / 投标编号…" /><div className="p9-row"><button className="p9-btn soft" onClick={() => setModal('')}>取消</button><button className="p9-btn primary" onClick={() => setModal('')}>搜索</button><button className="p9-btn soft" onClick={() => setModal('')}>收起</button></div><p className="p9-hint">注：本弹窗原型内容实为搜索字段，列显隐开关原型未出现，未按列显隐器实现。</p></section></div>}
      {/* P9.7.3 完成待办 */}
      {modal === 'complete' && todo && <div className="p9-mask" onClick={() => setModal('')}><section className="p9-modal" onClick={e => e.stopPropagation()}><h2>完成这条待办</h2><p>{todo.t} · 来源 {todo.src} · 负责人 {todo.owner} · 截止 {todo.due}</p>
        <label>完成情况 *（必选）<select value={completeResult} onChange={e => setCompleteResult(e.target.value)}><option>已完成</option><option>部分完成</option><option>已取消</option><option>需延期</option></select></label>
        <label>说明 *（必填，会写进历史并汇总到今日日报）<textarea defaultValue="已完成：项目地点补福建宁德；我司供货范围补 DC Block + PCS；投标保证金补 500 万元（2%）。" onChange={e => setCompleteNote(e.target.value)} maxLength={200} /></label>
        <p className="p9-muted">附件：拖拽文件到这里，或选择文件 · 支持 PDF / Word / Excel / 图片，单个不超过 20 MB · 已附 1 个：供货范围截图.png · 1.2 MB</p><p className="p9-hint">完成后不可再修改结果，可继续评论。</p>
        <div className="p9-row"><button className="p9-btn soft" onClick={() => setModal('')}>取消</button><button className="p9-btn primary" onClick={async () => { await call('/bids/' + bid.id + '/todos/' + todo.id + '/complete', 'POST', { outcome: ({ '已完成': 'completed', '部分完成': 'partial', '已取消': 'cancelled', '需延期': 'delayed' } as Any)[completeResult] || 'completed', note: completeNote || '已确认完成' }); setTodos(ts => ts.map(x => x.id === todo.id ? { ...x, status: completeResult === '已完成' ? '已完成' : '进行中' } : x)); setModal(''); notify('已确认完成，回写计划条目。'); }}>确认完成</button></div></section></div>}
      {/* P9.7.4 待办评论 */}
      {modal === 'comment' && todo && <div className="p9-mask" onClick={() => setModal('')}><section className="p9-modal" onClick={e => e.stopPropagation()}><h2>评论 · 3 条</h2><p>{todo.t} · 负责人 {todo.owner} · 截止 {todo.due} · 来源 {todo.src}</p>
        <p>王强 10-24 16:40：收到，供货范围这块我和 C 厂再核一下 PCS 型号，明天给结论。</p><p>李明 10-24 16:32：项目地点和保证金我先补了，供货范围还需要陈磊确认 PCS 是自研还是外采。</p><p>李明 10-23 09:15：项目地点是福建宁德还是福鼎？客户邮件里两个地方都提到了。</p>
        <input placeholder="追加评论，@ 可提醒同事…（⌘ + Enter 发送）" id="p9-comment2" /><p className="p9-muted">评论会同步给负责人与提出人</p>
        <div className="p9-row"><button className="p9-btn primary" onClick={() => { const el = document.getElementById('p9-comment2') as HTMLInputElement | null; if (el?.value) setExtraComments(cs => [...cs, el.value]); setModal(''); notify('评论已发送。'); }}>发送</button><button className="p9-btn soft" onClick={() => { setModal(''); }}>查看完整详情 ›</button></div></section></div>}
      {/* 一键建群占位 */}
      {modal === 'group' && <div className="p9-mask" onClick={() => setModal('')}><section className="p9-modal" onClick={e => e.stopPropagation()}><h2>一键建群</h2><p>群成员与载体原型未明确；后端返回群占位链接后在此展示（POST /api/bids/:id/group）。演示占位：群链接待后端返回。</p><button className="p9-btn primary" onClick={() => setModal('')}>关闭</button></section></div>}
      <p className="p9-foot">P9 演示时钟 2026-10-24 · 演示 Mock 已标注 · 报价边界：BAFO 只做版本与字段差异呈现，不做优劣判断、不做价格评分/排序/区间建议；无权限角色只看锁定占位（不含金额）。</p>
    </div>
  );
}
