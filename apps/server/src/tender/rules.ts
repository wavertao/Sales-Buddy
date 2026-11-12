import { z } from 'zod';
import { get, list, now, put } from '../db.ts';
import { AppError } from '../../../../packages/contracts/index.ts';
import type { User } from '../../../../packages/contracts/index.ts';
import type { TenderRuleSet } from '../../../../packages/contracts/tender.ts';
import { DEFAULT_RULES } from './default-rules.ts';
import { DEFAULT_GUARDS, DEFAULT_ITEMS } from './default-checklist.ts';

/** 规则存储：documents 表 tender_rules/active 存当前版本，tender_rules_history/v{n} 留每次保存的快照。 */
const ACTIVE = 'active';

const id = z.string().min(1).max(60);
const label = z.string().min(1, '名称不能为空').max(80);
const words = z.array(z.string().min(1).max(120)).max(200);
const category = z.enum(['technical', 'delivery', 'price', 'commercial', 'deviation']);
const role = z.enum(['SLS', 'PM', 'SC', 'QA', 'AMD', 'BSD']);
const regex = z.string().min(1, '正则不能为空').max(600).superRefine((s, ctx) => {
  try { new RegExp(s, 'iu'); } catch (e) { ctx.addIssue({ code: 'custom', message: `正则无效：${s}（${(e as Error).message}）` }); }
});

/** 强制项和风险规则可以只填关键词，正则留空 */
const optionalRegex = z.string().max(600).superRefine((s, ctx) => {
  if (!s) return;
  try { new RegExp(s, 'iu'); } catch (e) { ctx.addIssue({ code: 'custom', message: `正则无效：${s}（${(e as Error).message}）` }); }
});
const needsMatcher = (r: { label: string; pattern: string; keywords?: string[] }, ctx: z.RefinementCtx) => {
  if (!r.pattern.trim() && !(r.keywords || []).some((k) => k.trim())) ctx.addIssue({ code: 'custom', message: `规则「${r.label}」至少要填一个关键词` });
};

