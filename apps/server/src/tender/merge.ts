import type { JudgeSource, Severity, Strength, TenderCategory } from '../../../../packages/contracts/tender.ts';
import type { Verdict } from './judge.ts';

/**
 * 融合层：决定模型和规则的结论怎么合成最终结果。
 * 模型说了算，但有两条护栏：规则判否决的不许模型单方面下调，规则判高风险的不许模型单方面去掉。
 * 这两种情况都保留规则结论并标待确认，因为漏掉它们的代价最高。
 */
export type RuleView = {
  /** 规则原来的进表判断 */
  keep: boolean;
  category?: TenderCategory; strength?: Strength;
  risks: { label: string; severity: Severity; advice: string }[];
};
export type Merged = {
  include: boolean; category?: TenderCategory; strength?: Strength;
  risks: { label: string; severity: Severity; advice: string }[];
  source: JudgeSource; needsReview: boolean; reviewReasons: string[];
  summary?: string; quote?: string; reason?: string; confidence?: number;
  /** 不进表时的原因 */
  excludedBecause?: string;
};

const STRONG = new Set<Strength | undefined>(['mandatory', 'prohibited']);

/** 模型开启时用：verdict 为空表示这条没拿到可信的模型结论。 */
export function mergeVerdict(rule: RuleView, verdict: Verdict | undefined, minConfidence: number, source: JudgeSource): Merged {
  if (!verdict) {
    return { include: rule.keep, category: rule.category, strength: rule.strength, risks: rule.risks, source: 'rule', needsReview: rule.keep, reviewReasons: rule.keep ? ['模型未复核，这是规则结果'] : [] };
  }
  const reasons: string[] = [];
  const base = { source, summary: verdict.summary || undefined, quote: verdict.quote, reason: verdict.reason || undefined, confidence: verdict.confidence };
  const highRisks = rule.risks.filter((r) => r.severity === 'high');

  if (!verdict.isRequirement) {
    const guarded = rule.strength === 'prohibited' || highRisks.length > 0;
    if (!guarded) return { ...base, include: false, risks: [], needsReview: false, reviewReasons: [], excludedBecause: verdict.reason || '模型判定不是要求' };
    return { ...base, include: true, category: rule.category, strength: rule.strength, risks: rule.risks, needsReview: true, reviewReasons: ['模型认为这不是要求，但规则判为否决或高风险'] };
  }

  let strength = verdict.strength;
  if (rule.strength === 'prohibited' && strength !== 'prohibited') {
    strength = 'prohibited';
    reasons.push('规则判为否决，模型判得更低，先按否决保留');
  } else if (STRONG.has(rule.strength) !== STRONG.has(strength)) {
    reasons.push(STRONG.has(strength) ? '模型判为强制或否决，规则没有' : '规则判为强制，模型判得更低');
  }

  const risks = [...verdict.risks];
  if (highRisks.length && !risks.some((x) => x.severity === 'high')) {
    risks.push(...highRisks);
    reasons.push('规则判为高风险，模型没有标，先保留');
  }
  if (verdict.confidence < minConfidence) reasons.push(`模型置信度低（${verdict.confidence}）`);
  return { ...base, include: true, category: verdict.category, strength, risks, needsReview: reasons.length > 0, reviewReasons: reasons };
}
