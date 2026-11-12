import React, { useMemo, useState } from "react";
import { Loader2, Lock, Plus, Sparkles, Trash2 } from "lucide-react";
import type { GuardsConfig, ItemLevelKey, JudgeConfigLike, ReviewItemLike } from "./checklist-types";
import { TENDER_CATEGORIES, keywordsPattern } from "../../../../packages/contracts/tender";
import type { TenderCategory } from "../../../../packages/contracts/tender";
import { CAT_LABEL } from "./TenderResult";

/**
 * 规则配置三层的页面件：标准提示词、审查清单（大类 → 审查项）、兜底规则（必查词、标准与资质库）。
 * 布局按 Pencil 原型「P9 标书解析规则 v2 · 三层配置原型」。
 */
type Api = (path: string, options?: Record<string, unknown>) => Promise<any>;
const LEVEL: Record<ItemLevelKey, [string, string]> = { prohibited: ['否决', 'red'], high: ['高风险', 'red'], review: ['待确认', 'orange'] };
const newId = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}`;
const Tag = ({ tone, children }: { tone: string; children: React.ReactNode }) => <span className={'rp-tag is-' + tone}>{children}</span>;

// ======================= 标准提示词 =======================
/** 提示词按「## 小标题」切段，每段一个输入框；锁定部分（代码里的固定指令）只读展示 */
const splitSections = (s: string) => {
  const parts = s.split(/\n(?=## )/).map((p) => p.trim()).filter(Boolean);
  return parts.map((p) => { const m = p.match(/^## (.+)\n?([\s\S]*)$/); return m ? { title: m[1].trim(), body: m[2].trim() } : { title: '说明', body: p }; });
};
const joinSections = (xs: { title: string; body: string }[]) => xs.map((x) => `## ${x.title}\n${x.body}`).join('\n\n');

