import { z } from 'zod';
import { get, list, now, put } from '../db.ts';
import { AppError } from '../../../../packages/contracts/index.ts';
import type { User } from '../../../../packages/contracts/index.ts';
import type { TenderRuleSet } from '../../../../packages/contracts/tender.ts';
import { DEFAULT_RULES } from './default-rules.ts';

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

export const ruleSetSchema = z.object({
  version: z.number().int().min(0),
  fileRoles: z.array(z.object({
    id, label, enabled: z.boolean(), precedence: z.number().min(0).max(100), extractClauses: z.boolean(),
    role: z.enum(['notice', 'itb', 'contract', 'technical_spec', 'amendment', 'clarification', 'boq', 'drawing', 'form', 'integrity', 'result', 'reference', 'other']),
    namePatterns: z.array(regex).max(50), contentKeywords: words,
  })),
  headings: z.array(z.object({ id, label, pattern: regex, level: z.number().int().min(1).max(4), enabled: z.boolean() })),
  categories: z.array(z.object({ id, label, category, keywords: words, weight: z.number().min(0).max(10), enabled: z.boolean() })),
  mandatory: z.array(z.object({ id, label, pattern: regex, strength: z.enum(['mandatory', 'prohibited', 'recommended']), enabled: z.boolean() })),
  fields: z.array(z.object({
    id, label, key: z.string().regex(/^[a-z][a-z0-9_]*$/, '字段 key 只能用小写字母、数字、下划线'), pattern: regex,
    normalize: z.enum(['number', 'date', 'text']), unit: z.string().max(20).optional(), checkConflict: z.boolean(), enabled: z.boolean(),
  }).superRefine((f, ctx) => {
    if (!/\((?!\?)/.test(f.pattern)) ctx.addIssue({ code: 'custom', message: `字段「${f.label}」的正则需要一个捕获组 (...) 作为取值` });
  })),
  risks: z.array(z.object({ id, label, pattern: regex, severity: z.enum(['high', 'medium', 'low']), category, advice: z.string().max(300), enabled: z.boolean() })),
  owners: z.array(z.object({ category, role, reviewer: role, dueOffsetDays: z.number().int().min(0).max(60) })),
  options: z.object({
    minCharsPerPage: z.number().int().min(0).max(2000),
    maxPagesPerFile: z.number().int().min(1).max(2000),
    clauseMinLength: z.number().int().min(4).max(400),
    clauseMaxLength: z.number().int().min(80).max(4000),
    minCategoryScore: z.number().min(0).max(50),
  }),
});

function seedDefault(): TenderRuleSet {
  return structuredClone({ ...DEFAULT_RULES, version: 1, updatedAt: now(), updatedBy: '系统默认' });
}

export function getRules(): TenderRuleSet {
  const cur = get<TenderRuleSet>('tender_rules', ACTIVE);
  if (cur) return cur;
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

export function ruleHistory() {
  return list<TenderRuleSet>('tender_rules_history')
    .map((r) => ({ version: r.version, updatedAt: r.updatedAt, updatedBy: r.updatedBy }))
    .sort((a, b) => b.version - a.version)
    .slice(0, 30);
}

export function restoreRules(user: User, version: number): TenderRuleSet {
  const old = get<TenderRuleSet>('tender_rules_history', `v${version}`);
  if (!old) throw new AppError('NOT_FOUND', `没有 v${version} 的规则快照`, 404);
  const cur = getRules();
  const next: TenderRuleSet = { ...structuredClone(old), version: cur.version + 1, updatedAt: now(), updatedBy: `${user.name}（回滚到 v${version}）` };
  put('tender_rules', ACTIVE, next);
  put('tender_rules_history', `v${next.version}`, next);
  return next;
}
