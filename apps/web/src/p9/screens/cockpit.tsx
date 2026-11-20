// P9.1.1 驾驶舱：AI 总览结论条 → 健康度 → 剩余时间 → 卡点 × 逾期任务（右侧常驻对话栏由详情外壳提供）。
import React from 'react';
import { Activity, AlarmClock, BellRing, ChevronRight, CircleAlert, Gauge, Hourglass, MessageSquare, PenLine, TrendingDown, TriangleAlert } from 'lucide-react';
import * as D from '../demo';
import { useP9 } from '../store';
import type { Tab } from '../store';
import { Avatar, Btn, Card, Num, Pill } from '../ui';
import type { Tone } from '../ui';

const dimTone = (v: number) => v >= 80 ? 'green' : v >= 70 ? 'blue' : v >= 60 ? 'orange' : 'red';
const STATE_TONE = (s: string): Tone => s.startsWith('已升级') ? 'purple' : s.startsWith('待升级') ? 'orange' : s === '今日到期' ? 'orange' : 'blue';
const AV_TONE: Record<string, 'blue' | 'purple' | 'orange' | 'green' | 'teal'> = { 王强: 'blue', 李明: 'blue', 陈磊: 'blue', 张伟: 'blue', 王芳: 'orange' };

type Item = typeof D.COCKPIT.blockers[number];
function IssueList({ items, kind }: { items: Item[]; kind: 'blocker' | 'overdue' }) {
  const { setTab, notify } = useP9();
  const act = (it: Item) => {
    if (it.go === 'urge') notify(`已催办 ${it.owner}：钉钉 + 待办提醒已发送，2 小时未回自动升级`);
    else setTab(it.go as Tab);
  };
  return (
    <div className="p9-issues">
      {items.map((it, i) => (
        <div key={it.title} className="p9-issue">
          <div className="p9-issue-top">
            <Num n={i + 1} tone={kind === 'blocker' ? 'red' : 'orange'} />
            <b className="p9-issue-title">{it.title}</b>
            <Pill tone={it.level === '高' || it.level === 'P0' ? 'red' : 'orange'}>{it.level}</Pill>
            <span className="p9-grow" />
            <Pill tone={STATE_TONE(it.state)}>{it.state}</Pill>
            <span className="p9-issue-over">{it.over}</span>
            <ChevronRight size={11} className="ic-gray" />
          </div>
          <p className="p9-issue-ai">{it.ai}</p>
          <div className="p9-issue-act">
            <Avatar name={it.owner} tone={AV_TONE[it.owner] || 'blue'} />
            <span className="p9-issue-who">{it.owner} · {it.role}</span><span className="p9-issue-src">· {it.src}</span>
            <span className="p9-grow" />
            <Btn kind="outline" size="sm" icon={it.act === '查看答疑' ? MessageSquare : it.act === '去补齐' ? PenLine : BellRing} onClick={() => act(it)}>{it.act}</Btn>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Cockpit() {
  const { live, setTab, notify, node, todos } = useP9();
  const c = D.COCKPIT;
  const score = live?.health?.score ?? c.health.score;
  const dims = live?.health?.dims.length ? live.health.dims : c.dims;
  // 接口数据时按最低两项维度生成下降主因；演示数据沿用设计稿文案
  const reason = live?.health?.dims.length ? '下降主因：' + [...dims].sort((a, b) => a[1] - b[1]).slice(0, 2).map(([k, v]) => k + ' ' + v).join('、') : c.health.reason;
  const days = live?.daysLeft ?? c.remain.days;
  const open = todos.filter(t => t.status !== '已完成' && t.status !== '已取消').length;
  return (
    <div className="p9-cockpit">
      <section className="p9-conclusion">
        <span className="p9-ai-mark"><Gauge size={20} /></span>
        <div className="p9-grow">
          <div className="p9-conclusion-title"><b>AI 投标驾驶舱</b><Pill tone="purple">AI 实时解析 · {live?.today ? live.today.slice(5) : c.updated} 更新</Pill></div>
          <p>{c.conclusion.replace('距交标 12 天', `距交标 ${days} 天`).replace('健康度 68', `健康度 ${score}`)}</p>
        </div>
        <Btn kind="primary" size="lg" icon={BellRing} onClick={() => notify(`已一键催办 ${c.urge} 人：卡点与逾期责任人已收到钉钉提醒`)}>一键催办 {c.urge} 人</Btn>
      </section>

      <Card icon={Activity} title="健康度" hint="AI 按 6 个维度打分 · 每 5 分钟刷新" right={<Pill tone="orange">{score} / 100 · {c.health.status}</Pill>}>
        <div className="p9-health">
          <div className="p9-health-score">
            <div><b className={'tone-' + dimTone(score)}>{score}</b><span>/ 100</span></div>
            <Pill tone="orange">{c.health.status} · 安全线 {c.health.safe}</Pill>
            <small>{c.health.delta}</small>
          </div>
          <i className="p9-vline" />
          <div className="p9-health-dims">
            {dims.map(([k, v]) => (
              <div key={k} className="p9-dim"><span>{k}</span><span className="p9-dim-track"><i className={'tone-' + dimTone(v)} style={{ width: v + '%' }} /></span><b className={'tone-' + dimTone(v)}>{v}</b></div>
            ))}
          </div>
        </div>
        <div className="p9-reason"><TrendingDown size={12} className="ic-red" />{reason}</div>
      </Card>

      <Card icon={Hourglass} iconTone="red" title="剩余时间" hint="按交标截止倒排 · 剩余工作日已扣除周末" right={<Pill tone="red">T-{days} 天</Pill>}>
        <div className="p9-remain">
          <div className="p9-remain-count">
            <div><b>{days}</b><span>{c.remain.hours}</span></div>
            <small>交标 {c.remain.deadline}</small>
            <small className="tone-orange">首轮澄清 {c.remain.clar} · 剩 {c.remain.clarLeft} 天</small>
          </div>
          <i className="p9-vline" />
          <div className="p9-remain-mid">
            <div className="p9-cells">{c.remain.cells.map(([v, k], i) => <div key={k}><b>{i === 2 ? open : v}</b><span>{k}</span></div>)}</div>
            {c.remain.keys.map(([k, v, t]) => <div key={k} className="p9-remain-key"><span>{k}</span><b className={'tone-' + t}>{k === '交标截止' ? `2026-11-05 · 剩 ${days} 天` : v}</b></div>)}
          </div>
          <div className="p9-remain-risk"><TriangleAlert size={13} />{c.remain.risk}</div>
        </div>
      </Card>

      <div className="p9-two">
        <Card icon={CircleAlert} iconTone="red" title="卡点 · AI 识别" hint="废标影响 / 关键路径 / 超时" right={<Pill tone="red">{c.blockers.length} 个卡点</Pill>}
          footer={<><span>共 4 个卡点（含 1 个已闭环）</span><button type="button" className="p9-link" onClick={() => setTab(node <= 2 ? 'plan' : 'todos')}>全部<ChevronRight size={11} /></button></>} flush>
          <IssueList items={c.blockers} kind="blocker" />
        </Card>
        <Card icon={AlarmClock} iconTone="red" title="逾期任务 · 自动升级" hint="截止时间 + 依赖关系" right={<Pill tone="red">2 条逾期</Pill>}
          footer={<><span>逾期超 72h 自动进 BPM</span><button type="button" className="p9-link" onClick={() => setTab('todos')}>待办<ChevronRight size={11} /></button></>} flush>
          <IssueList items={c.overdue} kind="overdue" />
        </Card>
      </div>
    </div>
  );
}
