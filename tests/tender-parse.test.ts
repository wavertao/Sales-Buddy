import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import JSZip from 'jszip';

process.env.DATABASE_PATH = join(mkdtempSync(join(process.cwd(), 'data-test-tender-')), 'test.sqlite');
const { DEFAULT_RULES } = await import('../apps/server/src/tender/default-rules.ts');
const { parsePackage, previewText } = await import('../apps/server/src/tender/pipeline.ts');
const { getRules, saveRules, resetRules, restoreRules } = await import('../apps/server/src/tender/rules.ts');
import type { TenderRuleSet } from '../packages/contracts/tender.ts';

const rules = (): TenderRuleSet => ({ ...structuredClone(DEFAULT_RULES), version: 1, updatedAt: '', updatedBy: 'test' });
const txt = (name: string, s: string) => ({ name, path: name, bytes: new TextEncoder().encode(s) });
const admin = { id: 'u1', name: '管理员', role: 'admin' as const, teamId: 't' };

const RFP = `第一章 招标公告
项目规模 200MW/400MWh，投标截止时间：2026年11月20日 10:00。
第四章 技术要求
4.1 储能系统往返效率应不低于 88%，电芯循环寿命不少于 8000 次循环。
4.2 ★投标人必须提供 UL9540A 大规模燃烧测试报告，否则按无效投标处理。
第五章 商务条款
5.1 投标人须提交投标保证金 500000 元，未提交的否决其投标。
5.2 违约金按合同价 0.5% 每周计取，承包人承担无限责任。`;
const AMD = `Amendment-01
Clause 4.1 stands modified as: 往返效率应不低于 85%。往返效率 85%`;

test('TENDER-01 整包解析：角色、分类、强制项、风险、字段、修订引用、倒排截止', async () => {
  const r = await parsePackage(rules(), '测试包', [txt('招标文件正文.txt', RFP), txt('Amendment-01.txt', AMD)], 'upload');
  const roles = Object.fromEntries(r.files.map((f) => [f.name, f.role]));
  assert.equal(roles['招标文件正文.txt'], 'itb');
  assert.equal(roles['Amendment-01.txt'], 'amendment');

  const fire = r.items.find((i) => i.text.includes('UL9540A'));
  assert.ok(fire, '应拆出消防测试要求');
  assert.equal(fire.category, 'technical');
  assert.equal(fire.strength, 'prohibited');
  assert.equal(fire.owner, 'SC');
  assert.equal(fire.dueDate, '2026-11-13'); // 截止 11-20，技术类倒排 7 天

  const liab = r.items.find((i) => i.text.includes('无限责任'));
  assert.ok(liab?.risks.some((x) => x.severity === 'high'), '无限责任应标高风险');

  const deadline = r.fields.find((f) => f.key === 'deadline');
  assert.equal(deadline?.values[0].normalized, '2026-11-20');
  const rte = r.fields.find((f) => f.key === 'rte');
  assert.equal(rte?.value, '85%', '修订文件效力更高，采用修订值');
  assert.equal(rte?.status, 'overridden');

  const link = r.overrides.find((o) => o.ref.toLowerCase().includes('4.1'));
  assert.ok(link?.target, '修订应定位到原 4.1 章节');
  assert.ok(r.items.find((i) => i.text.includes('往返效率应不低于 88%'))?.amended, '被修订章节的条款应标已修订');
});

test('TENDER-02 xlsx 抽取与不支持格式', async () => {
  const zip = new JSZip();
  zip.file('xl/workbook.xml', '<workbook><sheets><sheet name="SOR" sheetId="1"/></sheets></workbook>');
  zip.file('xl/sharedStrings.xml', '<sst><si><t>Item</t></si><si><t>Unit Price</t></si></sst>');
  zip.file('xl/worksheets/sheet1.xml', '<worksheet><sheetData><row><c t="s"><v>0</v></c><c t="s"><v>1</v></c></row><row><c><v>12.5</v></c></row></sheetData></worksheet>');
  const bytes = await zip.generateAsync({ type: 'uint8array' });
  const r = await parsePackage(rules(), 'x', [{ name: 'Schedule_of_Rates.xlsx', path: 'a', bytes }, txt('pkg.QZZF', 'x')], 'upload');
  const sor = r.files.find((f) => f.ext === 'xlsx')!;
  assert.equal(sor.status, 'ok');
  assert.equal(sor.role, 'boq');
  assert.equal(r.files.find((f) => f.ext === 'qzzf')!.status, 'unsupported');
  assert.equal(r.stats.unsupportedFiles, 1);
});

test('TENDER-03 改规则即改结果：停用分类词、加风险规则', () => {
  const base = previewText(rules(), RFP);
  const fire = base.clauses.find((c) => c.text.includes('UL9540A'))!;
  assert.equal(fire.category, 'technical');
  const custom = rules();
  custom.risks.push({ id: 'r-test', label: '燃烧测试', pattern: 'UL9540A', severity: 'low', category: 'technical', advice: '', enabled: true });
  custom.categories = custom.categories.map((c) => (c.category === 'technical' ? { ...c, enabled: false } : c));
  const after = previewText(custom, RFP).clauses.find((c) => c.text.includes('UL9540A'))!;
  assert.notEqual(after.category, 'technical');
  assert.ok(after.risks.includes('燃烧测试'));
});

test('TENDER-04 规则保存：版本号、乐观锁、坏正则拦截、恢复默认与回滚', () => {
  const v1 = getRules();
  const edited = { ...v1, risks: [...v1.risks, { id: 'r-x', label: 'X', pattern: 'abc', severity: 'low' as const, category: 'price' as const, advice: '', enabled: true }] };
  const v2 = saveRules(admin, edited);
  assert.equal(v2.version, v1.version + 1);
  assert.throws(() => saveRules(admin, edited), /已被他人更新/);
  assert.throws(() => saveRules(admin, { ...v2, headings: [{ id: 'bad', label: 'bad', pattern: '([', level: 1, enabled: true }] }), /正则无效/);
  assert.throws(() => saveRules(admin, { ...v2, fields: [{ ...v2.fields[0], pattern: 'MWh' }] }), /捕获组/);
  const v3 = resetRules(admin);
  assert.ok(!v3.risks.some((x) => x.id === 'r-x'));
  const v4 = restoreRules(admin, v2.version);
  assert.ok(v4.risks.some((x) => x.id === 'r-x'));
  assert.equal(v4.version, v3.version + 1);
});
