// P9 投标全流程入口：按 view 切换 列表 / 商机 / 详情（11 个 Tab）/ 移动端，弹窗与提示统一在这里挂载。
import React from 'react';
import './p9.css';
import * as D from './demo';
import type { Api } from './live';
import { P9Provider, useP9 } from './store';
import { DetailHeader, Dock, Sidebar } from './shell';
import { Toast } from './ui';
import { BidList, EntryModals, OppBids } from './screens/list';
import { Cockpit } from './screens/cockpit';
import { AdvanceModal, Basic, Strategy } from './screens/basic';
import { Plan } from './screens/plan';
import { Docs } from './screens/docs';
import { Files, Meetings } from './screens/meetings';
import { CommentModal, CompleteModal, Todos } from './screens/todos';
import { Bafo, Review, Submit } from './screens/submit';
import { Mobile } from './screens/mobile';
import { Clock3, Sparkles } from 'lucide-react';

function Detail() {
  const { tab, modal, meetingId } = useP9();
  const body = {
    cockpit: <Cockpit />, basic: <Basic />, strategy: <Strategy />, plan: <Plan />, docs: <Docs />, meetings: <Meetings />,
    files: <Files />, todos: <Todos />, submit: <Submit />, bafo: <Bafo />, review: <Review />,
  }[tab];
  // 会议详情顶栏右侧显示会议时间（设计稿 P9.5.2）
  const right = tab === 'meetings' && meetingId ? <>
    <span className="p9-time-pill is-gray"><Clock3 size={11} />10-25 10:00–11:20</span>
    <button type="button" className="p9-ai-btn" onClick={() => document.querySelector<HTMLTextAreaElement>('.p9-dock textarea')?.focus()}><Sparkles size={13} />和纵横对话</button>
  </> : undefined;
  return (
    <div className="p9-page">
      <Sidebar />
      <main className="p9-main">
        <DetailHeader right={right} />
        <div className="p9-work">
          <div className={'p9-body is-' + tab}>{body}</div>
          {tab === 'cockpit' ? <Dock variant="cockpit" initial={D.COCKPIT_CHAT} key="cockpit" /> : <Dock key="default" />}
        </div>
      </main>
      {modal?.kind === 'advance' && <AdvanceModal />}
      {modal?.kind === 'complete' && <CompleteModal todoId={modal.todoId} />}
      {modal?.kind === 'comment' && <CommentModal todoId={modal.todoId} />}
      {(modal?.kind === 'create' || modal?.kind === 'created') && <EntryModals />}
    </div>
  );
}

function Router() {
  const { view, toast } = useP9();
  return (
    <div className="p9-root">
      {view === 'list' && <BidList />}
      {view === 'opp' && <OppBids />}
      {view === 'detail' && <Detail />}
      {view === 'mobile' && <Mobile />}
      <Toast text={toast} />
    </div>
  );
}

export function P9App({ api, user, onExit }: { api: Api; user: any; onExit: (page: string) => void }) {
  return <P9Provider api={api} user={user} onExit={onExit}><Router /></P9Provider>;
}
