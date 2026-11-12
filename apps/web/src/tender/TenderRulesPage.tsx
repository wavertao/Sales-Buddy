import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Check, ChevronDown, ChevronRight, FlaskConical, History, Loader2, Plus, RotateCcw, Save, Settings2, Trash2, X,
} from "lucide-react";
import type { FileRole, JudgeConfig, RulePreviewClause, Severity, Strength, TenderCategory, TenderRuleSet } from "../../../../packages/contracts/tender";
import { TENDER_CATEGORIES } from "../../../../packages/contracts/tender";
import { CAT_LABEL, ROLE_LABEL, SEV_LABEL, STRENGTH_LABEL } from "./TenderResult";
import "./tender.css";
import { LibraryPanel, SuggestionsPanel, VersionsPanel } from "./EvolvePanels";

type Api = (path: string, options?: Record<string, unknown>) => Promise<any>;

/** 标书解析规则配置（独立页面）：投标「招标文件」Tab 解析时用的全部规则都在这里维护、试跑、回滚。 */
type PageTab = 'rules' | 'suggestions' | 'library' | 'versions';
export function TenderRulesPage({ api }: { api: Api }) {
  const [tab, setTab] = useState<PageTab>('rules');
  // 自进化发布或回滚后规则版本会变，规则配置要重新读
  const [meta, setMeta] = useState<{ version: number; canEdit: boolean; pending: number }>({ version: 0, canEdit: false, pending: 0 });
  const [gen, setGen] = useState(0);
  const loadMeta = () => Promise.all([api('/tender/rules'), api('/tender/evolve/suggestions').catch(() => [])]).then(([j, s]) => setMeta({ version: j.rules.version, canEdit: j.canEdit, pending: (s as { status: string }[]).filter((x) => x.status === 'draft' || x.status === 'blocked').length }));
  useEffect(() => { void loadMeta(); }, [gen]);
  const changed = () => setGen((n) => n + 1);
  const tabs: [PageTab, string][] = [['rules', '规则与模型判断'], ['suggestions', `改进建议${meta.pending ? ` · ${meta.pending}` : ''}`], ['library', '改进库'], ['versions', '历史版本']];
  return (
    <div className="tp-root">
      <header className="tp-head">
        <div>
          <h1><Settings2 size={20} />标书解析规则</h1>
          <p>文件角色 → 章节 → 分类（技术 · 交付 · 价格 · 商务 · 偏差）→ 强制项 / 风险 / 关键字段 → 责任分工；投标「招标文件」Tab 上传后按这里生效的规则解析</p>
        </div>
      </header>
      <nav className="tp-evtabs">{tabs.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</nav>
      {tab === 'rules' && <RuleConfig key={gen} api={api} onSaved={() => void loadMeta()} />}
      {tab === 'suggestions' && <SuggestionsPanel api={api} canEdit={meta.canEdit} onChanged={changed} />}
      {tab === 'library' && <LibraryPanel api={api} />}
      {tab === 'versions' && <VersionsPanel api={api} canEdit={meta.canEdit} current={meta.version} onChanged={changed} />}
    </div>
  );
}

// ======================= 规则配置 =======================
type GroupKey = 'judge' | 'fileRoles' | 'headings' | 'categories' | 'mandatory' | 'fields' | 'risks' | 'owners' | 'options';
const GROUPS: { key: GroupKey; label: string; step: string; hint: string }[] = [
  { key: 'judge', label: '模型判断', step: '第 4 步', hint: '配置了模型时，规则只负责找候选和给提示，类别、强度、风险由模型判断，每条结论必须引用原文。规则判为否决或高风险的不会被模型单方面去掉，分歧会标「待确认」。这里的提示词、公司口径和示例和规则同一个版本，保存、回滚都在一起。' },
  { key: 'fileRoles', label: '文件角色识别', step: '第 2 步', hint: '文件名正则命中 +3 分、前两页关键词命中 +1 分，取最高分的角色。效力顺序决定同一字段多文件取值时以谁为准；「拆条款」关掉的角色只登记不拆。' },
  { key: 'headings', label: '章节标题', step: '第 3 步', hint: '一行文字（≤120 字）命中任一正则就当作章节标题，后面的条款都挂在这个章节下。修订文件里引用的条款号也靠这里切出来的章节编号来定位。' },
  { key: 'categories', label: '拆标分类', step: '第 4 步', hint: '条款原文每命中一个关键词 +1（同一词最多计 3 次），所在章节标题命中再 +1，乘以权重后取得分最高的类别。英文关键词自动加左词界，支持 non-?compliance 这类正则简写。' },
  { key: 'mandatory', label: '强制项判定', step: '第 4 步', hint: '条款命中多条时取最强的：禁止 / 否决 > 强制 > 建议。只有强制或禁止、且分类得分达到下限的条款才进分解表（带风险的条款无条件进）。' },
  { key: 'fields', label: '关键字段', step: '第 5 步', hint: '正则的第 1 个捕获组是取值。数字类字段会统一单位（GWh 折成 MWh），日期统一成年-月-日。打开「查矛盾」后，多文件取值不一致会标「待核对」，修订 / 澄清文件给出的新值会标「已被修订」。' },
  { key: 'risks', label: '风险提示', step: '第 4 步', hint: '命中即在分解表里挂风险标签和处理建议，并按风险等级排序优先保留。' },
  { key: 'owners', label: '责任分工', step: '第 5 步', hint: '每一类要求默认的负责角色、复核角色，以及在投标截止日前多少天完成（倒排）。' },
  { key: 'options', label: '解析参数', step: '全局', hint: '扫描件判定、读取页数上限、条款长度与进表门槛。' },
];
const ROLE_OPTIONS = Object.entries(ROLE_LABEL) as [FileRole, string][];
const TEAM_ROLES = ['SLS', 'PM', 'SC', 'QA', 'AMD', 'BSD'];

function regexError(src: string): string | null { try { new RegExp(src, 'iu'); return null; } catch (e) { return (e as Error).message; } }
const newId = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}`;

function RuleConfig({ api, onSaved }: { api: Api; onSaved?: () => void }) {
  const [saved, setSaved] = useState<TenderRuleSet | null>(null);
  const [draft, setDraft] = useState<TenderRuleSet | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [group, setGroup] = useState<GroupKey>('judge');
  const [msg, setMsg] = useState<{ tone: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<{ version: number; updatedAt: string; updatedBy: string }[] | null>(null);
  const [testOpen, setTestOpen] = useState(false);

  const load = () => api('/tender/rules').then((j) => { setSaved(j.rules); setDraft(structuredClone(j.rules)); setCanEdit(j.canEdit); });
  useEffect(() => { load().catch((e) => setMsg({ tone: 'red', text: e.message })); }, []);
  const dirty = useMemo(() => !!saved && !!draft && JSON.stringify(saved) !== JSON.stringify(draft), [saved, draft]);
  const invalid = useMemo(() => {
    if (!draft) return 0;
    const pats = [...draft.fileRoles.flatMap((r) => r.namePatterns), ...draft.headings.map((h) => h.pattern), ...draft.mandatory.map((m) => m.pattern), ...draft.fields.map((f) => f.pattern), ...draft.risks.map((r) => r.pattern)];
    return pats.filter((p) => regexError(p)).length;
  }, [draft]);
  if (!draft || !saved) return <div className="tp-card tp-pad">{msg ? msg.text : '正在读取规则…'}</div>;

  const set = <K extends keyof TenderRuleSet>(k: K, v: TenderRuleSet[K]) => setDraft({ ...draft, [k]: v });
  const flash = (tone: string, text: string) => { setMsg({ tone, text }); setTimeout(() => setMsg(null), 5000); };
  async function save() {
    setBusy(true);
    try { const r = await api('/tender/rules', { method: 'PUT', body: draft }); setSaved(r); setDraft(structuredClone(r)); flash('green', `已保存为 v${r.version}，下次解析生效`); onSaved?.(); }
    catch (e) { flash('red', (e as Error).message); } finally { setBusy(false); }
  }
  async function reset() {
    if (!confirm('恢复出厂规则？当前规则会留在历史版本里，可以再回滚。')) return;
    setBusy(true);
    try { const r = await api('/tender/rules/reset', { method: 'POST', body: {} }); setSaved(r); setDraft(structuredClone(r)); flash('green', `已恢复默认（v${r.version}）`); }
    catch (e) { flash('red', (e as Error).message); } finally { setBusy(false); }
  }
  async function restore(version: number) {
    setBusy(true);
    try { const r = await api('/tender/rules/restore', { method: 'POST', body: { version } }); setSaved(r); setDraft(structuredClone(r)); setHistory(null); flash('green', `已回滚到 v${version} 的内容，保存为 v${r.version}`); }
    catch (e) { flash('red', (e as Error).message); } finally { setBusy(false); }
  }
  const g = GROUPS.find((x) => x.key === group)!;
  const count = (k: GroupKey) => (k === 'options' ? 5 : k === 'judge' ? draft.judge.examples.length : (draft[k] as unknown[]).length);

  return (
    <div className="tp-rules">
      <div className="tp-card tp-rulebar">
        <b>规则 v{saved.version}</b>
        <span className="tp-muted">{saved.updatedBy} · {saved.updatedAt.slice(0, 16).replace('T', ' ')}</span>
        {dirty && <span className="tp-pill orange">有未保存的修改</span>}
        {invalid > 0 && <span className="tp-pill red">{invalid} 条正则无效</span>}
        {!canEdit && <span className="tp-pill gray">只读：主管或管理员才能保存</span>}
        <span className="tp-grow" />
        {msg && <span className={'tp-msg tone-' + msg.tone}>{msg.text}</span>}
        <button className="tp-btn" onClick={() => setTestOpen(!testOpen)}><FlaskConical size={13} />试跑</button>
        <div className="tp-dropdown">
          <button className="tp-btn" onClick={() => (history ? setHistory(null) : api('/tender/rules/history').then(setHistory))}><History size={13} />历史版本</button>
          {history && (
            <div className="tp-menu">
              {history.map((h) => (
                <button key={h.version} disabled={!canEdit || h.version === saved.version || busy} onClick={() => restore(h.version)}>
                  <b>v{h.version}</b><span>{h.updatedBy}</span><span className="tp-muted">{h.updatedAt.slice(5, 16).replace('T', ' ')}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="tp-btn" disabled={!dirty || busy} onClick={() => setDraft(structuredClone(saved))}><X size={13} />放弃修改</button>
        <button className="tp-btn" disabled={!canEdit || busy} onClick={reset}><RotateCcw size={13} />恢复默认</button>
        <button className="tp-btn primary" disabled={!canEdit || !dirty || busy || invalid > 0} onClick={save}>{busy ? <Loader2 size={13} className="tp-spin" /> : <Save size={13} />}保存</button>
      </div>
      {testOpen && <RuleTester api={api} draft={draft} dirty={dirty} />}
      <div className="tp-rule-body">
        <nav className="tp-card tp-groups">
          {GROUPS.map((x) => (
            <button key={x.key} className={group === x.key ? 'on' : ''} onClick={() => setGroup(x.key)}>
              <span className="tp-grow">{x.label}</span><span className="tp-muted">{x.step}</span><i>{count(x.key)}</i>
            </button>
          ))}
        </nav>
        <section className="tp-card tp-group">
          <div className="tp-card-head"><b>{g.label}</b><span className="tp-muted">{g.step}</span></div>
          <p className="tp-hint">{g.hint}</p>
          <fieldset disabled={!canEdit} className="tp-fieldset">
            {group === 'judge' && <JudgeForm value={draft.judge} onChange={(v) => set('judge', v)} />}
            {group === 'fileRoles' && (
              <RuleList items={draft.fileRoles} onChange={(v) => set('fileRoles', v)} add={() => ({ id: newId('fr'), role: 'other' as FileRole, label: '新角色', namePatterns: [], contentKeywords: [], precedence: 30, extractClauses: true, enabled: true })}
                render={(r, up) => (<>
                  <Row label="名称"><input value={r.label} onChange={(e) => up({ label: e.target.value })} /></Row>
                  <Row label="角色"><select value={r.role} onChange={(e) => up({ role: e.target.value as FileRole })}>{ROLE_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Row>
                  <Row label="效力顺序"><input type="number" min={0} max={100} value={r.precedence} onChange={(e) => up({ precedence: Number(e.target.value) })} className="tp-narrow" /><label className="tp-check"><input type="checkbox" checked={r.extractClauses} onChange={(e) => up({ extractClauses: e.target.checked })} />拆条款</label></Row>
                  <Row label="文件名正则" wide><Tags values={r.namePatterns} onChange={(v) => up({ namePatterns: v })} regex /></Row>
                  <Row label="内容关键词" wide><Tags values={r.contentKeywords} onChange={(v) => up({ contentKeywords: v })} /></Row>
                </>)} />
            )}
            {group === 'headings' && (
              <RuleList items={draft.headings} onChange={(v) => set('headings', v)} add={() => ({ id: newId('h'), label: '新标题规则', pattern: '^\\s*', level: 2, enabled: true })}
                render={(r, up) => (<>
                  <Row label="名称"><input value={r.label} onChange={(e) => up({ label: e.target.value })} /></Row>
                  <Row label="层级"><select value={r.level} onChange={(e) => up({ level: Number(e.target.value) })}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} 级</option>)}</select></Row>
                  <Row label="正则" wide><Regex value={r.pattern} onChange={(v) => up({ pattern: v })} /></Row>
                </>)} />
            )}
            {group === 'categories' && (
              <RuleList items={draft.categories} onChange={(v) => set('categories', v)} add={() => ({ id: newId('c'), category: 'technical' as TenderCategory, label: '新分类词表', keywords: [], weight: 1, enabled: true })}
                render={(r, up) => (<>
                  <Row label="名称"><input value={r.label} onChange={(e) => up({ label: e.target.value })} /></Row>
                  <Row label="归入类别"><select value={r.category} onChange={(e) => up({ category: e.target.value as TenderCategory })}>{TENDER_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></Row>
                  <Row label="权重"><input type="number" step={0.1} min={0} max={10} value={r.weight} onChange={(e) => up({ weight: Number(e.target.value) })} className="tp-narrow" /></Row>
                  <Row label={`关键词 · ${r.keywords.length}`} wide><Tags values={r.keywords} onChange={(v) => up({ keywords: v })} /></Row>
                </>)} />
            )}
            {group === 'mandatory' && (
              <RuleList items={draft.mandatory} onChange={(v) => set('mandatory', v)} add={() => ({ id: newId('m'), label: '新强制项规则', pattern: '', strength: 'mandatory' as Strength, enabled: true })}
                render={(r, up) => (<>
                  <Row label="名称"><input value={r.label} onChange={(e) => up({ label: e.target.value })} /></Row>
                  <Row label="强度"><select value={r.strength} onChange={(e) => up({ strength: e.target.value as Strength })}>{Object.entries(STRENGTH_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Row>
                  <Row label="正则" wide><Regex value={r.pattern} onChange={(v) => up({ pattern: v })} /></Row>
                </>)} />
            )}
            {group === 'fields' && (
              <RuleList items={draft.fields} onChange={(v) => set('fields', v)} add={() => ({ id: newId('f'), key: 'new_field', label: '新字段', pattern: '(...)', normalize: 'text' as const, checkConflict: false, enabled: true })}
                render={(r, up) => (<>
                  <Row label="名称"><input value={r.label} onChange={(e) => up({ label: e.target.value })} /></Row>
                  <Row label="字段 key"><input value={r.key} onChange={(e) => up({ key: e.target.value })} className="tp-mono" /></Row>
                  <Row label="归一化"><select value={r.normalize} onChange={(e) => up({ normalize: e.target.value as 'number' | 'date' | 'text' })}><option value="number">数字</option><option value="date">日期</option><option value="text">文本</option></select><input value={r.unit || ''} onChange={(e) => up({ unit: e.target.value || undefined })} placeholder="单位" className="tp-narrow" /><label className="tp-check"><input type="checkbox" checked={r.checkConflict} onChange={(e) => up({ checkConflict: e.target.checked })} />查矛盾</label></Row>
                  <Row label="正则" wide><Regex value={r.pattern} onChange={(v) => up({ pattern: v })} /></Row>
                </>)} />
            )}
            {group === 'risks' && (
              <RuleList items={draft.risks} onChange={(v) => set('risks', v)} add={() => ({ id: newId('r'), label: '新风险', pattern: '', severity: 'medium' as Severity, category: 'commercial' as TenderCategory, advice: '', enabled: true })}
                render={(r, up) => (<>
                  <Row label="名称"><input value={r.label} onChange={(e) => up({ label: e.target.value })} /></Row>
                  <Row label="等级 / 类别"><select value={r.severity} onChange={(e) => up({ severity: e.target.value as Severity })}>{Object.entries(SEV_LABEL).map(([k, l]) => <option key={k} value={k}>{l}风险</option>)}</select><select value={r.category} onChange={(e) => up({ category: e.target.value as TenderCategory })}>{TENDER_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></Row>
                  <Row label="正则" wide><Regex value={r.pattern} onChange={(v) => up({ pattern: v })} /></Row>
                  <Row label="处理建议" wide><input value={r.advice} onChange={(e) => up({ advice: e.target.value })} /></Row>
                </>)} />
            )}
            {group === 'owners' && (
              <table className="tp-table tp-owners">
                <thead><tr><th>类别</th><th>负责角色</th><th>复核角色</th><th>截止前天数</th></tr></thead>
                <tbody>
                  {draft.owners.map((o, i) => {
                    const up = (p: Partial<typeof o>) => set('owners', draft.owners.map((x, j) => (j === i ? { ...x, ...p } : x)));
                    return (
                      <tr key={o.category}>
                        <td><span className={'tp-cat c-' + o.category}>{CAT_LABEL[o.category]}</span></td>
                        <td><select value={o.role} onChange={(e) => up({ role: e.target.value as typeof o.role })}>{TEAM_ROLES.map((r) => <option key={r}>{r}</option>)}</select></td>
                        <td><select value={o.reviewer} onChange={(e) => up({ reviewer: e.target.value as typeof o.role })}>{TEAM_ROLES.map((r) => <option key={r}>{r}</option>)}</select></td>
                        <td><input type="number" min={0} max={60} value={o.dueOffsetDays} onChange={(e) => up({ dueOffsetDays: Number(e.target.value) })} className="tp-narrow" /> 天</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {group === 'options' && (
              <div className="tp-options">
                {([
                  ['minCharsPerPage', '每页少于多少字算扫描页', '字'], ['maxPagesPerFile', '单文件最多读多少页', '页'],
                  ['clauseMinLength', '条款最短长度（更短的并到上一条）', '字'], ['clauseMaxLength', '条款最长长度（更长的按句切开）', '字'],
                  ['minCategoryScore', '强制项进分解表的分类得分下限', '分'],
                ] as const).map(([k, label, unit]) => (
                  <Row key={k} label={label}><input type="number" value={draft.options[k]} onChange={(e) => set('options', { ...draft.options, [k]: Number(e.target.value) })} className="tp-narrow" /><span className="tp-muted">{unit}</span></Row>
                ))}
              </div>
            )}
          </fieldset>
        </section>
      </div>
    </div>
  );
}

function JudgeForm({ value, onChange }: { value: JudgeConfig; onChange: (v: JudgeConfig) => void }) {
  const up = (p: Partial<JudgeConfig>) => onChange({ ...value, ...p });
  return (
    <div className="tp-judge">
      <label className="tp-check"><input type="checkbox" checked={value.enabled} onChange={(e) => up({ enabled: e.target.checked })} />启用模型判断（没配模型时自动用规则结果）</label>
      <Row label="提示词" wide><textarea className="tp-judge-text" value={value.prompt} onChange={(e) => up({ prompt: e.target.value })} /></Row>
      <Row label="公司口径（每行一条）" wide>
        <textarea className="tp-judge-text short" value={value.policies.join('\n')} placeholder="例如：质保超过 10 年算高风险" onChange={(e) => up({ policies: e.target.value.split('\n') })} onBlur={() => up({ policies: value.policies.map((p) => p.trim()).filter(Boolean) })} />
      </Row>
      <div className="tp-options">
        <Row label="每批条款数"><input type="number" min={1} max={100} value={value.batchSize} onChange={(e) => up({ batchSize: Number(e.target.value) })} className="tp-narrow" /></Row>
        <Row label="同时调用批数"><input type="number" min={1} max={20} value={value.concurrency} onChange={(e) => up({ concurrency: Number(e.target.value) })} className="tp-narrow" /></Row>
        <Row label="低于此置信度标待确认"><input type="number" step={0.05} min={0} max={1} value={value.minConfidence} onChange={(e) => up({ minConfidence: Number(e.target.value) })} className="tp-narrow" /></Row>
      </div>
      <b>标注示例 · {value.examples.length}</b>
      <RuleList items={value.examples} onChange={(v) => up({ examples: v })} add={() => ({ id: newId('ex'), text: '', isRequirement: true, category: 'technical' as TenderCategory, strength: 'required' as Strength, enabled: true })} addLabel="新增示例"
        render={(r, set1) => (<>
          <Row label="条款原文" wide><textarea className="tp-judge-text short" value={r.text} onChange={(e) => set1({ text: e.target.value })} /></Row>
          <Row label="判断"><label className="tp-check"><input type="checkbox" checked={r.isRequirement} onChange={(e) => set1({ isRequirement: e.target.checked })} />属于要求</label></Row>
          {r.isRequirement && <Row label="类别 / 强度"><select value={r.category} onChange={(e) => set1({ category: e.target.value as TenderCategory })}>{TENDER_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select><select value={r.strength} onChange={(e) => set1({ strength: e.target.value as Strength })}>{Object.entries(STRENGTH_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Row>}
          <Row label="说明" wide><input value={r.note || ''} onChange={(e) => set1({ note: e.target.value || undefined })} /></Row>
        </>)} />
    </div>
  );
}

function RuleList<T extends { id: string; enabled: boolean }>({ items, onChange, add, render, addLabel = '新增规则' }: {
  items: T[]; onChange: (v: T[]) => void; add: () => T; render: (r: T, up: (p: Partial<T>) => void) => React.ReactNode; addLabel?: string;
}) {
  return (
    <div className="tp-rule-list">
      {items.map((r, i) => {
        const up = (p: Partial<T>) => onChange(items.map((x, j) => (j === i ? { ...x, ...p } : x)));
        return (
          <div key={r.id} className={'tp-rule' + (r.enabled ? '' : ' off')}>
            <div className="tp-rule-side">
              <label className="tp-switch" title={r.enabled ? '已启用' : '已停用'}><input type="checkbox" checked={r.enabled} onChange={(e) => up({ enabled: e.target.checked } as Partial<T>)} /><i /></label>
              <button className="tp-icon" title="删除" onClick={() => onChange(items.filter((_, j) => j !== i))}><Trash2 size={13} /></button>
            </div>
            <div className="tp-rule-grid">{render(r, up)}</div>
          </div>
        );
      })}
      <button className="tp-btn tp-add" onClick={() => onChange([...items, add()])}><Plus size={13} />{addLabel}</button>
    </div>
  );
}

const Row = ({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) => (
  <div className={'tp-row-f' + (wide ? ' wide' : '')}><span>{label}</span><div>{children}</div></div>
);

function Regex({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const err = regexError(value);
  return (
    <div className="tp-regex">
      <input className={'tp-mono' + (err ? ' bad' : '')} value={value} onChange={(e) => onChange(e.target.value)} spellCheck={false} />
      {err ? <span className="tone-red tp-small" title={err}>正则无效</span> : <Check size={13} className="tone-green" />}
    </div>
  );
}

function Tags({ values, onChange, regex }: { values: string[]; onChange: (v: string[]) => void; regex?: boolean }) {
  const [text, setText] = useState('');
  const commit = () => {
    const add = text.split(/[,，\n]/).map((s) => s.trim()).filter((s) => s && !values.includes(s));
    if (add.length) onChange([...values, ...add]);
    setText('');
  };
  return (
    <div className="tp-tags">
      {values.map((v) => (
        <span key={v} className={'tp-tag' + (regex && regexError(v) ? ' bad' : '')}>{v}<button onClick={() => onChange(values.filter((x) => x !== v))}><X size={10} /></button></span>
      ))}
      <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }} onBlur={commit} placeholder="输入后回车，逗号可批量" />
    </div>
  );
}

const SAMPLE_TEXT = `第三章 技术要求
3.1 储能系统额定容量 200MW/400MWh，往返效率不低于 88%，电芯循环寿命不少于 8000 次循环。
3.2 ★投标人必须提供 UL9540A 大规模燃烧测试报告，否则按无效投标处理。
Section 5 Commercial Terms
5.2 The Contractor shall pay liquidated damages at 0.5% per week, subject to a cap of 10% of the Contract Price.
5.3 Bidders must submit a Bid Security of INR 4,21,600 along with the bid. Conditional bids will be rejected.
第四章 投标须知
投标截止时间：2026年11月20日 10:00，投标有效期 90 日历天。`;

function RuleTester({ api, draft, dirty }: { api: Api; draft: TenderRuleSet; dirty: boolean }) {
  const [text, setText] = useState(SAMPLE_TEXT);
  const [res, setRes] = useState<{ clauses: RulePreviewClause[]; sections: string[] } | null>(null);
  const [err, setErr] = useState('');
  async function run() {
    setErr('');
    try { setRes(await api('/tender/rules/preview', { method: 'POST', body: { text, rules: draft } })); }
    catch (e) { setErr((e as Error).message); }
  }
  return (
    <div className="tp-card tp-tester">
      <div className="tp-card-head"><FlaskConical size={14} /><b>规则试跑</b><span className="tp-muted">{dirty ? '用页面上未保存的规则' : '用当前已保存的规则'}跑第 3–5 步，不落库</span></div>
      <div className="tp-tester-body">
        <div className="tp-tester-in">
          <textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
          <button className="tp-btn primary" onClick={run}><FlaskConical size={13} />运行</button>
          {err && <div className="tone-red tp-small">{err}</div>}
        </div>
        <div className="tp-tester-out">
          {!res && <p className="tp-muted">贴一段招标文件原文，点「运行」看每条条款被切成什么、命中了哪些规则。</p>}
          {res && <div className="tp-muted tp-small">识别到 {res.sections.length} 个章节、{res.clauses.length} 条条款</div>}
          {res?.clauses.map((c, i) => (
            <div key={i} className="tp-pv">
              <div className="tp-pv-tags">
                {c.category ? <span className={'tp-cat c-' + c.category}>{CAT_LABEL[c.category]} {c.score}</span> : <span className="tp-pill gray">未分类</span>}
                {c.strength && <span className={'tp-pill ' + (c.strength === 'prohibited' ? 'red' : c.strength === 'mandatory' ? 'dark' : 'gray')} title={c.mandatoryRule}>{STRENGTH_LABEL[c.strength]}</span>}
                {c.risks.map((r) => <span key={r} className="tp-pill sev-high">{r}</span>)}
                {c.fields.map((f) => <span key={f.label} className="tp-pill blue">{f.label}：{f.value}</span>)}
                <span className="tp-muted tp-small">{c.section}</span>
              </div>
              <div className="tp-pv-text">{c.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

