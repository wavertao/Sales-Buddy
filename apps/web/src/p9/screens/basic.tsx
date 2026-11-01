// P9.2.1 基本信息（ATB 评审表 + 投标轮次）· P9.2.2 投标策略 · P9.2.3 节点推进确认弹窗
import React, { useState } from 'react';
import { Check, ChevronDown, ChevronRight, ChevronsRight, ClipboardList, Mic, RefreshCw, Sparkles, Target, ArrowRight, Undo2, TriangleAlert, PenLine } from 'lucide-react';
import * as D from '../demo';
import { useP9 } from '../store';
import { Btn, Card, Modal, Pill, SectionHead, cx } from '../ui';

function YesNo({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <span className="p9-yesno" role="radiogroup">
      <button type="button" className={cx(value && 'is-on')} onClick={() => onChange(true)} aria-pressed={value}>是</button>
      <button type="button" className={cx(!value && 'is-on')} onClick={() => onChange(false)} aria-pressed={!value}>否</button>
    </span>
  );
}

function JudgeRows({ rows, initial = true }: { rows: [string, string][]; initial?: boolean }) {
  const [vals, setVals] = useState<boolean[]>(rows.map(() => initial));
  return (
    <div className="p9-judge">
      {rows.map(([k, q], i) => (
        <div key={k} className="p9-judge-row">
          <b>{k}</b><span>{q}</span>
          <YesNo value={vals[i]} onChange={v => setVals(vs => vs.map((x, j) => j === i ? v : x))} />
        </div>
      ))}
    </div>
  );
}

