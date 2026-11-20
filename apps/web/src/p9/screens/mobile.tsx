// P9M 移动端 390：我的投标 · 投标信息填报 · 投标策略 · 待办 · 完成待办（底部弹层）· 待办明细
import React, { useState } from 'react';
import {
  ArrowLeft, ArrowRight, BatteryCharging, Bell, BellRing, Bookmark, CalendarClock, Check, ChevronRight, CircleAlert, CircleCheck, FileText,
  GitBranch, MessageSquare, Mic, Monitor, Paperclip, Pencil, Plus, RotateCcw, Sparkles, X,
} from 'lucide-react';
import * as D from '../demo';
import { useP9 } from '../store';
import { cx } from '../ui';

type MScreen = 'bids' | 'form' | 'strategy' | 'todos' | 'todo';

function Phone({ title, onBack, children, input = true }: { title: string; onBack?: () => void; children: React.ReactNode; input?: boolean }) {
  return (
    <div className="m9-phone">
      <div className="m9-status"><b>9:41</b><span>●●● <BatteryCharging size={14} /></span></div>
      <div className="m9-content">
        <div className="m9-header">
          <button type="button" className="m9-round" onClick={onBack} aria-label="返回"><ArrowLeft size={18} /></button>
          <h1>{title}</h1>
          <span className="m9-actions"><span className="m9-round"><MessageSquare size={17} /></span><span className="m9-round"><Bell size={17} /></span></span>
        </div>
        <div className="m9-body">{children}</div>
        {input && <div className="m9-input"><Mic size={16} /><span>输入指令或点击语音</span><button type="button" aria-label="发送"><ArrowRight size={16} /></button></div>}
      </div>
    </div>
  );
}

const STATUS_CLASS: Record<string, string> = { 进行中: 'blue', 风险: 'orange', 已逾期: 'red' };

