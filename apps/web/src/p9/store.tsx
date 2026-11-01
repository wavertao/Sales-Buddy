// P9 页面状态：路由（列表 / 商机 / 详情 / 移动端）、当前投标、可编辑数据与动作。
// 动作先更新本地状态（界面立即响应），后端接通时再调用对应接口；接口失败给出提示但不回滚演示数据。
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as D from './demo';
import type { Api, LiveBundle } from './live';
import { loadBundle, loadList } from './live';

export type View = 'list' | 'opp' | 'detail' | 'mobile';
export type Tab = 'cockpit' | 'basic' | 'strategy' | 'plan' | 'docs' | 'meetings' | 'files' | 'todos' | 'submit' | 'bafo' | 'review';
export const TABS: [Tab, string, boolean?][] = [
  ['cockpit', '驾驶舱'], ['basic', '基本信息'], ['strategy', '投标策略'], ['plan', '计划', true], ['docs', '招标文件'],
  ['meetings', '会议', true], ['files', '文件'], ['todos', '待办与澄清'], ['submit', '交标与结果'], ['bafo', 'BAFO 对比'], ['review', '定标复盘'],
];
export type Modal = null | { kind: 'create' } | { kind: 'created'; number: string } | { kind: 'complete'; todoId: string } | { kind: 'comment'; todoId: string } | { kind: 'advance' };

export interface P9State {
  api: Api; user: any; online: boolean; today: string | null;
  view: View; setView: (v: View) => void;
  tab: Tab; setTab: (t: Tab) => void;
  bids: D.BidRow[]; bid: D.BidRow; openBid: (id: string, tab?: Tab) => void;
  live: LiveBundle | null;
  node: number; advanceNode: (note: string) => void;
  rounds: D.Round[]; advanceRound: () => void;
  atb: D.AtbGroup[]; setAtbField: (group: string, field: string, value: string) => void;
  todos: D.Todo[]; completeTodo: (id: string, outcome: string, note: string, file?: string) => void; commentTodo: (id: string, text: string) => void; reopenTodo: (id: string) => void;
  clars: D.Clar[];
  plan: D.PlanItem[]; setPlan: (items: D.PlanItem[]) => void;
  docsState: 'empty' | 'parsing' | 'parsed'; setDocsState: (s: 'empty' | 'parsing' | 'parsed') => void;
  meetingId: string | null; setMeetingId: (id: string | null) => void;
  todoId: string | null; setTodoId: (id: string | null) => void;
  modal: Modal; setModal: (m: Modal) => void;
  createBid: (form: { country: string; form: string; target: string }) => void;
  toast: string; notify: (text: string) => void;
  call: (path: string, method?: string, body?: unknown) => Promise<any>;
  exit: (page: string) => void;
}

const Ctx = createContext<P9State | null>(null);
export const useP9 = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useP9 必须在 P9Provider 内使用');
  return v;
};

