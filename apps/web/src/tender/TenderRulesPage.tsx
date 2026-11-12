import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Check, ChevronDown, ChevronRight, FlaskConical, History, Loader2, Play, Plus, RotateCcw, Save, Settings2, SlidersHorizontal, Trash2, X,
} from "lucide-react";
import type { FileRole, JudgeConfig, RulePreviewClause, Severity, Strength, TenderCategory, TenderRuleSet } from "../../../../packages/contracts/tender";
import { TENDER_CATEGORIES, keywordsPattern } from "../../../../packages/contracts/tender";
import { CAT_LABEL, ROLE_LABEL, SEV_LABEL, STRENGTH_LABEL } from "./TenderResult";
import "./tender.css";
import "./rules-page.css";
import { LibraryPanel, SuggestionsPanel, VersionsPanel } from "./EvolvePanels";
import { ChecklistEditor, GuardsEditor, PromptPanel } from "./ChecklistPanels";

type Api = (path: string, options?: Record<string, unknown>) => Promise<any>;

/**
 * 标书解析规则配置（独立页面）：三层配置——标准提示词 → 审查清单（大类 → 审查项）→ 兜底规则，
 * 外加改进建议（含改进库）和历史版本。投标「标书拆解」解析时按这里生效的版本跑。
 */