export function Mobile() {
  const { setView, bids, todos, completeTodo, notify } = useP9();
  const [screen, setScreen] = useState<MScreen>('bids');
  const [filter, setFilter] = useState('全部');
  const [sheet, setSheet] = useState<string | null>(null);
  const [form, setForm] = useState(D.M_FORM);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const main = bids.find(x => x.number === D.BIDS[0].number) || bids[0];
  const mbids = [
    { b: main, sub: '宁德时代 · 储能项目', rounds: [['R1 已交标', 0], ['R2 当前', 1]], left: '12', mine: 2 },
    { b: { ...main, number: 'BID-20260912-011', node: 6, status: '进行中' as const }, sub: '宁德时代 · 储能项目 · 二期', rounds: [['R1 当前', 1]], left: '6', mine: 0 },
    { b: bids.find(x => x.number === 'BID-20260928-007') || bids[2], sub: '隆基绿能 · 分布式储能', rounds: [['R1 已交标', 0], ['R2 当前', 1]], left: '4', mine: 1 },
  ];
  const shown = mbids.filter(x => filter === '全部' || (filter === '待我处理' ? x.mine > 0 : Number(x.left) <= 7));
  const filled = form.filter(f => f.v).length + 3;
  return (
    <div className="m9-stage">
      <div className="m9-stage-bar">
        <button type="button" className="p9-link" onClick={() => setView('list')}><Monitor size={12} />回 PC 列表</button>
        <span className="m9-tabs">{([['bids', '我的投标'], ['form', '信息填报'], ['strategy', '投标策略'], ['todos', '待办'], ['todo', '待办明细']] as [MScreen, string][]).map(([k, l]) => <button type="button" key={k} className={cx(screen === k && 'is-on')} onClick={() => setScreen(k)}>{l}</button>)}</span>
      </div>

      {screen === 'bids' && (
        <Phone title="我的投标" onBack={() => setView('list')}>
          <div className="m9-seg">{[['全部', 8], ['待我处理', 3], ['即将交标', 2]].map(([k, n]) => <button type="button" key={k} className={cx(filter === k && 'is-on')} onClick={() => setFilter(String(k))}>{k} <i>{n}</i></button>)}</div>
          <button type="button" className="m9-primary" onClick={() => notify('发起投标：在 PC 端填写 4 个基本信息后生成编号')}><Plus size={16} />发起投标</button>
          <div className="m9-ai"><Sparkles size={13} />8 个在跟 · 3 个待我处理 · 2 个本周交标</div>
          {shown.map(({ b, sub, rounds, left, mine }) => (
            <button type="button" key={b.number} className="m9-card m9-bid" onClick={() => setScreen('form')}>
              <span className="m9-bid-top"><b>{b.number}</b><i className={'m9-tag tone-' + STATUS_CLASS[b.status]}>{b.status}</i></span>
              <small>{sub}</small>
              <span className="m9-rounds">{rounds.map(([t, now]) => <i key={String(t)} className={cx(now ? 'is-now' : '')}>{t}</i>)}</span>
              <span className="m9-node"><GitBranch size={12} /><b>{D.NODES[b.node]}</b><em>交标剩 {left} 天</em></span>
              <span className="m9-bid-foot"><small>我的待办 {mine} 件</small><ChevronRight size={14} /></span>
            </button>
          ))}
        </Phone>
      )}

      {screen === 'form' && (
        <Phone title="投标信息填报" onBack={() => setScreen('bids')}>
          <div className="m9-progress"><div><b>已填 {filled} / 12</b><small>缺 {12 - filled} 项不阻断，可先存草稿</small></div><span><i style={{ width: filled / 12 * 100 + '%' }} /></span></div>
          <div className="m9-card m9-form">
            <div className="m9-form-head"><b>基本信息</b><small>{form.filter(f => f.v).length - 1} / 9</small></div>
            {form.map((f, i) => (
              <label key={f.k} className="m9-form-row"><span>{f.k}</span>
                {f.v || f.k === '项目名称' ? <input value={f.v} onChange={e => setForm(fs => fs.map((x, j) => j === i ? { ...x, v: e.target.value } : x))} />
                  : <span className="m9-missing"><input placeholder="待补" onBlur={e => { const v = e.target.value; if (v) setForm(fs => fs.map((x, j) => j === i ? { ...x, v } : x)); }} /><Pencil size={12} /></span>}
              </label>
            ))}
          </div>
          {[['商务情况', '0 / 8'], ['技术模块', '4 / 8'], ['售后板块', '1 / 4']].map(([k, v]) => <button type="button" key={k} className="m9-card m9-fold" onClick={() => notify(`「${k}」在 PC 端逐项补录更方便，移动端可语音补一句`)}><b>{k} {v}</b><ChevronRight size={14} /></button>)}
          <div className="m9-btns"><button type="button" className="m9-ghost" onClick={() => notify('草稿已保存')}><Bookmark size={16} />保存草稿</button><button type="button" className="m9-primary" onClick={() => { notify('已提交，缺失项已转待澄清'); setScreen('strategy'); }}><Check size={16} />提交</button></div>
        </Phone>
      )}

      {screen === 'strategy' && (
        <Phone title="投标策略" onBack={() => setScreen('form')}>
          {D.M_STRATEGY.map(([k, src, v]) => <div key={k} className="m9-card m9-strat"><div><b>{k}</b><i>{src}</i></div><p>{v}</p></div>)}
          <div className="m9-card m9-aidir">
            <div className="m9-aidir-head"><Sparkles size={14} />AI 策略方向</div>
            {D.AI_DIRECTION.map(([k, v]) => <div key={k}><i>{k}</i><p>{k === '主打点' ? v.replace('用全生命周期', '全生命周期') : v}</p></div>)}
            <div className="m9-warn"><CircleAlert size={12} />客户已与阳光电源技术交流，报价姿态需先确认对手底价</div>
          </div>
          <div className="m9-btns"><button type="button" className="m9-primary" onClick={() => notify('已采用此方向')}><Check size={16} />采用此方向</button><button type="button" className="m9-ghost" onClick={() => notify('AI 正在重新生成方向…')}>再生成</button></div>
        </Phone>
      )}

      {(screen === 'todos') && (
        <Phone title="投标待办" onBack={() => setScreen('bids')}>
          <div className="m9-stats">{[['1', '已逾期', 'red'], ['2', '今天到期', 'orange'], ['3', '本周', 'gray']].map(([n, l, t]) => <div key={l} className="m9-card"><b className={'tone-' + t}>{n}</b><small>{l}</small></div>)}</div>
          {['今天到期', '本周'].map(g => (
            <React.Fragment key={g}>
              <div className="m9-group">{g} · {D.M_TODOS.filter(t => t.group === g).length}</div>
              {D.M_TODOS.filter(t => t.group === g).map(t => {
                const done = doneIds.has(t.id) || todos.find(x => x.id === t.id)?.status === '已完成';
                return (
                  <div key={t.id} className="m9-card m9-todo">
                    <div className="m9-todo-main">
                      <button type="button" className={cx('m9-check', done && 'is-on')} onClick={() => !done && setSheet(t.id)} aria-label="完成">{done && <Check size={12} />}</button>
                      <div><b className={cx(done && 'is-done')}>{t.title}</b><small>{t.sub}</small><span className="m9-todo-tags"><i className={'m9-pri is-' + t.pri}>{t.pri}</i><em className={t.pri === 'P0' ? 'tone-red' : 'tone-orange'}>截止 {t.due}</em></span></div>
                    </div>
                    <div className="m9-todo-act">
                      <button type="button" className="m9-btn is-primary" disabled={done} onClick={() => setSheet(t.id)}><Check size={11} />{done ? '已完成' : '完成'}</button>
                      <button type="button" className="m9-btn" onClick={() => notify(t.second === '延期' ? '已申请延期 1 天，待负责人确认' : '已催办')}>{t.second === '延期' ? <CalendarClock size={11} /> : <BellRing size={11} />}{t.second}</button>
                      <button type="button" className="m9-btn" onClick={() => setScreen('todo')}>详情<ChevronRight size={11} /></button>
                    </div>
                  </div>
                );
              })}
            </React.Fragment>
          ))}
          <div className="m9-ai is-purple"><Sparkles size={13} />勾选完成会自动回写计划与今日日报；也可以按住麦克风说一句，我帮你写进展</div>
          {sheet && <CompleteSheet title={D.M_TODOS.find(t => t.id === sheet)!.title} onClose={() => setSheet(null)} onDone={(o, n) => { setDoneIds(s => new Set(s).add(sheet)); if (todos.some(x => x.id === sheet)) completeTodo(sheet, o, n); else notify('已' + o); setSheet(null); }} />}
        </Phone>
      )}

      {screen === 'todo' && <TodoDetailM onBack={() => setScreen('todos')} />}
    </div>
  );
}