export function P9Provider({ api, user, onExit, children }: { api: Api; user: any; onExit: (page: string) => void; children: React.ReactNode }) {
  const [view, setView] = useState<View>('list');
  const [tab, setTabRaw] = useState<Tab>('cockpit');
  const [bids, setBids] = useState<D.BidRow[]>(D.BIDS);
  const [bidId, setBidId] = useState(D.BIDS[0].id);
  const [online, setOnline] = useState(false);
  const [today, setToday] = useState<string | null>(null);
  const [live, setLive] = useState<LiveBundle | null>(null);
  const [node, setNode] = useState(2);
  const [rounds, setRounds] = useState(D.ROUNDS);
  const [atb, setAtb] = useState(D.ATB_GROUPS);
  const [todos, setTodos] = useState(D.TODOS);
  const [clars, setClars] = useState(D.CLARS);
  const [plan, setPlan] = useState(D.PLAN_ITEMS);
  const [docsState, setDocsState] = useState<'empty' | 'parsing' | 'parsed'>('parsed');
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [todoId, setTodoId] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [toast, setToast] = useState('');
  const timer = useRef<number | undefined>(undefined);

  const notify = useCallback((text: string) => {
    setToast(text);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(''), 3200);
  }, []);
  const call = useCallback(async (path: string, method = 'GET', body?: unknown) => {
    if (!online) return null;
    try { return await api(path, method === 'GET' ? undefined : { method, body }); }
    catch (e) { notify('接口返回：' + (e instanceof Error ? e.message : String(e))); return null; }
  }, [api, online, notify]);

  useEffect(() => {
    let alive = true;
    void loadList(api, user?.id).then(r => {
      if (!alive || !r || !r.rows.length) return;
      setOnline(true); setToday(r.today);
      // 后端没有的设计稿行（同客户其它投标）保留，后端有的以接口为准
      setBids(prev => [...r.rows, ...prev.filter(p => !r.rows.some(x => x.number === p.number))]);
      const main = r.rows.find(x => x.number === D.BIDS[0].number) || r.rows[0];
      setBidId(main.id);
    });
    return () => { alive = false; };
  }, [api, user?.id]);

  useEffect(() => {
    if (!online) return;
    let alive = true;
    void loadBundle(api, bidId, user?.id).then(b => {
      if (!alive || !b) return;
      setLive(b);
      setNode(b.node);
      if (b.todos.length) setTodos(b.todos);
      if (b.clars.length) setClars(b.clars);
    });
    return () => { alive = false; };
  }, [api, bidId, online, user?.id]);

  const bid = bids.find(b => b.id === bidId) || bids[0];
  const setTab = useCallback((t: Tab) => { setTabRaw(t); setMeetingId(null); setTodoId(null); }, []);
  const openBid = useCallback((id: string, t: Tab = 'cockpit') => {
    setBidId(id); setView('detail'); setTabRaw(t); setMeetingId(null); setTodoId(null);
    // 新发起（节点 ①②）的投标还没有招标文件：招标文件 Tab 显示空态，计划 Tab 显示阶段级初版
    const row = bids.find(b => b.id === id);
    if (row) { setNode(row.node); setDocsState(row.node < 2 ? 'empty' : 'parsed'); }
  }, [bids]);

  const base = '/bids/' + encodeURIComponent(bidId);
  const completeTodo = useCallback((id: string, outcome: string, note: string, file?: string) => {
    const map: Record<string, D.Todo['status']> = { 已完成: '已完成', 部分完成: '部分完成', 已取消: '已取消', 需延期: '需延期' };
    const now = '刚刚';
    setTodos(ts => ts.map(t => t.id === id ? {
      ...t, status: map[outcome] || '已完成', overdue: false,
      result: { outcome, who: user?.name || '我', time: now, note, file },
      comments: [{ who: '系统', time: now, text: `${user?.name || '我'} 将待办标记为「${outcome}」，并回写计划条目 ${t.src}`, system: true }, ...t.comments],
    } : t));
    const apiOutcome = { 已完成: 'completed', 部分完成: 'partial', 已取消: 'cancelled', 需延期: 'delayed' }[outcome] || 'completed';
    void call(`${base}/todos/${encodeURIComponent(id)}/complete`, 'POST', { outcome: apiOutcome, note });
    notify(`${outcome.startsWith('已') ? outcome : '已标记「' + outcome + '」'}，已回写计划并写入今日日报`);
  }, [base, call, notify, user?.name]);
  const commentTodo = useCallback((id: string, text: string) => {
    setTodos(ts => ts.map(t => t.id === id ? { ...t, comments: [{ who: user?.name || '我', time: '刚刚', text }, ...t.comments] } : t));
    void call(`${base}/todos/${encodeURIComponent(id)}/comments`, 'POST', { text });
  }, [base, call, user?.name]);
  const reopenTodo = useCallback((id: string) => {
    setTodos(ts => ts.map(t => t.id === id ? { ...t, status: '进行中', result: undefined, comments: [{ who: '系统', time: '刚刚', text: `由 ${user?.name || '我'} 重新打开`, system: true }, ...t.comments] } : t));
    void call(`${base}/todos/${encodeURIComponent(id)}/reopen`, 'POST', {});
    notify('待办已重新打开');
  }, [base, call, notify, user?.name]);

  const advanceNode = useCallback((note: string) => {
    setNode(n => Math.min(9, n + 1));
    notify(`已推进到「${D.NODES[Math.min(9, node + 1)]}」${note ? '，推进说明已写入节点日志' : ''}`);
  }, [node, notify]);
  const advanceRound = useCallback(() => {
    setRounds(rs => {
      const i = rs.findIndex(r => r.state === 'now');
      if (i < 0 || i >= rs.length - 1) { notify('已是最后一轮（终审）'); return rs; }
      notify(`已推进到 ${rs[i + 1].no} · ${rs[i + 1].label}，${rs[i].no} 转为只读`);
      return rs.map((r, k) => k < i + 1 ? { ...r, state: 'done', note: '已归档 · 只读' } : k === i + 1 ? { ...r, state: 'now', date: (today || '2026-10-24').slice(5) + ' 开始', note: '进行中 · 可继续补字段' } : r);
    });
    void call(`${base}/bafo/rounds`, 'POST', {});
  }, [base, call, notify, today]);
  const setAtbField = useCallback((group: string, field: string, value: string) => {
    setAtb(gs => gs.map(g => g.key !== group ? g : { ...g, fields: g.fields.map(([k, v]) => [k, k === field ? value : v] as [string, string]) }));
  }, []);
  const createBid = useCallback(async (_form: { country: string; form: string; target: string }) => {
    // 后端只存商机 / 团队；国家、招标形式、招标对象进入 ATB 基本信息，由详情页继续补录
    const r = await call('/bids', 'POST', { opportunityId: 'OP-CATL-001', sppTeam: '储能 SPP' });
    const id = r?.id || 'BID-20261010-026';
    const number = r?.number || 'BID-20261010-026';
    setBids(bs => bs.some(b => b.number === number) ? bs : [{ id, number, customer: '宁德时代', project: '储能项目', round: '首轮', node: 0, owner: '李明', team: '储能 SPP', due: '2026-11-20', left: '27 天', from: user?.name || '李明', fromDate: (today || '2026-10-24'), status: '进行中', mine: true }, ...bs]);
    setModal({ kind: 'created', number });
  }, [call, today, user?.name]);

  const value = useMemo<P9State>(() => ({
    api, user, online, today, view, setView, tab, setTab, bids, bid, openBid, live, node, advanceNode, rounds, advanceRound,
    atb, setAtbField, todos, completeTodo, commentTodo, reopenTodo, clars, plan, setPlan, docsState, setDocsState,
    meetingId, setMeetingId, todoId, setTodoId, modal, setModal, createBid, toast, notify, call, exit: onExit,
  }), [api, user, online, today, view, tab, setTab, bids, bid, openBid, live, node, advanceNode, rounds, advanceRound, atb, setAtbField, todos, completeTodo, commentTodo, reopenTodo, clars, plan, docsState, meetingId, todoId, modal, createBid, toast, notify, call, onExit]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
