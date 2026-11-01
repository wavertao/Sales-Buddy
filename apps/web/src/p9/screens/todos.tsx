// P9.7 待办与澄清：列表（勾选 / 评论 / 详情）· 待办详情（完成结果 + 评论时间线）· 完成确认弹层 · 评论弹层
import React, { useRef, useState } from 'react';
import { ArrowLeft, ArrowUp, AtSign, BellRing, Check, ChevronRight, CircleCheck, CircleCheckBig, CloudUpload, FileText, ListTodo, MessageSquare, Mic, Paperclip, PenLine, Plus, RotateCcw, Smile, X } from 'lucide-react';
import * as D from '../demo';
import { useP9 } from '../store';
import { Avatar, Btn, Check as Checkbox, Modal, Pill, RoundTag, cx } from '../ui';

const isDone = (t: D.Todo) => ['已完成', '已取消'].includes(t.status);
const AV: Record<string, 'blue' | 'purple' | 'orange'> = { 王强: 'blue', 李明: 'purple', 陈磊: 'blue', 王芳: 'orange', 张伟: 'blue' };

function Chips({ value, onChange, counts }: { value: string; onChange: (v: string) => void; counts: [string, number][] }) {
  return <span className="p9-mini-chips">{counts.map(([k, n]) => <button type="button" key={k} className={cx(value === k && 'is-on')} onClick={() => onChange(k)}>{k} {n}</button>)}</span>;
}

