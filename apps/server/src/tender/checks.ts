import type { ItemLevel, ReviewItem, Severity, StandardEntry, Strength } from '../../../../packages/contracts/tender.ts';

/**
 * 程序兜底：有确定答案的事不交给 AI 判。
 * - 审查项的数值红线：AI 只负责把数抽出来（values），程序和阈值比较。
 * - 标准与资质库：条款里出现的标准号和我方证书比对。
 * 命中红线的结论以程序为准，并标待确认，交人核对。
 */
type Value = { field: string; value: number | null; unit?: string | null };
export type CheckResult = {
  strength?: Strength;
  risks: { label: string; severity: Severity; advice: string }[];
  reasons: string[];
  checks: { label: string; hit: boolean; level?: ItemLevel; detail: string }[];
};

const LEVEL_LABEL: Record<ItemLevel, string> = { prohibited: '否决', high: '高风险', review: '待确认' };
/** 数值名比对：去掉空格和括号里的单位说明，AI 写法略有出入也能对上 */
const norm = (s: string) => s.replace(/[\s（）()]/g, '').replace(/[%％]/g, '').toLowerCase();
const sameField = (a: string, b: string) => { const x = norm(a), y = norm(b); return x === y || x.includes(y) || y.includes(x); };
/** 标准号比对：去掉空格、斜杠、连字符，UL9540A / UL 9540A / UL-9540A 视为同一个 */
const code = (s: string) => s.replace(/[\s/\-_.]/g, '').toLowerCase();

/** 数值名里括号中的单位，如「质保期（年）」→ 年 */
const unitOf = (field: string) => (field.match(/[（(]([^（）()]*)[）)]\s*$/)?.[1] || '').replace(/^占合同价\s*/, '').trim();
/** 时间单位统一成天再换算；百分比只认 %；单位都没写时原样比较 */
const DAYS: Record<string, number> = { 天: 1, 日: 1, day: 1, days: 1, d: 1, 周: 7, 星期: 7, week: 7, weeks: 7, 月: 30.4, 个月: 30.4, month: 30.4, months: 30.4, 年: 365, year: 365, years: 365, yr: 365, yrs: 365 };
function convert(value: number, from: string, to: string): number | null {
  const f = from.trim().toLowerCase(), g = to.trim().toLowerCase();
  if (!f || !g || f === g) return value;
  if (DAYS[f] && DAYS[g]) return Math.round((value * DAYS[f]) / DAYS[g] * 100) / 100;
  if (/%|％|percent/.test(f) && /%|％/.test(g)) return value;
  return null;
}

export function programChecks(text: string, item: ReviewItem | undefined, values: Value[], standards: StandardEntry[]): CheckResult {
  const out: CheckResult = { risks: [], reasons: [], checks: [] };
  const raise = (level: ItemLevel, label: string, detail: string) => {
    out.checks.push({ label, hit: true, level, detail });
    if (level === 'prohibited') out.strength = 'prohibited';
    if (level !== 'review') out.risks.push({ label, severity: 'high', advice: `程序校验：${detail}，请人工核对` });
    out.reasons.push(`程序校验：${detail}`);
  };

  for (const c of item?.checks || []) {
    // 「没找到」要看整个审查项的所有条款，在 missingChecks 里统一判
    if (c.op === 'missing') continue;
    const raw = values.find((x) => sameField(x.field, c.field) && typeof x.value === 'number');
    if (!raw || typeof c.value !== 'number') continue;
    // AI 按原文单位抽数（不换算），程序换成校验要求的单位；换不了的不比，免得「24 个月」被当成 24 年
    const unit = c.unit || unitOf(c.field);
    const n = convert(raw.value as number, raw.unit || '', unit);
    if (n === null) { out.checks.push({ label: `${item!.name}：${c.field}`, hit: false, detail: `抽到 ${raw.value}${raw.unit || ''}，单位和「${c.field}」对不上，未比较` }); continue; }
    const t = c.value;
    const hit = c.op === '>' ? n > t : c.op === '>=' ? n >= t : c.op === '<' ? n < t : n <= t;
    const detail = `${c.field} ${n}${unit} ${c.op} ${t}${unit}`;
    if (hit) raise(c.result, `${item!.name}：${c.field} ${n}${unit}`, `${detail} → ${LEVEL_LABEL[c.result]}`);
    else out.checks.push({ label: `${item!.name}：${c.field} ${n}${unit}`, hit: false, detail: `${c.field} ${n}${unit}，未触碰红线（${c.op} ${t}${unit}）` });
  }

  const t = code(text);
  for (const s of standards) {
    if (!t.includes(code(s.code))) continue;
    if (s.status === 'have') { out.checks.push({ label: `资质：${s.code}`, hit: false, detail: `我方已有${s.expires ? `，有效期至 ${s.expires}` : ''}` }); continue; }
    const why = s.status === 'missing' ? '我方没有' : `版本不符${s.note ? `（${s.note}）` : ''}`;
    raise('high', `资质缺口：${s.code}`, `标书要求 ${s.code}，${why}`);
  }
  return out;
}

/**
 * 「没找到某个数值」按审查项整体判：这一项的所有条款里都没抽到，才在它最重要的那条上标出来。
 * 只在模型判断过时做（没有模型就没有抽数，不能说没找到）。
 */
export function missingChecks(items: { reviewItem?: string; strength?: Strength; values?: Value[]; mark: (r: CheckResult) => void }[], reviewItems: ReviewItem[]) {
  const rank = { prohibited: 4, mandatory: 3, required: 2, recommended: 1 } as const;
  for (const ri of reviewItems) {
    const mine = items.filter((i) => i.reviewItem === ri.id);
    if (!mine.length) continue;
    for (const c of ri.checks.filter((x) => x.op === 'missing')) {
      if (mine.some((i) => (i.values || []).some((v) => sameField(v.field, c.field) && typeof v.value === 'number'))) continue;
      const top = [...mine].sort((a, b) => (rank[b.strength || 'recommended'] || 0) - (rank[a.strength || 'recommended'] || 0))[0];
      const detail = `整个「${ri.name}」都没有写明${c.field} → ${LEVEL_LABEL[c.result]}`;
      top.mark({ strength: c.result === 'prohibited' ? 'prohibited' : undefined, risks: c.result === 'review' ? [] : [{ label: `${ri.name}：未写明${c.field}`, severity: 'high', advice: `程序校验：${detail}，请人工核对` }], reasons: [`程序校验：${detail}`], checks: [{ label: `${ri.name}：缺少${c.field}`, hit: true, level: c.result, detail }] });
    }
  }
}
