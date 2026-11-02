// P9.5 会议：会议清单 · 会议详情（Tab 内二级页）；P9.6 文件：文件夹树 + 版本列表。
import React, { useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronDown, ChevronRight, FileSpreadsheet, FileText, Folder, FolderOpen, FolderPlus, Mic, Plus, Search, Sparkles, Upload } from 'lucide-react';
import * as D from '../demo';
import { useP9 } from '../store';
import { Avatar, Btn, Check as Checkbox, Pill, RoundTag, cx } from '../ui';
import type { Tone } from '../ui';

const MT_TONE: Record<string, Tone> = { 待开: 'blue', 待纪要: 'orange', 已出纪要: 'green' };

export function Meetings() {
  const { live, meetingId, setMeetingId, notify } = useP9();
  const meetings = live?.meetings.length ? live.meetings : D.MEETINGS;
  const [filter, setFilter] = useState('全部');
  if (meetingId) return <MeetingDetail meeting={meetings.find(m => m.id === meetingId) || meetings[1]} onBack={() => setMeetingId(null)} />;
  const counts = { 全部: meetings.length, 待开: meetings.filter(m => m.status === '待开').length, 待纪要: meetings.filter(m => m.status === '待纪要').length, 已出纪要: meetings.filter(m => m.status === '已出纪要').length } as Record<string, number>;
  const rows = meetings.filter(m => filter === '全部' || m.status === filter);
  return (
    <section className="p9-card is-fill">
      <header className="p9-card-head">
        <div className="p9-card-head-left"><h3>会议</h3><span className="p9-card-hint tone-blue">{meetings.length} 场 · {counts['待纪要'] + counts['待开']} 场待出纪要</span></div>
        <div className="p9-card-head-right">
          <Btn kind="ai" size="sm" icon={Mic} onClick={() => notify('导入听记：选择录音后自动转写并产出纪要、待办与澄清条目')}>导入听记</Btn>
          <Btn kind="primary" size="sm" icon={Plus} onClick={() => notify('已打开预约会议：默认带入当前轮次 R2 与 SPP 团队成员')}>预约会议</Btn>
        </div>
      </header>
      <div className="p9-filter-row is-in-card">
        {Object.keys(counts).map(k => <button type="button" key={k} className={cx('p9-chip is-sm', filter === k && 'is-on')} onClick={() => setFilter(k)}>{k} {counts[k]}</button>)}
      </div>
      <div className="p9-table" style={{ '--cols': 'minmax(0,1fr) 64px 82px 52px 52px 56px 40px 40px 60px 70px' } as React.CSSProperties}>
        <div className="p9-tr is-head">{['会议名称 / 轮次', '类型', '时间', '参与人', '发起人', '录音', '待办', '结论', '状态', '操作'].map((h, i) => <div key={h} className={cx('p9-th', i === 9 && 'is-center')}>{h}</div>)}</div>
        {rows.map(m => (
          <div key={m.id} className="p9-tr is-38">
            <div className="p9-td-stack"><b className="is-10">{m.name}</b><span className="p9-round-line"><RoundTag round={m.round} /><small>{m.roundLabel}</small></span></div>
            <div><Pill tone="blue" shape="tag">{m.type}</Pill></div>
            <div className="p9-td-c is-muted p9-mono">{m.time}</div>
            <div className="p9-td-c">{m.people} 人</div>
            <div className="p9-td-c">{m.host}</div>
            <div className={cx('p9-td-c', m.rec === '已转写' ? 'tone-blue' : 'is-muted')}>{m.rec}</div>
            <div className="p9-td-c tone-blue">{m.todo}</div>
            <div className="p9-td-c tone-blue">{m.concl}</div>
            <div className={'p9-td-c tone-' + MT_TONE[m.status]}>{m.status}</div>
            <div className="p9-td-c is-center"><Btn kind="soft" size="sm" iconRight={ChevronRight} onClick={() => setMeetingId(m.id)}>查看详情</Btn></div>
          </div>
        ))}
      </div>
      <span className="p9-grow" />
      <footer className="p9-card-foot"><span>{meetings.length} 场 · 已出纪要 {counts['已出纪要']} · 待纪要 {counts['待纪要']} · 待开 {counts['待开']}</span><button type="button" className="p9-link" onClick={() => notify('已导出会议台账（Excel）')}>导出会议台账</button></footer>
    </section>
  );
}