function Rounds() {
  const { rounds, setModal } = useP9();
  const cur = rounds.findIndex(r => r.state === 'now');
  return (
    <div className="p9-sec">
      <SectionHead name="投标轮次" summary={`当前 ${rounds[cur]?.no} · ${rounds[cur]?.label}｜共 4 轮（首轮 / 次轮 / 短名单 / 终审），推进后历史轮次保留只读`}
        badge={<><Pill tone="blue">{rounds[cur]?.no} / 4</Pill><Btn kind="outline" size="sm" icon={Undo2} disabled={cur <= 0} onClick={() => setModal({ kind: 'round', dir: 'back' })}>回退上一轮</Btn><Btn kind="primary" size="sm" iconRight={ChevronRight} disabled={cur >= rounds.length - 1} onClick={() => setModal({ kind: 'round', dir: 'next' })}>推进下一轮</Btn></>} />
      <div className="p9-rounds">
        {rounds.map((r, i) => (
          <button type="button" key={r.no} className={cx('p9-round-card', 'is-' + r.state)} disabled={r.state !== 'todo' || i !== cur + 1} onClick={() => setModal({ kind: 'round', dir: 'next' })}>
            <span className="p9-round-top"><b>{r.no} · {r.label}</b><span className="p9-grow" /><i>{r.state === 'done' ? '已结束' : r.state === 'now' ? '当前轮次' : '待开始'}</i></span>
            <small>{r.date}</small>
            <small className="p9-round-note">{r.note}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

function MultiOpp() {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>(D.OPP_NAME_CHOICES);
  return (
    <span className={cx('p9-field-box is-multi', open && 'is-open')} onClick={() => setOpen(!open)} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false); }} tabIndex={0} role="combobox" aria-expanded={open}>
      {picked[0] && <span className="p9-chip-sel">{picked[0]}</span>}
      {picked.length > 1 && <b className="p9-more">+{picked.length - 1}</b>}
      <span className="p9-grow" /><ChevronDown size={11} className={cx(open && 'rot-180')} />
      {open && <span className="p9-dropdown" onClick={e => e.stopPropagation()}>
        {D.OPP_NAME_CHOICES.map(o => (
          <button type="button" key={o} className={cx('p9-opt', picked.includes(o) && 'is-on')} onClick={() => setPicked(p => p.includes(o) ? p.filter(x => x !== o) : [...p, o])}><span className={cx('p9-optbox', picked.includes(o) && 'is-on')}>{picked.includes(o) && <Check size={9} strokeWidth={3} />}</span><span>{o}</span></button>
        ))}
      </span>}
    </span>
  );
}

export function Basic() {
  const { atb, setAtbField, notify } = useP9();
  const [folded, setFolded] = useState<Record<string, boolean>>({});
  const filledOf = (g: D.AtbGroup) => g.fields.filter(([, v]) => v).length;
  const total = atb.reduce((n, g) => n + g.fields.length, 0);
  const filled = atb.reduce((n, g) => n + filledOf(g), 0);
  return (
    <Card icon={ClipboardList} title="投标基本信息 · ATB 评审表" hint="商机判断四组字段 + SPP 团队角色；缺失项按 ATB 表提示补填"
      right={<><Pill tone={filled >= total ? 'green' : 'orange'}>{filled} / {total} 已填</Pill><Btn kind="primary" size="sm" icon={Check} onClick={() => notify('ATB 评审表已保存，缺失项已同步为待澄清')}>保存</Btn></>}>
      <div className="p9-secs">
        <Rounds />
        <div className="p9-sec">
          <SectionHead name="投标必要性判断" summary="3 项判断" bar="purple" badge={<><button type="button" className="p9-ai-link" onClick={() => notify('AI 提示：需求真实性请附业主与资金路径证据（如投资批复、融资意向书）')}>AI 提示</button><button type="button" className="p9-link" onClick={() => notify('填写规则：三项均为「是」才建议投标；任一为「否」需在备注写明理由并经 SPP 负责人确认')}>查看填写规则<ChevronRight size={10} /></button></>} />
          <JudgeRows rows={D.NECESSITY} />
        </div>
        {atb.map(g => {
          const done = filledOf(g);
          const isFold = folded[g.key];
          return (
            <div key={g.key} className="p9-sec">
              <SectionHead name={g.name} summary={done === 0 ? `${g.fields.length} 项 · 全部待补` : done === g.fields.length || g.key === 'basic' ? `${g.fields.length} 项` : `${g.fields.length} 项 · 缺 ${g.key === 'team' ? g.fields.filter(([, v]) => !v).map(([k]) => k).join('、') : g.fields.length - done + ' 项'}`}
                progress={{ done, total: g.fields.length }}
                action={<>{isFold ? '展开' : '收起'}{isFold ? <ChevronRight size={10} /> : <ChevronDown size={10} className="rot-180" />}</>}
                onAction={() => setFolded(f => ({ ...f, [g.key]: !f[g.key] }))} />
              {!isFold && (
                <div className="p9-fields">
                  {g.fields.map(([k, v]) => (
                    <label key={k} className="p9-field">
                      <span className="p9-field-label">{k}</span>
                      {k === '商机名称' ? <MultiOpp /> : (
                        <span className={cx('p9-field-box', !v && 'is-missing')}>
                          <input value={v} placeholder="点击填写" onChange={e => setAtbField(g.key, k, e.target.value)} />
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function Strategy() {
  const { notify, call, bid } = useP9();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [fold, setFold] = useState(false);
  const [adopted, setAdopted] = useState(true);
  const [regen, setRegen] = useState(false);
  const [editing, setEditing] = useState(false);
  // 已保存的策略内容 + 编辑中的草稿；取消时丢弃草稿
  const init = { judge: D.STRATEGY_JUDGE, fields: D.STRATEGY_FIELDS, sections: D.STRATEGY_SECTIONS, dir: D.AI_DIRECTION };
  const [saved, setSaved] = useState(init);
  const [draft, setDraft] = useState(init);
  const cur = editing ? draft : saved;
  const setAt = <K extends keyof typeof init>(key: K, i: number, col: number, v: string) =>
    setDraft(d => ({ ...d, [key]: (d[key] as string[][]).map((row, j) => j === i ? row.map((x, c) => c === col ? v : x) : row) }));
  const regenerate = async () => {
    setRegen(true);
    await call(`/bids/${encodeURIComponent(bid.id)}/strategy/regenerate`, 'POST', { reason: '手动再生成' });
    setTimeout(() => { setRegen(false); setAdopted(false); notify('AI 已按三段策略重新生成方向，待你采用'); }, 600);
  };
  const save = async () => {
    setSaved(draft); setEditing(false);
    await call(`/bids/${encodeURIComponent(bid.id)}/strategy`, 'PUT', { scope: draft.judge[0][1], customer: draft.judge[1][1], competition: draft.judge[2][1] });
    notify('投标策略已保存，已归档到投标实体');
  };
  const text = (key: 'judge' | 'dir', i: number, v: string) => editing
    ? <textarea className="p9-inline-input is-area" rows={1} value={v} onChange={e => setAt(key, i, 1, e.target.value)} />
    : <span>{v}</span>;
  return (
    <Card icon={Target} title="投标策略" hint="三段模板化录入 · 归档到投标实体；AI 据此生成策略方向"
      right={<>
        <Pill tone={editing ? 'orange' : adopted ? 'green' : 'orange'}>{editing ? '编辑中 · 未保存' : adopted ? '已归档' : '待采用'}</Pill>
        {editing ? <>
          <Btn kind="outline" size="sm" onClick={() => { setDraft(saved); setEditing(false); }}>取消</Btn>
          <Btn kind="primary" size="sm" icon={Check} onClick={() => void save()}>保存</Btn>
        </> : <>
          <Btn kind="outline" size="sm" icon={PenLine} onClick={() => { setDraft(saved); setEditing(true); setOpen({ 报价策略: true, 技术策略: true, 服务策略: true, 团队分工: true }); }}>编辑</Btn>
          <Btn kind="primary" size="sm" icon={Check} disabled={adopted} onClick={() => { setAdopted(true); notify('已采用此方向，策略单已归档到投标实体'); }}>{adopted ? '已采用此方向' : '采用此方向'}</Btn>
        </>}
      </>}>
      <div className="p9-secs">
        <div className="p9-sec">
          <SectionHead name="投标策略判断" summary="3 项判断 · 三段模板化录入" bar="purple" badge={<button type="button" className="p9-link" onClick={() => notify('模板：招标范围（范围 / 容量 / 排除项）· 对客策略（决策链 / 价值主线）· 竞争策略（对手 / 差异化）')}>查看模板<ChevronRight size={10} /></button>} />
          <div className="p9-judge">{cur.judge.map(([k, v], i) => <div key={k} className="p9-judge-row"><b>{k}</b>{text('judge', i, v)}<YesNo value onChange={() => undefined} /></div>)}</div>
        </div>
        <div className="p9-sec">
          <SectionHead name="策略字段" summary="12 项 · 已归档到投标实体" progress={{ done: cur.fields.filter(f => f[1]).length, total: 12 }}
            action={<>{fold ? '展开' : '收起'}{fold ? <ChevronRight size={10} /> : <ChevronDown size={10} className="rot-180" />}</>} onAction={() => setFold(!fold)} />
          {!fold && <div className="p9-fields">{cur.fields.map(([k, v], i) => (
            <label key={k} className="p9-field"><span className="p9-field-label">{k}</span><span className={cx('p9-field-box', !editing && 'is-readonly')}><input value={v} readOnly={!editing} onChange={e => setAt('fields', i, 1, e.target.value)} /></span></label>
          ))}</div>}
        </div>
        {cur.sections.map(([k, sum, detail], i) => (
          <div key={k} className="p9-sec">
            <SectionHead name={k} summary={sum} bar="gray" action={<>{open[k] ? '收起' : '展开'}{open[k] ? <ChevronDown size={10} className="rot-180" /> : <ChevronRight size={10} />}</>} onAction={() => setOpen(o => ({ ...o, [k]: !o[k] }))} />
            {open[k] && (editing ? (
              <div className="p9-sec-edit">
                <label className="p9-field"><span className="p9-field-label">摘要</span><span className="p9-field-box"><input value={sum} onChange={e => setAt('sections', i, 1, e.target.value)} /></span></label>
                <label className="p9-field"><span className="p9-field-label">详细说明</span><span className="p9-textarea"><textarea value={detail} onChange={e => setAt('sections', i, 2, e.target.value)} /></span></label>
              </div>
            ) : <p className="p9-sec-text">{detail}</p>)}
          </div>
        ))}
        <div className="p9-sec">
          <SectionHead name="AI 策略方向" summary="基于上面三段生成 · 仅作方向建议" bar="purple" badge={!editing && <button type="button" className="p9-link" onClick={() => void regenerate()}>重新生成<RefreshCw size={10} className={cx(regen && 'spin')} /></button>} />
          <div className="p9-judge">{cur.dir.map(([k, v], i) => <div key={k} className="p9-judge-row"><b>{k}</b>{text('dir', i, v)}<YesNo value onChange={() => undefined} /></div>)}</div>
        </div>
      </div>
    </Card>
  );
}

/** P9.2.3：点节点条当前阶段弹出，贴在节点条下方、无遮罩。 */
export function AdvanceModal() {
  const { node, setModal, advanceNode } = useP9();
  const [note, setNote] = useState('');
  const next = Math.min(9, node + 1);
  return (
    <div className="p9-pop-layer" onClick={() => setModal(null)}>
      <div className="p9-modal is-pop" style={{ width: 520, left: 228 + Math.max(0, node - 2) * 104 }} onClick={e => e.stopPropagation()} role="dialog" aria-label="推进到下一节点">
        <header className="p9-modal-head"><ChevronsRight size={15} className="ic-blue" /><h3>推进到下一节点</h3><span className="p9-grow" /><button type="button" className="p9-modal-x" onClick={() => setModal(null)} aria-label="关闭">×</button></header>
        <div className="p9-modal-body is-gap12">
          <div className="p9-flow">
            <div className="p9-flow-card is-now"><b>{D.NODE_NO[node]} {D.NODES[node]}</b><small>进行中 · 10-20 14:20 起</small></div>
            <ArrowRight size={16} className="ic-gray" />
            <div className="p9-flow-card"><b>{D.NODE_NO[next]} {D.NODES[next]}</b><small>待开始 · 推进后转为进行中</small></div>
          </div>
          <div className="p9-precheck">
            <div className="p9-precheck-head"><Sparkles size={12} /><b>AI 前置检查</b><span className="p9-grow" /><Pill tone="green">3 / 3 通过</Pill></div>
            {D.ADVANCE_CHECKS.map(c => <div key={c} className="p9-precheck-item"><Check size={10} />{c}</div>)}
          </div>
          <div className="p9-mf">
            <span className="p9-mf-label">推进说明<small>（选填）会写进节点日志</small></span>
            <span className="p9-textarea"><textarea value={note} onChange={e => setNote(e.target.value)} placeholder="例如：拆标分解表已通过 BSD 审核，责任人已确认；开工会安排 10-22 14:00" /><Mic size={13} /></span>
          </div>
          <p className="p9-modal-tip">推进后 {D.NODE_NO[node]} {D.NODES[node]} 转为「已完成 · 只读」；{D.NODE_NO[next]} {D.NODES[next]} 转为「进行中」，其待办 / 会议 / 澄清自动继承当前轮次 R2</p>
        </div>
        <footer className="p9-modal-foot"><span className="p9-grow" /><Btn kind="outline" size="lg" onClick={() => setModal(null)}>取消</Btn><Btn kind="primary" size="lg" icon={Check} onClick={() => { advanceNode(note); setModal(null); }}>确认推进</Btn></footer>
      </div>
    </div>
  );
}

/** 阶段回退确认：点节点条上已完成的节点触发，贴在节点条下方、无遮罩（与推进弹窗同一套样式）。 */
export function RollbackModal({ to }: { to: number }) {
  const { node, setModal, rollbackNode } = useP9();
  const [reason, setReason] = useState('');
  const lost = D.NODES.slice(to + 1, node + 1);
  return (
    <div className="p9-pop-layer" onClick={() => setModal(null)}>
      <div className="p9-modal is-pop" style={{ width: 520, left: Math.max(0, to * 104 - 60) }} onClick={e => e.stopPropagation()} role="dialog" aria-label="回退到此节点">
        <header className="p9-modal-head"><Undo2 size={15} className="ic-orange" /><h3>回退到「{D.NODE_NO[to]} {D.NODES[to]}」</h3><span className="p9-grow" /><button type="button" className="p9-modal-x" onClick={() => setModal(null)} aria-label="关闭">×</button></header>
        <div className="p9-modal-body is-gap12">
          <div className="p9-flow">
            <div className="p9-flow-card is-now"><b>{D.NODE_NO[node]} {D.NODES[node]}</b><small>当前节点 · 进行中</small></div>
            <ArrowRight size={16} className="ic-gray" />
            <div className="p9-flow-card is-back"><b>{D.NODE_NO[to]} {D.NODES[to]}</b><small>回退后重新转为进行中</small></div>
          </div>
          <div className="p9-backwarn">
            <div className="p9-precheck-head"><TriangleAlert size={12} /><b>回退影响</b></div>
            <div className="p9-precheck-item">「{lost.join('、')}」将转为待开始，节点完成时间清空</div>
            <div className="p9-precheck-item">这些节点下已建的待办 / 会议 / 澄清保留，不会删除</div>
            <div className="p9-precheck-item">回退会写入节点日志，并通知 SPP 团队</div>
          </div>
          <div className="p9-mf">
            <span className="p9-mf-label is-strong">回退原因<i className="p9-req">*</i></span>
            <span className="p9-textarea"><textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="例如：BSD 审核退回，拆标分解表需按新版招标文件重新拆解" /><Mic size={13} /></span>
          </div>
        </div>
        <footer className="p9-modal-foot"><span className="p9-grow" /><Btn kind="outline" size="lg" onClick={() => setModal(null)}>取消</Btn><Btn kind="danger" size="lg" icon={Undo2} disabled={!reason.trim()} onClick={() => { rollbackNode(to, reason); setModal(null); }}>确认回退</Btn></footer>
      </div>
    </div>
  );
}

/** 轮次推进 / 回退确认（居中弹窗）。 */
export function RoundModal({ dir }: { dir: 'next' | 'back' }) {
  const { rounds, setModal, advanceRound, rollbackRound } = useP9();
  const [reason, setReason] = useState('');
  const i = rounds.findIndex(r => r.state === 'now');
  const cur = rounds[i], target = rounds[dir === 'next' ? i + 1 : i - 1];
  if (!cur || !target) return null;
  const back = dir === 'back';
  return (
    <Modal icon={back ? Undo2 : ChevronsRight} title={back ? '回退到上一轮' : '推进到下一轮'} width={460} onClose={() => setModal(null)} footer={<>
      <span className="p9-grow" />
      <Btn kind="outline" size="lg" onClick={() => setModal(null)}>取消</Btn>
      <Btn kind={back ? 'danger' : 'primary'} size="lg" icon={back ? Undo2 : Check} disabled={back && !reason.trim()} onClick={() => { back ? rollbackRound(reason) : advanceRound(); setModal(null); }}>{back ? '确认回退' : '确认推进'}</Btn>
    </>}>
      <div className="p9-flow">
        <div className="p9-flow-card is-now"><b>{cur.no} · {cur.label}</b><small>当前轮次</small></div>
        <ArrowRight size={16} className="ic-gray" />
        <div className={cx('p9-flow-card', back && 'is-back')}><b>{target.no} · {target.label}</b><small>{back ? '回退后恢复为当前轮次、可编辑' : '推进后成为当前轮次'}</small></div>
      </div>
      <p className="p9-modal-tip">{back
        ? `${cur.no} 下新建的会议 / 待办 / 澄清保留在 ${cur.no}（快照不回写）；${target.no} 解除只读。回退写入操作日志。`
        : `${cur.no} 下所有对象转为「已结束 · 只读」；新建记录自动挂 ${target.no}。`}</p>
      {back && <div className="p9-mf"><span className="p9-mf-label is-strong">回退原因<i className="p9-req">*</i></span><span className="p9-textarea"><textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="例如：客户撤回短名单通知，回到次轮补充澄清" /></span></div>}
    </Modal>
  );
}
