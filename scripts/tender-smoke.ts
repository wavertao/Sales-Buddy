/** 标书解析冒烟：对样本目录里的每个包跑一遍流水线，打印统计（不改规则）。用法：npx tsx scripts/tender-smoke.ts [包名关键字] */
import { listSamples, parseSample } from '../apps/server/src/tender/service.ts';
const filter = process.argv[2] || '';
for (const p of listSamples().packages.filter((x) => x.id.includes(filter))) {
  const r = await parseSample('smoke', p.id);
  const s = r.stats;
  console.log(`\n== ${p.id}  ${s.files} 文件 / ${s.pages} 页 / ${r.durationMs}ms`);
  console.log(`   要求 ${s.items}（强制 ${s.mandatory}）分类 ${JSON.stringify(s.byCategory)} 风险 ${JSON.stringify(s.risks)} 矛盾 ${s.conflicts} 修订引用 ${r.overrides.length}`);
  for (const f of r.files) console.log(`   [${f.roleLabel}] ${f.name} ${f.status} p${f.pages} 节${f.sections} 条${f.clauses}`);
  for (const f of r.fields) console.log(`   字段 ${f.label}=${f.value} (${f.status}) ${f.values.map((v) => v.normalized).join(' / ')}`);
  for (const w of r.warnings) console.log(`   ! ${w}`);
  if (process.env.SHOW) for (const it of r.items.slice(0, Number(process.env.SHOW))) console.log(`   ${it.id} [${it.category}/${it.strength}/${it.owner}] ${it.title} <${it.fileName} p${it.page} ${it.section}>`);
}