function MeetingDetail({ meeting, onBack }: { meeting: D.Meeting; onBack: () => void }) {
  const { notify, setTab } = useP9();
  const md = D.MEETING_DETAIL;
  const [editing, setEditing] = useState(true);
  const [minutes, setMinutes] = useState(md.minutes);
  const [todos, setTodos] = useState(md.todos);
  const [dispatched, setDispatched] = useState(false);
  return (
    <div className="p9-meeting">
      <div className="p9-crumb"><button type="button" className="p9-link" onClick={onBack}><ArrowLeft size={11} />会议列表</button><span>/</span><b>{meeting.name}</b></div>
      <div className="p9-meeting-cols">
        <div className="p9-col">
          <section className="p9-card">
            <header className="p9-card-head">
              <div className="p9-card-head-left"><Sparkles size={13} className="ic-purple" /><h3>AI 纪要</h3><RoundTag round="R2" label="短名单" /><span className="p9-card-hint tone-purple">{editing ? '编辑中 · 保存后写入纪要' : '已保存 · 已写入纪要'}</span></div>
              <div className="p9-card-head-right">
                <button type="button" className="p9-link" onClick={() => notify('转写全文：80 分钟 · 3 位发言人，已按发言人分段')}>查看转写全文</button>
                {editing ? <>
                  <Btn kind="outline" size="sm" onClick={() => { setMinutes(md.minutes); setEditing(false); }}>取消</Btn>
                  <Btn kind="primary" size="sm" icon={Check} onClick={() => { setEditing(false); notify('纪要已保存，草稿转正式'); }}>保存</Btn>
                </> : <Btn kind="outline" size="sm" onClick={() => setEditing(true)}>编辑</Btn>}
              </div>
            </header>
            <div className="p9-minutes">
              {minutes.map(([k, v], i) => (
                <div key={k} className="p9-minute-row"><span>{k}</span>
                  {editing ? <textarea value={v} rows={v.length > 60 ? 2 : 1} onChange={e => setMinutes(ms => ms.map((m, j) => j === i ? [m[0], e.target.value] : m))} /> : <p>{v}</p>}
                </div>
              ))}
            </div>
          </section>
          <section className="p9-card">
            <header className="p9-card-head is-sub"><div className="p9-card-head-left"><i className="p9-sec-bar bar-blue" /><h3>本场结论 · {md.conclusions.length} 条</h3></div></header>
            <ul className="p9-bullets">{md.conclusions.map(c => <li key={c}>{c}</li>)}</ul>
          </section>
          <section className="p9-card">
            <header className="p9-card-head is-sub"><div className="p9-card-head-left"><i className="p9-sec-bar bar-purple" /><h3>本场待办 · {todos.length} 条</h3></div>
              <button type="button" className="p9-link" disabled={dispatched} onClick={() => { setDispatched(true); notify('已全部派发：待办按 RACI 下发，澄清条目已回写「待办与澄清」'); }}>{dispatched ? '已派发' : '全部派发'}</button></header>
            <div className="p9-mtodos">
              {todos.map((t, i) => (
                <div key={t.t} className="p9-mtodo">
                  <Checkbox checked={t.done} onChange={() => setTodos(ts => ts.map((x, j) => j === i ? { ...x, done: !x.done, status: !x.done ? '已完成' : '进行中' } : x))} label={t.t} />
                  <b className={cx(t.done && 'is-done')}>{t.t}</b><span className="p9-grow" /><small>{t.who}</small>
                  <Pill tone={t.status === '已完成' ? 'green' : t.status === '进行中' ? 'blue' : 'gray'} shape="tag">{t.status}</Pill>
                </div>
              ))}
            </div>
          </section>
        </div>
        <div className="p9-col is-side">
          <section className="p9-card">
            <header className="p9-card-head is-sub"><div className="p9-card-head-left"><h3>参与人</h3></div><span className="p9-card-hint">{md.people.length} 人</span></header>
            <div className="p9-people">{md.people.map(([n, r, t]) => <div key={n}><Avatar name={n} tone={t as 'blue'} size={18} /><b>{n}</b><small>{r}</small></div>)}</div>
          </section>
          <section className="p9-card">
            <header className="p9-card-head is-sub"><div className="p9-card-head-left"><h3>录音与转写</h3></div><button type="button" className="p9-link" onClick={() => notify('已提交重新转写，约 2 分钟完成')}>重转写</button></header>
            <div className="p9-kv">{md.record.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}</div>
          </section>
          <section className="p9-card">
            <header className="p9-card-head is-sub"><div className="p9-card-head-left"><h3>本场关联</h3></div></header>
            <div className="p9-kv is-links">{md.links.map(([k, v]) => <button type="button" key={k} onClick={() => k === '相关文件' ? setTab('files') : setTab('todos')}><i />{k}<span>{v}</span></button>)}</div>
          </section>
        </div>
      </div>
    </div>
  );
}