function CompleteSheet({ title, onClose, onDone }: { title: string; onClose: () => void; onDone: (outcome: string, note: string) => void }) {
  const [o, setO] = useState('已完成');
  const [note, setNote] = useState('');
  return (
    <div className="m9-sheet-mask" onClick={onClose}>
      <div className="m9-sheet" onClick={e => e.stopPropagation()} role="dialog" aria-label="完成待办">
        <i className="m9-grab" />
        <div className="m9-sheet-head"><b>完成待办</b><button type="button" className="m9-x" onClick={onClose} aria-label="关闭"><X size={14} /></button></div>
        <div className="m9-sheet-todo"><b>{title}</b><small>① 商机判断　李明　<em>今天到期</em></small></div>
        <div className="m9-sheet-label">完成情况<i>*</i></div>
        <div className="m9-outcomes">{['已完成', '部分完成', '已取消', '需延期'].map(k => <button type="button" key={k} className={cx(o === k && 'is-on')} onClick={() => setO(k)}>{k}</button>)}</div>
        <div className="m9-sheet-label">完成说明<i>*</i></div>
        <label className="m9-textarea"><textarea value={note} onChange={e => setNote(e.target.value)} placeholder="已完成：项目地点补福建宁德；供货范围补 DC Block + PCS；保证金补 500 万元（2%）" /><Mic size={14} /></label>
        <button type="button" className="m9-attach"><Paperclip size={14} />添加附件（选填）<span className="p9-grow" /><small>PDF / 图片</small></button>
        <div className="m9-btns"><button type="button" className="m9-ghost" onClick={onClose}>取消</button><button type="button" className="m9-primary" onClick={() => onDone(o, note || '已完成：项目地点补福建宁德；供货范围补 DC Block + PCS；保证金补 500 万元（2%）')}><Check size={16} />确认完成</button></div>
      </div>
    </div>
  );
}

function TodoDetailM({ onBack }: { onBack: () => void }) {
  const { todos, reopenTodo } = useP9();
  const t = todos[0];
  const done = t.status === '已完成';
  return (
    <Phone title="待办明细" onBack={onBack}>
      <div className="m9-card m9-detail">
        <div className="m9-detail-top"><b>补齐 3 个基本信息字段</b><i className={'m9-tag tone-' + (done ? 'green' : 'blue')}>{t.status}</i></div>
        <small>项目地点 / 我司供货范围 / 投标保证金 —— 补录后回写 ATB 与商机</small>
        {[['负责人', '李明（SLS）'], ['截止', '2026-10-25（已延期 1 次）'], ['创建', '王强 · 10-20 14:20']].map(([k, v]) => <div key={k} className="m9-kv"><span>{k}</span><b>{v}</b></div>)}
        {done && <button type="button" className="m9-reopen" onClick={() => reopenTodo(t.id)}><RotateCcw size={13} />重新打开</button>}
      </div>
      {done && <div className="m9-card m9-done"><div><CircleCheck size={13} />完成结果</div><p>{t.result?.note || '项目地点补福建宁德；我司供货范围补 DC Block + PCS；投标保证金补 500 万元（2%）。'}</p><small><FileText size={11} />供货范围截图.png · 240 KB</small></div>}
      <div className="m9-card m9-cmts">
        <div className="m9-cmts-head"><b>评论与动态 · 3</b><small>最新在前</small></div>
        {[['系统', '10-24 16:32', '李明 将待办标记为「已完成」，并回写计划条目 ③ 标书分解'], ['王强', '10-24 15:10', '保证金金额按 2% 记，财务那边我已经打过招呼'], ['李明', '10-24 11:02', '截图已传，供货范围里 PCS 是甲供还是我们供？']].map(([w, tm, x]) => <div key={tm} className="m9-cmt"><div><b>{w}</b><small>{tm}</small></div><p>{x}</p></div>)}
      </div>
      <div className="m9-card m9-links">
        <b>关联对象</b>
        {[['来源拆解条目', '③ 标书分解 · 4.1 基本信息 ATB 补齐'], ['相关澄清', '3 条（其中 1 条未闭环）'], ['相关会议', '客户澄清会（第一轮）']].map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b><ChevronRight size={14} /></div>)}
      </div>
    </Phone>
  );
}