export function Todos() {
  const { todos, clars, todoId, setTodoId, setModal, notify, user } = useP9();
  const [tf, setTf] = useState(() => todos.some(t => t.mine) ? '我的' : '全部');
  const [cf, setCf] = useState('全部');
  if (todoId) return <TodoDetail todo={todos.find(t => t.id === todoId) || todos[0]} onBack={() => setTodoId(null)} />;
  const overdue = todos.filter(t => t.overdue && !isDone(t));
  const tRows = todos.filter(t => tf === '全部' || (tf === '我的' ? t.mine : t.overdue && !isDone(t)));
  const isMineClar = (c: D.Clar) => c.owner === user?.name;
  const cRows = clars.filter(c => cf === '全部' || (cf === '我的' ? isMineClar(c) : c.status === '待答复'));
  const open = clars.filter(c => c.status === '待答复').length;
  return (
    <div className="p9-col is-gap12">
      <section className="p9-card">
        <header className="p9-card-head">
          <div className="p9-card-head-left"><ListTodo size={13} className="ic-blue" /><h3>{tf === '我的' ? '我的待办' : '全部待办'} · {tRows.length} 项</h3><span className="p9-card-hint tone-purple">与计划联动 · 勾选完成回写条目状态</span></div>
          <div className="p9-card-head-right"><Chips value={tf} onChange={setTf} counts={[['我的', todos.filter(t => t.mine).length], ['全部', todos.length], ['逾期', overdue.length]]} /><Btn kind="primary" size="sm" icon={Plus} onClick={() => notify('新建待办：默认挂当前轮次 R2，可关联计划条目')}>新建</Btn></div>
        </header>
        <div className="p9-table" style={{ '--cols': '18px minmax(0,1fr) 34px 88px 54px 50px 40px 54px' } as React.CSSProperties}>
          <div className="p9-tr is-head"><div /><div className="p9-th">待办事项</div><div className="p9-th is-center">轮次</div><div className="p9-th">来源</div><div className="p9-th">负责人</div><div className="p9-th">截止</div><div className="p9-th">优先级</div><div className="p9-th is-right">操作</div></div>
          {tRows.map(t => (
            <div key={t.id} className="p9-tr is-36">
              <Checkbox checked={isDone(t)} onChange={() => isDone(t) ? notify('已完成的待办可在详情里「重新打开」') : setModal({ kind: 'complete', todoId: t.id })} label={t.title} />
              <button type="button" className={cx('p9-todo-title', isDone(t) && 'is-done')} onClick={() => setTodoId(t.id)}>{t.title}</button>
              <div className="p9-td-c is-center"><RoundTag round={t.round} /></div>
              <div className="p9-td-c is-muted">{t.src}</div>
              <div className="p9-td-c">{t.owner}</div>
              <div className={cx('p9-td-c is-bold', t.due === '今天' && !isDone(t) ? 'tone-red' : 'is-muted')}>{t.due}</div>
              <div><span className={'p9-pri is-' + t.pri}>{t.pri}</span></div>
              <div className="p9-row-ops">
                <button type="button" className="p9-cmt" onClick={() => setModal({ kind: 'comment', todoId: t.id })} aria-label="评论"><MessageSquare size={10} />{t.comments.length}</button>
                <button type="button" className="p9-go" onClick={() => setTodoId(t.id)} aria-label="查看详情"><ChevronRight size={11} /></button>
              </div>
            </div>
          ))}
        </div>
        <footer className="p9-card-foot"><span>已完成 {todos.filter(isDone).length} 项 · 逾期 {overdue.length} 项</span><button type="button" className="p9-link" onClick={() => setTf('全部')}>查看全部</button></footer>
      </section>
      <section className="p9-card">
        <header className="p9-card-head">
          <div className="p9-card-head-left"><h3>澄清条目</h3><span className="p9-card-hint tone-orange">{clars.length} 条 · 未闭环 {open}</span></div>
          <div className="p9-card-head-right"><Chips value={cf} onChange={setCf} counts={[['我的', clars.filter(isMineClar).length], ['全部', clars.length], ['待答复', open]]} /><Btn kind="primary" size="sm" icon={Plus} onClick={() => notify('新建澄清：选择方向（pre-bid / post-bid）与类别（技术 / 商务 / 偏差）')}>新建</Btn></div>
        </header>
        <div className="p9-table" style={{ '--cols': '18px 52px 34px 60px minmax(0,1fr) 60px 52px 56px 54px' } as React.CSSProperties}>
          <div className="p9-tr is-head"><div /><div className="p9-th is-center">类型</div><div className="p9-th is-center">轮次</div><div className="p9-th">来源</div><div className="p9-th">问题</div><div className="p9-th">责任方</div><div className="p9-th">截止</div><div className="p9-th">状态</div><div className="p9-th is-right">操作</div></div>
          {cRows.map(c => (
            <div key={c.id} className="p9-tr is-34">
              <Checkbox checked={c.status === '已答复'} label={c.q} onChange={() => notify(c.status === '已答复' ? '已答复的澄清可在详情中重开' : '请先填写答复内容再关闭')} />
              <div className="p9-td-c is-center"><Pill tone={c.type === '技术' ? 'blue' : c.type === '商务' ? 'purple' : 'green'} shape="tag">{c.type}</Pill></div>
              <div className="p9-td-c is-center"><RoundTag round={c.round} /></div>
              <div className="p9-td-c is-muted p9-mono">{c.dir}</div>
              <div className="p9-td-c is-ellipsis">{c.q}</div>
              <div className="p9-td-c">{c.owner}</div>
              <div className="p9-td-c tone-green p9-mono">{c.due}</div>
              <div className={cx('p9-td-c is-bold', c.status === '待答复' ? 'tone-orange' : 'tone-green')}>{c.status}</div>
              <div className="p9-row-ops"><span className="p9-cmt"><MessageSquare size={10} />{c.comments}</span><span className="p9-go"><ChevronRight size={11} /></span></div>
            </div>
          ))}
        </div>
        <footer className="p9-card-foot"><span>已答复 {clars.length - open} · 待答复 {open} · pre-bid {clars.filter(c => c.dir === 'pre-bid').length} / post-bid {clars.filter(c => c.dir === 'post-bid').length}</span><button type="button" className="p9-link" onClick={() => setCf('全部')}>查看全部</button></footer>
      </section>
    </div>
  );
}

function CommentList({ comments }: { comments: D.Comment[] }) {
  return (
    <div className="p9-comments">
      {comments.map((c, i) => c.system ? (
        <div key={i} className="p9-cmt-sys"><i />系统 · {c.time}　{c.text}</div>
      ) : (
        <div key={i} className="p9-cmt-row">
          <Avatar name={c.who} tone={AV[c.who] || 'purple'} size={24} />
          <div className="p9-grow"><div className="p9-cmt-meta"><b>{c.who}</b><small>{c.time}</small></div><p>{c.text}</p></div>
        </div>
      ))}
    </div>
  );
}

