import { now, uid } from '../db.ts';
import type {
  DecompItem, ExcludedClause, FieldHit, FieldSummary, FileRole, JudgeSummary, OverrideLink, ParsedFile, RulePreviewClause, Severity, Strength,
  TenderCategory, TenderParseResult, TenderProgress, TenderRuleSet, TeamRole,
} from '../../../../packages/contracts/tender.ts';
import { TENDER_CATEGORIES } from '../../../../packages/contracts/tender.ts';
import { extOf, extractFile, HEADING_MARK, newDedupe, type Extracted, type SourceFile } from './extract.ts';
import { clauseKey, type Candidate, type JudgeOutcome, type JudgeRunner } from './judge.ts';
import { mergeVerdict, type Merged } from './merge.ts';

/**
 * 标书解析流水线（不传 judge 时是纯规则，可复现）：
 *   1 抽取：extract.ts 把每个文件变成按页文本
 *   2 文件角色：文件名正则 + 前两页关键词打分，决定效力顺序和是否拆条款
 *   3 章节切分：标题正则把正文切成章节，再按列表项 / 句末把章节切成条款
 *   4 条款打标：五类分类得分、强制项强度、风险命中
 *   5 包级汇总：关键字段（多文件取值对比 → 采用值 / 被修订 / 矛盾）、修订与澄清对原条款的引用、拆标分解表（责任角色 + 倒排截止）
 * 规则全部来自 TenderRuleSet，本文件不写死业务口径。
 * 传了 judge 时第 4 步多一道：规则放宽筛出候选，模型逐批判断，merge.ts 决定采纳谁的结论。
 */

const MAX_ITEMS = 1500;
const MAX_OVERRIDES = 200;
const CLAUSE_TEXT_CAP = 600;
const STRENGTH_RANK: Record<Strength, number> = { prohibited: 4, mandatory: 3, required: 2, recommended: 1 };
const SEVERITY_RANK: Record<Severity, number> = { high: 3, medium: 2, low: 1 };

const safe = (src: string, flags = 'iu'): RegExp | null => { try { return new RegExp(src, flags); } catch { return null; } };
/** 关键词转正则：英文开头的词加左边界（cell 不该命中 cancellation），其余按原样（允许 non-?compliance 这类简写）。 */
const keywordRe = (kw: string) => safe((/^[A-Za-z]/.test(kw) ? '\\b' : '') + kw, 'giu');

type Compiled = ReturnType<typeof compile>;
export function compile(rules: TenderRuleSet) {
  const on = <T extends { enabled: boolean }>(xs: T[]) => xs.filter((x) => x.enabled);
  return {
    rules,
    roles: on(rules.fileRoles).map((r) => ({
      rule: r,
      names: r.namePatterns.map((p) => safe(p)).filter(Boolean) as RegExp[],
      kws: r.contentKeywords.map((k) => keywordRe(k)).filter(Boolean) as RegExp[],
    })),
    headings: on(rules.headings).map((h) => ({ rule: h, re: safe(h.pattern) })).filter((h) => h.re) as { rule: TenderRuleSet['headings'][number]; re: RegExp }[],
    categories: on(rules.categories).map((c) => ({ rule: c, kws: c.keywords.map(keywordRe).filter(Boolean) as RegExp[] })),
    mandatory: on(rules.mandatory).map((m) => ({ rule: m, re: safe(m.pattern) })).filter((m) => m.re) as { rule: TenderRuleSet['mandatory'][number]; re: RegExp }[],
    fields: on(rules.fields).map((f) => ({ rule: f, re: safe(f.pattern, 'giu') })).filter((f) => f.re) as { rule: TenderRuleSet['fields'][number]; re: RegExp }[],
    risks: on(rules.risks).map((r) => ({ rule: r, re: safe(r.pattern) })).filter((r) => r.re) as { rule: TenderRuleSet['risks'][number]; re: RegExp }[],
    owners: new Map(rules.owners.map((o) => [o.category, o])),
  };
}