function NameInput({ value, icon, onDone }: { value: string; icon?: boolean; onDone: (v: string) => void }) {
  return (
    <div className={cx(icon ? 'p9-tree-row' : 'p9-tree-sub', 'is-on is-edit')}>
      {icon ? <FolderOpen size={12} /> : <i />}
      <input autoFocus defaultValue={value} aria-label="文件夹名称" onFocus={e => e.target.select()} onBlur={e => onDone(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') onDone(value); }} />
    </div>
  );
}

export function Files() {
  const { live, notify } = useP9();
  const files = live?.files.length ? live.files : D.FILES;
  const [folder, setFolder] = useState('投标文件');
  const [sub, setSub] = useState<string | null>(null);
  const [openF, setOpenF] = useState<Set<string>>(new Set(['投标文件']));
  const [fq, setFq] = useState('');
  const [q, setQ] = useState('');
  const [extra, setExtra] = useState<D.FileRow[]>([]);
  const [folders, setFolders] = useState(D.FOLDERS);
  const [naming, setNaming] = useState<string | null>(null);
  // 新建文件夹：在当前一级文件夹下建子文件夹（选中「投标文件」时），否则建一级文件夹；建好后进入重命名
  const newFolder = () => {
    const parent = folders.find(f => f.name === folder);
    const base = '新建文件夹';
    const taken = new Set(folders.flatMap(f => [f.name, ...(f.subs || []).map(s => s[0])]));
    let name = base; for (let i = 2; taken.has(name); i++) name = base + ' ' + i;
    if (parent?.subs) { setFolders(fs => fs.map(f => f === parent ? { ...f, subs: [...(f.subs || []), [name, 0] as [string, number]] } : f)); setOpenF(s => new Set(s).add(parent.name)); setSub(name); }
    else { setFolders(fs => [...fs, { name, count: 0 }]); setFolder(name); setSub(null); }
    setNaming(name);
  };
  const rename = (from: string, to: string) => {
    const v = to.trim(); setNaming(null);
    if (!v || v === from) return;
    setFolders(fs => fs.map(f => f.name === from ? { ...f, name: v } : { ...f, subs: f.subs?.map(s => s[0] === from ? [v, s[1]] as [string, number] : s) }));
    if (folder === from) setFolder(v); if (sub === from) setSub(v);
    notify(`已新建文件夹「${v}」`);
  };
  const up = useRef<HTMLInputElement>(null);
  const all = [...extra, ...files];
  const rows = useMemo(() => all.filter(f => f.folder === folder && (!sub || f.sub === sub) && (!q || (f.name + f.who).includes(q))), [all, folder, sub, q]);
  return (
    <div className="p9-files">
      <section className="p9-card p9-folders">
        <header className="p9-card-head"><div className="p9-card-head-left"><Folder size={13} className="ic-blue" /><h3>文件夹</h3><span className="p9-card-hint tone-blue">18</span></div><button type="button" className="p9-sq-btn is-xs" aria-label="新建文件夹" onClick={newFolder}><FolderPlus size={11} /></button></header>
        <label className="p9-search is-sm"><Search size={11} /><input value={fq} onChange={e => setFq(e.target.value)} placeholder="搜索文件夹、文件名" /></label>
        <div className="p9-tree is-folders">
          {folders.filter(f => !fq || f.name.includes(fq) || f.subs?.some(([s]) => s.includes(fq))).map(f => {
            const open = openF.has(f.name);
            const on = folder === f.name && !sub;
            return (
              <React.Fragment key={f.name}>
                {naming === f.name ? <NameInput value={f.name} icon onDone={v => rename(f.name, v)} /> : <button type="button" className={cx('p9-tree-row', on && 'is-on')} onClick={() => { setFolder(f.name); setSub(null); setOpenF(s => { const n = new Set(s); n.has(f.name) ? n.delete(f.name) : n.add(f.name); return n; }); }}>
                  {open ? <FolderOpen size={12} /> : <Folder size={12} />}<span className="p9-grow">{f.name}</span><small>{f.count}</small>{f.subs ? (open ? <ChevronDown size={10} /> : <ChevronRight size={10} />) : <ChevronRight size={10} />}
                </button>}
                {open && f.subs?.map(([s, n]) => naming === s ? <NameInput key={s} value={s} onDone={v => rename(s, v)} /> : <button type="button" key={s} className={cx('p9-tree-sub is-btn', folder === f.name && sub === s && 'is-on')} onClick={() => { setFolder(f.name); setSub(s); }}><i />{s}<span className="p9-grow" /><small>{n}</small></button>)}
              </React.Fragment>
            );
          })}
        </div>
      </section>
      <section className="p9-card is-grow">
        <header className="p9-card-head">
          <div className="p9-card-head-left"><FolderOpen size={13} className="ic-blue" /><h3>{sub || folder}</h3><span className="p9-card-hint">{rows.length} 个文件{!sub && folder === '投标文件' ? ' · 4 个子文件夹' : ''}</span></div>
          <div className="p9-card-head-right">
            <Btn kind="outline" size="sm" icon={FolderPlus} onClick={newFolder}>新建文件夹</Btn>
            <input ref={up} type="file" hidden onChange={e => { const f = e.target.files?.[0]; if (!f) return; setExtra(x => [{ name: f.name, type: '投标文件', v: 'v1', size: (f.size / 1048576).toFixed(1) + ' MB', who: '我', time: '刚刚', status: '进行中', folder, sub: sub || undefined, kind: f.name.endsWith('.xlsx') ? 'xls' : f.name.endsWith('.pdf') ? 'pdf' : 'doc' }, ...x]); notify('已上传，版本号 +1 并保留历史'); }} />
            <Btn kind="primary" size="sm" icon={Upload} onClick={() => up.current?.click()}>上传文件</Btn>
          </div>
        </header>
        <div className="p9-search-line"><label className="p9-search is-wide"><Search size={12} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="搜索文件名、上传人" /></label></div>
        <div className="p9-table" style={{ '--cols': 'minmax(0,1fr) 60px 44px 52px 52px 70px 44px' } as React.CSSProperties}>
          <div className="p9-tr is-head">{['文件名', '类型', '版本', '大小', '上传人', '更新时间', '状态'].map(h => <div key={h} className="p9-th">{h}</div>)}</div>
          {rows.map(f => (
            <div key={f.name} className="p9-tr is-38">
              <div className="p9-file-name">{f.kind === 'xls' ? <FileSpreadsheet size={11} className="ic-orange" /> : <FileText size={11} className={f.kind === 'pdf' ? 'ic-green' : 'ic-blue'} />}<span>{f.name}</span></div>
              <div className="p9-td-c is-muted">{f.type}</div>
              <div className="p9-td-c tone-blue is-bold">{f.v}</div>
              <div className="p9-td-c is-muted">{f.size}</div>
              <div className="p9-td-c">{f.who}</div>
              <div className="p9-td-c is-muted p9-mono">{f.time}</div>
              <div className={cx('p9-td-c is-bold', f.status === '进行中' ? 'tone-blue' : f.status === '已归档' ? 'tone-green' : 'is-muted')}>{f.status}</div>
            </div>
          ))}
          {!rows.length && <div className="p9-empty-row">这个文件夹里还没有文件</div>}
        </div>
        <span className="p9-grow" />
        <footer className="p9-card-foot"><span>共 {rows.length} 个文件 · 32.6 MB · 支持按版本回溯</span><button type="button" className="p9-link">按更新时间排序<ChevronDown size={10} /></button></footer>
      </section>
    </div>
  );
}
