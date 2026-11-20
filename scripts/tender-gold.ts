/**
 * 标书解析标注集与回放（放在被 Git 忽略的 data/ 下，招标原文不进仓库）。
 *   抽样：npx tsx scripts/tender-gold.ts sample [每包条数，默认 50]   → data/tender-gold.json，预填规则结论，待人校对
 *   回放：npx tsx scripts/tender-gold.ts eval                        → 只统计 reviewed 为 true 的条目
 * 回放对比规则和当前配置的模型（没配模型时只出规则结果），重点看否决、强制的漏判。这些条款会发给已配置的模型服务。
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { modelStatus } from '../apps/server/src/model.ts';
import { compile, segment, tagClause } from '../apps/server/src/tender/pipeline.ts';
import { clauseKey, makeJudge, type Candidate } from '../apps/server/src/tender/judge.ts';
import { getRules } from '../apps/server/src/tender/rules.ts';
import { extractFile } from '../apps/server/src/tender/extract.ts';
import { listSamples, loadSample } from '../apps/server/src/tender/service.ts';
import type { FileRole, Strength, TenderCategory } from '../packages/contracts/tender.ts';

type Gold = {
  key: string; package: string; fileName: string; section: string; text: string; reviewed: boolean;
  isRequirement: boolean; category?: TenderCategory; strength?: Strength; note?: string;
};
const FILE = 'data/tender-gold.json';
const STRONG = new Set<Strength | undefined>(['mandatory', 'prohibited']);

async function clausesOf(id: string) {
  const rules = getRules();
  const c = compile(rules);
  const out: { text: string; section: string; fileName: string; tag: ReturnType<typeof tagClause> }[] = [];
  for (const f of loadSample(id).files) {
    for (const ex of await extractFile(f, rules.options.maxPagesPerFile, rules.options.minCharsPerPage)) {
      const pages = ex.pages.filter((p) => p.text.replace(/\s/g, '').length >= rules.options.minCharsPerPage);
      if (!pages.length) continue;
      for (const cl of segment(c, pages).clauses) out.push({ text: cl.text.slice(0, 600), section: cl.section.title, fileName: ex.name, tag: tagClause(c, cl.text, cl.section.title) });
    }
  }
  return out;
}

async function sample(perPackage: number) {
  const gold: Gold[] = [];
  for (const p of listSamples().packages.filter((x) => x.kind === 'package')) {
    const all = (await clausesOf(p.id)).filter((x) => x.tag.strength || x.tag.risks.length || x.tag.score > 0);
    // 分层抽样：否决和强制最值得核对，占一半；其余均匀取，保证有规则不看重的条款
    const strong = all.filter((x) => STRONG.has(x.tag.strength));
    const rest = all.filter((x) => !STRONG.has(x.tag.strength));
    const pick = <T>(xs: T[], n: number) => xs.filter((_, i) => i % Math.max(1, Math.floor(xs.length / n)) === 0).slice(0, n);
    const half = Math.ceil(perPackage / 2);
    const chosen = [...pick(strong, half), ...pick(rest, perPackage - Math.min(half, strong.length))];
    for (const x of chosen) gold.push({ key: clauseKey(x.text), package: p.name, fileName: x.fileName, section: x.section, text: x.text, reviewed: false, isRequirement: true, category: x.tag.category, strength: x.tag.strength });
  }
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(gold, null, 2));
  console.log(`已写入 ${FILE}，共 ${gold.length} 条。校对后把 reviewed 改成 true。`);
}

type Row = { isRequirement: boolean; category?: TenderCategory; strength?: Strength };
function report(name: string, gold: Gold[], pred: (g: Gold) => Row | undefined) {
  const judged = gold.filter((g) => pred(g));
  const req = judged.filter((g) => g.isRequirement);
  const recall = (s: Strength) => {
    const xs = judged.filter((g) => g.strength === s);
    return `${xs.filter((g) => pred(g)!.strength === s).length}/${xs.length}`;
  };
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '-');
  console.log(`\n${name}：判了 ${judged.length}/${gold.length} 条`);
  console.log(`  否决召回 ${recall('prohibited')}，强制召回 ${recall('mandatory')}`);
  console.log(`  要求判定准确率 ${pct(judged.filter((g) => pred(g)!.isRequirement === g.isRequirement).length, judged.length)}`);
  console.log(`  类别准确率 ${pct(req.filter((g) => pred(g)!.category === g.category).length, req.length)}`);
}

async function evaluate() {
  const rules = getRules();
  const gold = (JSON.parse(readFileSync(FILE, 'utf8')) as Gold[]).filter((g) => g.reviewed);
  if (!gold.length) { console.log('没有校对过的条目（reviewed 为 true）'); return; }
  const c = compile(rules);
  const tags = new Map(gold.map((g) => [g.key, tagClause(c, g.text, g.section)]));
  report('规则', gold, (g) => { const t = tags.get(g.key)!; return { isRequirement: !!t.strength || t.risks.length > 0, category: t.category, strength: t.strength }; });
  if (!modelStatus().configured) { console.log('\n没有配置模型，只输出规则结果'); return; }
  const cands: Candidate[] = gold.map((g) => { const t = tags.get(g.key)!; return { key: g.key, text: g.text, section: g.section, fileName: g.fileName, fileRole: 'itb' as FileRole, hint: { category: t.category, strength: t.strength, risks: t.risks.map((r) => r.label) } }; });
  const out = await makeJudge()(cands, rules.judge, (p) => process.stdout.write(`\r${p.message}   `));
  report(`模型（${out.model}）`, gold, (g) => out.verdicts.get(g.key));
  if (out.note) console.log(out.note);
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'sample') await sample(Number(arg) || 50);
else if (cmd === 'eval') await evaluate();
else console.log('用法：tender-gold.ts sample [每包条数] | eval');