// ---------- 2 文件角色 ----------
function classifyRole(c: Compiled, f: Extracted): { role: FileRole; label: string; score: number; precedence: number; extract: boolean } {
  const head = f.pages.slice(0, 2).map((p) => p.text).join('\n').slice(0, 8000);
  // 整包里的文件夹名（如「A.2 SLD」「Appendix B - Returnable Schedules」）也说明了文件是什么
  const folder = f.path.split('/').slice(0, -1).join('/');
  let best = { role: 'other' as FileRole, label: '其他', score: 0, precedence: 25, extract: true };
  for (const { rule, names, kws } of c.roles) {
    let score = 0;
    for (const re of names) { if (re.test(f.name)) score += 3; else if (folder && re.test(folder)) score += 2; }
    for (const re of kws) { re.lastIndex = 0; if (re.test(head)) score += 1; }
    if (score > best.score || (score === best.score && score > 0 && rule.precedence > best.precedence)) {
      best = { role: rule.role, label: rule.label, score, precedence: rule.precedence, extract: rule.extractClauses };
    }
  }
  return best;
}

// ---------- 3 章节与条款切分 ----------
type Section = { title: string; number?: string; page: number };
type Clause = { text: string; page: number; section: Section };

const ENUM_START = /^\s*(\(?[a-zA-Z]\)|\(?[ivxIVX]{1,4}\)|\(\d{1,2}\)|（\d{1,2}）|\d{1,2}[)、]|[•●▪◆■]\s|-\s|o\s+(?=[A-Z]))/;
const SENTENCE_SPLIT = /(?<=[。；;！？])|(?<=\.)\s+(?=[A-Z(])/u;

function sectionNumber(title: string): string | undefined {
  const m = title.match(/^\s*(?:section|clause|article|chapter|annexure|appendix|part)?\s*([0-9]{1,2}(?:\.[0-9]{1,3}){0,4})\b/i);
  if (m) return m[1];
  const cn = title.match(/^\s*第\s*([一二三四五六七八九十百零〇\d]+)\s*[章节条卷]/);
  return cn ? cn[1] : undefined;
}

function joinLine(a: string, b: string): string {
  if (!a) return b;
  const cjk = /[一-龥，。；：、）]$/.test(a) && /^[一-龥（]/.test(b);
  return a + (cjk ? '' : ' ') + b;
}

export function segment(c: Compiled, pages: { page: number; text: string }[]): { sections: Section[]; clauses: Clause[] } {
  const { clauseMinLength: min, clauseMaxLength: max } = c.rules.options;
  const sections: Section[] = [];
  const clauses: Clause[] = [];
  let section: Section = { title: '（文首）', page: pages[0]?.page ?? 1 };
  let buf = '';
  let bufPage = section.page;
  // 「The Supplier must:」后面跟一串列表项：列表项单看没有主语和情态词，带上这句引导语才判得出强度
  let lead: string | undefined;
  let bufEnum = false;
  const LEAD_CAP = 160;

  const pushPiece = (text: string, page: number) => {
    const t = text.replace(/\s+/g, ' ').trim();
    if (!t) return;
    const last = clauses[clauses.length - 1];
    if (t.length < min && last && last.section === section && last.text.length + t.length < max) { last.text += ' ' + t; return; }
    if (t.length < min) return;
    clauses.push({ text: t, page, section });
  };
  const flush = () => {
    if (!buf.trim()) { buf = ''; return; }
    const prefix = bufEnum && lead ? lead + ' ' : '';
    if (buf.length <= max) pushPiece(prefix + buf, bufPage);
    else {
      let cur = '';
      for (const s of buf.split(SENTENCE_SPLIT)) {
        if (cur.length + s.length > max && cur) { pushPiece(prefix + cur, bufPage); cur = ''; }
        cur += s;
      }
      pushPiece(prefix + cur.slice(0, max * 2), bufPage);
    }
    // 普通段落以冒号结尾就是新的引导语；普通段落不以冒号结尾，说明列表结束了
    if (!bufEnum) {
      const tail = buf.trim().split(SENTENCE_SPLIT).pop()!.trim();
      lead = /[:：]$/.test(tail) ? tail.slice(-LEAD_CAP) : undefined;
    }
    buf = '';
    bufEnum = false;
  };

  for (const p of pages) {
    for (const raw of p.text.split(/\n/)) {
      // 抽取层已认出的标题（Word 标题样式）直接当章节标题
      const marked = raw.startsWith(HEADING_MARK);
      const line = raw.replace(HEADING_MARK, '').replace(/\s+/g, ' ').trim();
      if (!line) { flush(); continue; }
      if (/^(page\s*)?\d{1,4}(\s*(of|\/)\s*\d{1,4})?$/i.test(line) || /^第\s*\d+\s*页/.test(line)) continue; // 页码行
      if (/(\.{5,}|…{3,}|·{5,})\s*\d{1,4}\s*$/.test(line)) continue; // 目录行（点引导线 + 页码）
      const isHeading = line.length <= 120 && (marked || c.headings.some((h) => h.re.test(line)));
      if (isHeading) {
        flush();
        lead = undefined;
        section = { title: line.slice(0, 90), number: sectionNumber(line), page: p.page };
        sections.push(section);
        bufPage = p.page;
        // 「5.2 违约金按……。」这种带编号的整句既开新章节，本身也是一条条款
        const clauseLike = line.length > 50 || /[。；;]$/.test(line);
        if (!clauseLike) continue;
      }
      if (ENUM_START.test(line)) { flush(); bufPage = p.page; bufEnum = true; }
      if (!buf) bufPage = p.page;
      buf = joinLine(buf, line);
      // 没有句末标点的长段（数据表、图纸文字）也要及时切，否则缓冲区越拼越长，整段耗时会平方增长
      if ((/[。；;]$/.test(line) && buf.length >= min) || buf.length > max * 4) flush();
    }
  }
  flush();
  return { sections, clauses };
}

// ---------- 4 条款打标 ----------
/** 强制项没命中任何分类词时的兜底类别：按所在文件的性质 */
const ROLE_DEFAULT_CATEGORY: Record<FileRole, TenderCategory> = {
  technical_spec: 'technical', drawing: 'technical', boq: 'price',
  notice: 'commercial', itb: 'commercial', contract: 'commercial', amendment: 'commercial', clarification: 'commercial',
  form: 'commercial', integrity: 'commercial', result: 'commercial', reference: 'technical', other: 'commercial',
};
function countHits(re: RegExp, text: string, cap = 3): number {
  re.lastIndex = 0;
  let n = 0;
  while (n < cap && re.exec(text)) n++;
  re.lastIndex = 0;
  return n;
}

export function tagClause(c: Compiled, text: string, sectionTitle: string) {
  const scores = Object.fromEntries(TENDER_CATEGORIES.map((k) => [k.key, 0])) as Record<TenderCategory, number>;
  for (const { rule, kws } of c.categories) {
    let s = 0;
    for (const re of kws) s += countHits(re, text) + countHits(re, sectionTitle, 1);
    scores[rule.category] += s * rule.weight;
  }
  let strength: Strength | undefined;
  let mandatoryRule: string | undefined;
  for (const { rule, re } of c.mandatory) {
    if (re.test(text) && (!strength || STRENGTH_RANK[rule.strength] > STRENGTH_RANK[strength])) { strength = rule.strength; mandatoryRule = rule.label; }
  }
  const risks = c.risks.filter(({ re }) => re.test(text)).map(({ rule }) => rule);
  let category: TenderCategory | undefined;
  let score = 0;
  for (const k of TENDER_CATEGORIES) if (scores[k.key] > score) { score = scores[k.key]; category = k.key; }
  if (!category && risks.length) category = risks[0].category;
  return { scores, score: Math.round(score * 10) / 10, category, strength, mandatoryRule, risks };
}

// ---------- 5 字段 ----------
const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n: number) => String(n).padStart(2, '0');
function normalizeDate(v: string): string {
  let m = v.match(/(\d{4})\s*[-./年]\s*(\d{1,2})\s*[-./月]\s*(\d{1,2})/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = v.match(/(\d{1,2})\s*[-./]\s*(\d{1,2})\s*[-./]\s*(\d{4})/);
  if (m) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`; // 日在前（印度 / 英式）
  m = v.match(/(\d{1,2})\s*(?:st|nd|rd|th)?\s+([A-Za-z]{3})[a-z]*,?\s+(\d{4})/);
  if (m && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${pad(MONTHS[m[2].toLowerCase()])}-${pad(+m[1])}`;
  m = v.match(/([A-Za-z]{3})[a-z]*\s+(\d{1,2}),\s+(\d{4})/);
  if (m && MONTHS[m[1].toLowerCase()]) return `${m[3]}-${pad(MONTHS[m[1].toLowerCase()])}-${pad(+m[2])}`;
  return v.trim();
}
function normalizeNumber(v: string, unit?: string): string {
  const n = Number((v.match(/\d[\d,]*(?:\.\d+)?/)?.[0] || '').replace(/,/g, ''));
  if (!Number.isFinite(n)) return v.trim();
  let x = n;
  if (/GWh/i.test(v) && unit === 'MWh') x = n * 1000;
  if (/GW(?!h)/i.test(v) && unit === 'MW') x = n * 1000;
  return `${Math.round(x * 1000) / 1000}${unit ? ' ' + unit : ''}`;
}
function normalizeField(rule: TenderRuleSet['fields'][number], v: string): string {
  if (rule.normalize === 'date') return normalizeDate(v);
  if (rule.normalize === 'number') return normalizeNumber(v, rule.unit);
  return v.replace(/\s+/g, ' ').trim().toLowerCase();
}

function extractFields(c: Compiled, file: ParsedFile, pages: { page: number; text: string }[]): FieldHit[] {
  const hits: FieldHit[] = [];
  for (const { rule, re } of c.fields) {
    let perFile = 0;
    for (const p of pages) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(p.text)) && perFile < 60) {
        const value = (m[1] || m[0]).replace(/\s+/g, ' ').trim();
        if (!value) { re.lastIndex++; continue; }
        perFile++;
        const at = m.index;
        hits.push({
          key: rule.key, label: rule.label, value, normalized: normalizeField(rule, value), unit: rule.unit,
          fileId: file.id, fileName: file.name, page: p.page, precedence: file.precedence,
          snippet: p.text.slice(Math.max(0, at - 50), at + m[0].length + 50).replace(/\s+/g, ' ').trim(),
        });
      }
    }
  }
  return hits;
}