export function PromptPanel({ value, onChange, locked, model, policySource }: { value: JudgeConfigLike; onChange: (v: JudgeConfigLike) => void; locked: string; model: string | null; policySource: Record<string, string> }) {
  const secs = useMemo(() => splitSections(value.prompt), [value.prompt]);
  const up = (p: Partial<JudgeConfigLike>) => onChange({ ...value, ...p });
  const setSec = (i: number, body: string) => up({ prompt: joinSections(secs.map((s, j) => (j === i ? { ...s, body } : s))) });
  const lockedSecs = splitSections(locked);
  return (
    <div className="ck-cols">
      <section className="rp-card ck-doc">
        <div className="ck-doc-head"><b>标准提示词</b><small>相当于给 AI 的 agent.md：约束注意力、解析方法、产出内容和格式</small></div>
        <div className="ck-doc-body">
          {secs.map((s, i) => (
            <div key={s.title + i} className="ck-sec">
              <div className="ck-sec-head"><b>## {s.title}</b><Tag tone="blue">可改</Tag></div>
              <textarea value={s.body} rows={Math.max(2, s.body.split('\n').length + 1)} onChange={(e) => setSec(i, e.target.value)} />
            </div>
          ))}
          {!!value.policies.length && (
            <div className="ck-sec">
              <div className="ck-sec-head"><b>## 公司口径</b><Tag tone="purple">来自改进建议</Tag></div>
              {value.policies.map((p, i) => (
                <div key={i} className="ck-line"><input value={p} onChange={(e) => up({ policies: value.policies.map((x, j) => (j === i ? e.target.value : x)) })} /><small>{policySource[p] || '人工添加'}</small><button className="rp-icon" title="删除" onClick={() => up({ policies: value.policies.filter((_, j) => j !== i) })}><Trash2 size={13} /></button></div>
              ))}
            </div>
          )}
          <div className="ck-sec">
            <div className="ck-sec-head"><b>## 通用判例 · {value.examples.length}</b><Tag tone="purple">出厂 + 人工改判</Tag></div>
            {value.examples.map((e, i) => (
              <div key={e.id} className={'ck-line' + (e.enabled ? '' : ' off')}>
                <span className="ck-ex-text" title={e.note}>{e.text}</span>
                <b className="ck-ex-res">→ {e.isRequirement ? `${CAT_LABEL[e.category as TenderCategory] || ''} · ${({ prohibited: '否决', mandatory: '强制', required: '一般要求', recommended: '建议' } as Record<string, string>)[e.strength || ''] || ''}` : '不是要求'}</b>
                <span className="tp-switch"><input type="checkbox" checked={e.enabled} onChange={(ev) => up({ examples: value.examples.map((x, j) => (j === i ? { ...x, enabled: ev.target.checked } : x)) })} /><i /></span>
                <button className="rp-icon" title="删除" onClick={() => up({ examples: value.examples.filter((_, j) => j !== i) })}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
          {lockedSecs.map((s) => (
            <div key={s.title} className="ck-sec is-locked">
              <div className="ck-sec-head"><b>## {s.title.replace('（锁定）', '')}</b><Tag tone="gray"><Lock size={10} /> 锁定 · 程序依赖</Tag></div>
              <pre>{s.body}</pre>
            </div>
          ))}
        </div>
      </section>
      <aside className="ck-side">
        <section className="rp-card ck-pad">
          <h4>一次调用怎么拼</h4>
          <small className="rp-muted">以「商务」这一批 {value.batchSize} 条为例</small>
          {[['1', '标准提示词', '本页这份文档（含公司口径和通用判例），每次调用都带', 'blue'], ['2', '审查项注入', '只拼本批相关的审查项：要审什么、关注点、结论档位、要抽的数值', 'purple'], ['3', '条款数据', `本批 ${value.batchSize} 条原文，每条带程序预判的 hint（命中的必查词、可能相关的审查项）`, 'gray']].map(([n, t, d, tone]) => (
            <div key={n} className={'ck-step is-' + tone}><i>{n}</i><div><b>{t}</b><small>{d}</small></div></div>
          ))}
        </section>
        <section className="rp-card ck-pad">
          <h4>冲突时听谁的</h4>
          <div className="ck-pri"><Tag tone="green">程序兜底</Tag>›<Tag tone="purple">审查项红线</Tag>›<Tag tone="blue">标准提示词</Tag></div>
          <small className="rp-muted">例：程序比出违约金上限 15% 超过 10%，AI 判为一般 → 按高风险保留并标待确认。</small>
        </section>
        <section className="rp-card ck-pad">
          <h4>模型与参数</h4>
          <label className="ck-switch"><span className="tp-switch"><input type="checkbox" checked={value.enabled} onChange={(e) => up({ enabled: e.target.checked })} /><i /></span>{value.enabled ? '已启用模型判断' : '已停用（只用规则结果）'}</label>
          <small className="rp-muted">{model || '未配置模型'}</small>
          <div className="ck-nums">
            <label>每批<input type="number" min={1} max={100} value={value.batchSize} onChange={(e) => up({ batchSize: Number(e.target.value) })} /></label>
            <label>并发<input type="number" min={1} max={20} value={value.concurrency} onChange={(e) => up({ concurrency: Number(e.target.value) })} /></label>
            <label>低于此置信度标待确认<input type="number" step={0.05} min={0} max={1} value={value.minConfidence} onChange={(e) => up({ minConfidence: Number(e.target.value) })} /></label>
          </div>
        </section>
        <section className="rp-card ck-pad">
          <h4>谁来维护</h4>
          <small>可改部分：BSD 负责人；改动走试跑和回放，生成新版本。</small>
          <small>锁定部分：研发维护，随系统版本发布。</small>
          <small className="rp-muted">日常调整应优先改审查项，而不是改这份文档。</small>
        </section>
      </aside>
    </div>
  );
}

// ======================= 审查清单 =======================
export function ChecklistEditor({ api, items, onChange, examples, canEdit }: { api: Api; items: ReviewItemLike[]; onChange: (v: ReviewItemLike[]) => void; examples: { text: string; isRequirement: boolean; category?: string; strength?: string; note?: string }[]; canEdit: boolean }) {
  const [sel, setSel] = useState(items[0]?.id || '');
  const [open, setOpen] = useState<Set<string>>(new Set([items[0]?.category || 'commercial']));
  const [busy, setBusy] = useState(false);
  const it = items.find((x) => x.id === sel) || items[0];
  const up = (p: Partial<ReviewItemLike>) => onChange(items.map((x) => (x.id === it.id ? { ...x, ...p } : x)));
  const add = (category: TenderCategory) => { const n: ReviewItemLike = { id: newId('ri'), category, name: '新审查项', ask: '', focus: [], levels: [{ level: 'review', when: '' }], checks: [], terms: [], enabled: true }; onChange([...items, n]); setSel(n.id); setOpen(new Set([...open, category])); };
  const genTerms = async () => {
    setBusy(true);
    try { const r = await api('/tender/rules/terms', { method: 'POST', body: { name: it.name, ask: it.ask, category: it.category } }); up({ terms: r.terms }); }
    finally { setBusy(false); }
  };
  // 判例：通用标注示例里命中这一项检索词的
  const cases = useMemo(() => { if (!it?.terms.length) return []; try { const re = new RegExp(keywordsPattern(it.terms), 'iu'); return examples.filter((e) => re.test(e.text)).slice(0, 4); } catch { return []; } }, [it, examples]);
  if (!it) return <div className="rp-card ck-pad">还没有审查项。<button className="rp-link" onClick={() => add('commercial')}>新增一个</button></div>;
  return (
    <div className="ck-cols is-three">
      <nav className="rp-card ck-nav">
        {TENDER_CATEGORIES.map((c) => {
          const mine = items.filter((x) => x.category === c.key);
          const on = open.has(c.key);
          return (
            <div key={c.key}>
              <button className="ck-cat" onClick={() => setOpen((s) => { const n = new Set(s); n.has(c.key) ? n.delete(c.key) : n.add(c.key); return n; })}><b>{on ? '▾' : '▸'} {c.label}</b><i>{mine.length}</i></button>
              {on && mine.map((x) => (
                <button key={x.id} className={'ck-item' + (x.id === it.id ? ' on' : '') + (x.enabled ? '' : ' off')} onClick={() => setSel(x.id)}><span>{x.name}</span><small>{x.checks.length ? 'AI+程序' : 'AI'}</small></button>
              ))}
              {on && canEdit && <button className="ck-add" onClick={() => add(c.key)}>+ 新增审查项</button>}
            </div>
          );
        })}
      </nav>
      <section className="rp-card ck-main">
        <div className="ck-main-head">
          <input className="ck-title" value={it.name} onChange={(e) => up({ name: e.target.value })} />
          <select value={it.category} onChange={(e) => up({ category: e.target.value as TenderCategory })}>{TENDER_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select>
          <select value={it.owner || ''} onChange={(e) => up({ owner: (e.target.value || undefined) as ReviewItemLike['owner'] })}><option value="">负责人（按大类）</option>{['SLS', 'PM', 'SC', 'QA', 'AMD', 'BSD'].map((r) => <option key={r}>{r}</option>)}</select>
          <span className="rp-grow" />
          <label className="ck-switch"><span className="tp-switch"><input type="checkbox" checked={it.enabled} onChange={(e) => up({ enabled: e.target.checked })} /><i /></span>{it.enabled ? '启用' : '停用'}</label>
          {canEdit && <button className="rp-icon" title="删除这一项" onClick={() => { if (confirm(`删除审查项「${it.name}」？`)) { onChange(items.filter((x) => x.id !== it.id)); setSel(''); } }}><Trash2 size={14} /></button>}
        </div>
        <div className="ck-main-body">
          <div className="ck-block">
            <div className="ck-block-head"><Tag tone="purple">AI 判断</Tag><small>注入到提示词，AI 逐条找原文并下结论</small></div>
            <label className="ck-field"><span>要审什么</span><textarea rows={2} value={it.ask} placeholder="一句话说明这一项要审的内容" onChange={(e) => up({ ask: e.target.value })} /></label>
            <label className="ck-field"><span>关注点 / 口径（每行一条）</span><textarea rows={Math.max(2, it.focus.length + 1)} value={it.focus.join('\n')} onChange={(e) => up({ focus: e.target.value.split('\n') })} onBlur={() => up({ focus: it.focus.map((x) => x.trim()).filter(Boolean) })} /></label>
            <div className="ck-field"><span>结论档位</span>
              {it.levels.map((l, i) => (
                <div key={i} className="ck-line">
                  <select className={'ck-level is-' + LEVEL[l.level][1]} value={l.level} onChange={(e) => up({ levels: it.levels.map((x, j) => (j === i ? { ...x, level: e.target.value as ItemLevelKey } : x)) })}>{Object.entries(LEVEL).map(([k, [t]]) => <option key={k} value={k}>{t}</option>)}</select>
                  <input value={l.when} placeholder="什么情况下出这个结论" onChange={(e) => up({ levels: it.levels.map((x, j) => (j === i ? { ...x, when: e.target.value } : x)) })} />
                  <button className="rp-icon" onClick={() => up({ levels: it.levels.filter((_, j) => j !== i) })}><Trash2 size={13} /></button>
                </div>
              ))}
              <button className="rp-link" onClick={() => up({ levels: [...it.levels, { level: 'review', when: '' }] })}>+ 新增档位</button>
            </div>
            <div className="ck-field"><span>判例 · {cases.length} 条<small>（来自人工改判和通用判例，自动维护）</small></span>
              {!cases.length && <small className="rp-muted">还没有。人工改判后，改进建议采纳的判例会出现在这里。</small>}
              {cases.map((c, i) => <div key={i} className="ck-case"><span>{c.text}</span><b>→ {c.isRequirement ? `${CAT_LABEL[c.category as TenderCategory] || ''} · ${({ prohibited: '否决', mandatory: '强制', required: '一般要求', recommended: '建议' } as Record<string, string>)[c.strength || ''] || ''}` : '不是要求'}</b></div>)}
            </div>
          </div>
          <div className="ck-block">
            <div className="ck-block-head"><Tag tone="green">程序校验</Tag><small>AI 只抽数值和原文，程序比较；与 AI 结论冲突时以程序为准并标待确认</small></div>
            <div className="ck-checks">
              <div className="ck-checks-head"><span>要抽的数值</span><span>单位</span><span>条件</span><span>阈值</span><span>结论</span><span /></div>
              {it.checks.map((c, i) => {
                const set = (p: Partial<typeof c>) => up({ checks: it.checks.map((x, j) => (j === i ? { ...x, ...p } : x)) });
                return (
                  <div key={c.id} className="ck-checks-row">
                    <input value={c.field} placeholder="如：累计上限（占合同价 %）" onChange={(e) => set({ field: e.target.value })} />
                    <input value={c.unit || ''} placeholder="%" onChange={(e) => set({ unit: e.target.value || undefined })} />
                    <select value={c.op} onChange={(e) => set({ op: e.target.value as typeof c.op })}>{[['>', '大于'], ['>=', '不小于'], ['<', '小于'], ['<=', '不大于'], ['missing', '没找到']].map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                    <input type="number" disabled={c.op === 'missing'} value={c.value ?? ''} onChange={(e) => set({ value: e.target.value === '' ? undefined : Number(e.target.value) })} />
                    <select className={'ck-level is-' + LEVEL[c.result][1]} value={c.result} onChange={(e) => set({ result: e.target.value as ItemLevelKey })}>{Object.entries(LEVEL).map(([k, [t]]) => <option key={k} value={k}>{t}</option>)}</select>
                    <button className="rp-icon" onClick={() => up({ checks: it.checks.filter((_, j) => j !== i) })}><Trash2 size={13} /></button>
                  </div>
                );
              })}
              <button className="rp-link" onClick={() => up({ checks: [...it.checks, { id: newId('ck'), field: '', op: '>', value: 0, result: 'high' }] })}><Plus size={12} /> 新增校验：选一个数值 → 选比较方式 → 填阈值 → 选结论</button>
            </div>
          </div>
          <div className="ck-terms">
            <b>检索词</b><small>（AI 生成，保证相关条款一定送审）</small>
            <span>{it.terms.length ? it.terms.join(' · ') : '还没有，点右边生成'}</span>
            {canEdit && <button className="rp-btn" disabled={busy} onClick={() => void genTerms()}>{busy ? <Loader2 size={12} className="tp-spin" /> : <Sparkles size={12} />}{it.terms.length ? '重新生成' : 'AI 生成'}</button>}
          </div>
        </div>
      </section>
      <aside className="ck-side">
        <section className="rp-card ck-pad">
          <h4>怎么写好一个审查项</h4>
          <small>「要审什么」写清楚范围，AI 靠它判断条款是否属于这一项。</small>
          <small>「关注点」写团队的口径，比如「上限按合同价计，没写上限视为无上限」。</small>
          <small>能用数字说清的红线放到「程序校验」，不要写进关注点让 AI 判。</small>
          <small className="rp-muted">保存后下一次解析生效；改动会进历史版本，可回滚。</small>
        </section>
      </aside>
    </div>
  );
}

// ======================= 兜底规则 =======================
const MW_LEVEL: Record<string, [string, string]> = { prohibited: ['否决', 'red'], mandatory: ['强制', 'dark'], risk: ['高风险', 'orange'] };
const ST_LEVEL: Record<string, [string, string]> = { have: ['有', 'green'], missing: ['没有', 'red'], version: ['版本不符', 'orange'] };
export function GuardsEditor({ value, onChange, fields, onFields, advanced }: { value: GuardsConfig; onChange: (v: GuardsConfig) => void; fields: { id: string; label: string; unit?: string; checkConflict: boolean; enabled: boolean }[]; onFields: (id: string, checkConflict: boolean) => void; advanced: React.ReactNode }) {
  const setW = (i: number, p: Partial<GuardsConfig['mustWords'][number]>) => onChange({ ...value, mustWords: value.mustWords.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const setS = (i: number, p: Partial<GuardsConfig['standards'][number]>) => onChange({ ...value, standards: value.standards.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  return (
    <div className="ck-cols">
      <div className="ck-stack">
        <section className="rp-card">
          <div className="ck-table-head"><b>必查词</b><small>出现即必须送审，并至少标到指定档位；防 AI 漏掉</small></div>
          <table className="ck-table">
            <thead><tr><th>词或短语</th><th>至少标为</th><th>适用大类</th><th>来源</th><th /></tr></thead>
            <tbody>{value.mustWords.map((w, i) => (
              <tr key={w.id} className={w.enabled ? '' : 'off'}>
                <td><input className="ck-mono" value={w.word} onChange={(e) => setW(i, { word: e.target.value })} /></td>
                <td><select className={'ck-level is-' + MW_LEVEL[w.level][1]} value={w.level} onChange={(e) => setW(i, { level: e.target.value as typeof w.level })}>{Object.entries(MW_LEVEL).map(([k, [t]]) => <option key={k} value={k}>{t}</option>)}</select></td>
                <td><select value={w.category || ''} onChange={(e) => setW(i, { category: (e.target.value || undefined) as TenderCategory | undefined })}><option value="">全部</option>{TENDER_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></td>
                <td className="rp-muted">{w.source || '人工添加'}</td>
                <td><span className="tp-switch"><input type="checkbox" checked={w.enabled} onChange={(e) => setW(i, { enabled: e.target.checked })} /><i /></span><button className="rp-icon" onClick={() => onChange({ ...value, mustWords: value.mustWords.filter((_, j) => j !== i) })}><Trash2 size={13} /></button></td>
              </tr>
            ))}</tbody>
          </table>
          <button className="rp-link ck-table-add" onClick={() => onChange({ ...value, mustWords: [...value.mustWords, { id: newId('mw'), word: '', level: 'prohibited', source: '人工添加', enabled: true }] })}>+ 新增必查词（也可以在标书原文里选中一段直接添加）</button>
        </section>
        <section className="rp-card">
          <div className="ck-table-head"><b>标准与资质库</b><small>标书要求的标准号，逐条与我方证书比对</small></div>
          <table className="ck-table">
            <thead><tr><th>标准 / 资质</th><th>我方状态</th><th>证书有效期</th><th>说明</th><th /></tr></thead>
            <tbody>{value.standards.map((s, i) => (
              <tr key={s.id}>
                <td><input className="ck-mono" value={s.code} onChange={(e) => setS(i, { code: e.target.value })} /></td>
                <td><select className={'ck-level is-' + ST_LEVEL[s.status][1]} value={s.status} onChange={(e) => setS(i, { status: e.target.value as typeof s.status })}>{Object.entries(ST_LEVEL).map(([k, [t]]) => <option key={k} value={k}>{t}</option>)}</select></td>
                <td><input value={s.expires || ''} placeholder="—" onChange={(e) => setS(i, { expires: e.target.value || undefined })} /></td>
                <td><input value={s.note || ''} onChange={(e) => setS(i, { note: e.target.value || undefined })} /></td>
                <td><button className="rp-icon" onClick={() => onChange({ ...value, standards: value.standards.filter((_, j) => j !== i) })}><Trash2 size={13} /></button></td>
              </tr>
            ))}</tbody>
          </table>
          <button className="rp-link ck-table-add" onClick={() => onChange({ ...value, standards: [...value.standards, { id: newId('st'), code: '', status: 'have' }] })}>+ 新增标准</button>
        </section>
        <section className="rp-card">
          <div className="ck-table-head"><b>数据一致性</b><small>关键数据在多份文件里取值不一致时，直接标「待核对」</small></div>
          <table className="ck-table">
            <thead><tr><th>数据</th><th>单位统一</th><th>不一致时</th><th>查矛盾</th></tr></thead>
            <tbody>{fields.filter((f) => f.enabled).map((f) => (
              <tr key={f.id}><td>{f.label}</td><td className="rp-muted">{f.unit || '—'}</td><td>{f.checkConflict ? <Tag tone="orange">待核对</Tag> : <span className="rp-muted">不检查</span>}</td>
                <td><span className="tp-switch"><input type="checkbox" checked={f.checkConflict} onChange={(e) => onFields(f.id, e.target.checked)} /><i /></span></td></tr>
            ))}</tbody>
          </table>
        </section>
        {advanced}
      </div>
      <aside className="ck-side">
        <section className="rp-card ck-pad">
          <h4>兜底结果怎么呈现</h4>
          <small className="rp-muted">在拆标分解表里，程序的结论和 AI 的结论并排，标明来源：</small>
          <div className="ck-example">
            <b>LDs capped at 15% of the Contract Price.</b>
            <div><Tag tone="purple">AI</Tag>一般要求 · 有上限</div>
            <div><Tag tone="green">程序</Tag>上限 15% &gt; 10% → 高风险</div>
            <div><Tag tone="orange">待确认</Tag><b>按高风险保留，请人核对</b></div>
          </div>
        </section>
        <section className="rp-card ck-pad">
          <h4>为什么要单独一层</h4>
          <small>· 数字比大小、标准号对照、多文件取值是否一致，都有确定答案，不该交给 AI 判。</small>
          <small>· 必查词是最后一道防线：哪怕 AI 判错，这些条款也一定会出现在人面前。</small>
          <small>· 这一层只用表单配置，不需要写正则；正则由系统内部生成。</small>
        </section>
      </aside>
    </div>
  );
}