function TodoDetail({ todo, onBack }: { todo: D.Todo; onBack: () => void }) {
  const { reopenTodo, commentTodo, setModal, notify } = useP9();
  const [text, setText] = useState('');
  const done = isDone(todo);
  const x = D.TODO_DETAIL_EXTRA;
  const res = todo.result;
  const short = todo.title.replace(/（.*）$/, '');
  const send = () => { if (!text.trim()) return; commentTodo(todo.id, text.trim()); setText(''); };
  return (
    <div className="p9-todo-detail">
      <div className="p9-crumb"><button type="button" className="p9-link" onClick={onBack}><ArrowLeft size={11} />待办与澄清</button><span>/</span><b>{short}</b></div>
      <section className="p9-card">
        <div className="p9-td-head">
          <div className="p9-grow">
            <h2>{todo.full || todo.title}</h2>
            <div className="p9-td-tags">
              <Pill tone={done ? 'green' : todo.overdue ? 'red' : 'blue'}>{todo.status}</Pill>
              <span className={'p9-pri is-' + todo.pri}>{todo.pri}</span>
              <RoundTag round={todo.round} label={todo.round === 'R1' ? '首轮' : '次轮'} />
              <Pill tone="gray">{todo.src}</Pill>
            </div>
          </div>
          {done ? <Btn kind="ghost" icon={RotateCcw} onClick={() => reopenTodo(todo.id)}>重新打开</Btn> : <Btn kind="primary" size="sm" icon={CircleCheck} onClick={() => setModal({ kind: 'complete', todoId: todo.id })}>完成</Btn>}
          <Btn kind="soft" size="sm" icon={PenLine} onClick={() => notify('编辑：可改标题、负责人、截止时间与优先级')}>编辑</Btn>
          <Btn kind="soft" size="sm" icon={BellRing} onClick={() => notify(`已催办 ${todo.owner}`)}>催办</Btn>
        </div>
        <div className="p9-td-info">
          {[['负责人', `${todo.owner}（${D.ROLE_OF[todo.owner] || '—'}）`], ['截止时间', todo.id === 't1' ? x.deadline : todo.due], ['创建人 / 时间', x.creator], ['关联客户', x.customer], ['关联商机', x.opp], ['关联线索', x.lead]].map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}
        </div>
      </section>
      {res && (
        <section className="p9-result">
          <div className="p9-result-head"><CircleCheckBig size={13} /><b>{res.outcome}</b><small>{res.who} · {res.time}</small></div>
          <p className="p9-result-note">{res.note}</p>
          {(res.file || todo.id === 't1') && <div className="p9-result-file"><Paperclip size={11} /><span className="tone-blue">{res.file || x.result.file}</span><small>{x.result.sync}</small></div>}
        </section>
      )}
      <section className="p9-card is-fill">
        <header className="p9-card-head"><div className="p9-card-head-left"><MessageSquare size={13} className="ic-blue" /><h3>评论与动态 · {todo.comments.length}</h3></div><span className="p9-card-hint">最新在前</span></header>
        <CommentList comments={todo.comments} />
        <span className="p9-grow" />
        <div className="p9-comment-input">
          <label><input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send(); }} placeholder="写评论，@ 可提醒同事…" /><Mic size={12} /></label>
          <button type="button" className="p9-send is-lg" onClick={send} aria-label="发送"><ArrowUp size={14} /></button>
        </div>
      </section>
    </div>
  );
}