function summarizeFields(c: Compiled, hits: FieldHit[]): FieldSummary[] {
  const out: FieldSummary[] = [];
  for (const { rule } of c.fields) {
    const hs = hits.filter((h) => h.key === rule.key);
    if (!hs.length) continue;
    const byVal = new Map<string, { normalized: string; value: string; files: Set<string>; count: number; prec: number }>();
    for (const h of hs) {
      const v = byVal.get(h.normalized) || { normalized: h.normalized, value: h.value, files: new Set<string>(), count: 0, prec: 0 };
      v.files.add(h.fileName); v.count++; v.prec = Math.max(v.prec, h.precedence);
      byVal.set(h.normalized, v);
    }
    const vals = [...byVal.values()].sort((a, b) => b.count - a.count || b.prec - a.prec);
    // 采用值：修订 / 澄清（效力 ≥80）给出的值优先；否则取出现最多的值。
    // 不按「规范 > 正文」取：规范里多是单台设备、单个场站的分项数字，项目总量在正文和应答表里反复出现
    const amended = vals.filter((v) => v.prec >= 80).sort((a, b) => b.prec - a.prec || b.count - a.count);
    const adopted = amended[0] || vals[0];
    const top = vals[0];
    let status: FieldSummary['status'] = 'single';
    if (vals.length > 1) {
      // 采用值来自修订 / 澄清（效力 ≥80），且低效力文件里有别的值 → 原值已被修订
      if (adopted.prec >= 80 && vals.some((v) => v !== adopted && v.prec < adopted.prec)) status = 'overridden';
      // 次多值也反复出现（≥2 次且不少于最多值的 30%）才算矛盾，偶发的分项数字不报
      else if (rule.checkConflict && vals[1].count >= Math.max(2, top.count * 0.3)) status = 'conflict';
      // 其余取值多是分项（单个集装箱、单个场站），不算矛盾，但也不能叫「一致」
      else status = 'multiple';
    } else if (top.files.size > 1) status = 'consistent';
    out.push({
      key: rule.key, label: rule.label, unit: rule.unit, value: adopted.value, source: [...adopted.files][0],
      values: vals.slice(0, 6).map((v) => ({ normalized: v.normalized, value: v.value, files: [...v.files].slice(0, 6) })),
      status,
    });
  }
  return out;
}