type PageTab = 'prompt' | 'items' | 'guards' | 'suggestions' | 'versions';
type Meta = { version: number; updatedAt: string; updatedBy: string; canEdit: boolean; model: string | null; pending: number; policySource: Record<string, string> };
export function TenderRulesPage({ api }: { api: Api }) {
  const [tab, setTab] = useState<PageTab>('items');
  const [group, setGroup] = useState<GroupKey>('mandatory');
  const [tester, setTester] = useState(false);
  const [lib, setLib] = useState(false);
  // 自进化发布或回滚后规则版本会变，规则配置要重新读
  const [meta, setMeta] = useState<Meta | null>(null);
  const [gen, setGen] = useState(0);
  const loadMeta = () => Promise.all([api('/tender/rules'), api('/tender/evolve/suggestions').catch(() => [])]).then(([j, s]) => {
    const sugs = s as { status: string; no: number; publishedVersion?: number; change: { policies?: string[] } }[];
    const policySource: Record<string, string> = {};
    for (const x of sugs) if (x.status === 'published') for (const p of x.change.policies || []) policySource[p] = `来自改进建议 · v${x.publishedVersion} 审批`;
    setMeta({ version: j.rules.version, updatedAt: j.rules.updatedAt, updatedBy: j.rules.updatedBy, canEdit: j.canEdit, model: j.model, pending: sugs.filter((x) => x.status === 'draft' || x.status === 'blocked').length, policySource });
  });
  useEffect(() => { void loadMeta(); }, [gen]);
  const changed = () => setGen((n) => n + 1);
  const tabs: [PageTab, string][] = [['prompt', '标准提示词'], ['items', '审查清单'], ['guards', '兜底规则'], ['suggestions', `改进建议${meta?.pending ? ` · ${meta.pending}` : ''}`], ['versions', '历史版本']];
  const configTab = tab === 'prompt' || tab === 'items' || tab === 'guards';
  return (
    <div className="rp-shell">
      <header className="rp-top">
        <SlidersHorizontal size={16} /><b>标书解析规则</b>
        {meta && <small>当前 v{meta.version} · {meta.updatedAt.slice(0, 10)} {meta.updatedBy.replace(/（.*$/, '')}发布 · 模型 {meta.model || '未配置（用规则结果）'}</small>}
        <span className="rp-grow" />
        <button className="rp-btn" onClick={() => { setTab('guards'); setTester(true); }}><FlaskConical size={13} />试跑</button>
        <button className="rp-btn" onClick={() => setTab('versions')}><History size={13} />历史版本</button>
      </header>
      <nav className="rp-tabs">{tabs.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</nav>
      <div className="rp-body">
        {configTab && <RuleConfig key={gen} api={api} mode={tab as 'prompt' | 'items' | 'guards'} group={group} setGroup={setGroup} tester={tester} setTester={setTester} model={meta?.model || null} policySource={meta?.policySource || {}} onSaved={() => void loadMeta()} />}
        {tab === 'suggestions' && (
          <div className="ck-stack">
            <div className="rp-seg"><button className={lib ? '' : 'on'} onClick={() => setLib(false)}>改进建议</button><button className={lib ? 'on' : ''} onClick={() => setLib(true)}>改进库（人工改判）</button></div>
            {lib ? <LibraryPanel api={api} canEdit={!!meta?.canEdit} onChanged={changed} /> : <SuggestionsPanel api={api} canEdit={!!meta?.canEdit} version={meta?.version || 0} onChanged={changed} />}
          </div>
        )}
        {tab === 'versions' && <VersionsPanel api={api} canEdit={!!meta?.canEdit} current={meta?.version || 0} onChanged={changed} />}
      </div>
    </div>
  );
}

// ======================= 规则配置 =======================
type GroupKey = 'judge' | 'fileRoles' | 'headings' | 'categories' | 'mandatory' | 'fields' | 'risks' | 'owners' | 'options';
const GROUPS: { key: GroupKey; label: string; step: string; hint: string }[] = [
  { key: 'judge', label: '模型判断', step: '第 4 步', hint: '配置了模型时，规则只负责找候选和给提示，类别、强度、风险由模型判断，每条结论必须引用原文。规则判为否决或高风险的不会被模型单方面去掉，分歧会标「待确认」。这里的提示词、公司口径和示例和规则同一个版本，保存、回滚都在一起。' },
  { key: 'fileRoles', label: '文件角色识别', step: '第 2 步', hint: '文件名正则命中 +3 分、前两页关键词命中 +1 分，取最高分的角色。效力顺序决定同一字段多文件取值时以谁为准；「拆条款」关掉的角色只登记不拆。' },
  { key: 'headings', label: '章节标题', step: '第 3 步', hint: '一行文字（≤120 字）命中任一正则就当作章节标题，后面的条款都挂在这个章节下。修订文件里引用的条款号也靠这里切出来的章节编号来定位。' },
  { key: 'categories', label: '拆标分类', step: '第 4 步', hint: '条款原文每命中一个关键词 +1（同一词最多计 3 次），所在章节标题命中再 +1，乘以权重后取得分最高的类别。英文关键词自动加词边界，直接填词或短语即可。' },
  { key: 'mandatory', label: '强制项判定', step: '第 4 步', hint: '填词或短语就行，比如 will be rejected、废标、不低于 *天（* 匹配中间任意几个字）；英文不分大小写。命中多条时取最强的：否决 > 强制 > 一般要求 > 建议。也可以在右边试跑结果里选中原文直接加词。' },
  { key: 'fields', label: '关键字段', step: '第 5 步', hint: '正则的第 1 个捕获组是取值。数字类字段会统一单位（GWh 折成 MWh），日期统一成年-月-日。打开「查矛盾」后，多文件取值不一致会标「待核对」，修订 / 澄清文件给出的新值会标「已被修订」。' },
  { key: 'risks', label: '风险提示', step: '第 4 步', hint: '填词或短语，命中即在分解表里挂风险标签和处理建议，并按风险等级排序优先保留。' },
  { key: 'owners', label: '责任分工', step: '第 5 步', hint: '每一类要求默认的负责角色、复核角色，以及在投标截止日前多少天完成（倒排）。' },
  { key: 'options', label: '解析参数', step: '全局', hint: '扫描件判定、读取页数上限、条款长度与进表门槛。' },
];
const ROLE_OPTIONS = Object.entries(ROLE_LABEL) as [FileRole, string][];
const TEAM_ROLES = ['SLS', 'PM', 'SC', 'QA', 'AMD', 'BSD'];

function regexError(src: string): string | null { try { new RegExp(src, 'iu'); return null; } catch (e) { return (e as Error).message; } }
const newId = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}`;

const ADVANCED = new Set<GroupKey>(['fileRoles', 'headings', 'fields', 'options']);
function RuleConfig({ api, mode, group, setGroup, tester, setTester, model, policySource, onSaved }: { api: Api; mode: 'prompt' | 'items' | 'guards'; group: GroupKey; setGroup: (g: GroupKey) => void; tester: boolean; setTester: (v: boolean) => void; model: string | null; policySource: Record<string, string>; onSaved?: () => void }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [saved, setSaved] = useState<TenderRuleSet | null>(null);
  const [draft, setDraft] = useState<TenderRuleSet | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [msg, setMsg] = useState<{ tone: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAdv, setShowAdv] = useState(false);

  const load = () => api('/tender/rules').then((j) => { setSaved(j.rules); setDraft(structuredClone(j.rules)); setCanEdit(j.canEdit); setIsAdmin(!!j.isAdmin); });
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
    try { const r = await api('/tender/rules/restore', { method: 'POST', body: { version } }); setSaved(r); setDraft(structuredClone(r)); flash('green', `已回滚到 v${version} 的内容，保存为 v${r.version}`); }
    catch (e) { flash('red', (e as Error).message); } finally { setBusy(false); }
  }
  const g = GROUPS.find((x) => x.key === group)!;
  const count = (k: GroupKey) => (k === 'options' ? 5 : k === 'judge' ? draft.judge.examples.length : (draft[k] as unknown[]).length);

  const addWord = (kind: 'prohibited' | 'mandatory' | 'required' | 'risk', word: string) => {
    const w = word.replace(/\s+/g, ' ').trim();
    const id = `kw-${kind}`;
    if (kind === 'risk') {
      const cur = draft.risks.find((x) => x.id === id) || { id, label: '从原文添加的风险词', pattern: '', keywords: [] as string[], severity: 'medium' as Severity, category: 'commercial' as TenderCategory, advice: '从原文添加，请补充处理建议', enabled: true };
      const next = { ...cur, enabled: true, keywords: [...new Set([...(cur.keywords || []), w])] };
      set('risks', draft.risks.some((x) => x.id === id) ? draft.risks.map((x) => (x.id === id ? next : x)) : [...draft.risks, next]);
    } else {
      const label = { prohibited: '从原文添加的否决词', mandatory: '从原文添加的强制词', required: '从原文添加的一般要求词' }[kind];
      const cur = draft.mandatory.find((x) => x.id === id) || { id, label, pattern: '', keywords: [] as string[], strength: kind as Strength, enabled: true };
      const next = { ...cur, enabled: true, keywords: [...new Set([...(cur.keywords || []), w])] };
      set('mandatory', draft.mandatory.some((x) => x.id === id) ? draft.mandatory.map((x) => (x.id === id ? next : x)) : [...draft.mandatory, next]);
    }
    flash('green', `已把「${w}」加进规则，点「保存为 v${saved.version + 1}」生效`);
  };
  void restore;
  const isJudge = mode === 'prompt';
  const hints: Record<typeof mode, string> = { prompt: '标准提示词约束 AI 的注意力、解析方法和产出；输出格式和安全约束锁定。', items: '按大类管理审查项：AI 判断那半边注入提示词，程序校验那半边由程序比阈值。', guards: '有确定答案的事由程序兜底：必查词、标准与资质库、数据一致性。' };
  const advanced = (
    <details className="rp-card ck-adv">
      <summary>高级：系统内部规则（文件角色、章节、分类词、强制词、风险词、字段、责任分工、参数）· 一般不用改</summary>
      <div className={'rp-cols' + (tester ? ' has-tester' : '')}>
        <nav className="rp-card rp-groups">
          {GROUPS.filter((x) => x.key !== 'judge').map((x) => (
            <button key={x.key} className={group === x.key ? 'on' : ''} onClick={() => setGroup(x.key)}>
              <span><b>{x.label}</b><small>{x.step}</small></span><i>{count(x.key)}</i>
            </button>
          ))}
          {!tester && <button className="rp-adv-toggle" onClick={() => setTester(true)}>打开试跑</button>}
        </nav>
        <section className="rp-card rp-group">
          <div className="rp-group-head"><b>{g.label} · {count(group)} {group === 'options' ? '项' : '条'}</b></div>
          <p className="rp-hint">{g.hint}</p>
          <fieldset disabled={!canEdit} className="tp-fieldset">
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
              <RuleList items={draft.mandatory} onChange={(v) => set('mandatory', v)} add={() => ({ id: newId('m'), label: '新强制项规则', pattern: '', keywords: [], strength: 'mandatory' as Strength, enabled: true })}
                render={(r, up) => (<>
                  <Row label="名称"><input value={r.label} onChange={(e) => up({ label: e.target.value })} /></Row>
                  <Row label="强度"><select value={r.strength} onChange={(e) => up({ strength: e.target.value as Strength })}>{Object.entries(STRENGTH_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Row>
                  <Keywords value={r.keywords || []} onChange={(v) => up({ keywords: v })} pattern={r.pattern} onPattern={(v) => up({ pattern: v })} />
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
              <RuleList items={draft.risks} onChange={(v) => set('risks', v)} add={() => ({ id: newId('r'), label: '新风险', pattern: '', keywords: [], severity: 'medium' as Severity, category: 'commercial' as TenderCategory, advice: '', enabled: true })}
                render={(r, up) => (<>
                  <Row label="名称"><input value={r.label} onChange={(e) => up({ label: e.target.value })} /></Row>
                  <Row label="等级 / 类别"><select value={r.severity} onChange={(e) => up({ severity: e.target.value as Severity })}>{Object.entries(SEV_LABEL).map(([k, l]) => <option key={k} value={k}>{l}风险</option>)}</select><select value={r.category} onChange={(e) => up({ category: e.target.value as TenderCategory })}>{TENDER_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></Row>
                  <Keywords value={r.keywords || []} onChange={(v) => up({ keywords: v })} pattern={r.pattern} onPattern={(v) => up({ pattern: v })} />
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
        {tester && <RuleTester api={api} draft={draft} dirty={dirty} onClose={() => setTester(false)} onAddWord={canEdit ? addWord : undefined} />}
      </div>
    </details>
  );
  return (
    <div className="rp-config">
      <div className="rp-card rp-rulebar">
        <b>规则 v{saved.version}</b>
        <small>{hints[mode]}</small>
        {dirty && <span className="rp-tag is-orange">有未保存的修改</span>}
        {invalid > 0 && <span className="rp-tag is-red">{invalid} 条正则无效</span>}
        {!canEdit && <span className="rp-tag is-gray">只读：主管或管理员才能保存</span>}
        <span className="rp-grow" />
        {msg && <span className={'rp-msg is-' + msg.tone}>{msg.text}</span>}
        <button className="rp-btn" disabled={!dirty || busy} onClick={() => setDraft(structuredClone(saved))}><X size={13} />放弃修改</button>
        {isJudge && <button className="rp-btn" disabled={!canEdit || busy} onClick={reset}><RotateCcw size={13} />恢复默认</button>}
        <button className="rp-btn primary" disabled={!canEdit || !dirty || busy || invalid > 0} onClick={save}>{busy ? <Loader2 size={13} className="tp-spin" /> : <Save size={13} />}保存为 v{saved.version + 1}</button>
      </div>
      <fieldset disabled={!canEdit} className="tp-fieldset">
        {mode === 'prompt' && <PromptPanel value={draft.judge} onChange={(v) => set('judge', v)} isAdmin={isAdmin} model={model} policySource={policySource} />}
        {mode === 'items' && <ChecklistEditor api={api} items={draft.items || []} onChange={(v) => set('items', v)} examples={draft.judge.examples} canEdit={canEdit} />}
      </fieldset>
      {mode === 'guards' && <GuardsEditor value={draft.guards || { mustWords: [], standards: [] }} onChange={(v) => set('guards', v)} fields={draft.fields} onFields={(id, cc) => set('fields', draft.fields.map((x) => (x.id === id ? { ...x, checkConflict: cc } : x)))} advanced={advanced} />}
    </div>
  );
}

/** 示例来源：出厂默认的几条有固定编号；人工改判转来的带「人工改判」说明；其余是在这里手工加的 */
const FACTORY_EXAMPLES = new Set(['ex-reject', 'ex-must', 'ex-shall', 'ex-cn-reject', 'ex-cn-shall', 'ex-def']);
const EX_SOURCE = (e: { id: string; note?: string }) => (e.note?.startsWith('人工改判') ? ['自动生效 · 来自改判', 'green'] : FACTORY_EXAMPLES.has(e.id) ? ['出厂', 'gray'] : ['人工添加', 'gray']);
function JudgeForm({ value, onChange, model, policySource }: { value: JudgeConfig; onChange: (v: JudgeConfig) => void; model: string | null; policySource: Record<string, string> }) {
  const up = (p: Partial<JudgeConfig>) => onChange({ ...value, ...p });
  const setEx = (i: number, p: Partial<JudgeConfig['examples'][number]>) => up({ examples: value.examples.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  return (
    <div className="rp-judge">
      <div className="rp-judge-head">
        <b>模型判断</b>
        <label className="tp-switch"><input type="checkbox" checked={value.enabled} onChange={(e) => up({ enabled: e.target.checked })} /><i /></label>
        <small>{value.enabled ? '已启用' : '已停用'} · {model || '未配置模型'} · 未配置模型时自动用规则结果</small>
        <span className="rp-grow" />
        <label className="rp-num">每批<input type="number" min={1} max={100} value={value.batchSize} onChange={(e) => up({ batchSize: Number(e.target.value) })} /></label>
        <label className="rp-num">并发<input type="number" min={1} max={20} value={value.concurrency} onChange={(e) => up({ concurrency: Number(e.target.value) })} /></label>
        <label className="rp-num">低于此置信度标待确认<input type="number" step={0.05} min={0} max={1} value={value.minConfidence} onChange={(e) => up({ minConfidence: Number(e.target.value) })} /></label>
      </div>
      <div className="rp-judge-cols">
        <div className="rp-judge-col">
          <h5>提示词</h5>
          <textarea className="rp-prompt" value={value.prompt} onChange={(e) => up({ prompt: e.target.value })} />
          <h5>公司口径（每条一句）<button className="rp-link" onClick={() => up({ policies: [...value.policies, ''] })}>+ 新增口径</button></h5>
          {!value.policies.length && <p className="rp-hint">还没有口径。改进建议里通过审批的口径会出现在这里。</p>}
          {value.policies.map((p, i) => (
            <div key={i} className="rp-policy">
              <input value={p} placeholder="例如：质保超过 10 年算高风险" onChange={(e) => up({ policies: value.policies.map((x, j) => (j === i ? e.target.value : x)) })} onBlur={() => up({ policies: value.policies.map((x) => x.trim()).filter(Boolean) })} />
              <span className={'rp-tag ' + (policySource[p] ? 'is-purple' : 'is-plain')}>{policySource[p] || '人工添加'}</span>
              <button className="rp-icon" title="删除" onClick={() => up({ policies: value.policies.filter((_, j) => j !== i) })}><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
        <div className="rp-judge-col">
          <h5>标注示例 · {value.examples.length}<button className="rp-link" onClick={() => up({ examples: [...value.examples, { id: newId('ex'), text: '', isRequirement: true, category: 'technical' as TenderCategory, strength: 'required' as Strength, enabled: true }] })}>+ 新增示例</button></h5>
          {value.examples.map((x, i) => {
            const [src, tone] = EX_SOURCE(x);
            return (
              <div key={x.id} className={'rp-example' + (x.enabled ? '' : ' off')}>
                <textarea value={x.text} rows={2} placeholder="条款原文" onChange={(e) => setEx(i, { text: e.target.value })} />
                <div className="rp-example-foot">
                  <select className="rp-chip is-blue" value={x.isRequirement ? `${x.category}|${x.strength || ''}` : 'no'} onChange={(e) => { const v = e.target.value; if (v === 'no') setEx(i, { isRequirement: false, category: undefined, strength: undefined }); else { const [c, s] = v.split('|'); setEx(i, { isRequirement: true, category: c as TenderCategory, strength: (s || undefined) as Strength | undefined }); } }}>
                    <option value="no">不是要求</option>
                    {TENDER_CATEGORIES.flatMap((c) => Object.entries(STRENGTH_LABEL).map(([s, l]) => <option key={c.key + s} value={`${c.key}|${s}`}>{c.label} · {l}</option>))}
                  </select>
                  <span className={'rp-tag is-' + tone}>{src}</span>
                  {x.note && <small title={x.note}>{x.note}</small>}
                  <span className="rp-grow" />
                  <label className="tp-switch" title={x.enabled ? '已启用' : '已停用'}><input type="checkbox" checked={x.enabled} onChange={(e) => setEx(i, { enabled: e.target.checked })} /><i /></label>
                  <button className="rp-icon" title="删除" onClick={() => up({ examples: value.examples.filter((_, j) => j !== i) })}><Trash2 size={13} /></button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const ruleTag = (r: Record<string, unknown>): [string, string] | null => {
  if (r.strength) return [STRENGTH_LABEL[r.strength as Strength].replace('禁止 / ', ''), r.strength === 'prohibited' ? 'red' : r.strength === 'mandatory' ? 'dark' : 'gray'];
  if (r.severity) return [`${SEV_LABEL[r.severity as Severity]}风险`, r.severity === 'high' ? 'red' : r.severity === 'medium' ? 'orange' : 'gray'];
  if (r.category) return [CAT_LABEL[r.category as TenderCategory], 'gray'];
  if (r.role) return [ROLE_LABEL[r.role as FileRole], 'gray'];
  if (r.level) return [`${r.level} 级`, 'gray'];
  return null;
};
const ruleLine = (r: Record<string, unknown>) => { const kws = [...((r.keywords as string[]) || []), ...((r.namePatterns as string[]) || []), ...((r.contentKeywords as string[]) || [])]; return kws.length ? kws.join(' | ') + (r.pattern ? '  + 高级正则' : '') : String(r.pattern ?? ''); };
function RuleList<T extends { id: string; enabled: boolean }>({ items, onChange, add, render, addLabel = '新增规则' }: {
  items: T[]; onChange: (v: T[]) => void; add: () => T; render: (r: T, up: (p: Partial<T>) => void) => React.ReactNode; addLabel?: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="rp-rule-list">
      {items.map((r, i) => {
        const up = (p: Partial<T>) => onChange(items.map((x, j) => (j === i ? { ...x, ...p } : x)));
        const rec = r as unknown as Record<string, unknown>;
        const tag = ruleTag(rec);
        return (
          <div key={r.id} className={'rp-rule' + (r.enabled ? '' : ' off') + (open === r.id ? ' open' : '')}>
            <div className="rp-rule-row" onClick={() => setOpen(open === r.id ? null : r.id)}>
              <label className="tp-switch" title={r.enabled ? '已启用' : '已停用'} onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={r.enabled} onChange={(e) => up({ enabled: e.target.checked } as Partial<T>)} /><i /></label>
              <span className="rp-rule-main"><b>{String(rec.label || rec.key || '')}</b><code>{ruleLine(rec) || '—'}</code></span>
              {tag && <span className={'rp-tag is-' + tag[1]}>{tag[0]}</span>}
              <button className="rp-icon" title="删除" onClick={(e) => { e.stopPropagation(); onChange(items.filter((_, j) => j !== i)); }}><Trash2 size={13} /></button>
            </div>
            {open === r.id && <div className="tp-rule-grid rp-rule-edit">{render(r, up)}</div>}
          </div>
        );
      })}
      <button className="rp-link rp-add" onClick={() => { const n = add(); onChange([...items, n]); setOpen(n.id); }}>+ {addLabel}</button>
    </div>
  );
}

/** 关键词编辑：日常只填词；自动生成的正则只读展示；手写正则收在「高级」里 */
function Keywords({ value, onChange, pattern, onPattern }: { value: string[]; onChange: (v: string[]) => void; pattern: string; onPattern: (v: string) => void }) {
  const [adv, setAdv] = useState(!!pattern && !value.length);
  const gen = keywordsPattern(value);
  return (<>
    <Row label={`关键词 · ${value.length}`} wide><Tags values={value} onChange={onChange} /></Row>
    {gen && <Row label="自动生成" wide><code className="rp-gen">{gen}</code></Row>}
    <Row label="" wide>{adv ? <div className="rp-adv"><span className="rp-muted">高级：手写正则（和关键词任一命中即算）</span><Regex value={pattern} onChange={onPattern} /></div> : <button className="rp-link" onClick={() => setAdv(true)}>{pattern ? '查看高级正则' : '高级：手写正则'}</button>}</Row>
  </>);
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

function RuleTester({ api, draft, dirty, onClose, onAddWord }: { api: Api; draft: TenderRuleSet; dirty: boolean; onClose: () => void; onAddWord?: (kind: 'prohibited' | 'mandatory' | 'required' | 'risk', word: string) => void }) {
  const [text, setText] = useState(SAMPLE_TEXT);
  const [pick, setPick] = useState('');
  // 在结果里选中一段原文 → 一键加成关键词，加完自动重跑
  const onSelect = () => { const s = (window.getSelection()?.toString() || '').replace(/\s+/g, ' ').trim(); setPick(s.length >= 2 && s.length <= 60 ? s : ''); };
  const add = (kind: 'prohibited' | 'mandatory' | 'required' | 'risk') => { onAddWord?.(kind, pick); setPick(''); window.getSelection()?.removeAllRanges(); };
  useEffect(() => { if (res) void run(); }, [draft.mandatory, draft.risks]);
  const [res, setRes] = useState<{ clauses: RulePreviewClause[]; sections: string[] } | null>(null);
  const [err, setErr] = useState('');
  async function run() {
    setErr('');
    try { setRes(await api('/tender/rules/preview', { method: 'POST', body: { text, rules: draft } })); }
    catch (e) { setErr((e as Error).message); }
  }
  return (
    <aside className="rp-card rp-tester">
      <div className="rp-group-head"><FlaskConical size={14} /><b>试跑</b><small>{dirty ? '用页面上未保存的规则' : '用当前已保存的规则'}，不落库</small><span className="rp-grow" /><button className="rp-icon" title="收起" onClick={onClose}><X size={13} /></button></div>
      <textarea className="rp-tester-in" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
      <div className="rp-tester-bar"><span className="rp-grow">{err && <span className="is-red">{err}</span>}</span><button className="rp-btn primary" onClick={run}><Play size={13} />运行</button></div>
      {res && <small className="rp-muted">识别到 {res.sections.length} 个章节、{res.clauses.length} 条条款</small>}
      {onAddWord && (pick
        ? <div className="rp-pick"><span>已选中「<b>{pick}</b>」加为</span><button className="rp-chip is-red" onClick={() => add('prohibited')}>否决词</button><button className="rp-chip is-dark" onClick={() => add('mandatory')}>强制词</button><button className="rp-chip is-gray" onClick={() => add('required')}>一般要求词</button><button className="rp-chip is-orange" onClick={() => add('risk')}>风险词</button><button className="rp-icon" onClick={() => setPick('')}><X size={12} /></button></div>
        : res && <small className="rp-muted">在下面的原文里选中一段文字，可以直接加成关键词</small>)}
      <div className="rp-tester-out" onMouseUp={onSelect}>
        {!res && <p className="rp-hint">贴一段招标文件原文，点「运行」看每条条款被切成什么、命中了哪些规则。</p>}
        {res?.clauses.map((c, i) => (
          <div key={i} className="rp-pv">
            <div className="rp-pv-text">{c.text}</div>
            <small>规则：{c.category ? `${CAT_LABEL[c.category]}（${c.score} 分）` : '未分类'}{c.strength ? ` · ${STRENGTH_LABEL[c.strength]}` : ''}{c.risks.length ? ` · 风险 ${c.risks.join('、')}` : ''}{c.fields.length ? ` · ${c.fields.map((f) => `${f.label}：${f.value}`).join('；')}` : ''}</small>
          </div>
        ))}
      </div>
    </aside>
  );

}