/** P9.7.3 完成确认弹层（PC）。 */
export function CompleteModal({ todoId }: { todoId: string }) {
  const { todos, setModal, completeTodo, setTodoId } = useP9();
  const t = todos.find(x => x.id === todoId);
  const [outcome, setOutcome] = useState('已完成');
  const [note, setNote] = useState(todoId === 't1' ? '已完成：项目地点补福建宁德；我司供货范围补 DC Block + PCS；投标保证金补 500 万元（2%）。' : '');
  const [file, setFile] = useState<{ name: string; size: string } | null>(todoId === 't1' ? { name: '供货范围截图.png', size: '1.2 MB' } : null);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  if (!t) return null;
  const pick = (f?: File) => { if (f) setFile({ name: f.name, size: (f.size / 1048576).toFixed(1) + ' MB' }); };
  return (
    <Modal icon={CircleCheck} title="完成这条待办" width={520} onClose={() => setModal(null)} className="is-complete" footer={<>
      <span className="p9-modal-foot-note">完成后不可再修改结果，可继续评论</span><span className="p9-grow" />
      <Btn kind="outline" size="lg" onClick={() => setModal(null)}>取消</Btn>
      <Btn kind="primary" size="lg" icon={Check} disabled={!note.trim()} onClick={() => { completeTodo(t.id, outcome, note.trim(), file ? `${file.name} · ${file.size}` : undefined); setModal(null); setTodoId(t.id); }}>确认完成</Btn>
    </>}>
      <div className="p9-cm-todo"><b>{t.title}</b><small>来源 {t.src}　负责人 {t.owner}　<span className="tone-red">截止 {t.due}</span></small></div>
      <div className="p9-mf"><span className="p9-mf-label is-strong">完成情况<i className="p9-req">*</i></span>
        <div className="p9-outcomes">{D.COMPLETE_OUTCOMES.map(([k, tone]) => <button type="button" key={k} className={cx(outcome === k && 'is-on')} onClick={() => setOutcome(k)}><i className="p9-radio" /><i className={'p9-dot tone-' + tone} />{k}</button>)}</div>
      </div>
      <div className="p9-mf"><span className="p9-mf-label is-strong">说明<i className="p9-req">*</i><small>会写进这条待办的历史，并汇总到今日日报</small></span>
        <span className="p9-textarea is-tall"><textarea value={note} maxLength={200} onChange={e => setNote(e.target.value)} placeholder="写一句完成情况…" /><span className="p9-ta-foot"><Mic size={11} /><span className="p9-grow" />{note.length} / 200</span></span>
      </div>
      <div className={cx('p9-drop', drag && 'is-drag')} onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}>
        <input ref={input} type="file" hidden onChange={e => pick(e.target.files?.[0])} />
        <span><CloudUpload size={15} className="ic-blue" />拖拽文件到这里，或 <button type="button" className="p9-link" onClick={() => input.current?.click()}>选择文件</button></span>
        <small>支持 PDF / Word / Excel / 图片，单个不超过 20 MB</small>
      </div>
      {file && <div className="p9-attached"><FileText size={10} />已附 1 个：{file.name}<small>· {file.size}</small><span className="p9-grow" /><button type="button" className="p9-plain" onClick={() => setFile(null)} aria-label="移除附件"><X size={10} /></button></div>}
    </Modal>
  );
}

/** P9.7.4 评论弹层。 */
export function CommentModal({ todoId }: { todoId: string }) {
  const { todos, setModal, commentTodo, setTodoId } = useP9();
  const t = todos.find(x => x.id === todoId);
  const [text, setText] = useState('');
  if (!t) return null;
  const send = () => { if (!text.trim()) return; commentTodo(t.id, text.trim()); setText(''); };
  return (
    <Modal icon={MessageSquare} title={`评论 · ${t.comments.filter(c => !c.system).length} 条`} width={480} onClose={() => setModal(null)} className="is-comment" footer={<>
      <span className="p9-modal-foot-note">评论会同步给负责人与提出人</span><span className="p9-grow" />
      <button type="button" className="p9-link" onClick={() => { setModal(null); setTodoId(t.id); }}>查看完整详情 ›</button>
      <Btn kind="primary" size="lg" icon={ArrowUp} onClick={send}>发送</Btn>
    </>}>
      <div className="p9-cm-todo"><b>{t.full || t.title}</b><small>负责人 {t.owner} · 截止 {t.due} · 来源 {t.src}</small></div>
      <div className="p9-cm-list"><CommentList comments={t.comments.filter(c => !c.system)} /></div>
      <div className="p9-cm-input">
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="追加评论，@ 可提醒同事…" onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(); }} />
        <div className="p9-cm-tools"><AtSign size={11} /><Paperclip size={11} /><Smile size={11} /><Mic size={11} /><span className="p9-grow" /><small>⌘ + Enter 发送</small></div>
      </div>
    </Modal>
  );
}