// ---------- 修订 / 澄清引用 ----------
const REF_RE = /\b(?:clause|section|article|para(?:graph)?|annexure|appendix|sl\.?\s*no\.?)\s*(?:no\.?\s*)?([0-9]{1,2}(?:\.[0-9]{1,3}){0,4}|[A-Z]{1,3}-?[0-9]{0,2})\b|第\s*([一二三四五六七八九十百零〇\d]+(?:\.\d+)*)\s*[章节条款]|([0-9]{1,2}(?:\.[0-9]{1,3}){1,4})\s*[条款节]/giu;

function findOverrides(
  file: ParsedFile, role: FileRole, pages: { page: number; text: string }[],
  sectionIndex: Map<string, { fileName: string; section: string; page: number }>,
): OverrideLink[] {
  if (role !== 'amendment' && role !== 'clarification') return [];
  const out: OverrideLink[] = [];
  const seen = new Set<string>();
  for (const p of pages) {
    REF_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = REF_RE.exec(p.text)) && out.length < 120) {
      const ref = (m[1] || m[2] || m[3] || '').trim();
      if (!ref || seen.has(ref)) continue;
      seen.add(ref);
      out.push({
        fileId: file.id, fileName: file.name, role, page: p.page, ref: m[0].replace(/\s+/g, ' ').trim(),
        snippet: p.text.slice(Math.max(0, m.index - 40), m.index + 160).replace(/\s+/g, ' ').trim(),
        target: sectionIndex.get(ref),
      });
    }
  }
  return out;
}