export const ruleSetSchema = z.object({
  version: z.number().int().min(0),
  fileRoles: z.array(z.object({
    id, label, enabled: z.boolean(), precedence: z.number().min(0).max(100), extractClauses: z.boolean(),
    role: z.enum(['notice', 'itb', 'contract', 'technical_spec', 'amendment', 'clarification', 'boq', 'drawing', 'form', 'integrity', 'result', 'reference', 'other']),
    namePatterns: z.array(regex).max(50), contentKeywords: words,
  })),
  headings: z.array(z.object({ id, label, pattern: regex, level: z.number().int().min(1).max(4), enabled: z.boolean() })),
  categories: z.array(z.object({ id, label, category, keywords: words, weight: z.number().min(0).max(10), enabled: z.boolean() })),
  mandatory: z.array(z.object({ id, label, pattern: optionalRegex, keywords: words.optional(), strength: z.enum(['prohibited', 'mandatory', 'required', 'recommended']), enabled: z.boolean() }).superRefine(needsMatcher)),
  fields: z.array(z.object({
    id, label, key: z.string().regex(/^[a-z][a-z0-9_]*$/, '字段 key 只能用小写字母、数字、下划线'), pattern: regex,
    normalize: z.enum(['number', 'date', 'text']), unit: z.string().max(20).optional(), checkConflict: z.boolean(), enabled: z.boolean(),
  }).superRefine((f, ctx) => {
    if (!/\((?!\?)/.test(f.pattern)) ctx.addIssue({ code: 'custom', message: `字段「${f.label}」的正则需要一个捕获组 (...) 作为取值` });
  })),
  risks: z.array(z.object({ id, label, pattern: optionalRegex, keywords: words.optional(), severity: z.enum(['high', 'medium', 'low']), category, advice: z.string().max(300), enabled: z.boolean() }).superRefine(needsMatcher)),
  owners: z.array(z.object({ category, role, reviewer: role, dueOffsetDays: z.number().int().min(0).max(60) })),
  options: z.object({
    minCharsPerPage: z.number().int().min(0).max(2000),
    maxPagesPerFile: z.number().int().min(1).max(2000),
    clauseMinLength: z.number().int().min(4).max(400),
    clauseMaxLength: z.number().int().min(80).max(4000),
    minCategoryScore: z.number().min(0).max(50),
  }),
  judge: z.object({
    enabled: z.boolean(),
    prompt: z.string().min(1, '提示词不能为空').max(8000),
    policies: z.array(z.string().min(1).max(300)).max(100),
    examples: z.array(z.object({
      id, text: z.string().min(1, '示例原文不能为空').max(1200), isRequirement: z.boolean(), category: category.optional(),
      strength: z.enum(['prohibited', 'mandatory', 'required', 'recommended']).optional(), note: z.string().max(300).optional(), enabled: z.boolean(),
    })).max(200),
    batchSize: z.number().int().min(1).max(100),
    concurrency: z.number().int().min(1).max(20),
    minConfidence: z.number().min(0).max(1),
  }),
  items: z.array(z.object({
    id, category, name: label, ask: z.string().max(600), focus: z.array(z.string().min(1).max(300)).max(20),
    levels: z.array(z.object({ level: z.enum(['prohibited', 'high', 'review']), when: z.string().min(1).max(300) })).max(6),
    checks: z.array(z.object({
      id, field: z.string().min(1, '数值名称不能为空').max(60), unit: z.string().max(10).optional(),
      op: z.enum(['>', '>=', '<', '<=', 'missing']), value: z.number().optional(), result: z.enum(['prohibited', 'high', 'review']),
    }).superRefine((c, ctx) => { if (c.op !== 'missing' && typeof c.value !== 'number') ctx.addIssue({ code: 'custom', message: `校验「${c.field}」要填阈值` }); })).max(10),
    terms: words, owner: role.optional(), enabled: z.boolean(),
  })).max(200).optional(),
  guards: z.object({
    mustWords: z.array(z.object({ id, word: z.string().min(2, '必查词至少 2 个字').max(60), level: z.enum(['prohibited', 'mandatory', 'risk']), category: category.optional(), source: z.string().max(80).optional(), enabled: z.boolean() })).max(300),
    standards: z.array(z.object({ id, code: z.string().min(2).max(40), status: z.enum(['have', 'missing', 'version']), expires: z.string().max(20).optional(), note: z.string().max(200).optional() })).max(300),
  }).optional(),
});

function seedDefault(): TenderRuleSet {
  return structuredClone({ ...DEFAULT_RULES, items: DEFAULT_ITEMS, guards: DEFAULT_GUARDS, version: 1, updatedAt: now(), updatedBy: '系统默认' });
}

/** 早期保存的规则没有 judge / 审查清单 / 兜底规则，读取时补上默认值。 */
const withJudge = (r: TenderRuleSet): TenderRuleSet => ({
  ...r,
  judge: r.judge || structuredClone(DEFAULT_RULES.judge),
  items: r.items || structuredClone(DEFAULT_ITEMS),
  guards: r.guards || structuredClone(DEFAULT_GUARDS),
});

export function getRules(): TenderRuleSet {
  const cur = get<TenderRuleSet>('tender_rules', ACTIVE);
  // 从没人改过的系统默认规则跟着代码里的默认值走（默认规则升级后自动生效）；改过的版本保持不动
  const body = ({ version: _v, updatedAt: _a, updatedBy: _b, ...r }: TenderRuleSet) => JSON.stringify(r);
  const stale = cur && cur.updatedBy === '系统默认' && body(cur) !== body(seedDefault());
  if (cur && !stale) return withJudge(cur);
  if (stale) { const next = { ...seedDefault(), version: cur.version }; put('tender_rules', ACTIVE, next); put('tender_rules_history', `v${next.version}`, next); return next; }
  const seeded = seedDefault();
  put('tender_rules', ACTIVE, seeded);
  put('tender_rules_history', `v${seeded.version}`, seeded);
  return seeded;
}

/** 乐观锁：提交的 version 必须等于当前版本，避免两人同时改互相覆盖。 */
export function saveRules(user: User, body: unknown): TenderRuleSet {
  const parsed = ruleSetSchema.parse(body);
  const cur = getRules();
  if (parsed.version !== cur.version) throw new AppError('CONFLICT', `规则已被他人更新到 v${cur.version}，请刷新后再改`, 409);
  const ids = new Set<string>();
  for (const group of [parsed.fileRoles, parsed.headings, parsed.categories, parsed.mandatory, parsed.fields, parsed.risks]) {
    for (const r of group) { if (ids.has(r.id)) throw new AppError('INVALID_ARGUMENT', `规则编号重复：${r.id}`, 400); ids.add(r.id); }
  }
  if (parsed.options.clauseMinLength >= parsed.options.clauseMaxLength) throw new AppError('INVALID_ARGUMENT', '条款最短长度必须小于最长长度', 400);
  const next: TenderRuleSet = { ...parsed, version: cur.version + 1, updatedAt: now(), updatedBy: user.name };
  put('tender_rules', ACTIVE, next);
  put('tender_rules_history', `v${next.version}`, next);
  return next;
}

export function resetRules(user: User): TenderRuleSet {
  const cur = getRules();
  const next: TenderRuleSet = { ...seedDefault(), version: cur.version + 1, updatedBy: `${user.name}（恢复默认）` };
  put('tender_rules', ACTIVE, next);
  put('tender_rules_history', `v${next.version}`, next);
  return next;
}

/** 程序发布一版（采纳改进建议、示例自动生效）：在当前版本上改，版本号加一，写明改了什么 */
export function publishRules(by: string, note: string, mutate: (r: TenderRuleSet) => TenderRuleSet): TenderRuleSet {
  const cur = getRules();
  const next: TenderRuleSet = { ...mutate(structuredClone(cur)), version: cur.version + 1, updatedAt: now(), updatedBy: by, changeNote: note };
  put('tender_rules', ACTIVE, next);
  put('tender_rules_history', `v${next.version}`, next);
  return next;
}
/** 「从原文加词」：把选中的一段原文加进对应的关键词规则（没有就新建一条），直接发布成新版本 */
export type KeywordKind = 'prohibited' | 'mandatory' | 'required' | 'risk';
const KW_LABEL: Record<KeywordKind, string> = { prohibited: '从原文添加的否决词', mandatory: '从原文添加的强制词', required: '从原文添加的一般要求词', risk: '从原文添加的风险词' };
export function addKeyword(user: User, kind: KeywordKind, word: string): TenderRuleSet {
  const w = word.replace(/\s+/g, ' ').trim();
  if (w.length < 2 || w.length > 60) throw new AppError('INVALID_ARGUMENT', '关键词请选 2 到 60 个字', 400);
  const id = `kw-${kind}`;
  return publishRules(user.name, `从原文加词：「${w}」（${KW_LABEL[kind].replace('从原文添加的', '')}）`, (r) => {
    if (kind === 'risk') {
      const cur = r.risks.find((x) => x.id === id) || { id, label: KW_LABEL.risk, pattern: '', keywords: [], severity: 'medium' as const, category: 'commercial' as const, advice: '从原文添加，请补充处理建议', enabled: true };
      const next = { ...cur, enabled: true, keywords: [...new Set([...(cur.keywords || []), w])] };
      return { ...r, risks: r.risks.some((x) => x.id === id) ? r.risks.map((x) => (x.id === id ? next : x)) : [...r.risks, next] };
    }
    const cur = r.mandatory.find((x) => x.id === id) || { id, label: KW_LABEL[kind], pattern: '', keywords: [], strength: kind, enabled: true };
    const next = { ...cur, enabled: true, keywords: [...new Set([...(cur.keywords || []), w])] };
    return { ...r, mandatory: r.mandatory.some((x) => x.id === id) ? r.mandatory.map((x) => (x.id === id ? next : x)) : [...r.mandatory, next] };
  });
}
export const ruleSnapshot = (version: number) => get<TenderRuleSet>('tender_rules_history', `v${version}`);

export function ruleHistory() {
  return list<TenderRuleSet>('tender_rules_history')
    .map((r) => ({ version: r.version, updatedAt: r.updatedAt, updatedBy: r.updatedBy, changeNote: r.changeNote || '', policies: r.judge?.policies.length ?? 0, examples: r.judge?.examples.filter((e) => e.enabled).length ?? 0,
      // 版本对比用：口径原文和几项判断参数
      policyList: r.judge?.policies ?? [], batchSize: r.judge?.batchSize, concurrency: r.judge?.concurrency, minConfidence: r.judge?.minConfidence, rules: r.mandatory.length + r.categories.length + r.risks.length + r.fields.length + r.headings.length + r.fileRoles.length }))
    .sort((a, b) => b.version - a.version)
    .slice(0, 30);
}

export function restoreRules(user: User, version: number): TenderRuleSet {
  const old = get<TenderRuleSet>('tender_rules_history', `v${version}`);
  if (!old) throw new AppError('NOT_FOUND', `没有 v${version} 的规则快照`, 404);
  const cur = getRules();
  const next: TenderRuleSet = { ...structuredClone(withJudge(old)), version: cur.version + 1, updatedAt: now(), updatedBy: `${user.name}（回滚到 v${version}）` };
  put('tender_rules', ACTIVE, next);
  put('tender_rules_history', `v${next.version}`, next);
  return next;
}