// ---------- 主流程 ----------
const titleOf = (t: string) => {
  // 按句切，但太短的头一句（如「No.」「Note:」）继续拼下一句
  let first = '';
  for (const p of t.split(/(?<=[。；;:：])|(?<=\.)\s/u)) { first += (first ? ' ' : '') + p; if (first.length >= 14) break; }
  return first.length > 64 ? first.slice(0, 62) + '…' : first;
};
const addDays = (iso: string, days: number) => {
  const d = new Date(iso + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return undefined;
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
};

/** 分解表的统计项：解析和人工改判后都按这里重算。 */
export function itemStats(items: DecompItem[]) {
  const byCategory = Object.fromEntries(TENDER_CATEGORIES.map((k) => [k.key, items.filter((i) => i.category === k.key).length])) as Record<TenderCategory, number>;
  const risks = { high: 0, medium: 0, low: 0 } as Record<Severity, number>;
  for (const it of items) for (const r of it.risks) risks[r.severity]++;
  return { byCategory, risks, mandatory: items.filter((i) => i.strength === 'mandatory' || i.strength === 'prohibited').length };
}
/** 按责任分工规则带出负责、复核和倒排截止；改判换类别时也走这里。 */
export function ownerFields(rules: TenderRuleSet, category: TenderCategory, deadlineIso?: string) {
  const owner = rules.owners.find((o) => o.category === category);
  return {
    owner: (owner?.role || 'SLS') as TeamRole, reviewer: (owner?.reviewer || 'BSD') as TeamRole,
    dueDate: deadlineIso && owner ? addDays(deadlineIso, owner.dueOffsetDays) : undefined,
  };
}
export const deadlineOf = (fields: FieldSummary[]) => {
  const d = fields.find((f) => f.key === 'deadline');
  const iso = d?.values.find((v) => v.value === d.value)?.normalized || '';
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : undefined;
};
export const titleOfClause = (text: string) => titleOf(text);

export type ParseOptions = { judge?: JudgeRunner; onProgress?: (p: TenderProgress) => void; onExcluded?: (runId: string, excluded: ExcludedClause[]) => void };

export async function parsePackage(rules: TenderRuleSet, packageName: string, files: SourceFile[], source: 'sample' | 'upload', opts: ParseOptions = {}): Promise<TenderParseResult> {
  const t0 = Date.now();
  const progress = opts.onProgress || (() => undefined);
  const c = compile(rules);
  const { maxPagesPerFile, minCharsPerPage, minCategoryScore } = rules.options;
  const warnings: string[] = [];

  // 1 抽取
  // 整包里常见「文件夹 + 同内容的压缩包」：先抽散文件，压缩包里内容完全相同的文件跳过
  const extracted: Extracted[] = [];
  const dedupe = newDedupe();
  const ordered = [...files].sort((a, b) => Number(extOf(a.name) === 'zip') - Number(extOf(b.name) === 'zip'));
  for (const [i, f] of ordered.entries()) {
    progress({ stage: 'extract', done: i, total: files.length, message: `抽取 ${f.name}` });
    extracted.push(...(await extractFile(f, maxPagesPerFile, minCharsPerPage, dedupe)));
  }
  if (dedupe.skipped) warnings.push(`有 ${dedupe.skipped} 个文件内容重复（多为压缩包里和包外的同一文件），只解析了一次`);

  // 2 角色 + 3 切分
  type Work = { file: ParsedFile; ex: Extracted; extract: boolean; clauses: Clause[]; sections: Section[] };
  const work: Work[] = extracted.map((ex, i) => {
    const r = classifyRole(c, ex);
    const textPages = ex.pages.filter((p) => p.text.replace(/\s/g, '').length >= minCharsPerPage);
    const seg = r.extract && textPages.length ? segment(c, textPages) : { sections: [], clauses: [] };
    const file: ParsedFile = {
      id: `F${String(i + 1).padStart(2, '0')}`, name: ex.name, path: ex.path, ext: ex.ext, size: ex.size,
      status: ex.status, note: ex.note, pages: ex.totalPages, textPages: textPages.length,
      chars: textPages.reduce((s, p) => s + p.text.length, 0),
      role: r.role, roleLabel: r.label, roleScore: r.score, precedence: r.precedence,
      sections: seg.sections.length, clauses: seg.clauses.length,
    };
    return { file, ex, extract: r.extract, clauses: seg.clauses, sections: seg.sections };
  });

  // 章节索引：给修订 / 澄清回指原条款用（只收正文类文件）
  const sectionIndex = new Map<string, { fileName: string; section: string; page: number }>();
  for (const w of [...work].sort((a, b) => a.file.precedence - b.file.precedence)) {
    if (w.file.role === 'amendment' || w.file.role === 'clarification') continue;
    for (const s of w.sections) if (s.number && !sectionIndex.has(s.number)) sectionIndex.set(s.number, { fileName: w.file.name, section: s.title, page: s.page });
  }

  // 5 字段与修订引用
  const fieldHits: FieldHit[] = [];
  let overrides: OverrideLink[] = [];
  for (const w of work) {
    const pages = w.ex.pages.filter((p) => p.text.trim());
    // 图纸、报价表、参考资料只登记：里面的数字多是分项参数，取关键字段会把采用值带偏
    if (w.extract) fieldHits.push(...extractFields(c, w.file, pages));
    overrides.push(...findOverrides(w.file, w.file.role, pages, sectionIndex));
  }
  if (overrides.length > MAX_OVERRIDES) { warnings.push(`修订 / 澄清引用 ${overrides.length} 处，只展示前 ${MAX_OVERRIDES} 处`); overrides = overrides.slice(0, MAX_OVERRIDES); }
  const fields = summarizeFields(c, fieldHits);
  const amendedSections = new Set(overrides.filter((o) => o.target).map((o) => `${o.target!.fileName}::${o.target!.section}`));

  // 4 条款打标 → 拆标分解表
  const deadlineIso = deadlineOf(fields);
  const rows = work.flatMap((w) => w.clauses.map((cl) => {
    const raw = tagClause(c, cl.text, cl.section.title);
    // 强制和否决不能因为没命中分类词就丢（如「The Proposal must be submitted via Aconex」），按文件类型给个默认类别
    const hard = raw.strength === 'mandatory' || raw.strength === 'prohibited';
    const tag = { ...raw, category: raw.category || (hard ? ROLE_DEFAULT_CATEGORY[w.file.role] : undefined) };
    const strong = hard || tag.strength === 'required';
    const keep = tag.risks.length > 0 || hard || (strong && tag.score >= minCategoryScore) || (w.file.role === 'clarification' && tag.score >= minCategoryScore);
    return { w, cl, tag, keep, clauseKey: clauseKey(cl.text), ruleRisks: tag.risks.map((r) => ({ label: r.label, severity: r.severity, advice: r.advice })) };
  }));
  // 候选比规则的进表条件宽得多：有任何信号就交给模型，规则不再替人把条款删掉
  const candidates: Candidate[] = opts.judge ? rows.filter((r) => r.tag.strength || r.tag.risks.length || r.tag.score > 0).map((r) => ({
    key: r.clauseKey, text: r.cl.text.slice(0, CLAUSE_TEXT_CAP), section: r.cl.section.title, fileName: r.w.file.name, fileRole: r.w.file.role,
    hint: { category: r.tag.category, strength: r.tag.strength, risks: r.tag.risks.map((x) => x.label) },
  })) : [];
  const outcome: JudgeOutcome | undefined = opts.judge && candidates.length ? await opts.judge(candidates, rules.judge, progress) : undefined;
  progress({ stage: 'summary', done: 0, total: 1, message: '生成拆标分解表' });

  const seen = new Set<string>();
  const excluded: ExcludedClause[] = [];
  let items: DecompItem[] = [];
  for (const { w, cl, tag, keep, clauseKey: key, ruleRisks } of rows) {
    const m: Merged = outcome
      ? mergeVerdict({ keep, category: tag.category, strength: tag.strength, risks: ruleRisks }, outcome.verdicts.get(key), rules.judge.minConfidence, outcome.source)
      : { include: keep, category: tag.category, strength: tag.strength, risks: ruleRisks, source: 'rule', needsReview: false, reviewReasons: [] };
    if (!m.include) {
      // 有信号但没进表的都留下来，人才能看到漏了什么；完全没信号的是封面、目录这类，不存
      const reason = m.excludedBecause || (tag.strength || tag.risks.length || tag.score > 0 ? '规则没有选中' : '');
      if (reason) excluded.push({ clauseKey: key, text: cl.text.slice(0, CLAUSE_TEXT_CAP), fileId: w.file.id, fileName: w.file.name, fileRole: w.file.role, section: cl.section.title, page: cl.page, reason, score: tag.score, amended: amendedSections.has(`${w.file.name}::${cl.section.title}`), ruleCategory: tag.category, ruleStrength: tag.strength });
      continue;
    }
    if (!m.category) continue;
    const dedupe = cl.text.slice(0, 140).toLowerCase().replace(/[^a-z0-9一-龥]/g, '');
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    items.push({
      id: '', no: 0, category: m.category, title: titleOf(cl.text), text: cl.text.slice(0, CLAUSE_TEXT_CAP),
      strength: m.strength, risks: m.risks,
      fileId: w.file.id, fileName: w.file.name, fileRole: w.file.role, section: cl.section.title, page: cl.page,
      ...ownerFields(rules, m.category, deadlineIso),
      score: tag.score, amended: amendedSections.has(`${w.file.name}::${cl.section.title}`),
      clauseKey: key, source: m.source, summary: m.summary, quote: m.quote, reason: m.reason, confidence: m.confidence,
      needsReview: m.needsReview || undefined, reviewReasons: m.reviewReasons.length ? m.reviewReasons : undefined,
      ruleCategory: tag.category, ruleStrength: tag.strength,
    });
  }
  const truncated = items.length > MAX_ITEMS;
  if (truncated) {
    warnings.push(`识别出 ${items.length} 条要求，按风险等级与效力顺序保留前 ${MAX_ITEMS} 条`);
    const prec = new Map(work.map((w) => [w.file.id, w.file.precedence]));
    items = items
      .map((it, i) => ({ it, i, rank: Math.max(0, ...it.risks.map((r) => SEVERITY_RANK[r.severity])) * 1000 + (it.strength === 'prohibited' ? 500 : 0) + (prec.get(it.fileId) || 0) * 5 + it.score }))
      .sort((a, b) => b.rank - a.rank).slice(0, MAX_ITEMS).sort((a, b) => a.i - b.i).map((x) => x.it);
  }
  items.forEach((it, i) => { it.no = i + 1; it.id = `R${String(i + 1).padStart(4, '0')}`; });

  for (const w of work) {
    if (w.file.status === 'scanned') warnings.push(`${w.file.name}：扫描件，未解析（${w.file.pages} 页）`);
    if (w.file.status === 'unsupported' || w.file.status === 'error') warnings.push(`${w.file.name}：${w.file.note}`);
  }
  if (!deadlineIso) warnings.push('没有识别到投标截止时间，分解表的倒排截止日留空');

  const parsed = work.map((w) => w.file);
  const { byCategory, risks, mandatory } = itemStats(items);
  const judge: JudgeSummary = outcome ? {
    mode: outcome.source, model: outcome.model, candidates: new Set(candidates.map((x) => x.key)).size, batches: outcome.batches, failedBatches: outcome.failedBatches,
    cached: outcome.cached, unverified: items.filter((i) => i.source === 'rule').length, excluded: excluded.length, needsReview: items.filter((i) => i.needsReview).length, note: outcome.note,
  } : { mode: 'rule', candidates: 0, batches: 0, failedBatches: 0, cached: 0, unverified: items.length, excluded: excluded.length, needsReview: 0 };
  if (outcome?.note) warnings.push(outcome.note);
  const id = uid('tender');
  if (excluded.length) opts.onExcluded?.(id, excluded);
  return {
    id, packageName, source, createdAt: now(), durationMs: Date.now() - t0, ruleVersion: rules.version, judge,
    files: parsed, fields, overrides, items,
    stats: {
      files: parsed.length, pages: parsed.reduce((s, f) => s + f.pages, 0),
      scannedFiles: parsed.filter((f) => f.status === 'scanned').length,
      unsupportedFiles: parsed.filter((f) => f.status === 'unsupported' || f.status === 'error').length,
      items: items.length, mandatory,
      risks, byCategory, conflicts: fields.filter((f) => f.status === 'conflict').length,
    },
    warnings, truncated,
  };
}

/** 规则试跑：对一段文字走 3、4、5 步，返回每条条款的命中明细（不落库）。 */
export function previewText(rules: TenderRuleSet, text: string): { clauses: RulePreviewClause[]; sections: string[] } {
  const c = compile(rules);
  const pages = [{ page: 1, text }];
  const { sections, clauses } = segment(c, pages);
  const fieldRules = c.fields;
  return {
    sections: sections.map((s) => s.title),
    clauses: clauses.slice(0, 200).map((cl) => {
      const tag = tagClause(c, cl.text, cl.section.title);
      const fields: { label: string; value: string }[] = [];
      for (const { rule, re } of fieldRules) {
        re.lastIndex = 0;
        const m = re.exec(cl.text);
        if (m) fields.push({ label: rule.label, value: (m[1] || m[0]).trim() });
      }
      return {
        text: cl.text, section: cl.section.title, category: tag.category, score: tag.score, scores: tag.scores,
        strength: tag.strength, mandatoryRule: tag.mandatoryRule, risks: tag.risks.map((r) => r.label), fields,
      };
    }),
  };
}
