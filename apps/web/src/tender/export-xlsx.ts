import JSZip from 'jszip';
import { TENDER_CATEGORIES } from '../../../../packages/contracts/tender';
import type { DecompItem, ExcludedClause, TenderParseResult } from '../../../../packages/contracts/tender';
import { CAT_LABEL, FIELD_STATUS, ROLE_LABEL, SEV_LABEL, STATUS_LABEL, STRENGTH_LABEL, coverage, fileNote, judgeLine } from './TenderResult';
import type { WorkItem } from './TenderBreakdown';

/**
 * 导出拆标分解表（.xlsx），内容和页面一致，不缺字段：
 * - 拆标分解表：按类别分节 → 工作项 → 要求（要求行分级，Excel 左侧可以折叠）
 * - 解析概况：总结、覆盖情况、模型判断、关键字段、文件角色
 * - 已排除：没进分解表的条款和原因
 * 用 jszip 直接写 OOXML，不另引表格库。
 */
type Cell = string | number | null | undefined;
/** 行样式：head 表头、section 类别分节、wi 工作项、req 要求、title 标题、label 小标题、plain 普通 */
type Kind = 'head' | 'section' | 'wi' | 'req' | 'title' | 'label' | 'plain';
type Row = { kind: Kind; cells: Cell[]; level?: number };
type Sheet = { name: string; widths: number[]; rows: Row[]; wrap?: number[]; freeze?: number; filter?: boolean };

const xml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!)).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const col = (n: number) => { let s = ''; for (n += 1; n; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };
const STATUS: Record<string, string> = { pending: '待开始', in_progress: '进行中', done: '已完成', blocked: '阻塞' };
const sourceLabel = (it: DecompItem) => (it.source === 'human' ? '人工' : it.source === 'rule' ? '规则' : 'AI');

// 样式表下标：见 styles.xml 里 cellXfs 的顺序
const XF: Record<Kind, [number, number]> = { plain: [3, 2], req: [3, 2], head: [1, 1], section: [4, 4], wi: [5, 6], title: [7, 7], label: [8, 8] };

function sheetXml(s: Sheet) {
  const cell = (v: Cell, r: number, c: number, style: number) => {
    const ref = `${col(c)}${r}`;
    if (v === null || v === undefined || v === '') return `<c r="${ref}" s="${style}"/>`;
    if (typeof v === 'number') return `<c r="${ref}" s="${style}"><v>${v}</v></c>`;
    return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(String(v).slice(0, 32000))}</t></is></c>`;
  };
  const merges: string[] = [];
  const rows = s.rows.map((row, i) => {
    const r = i + 1;
    const [plain, wrapped] = XF[row.kind];
    // 分节和标题行只有第一格有字，合并到整行
    const span = row.kind === 'section' || row.kind === 'title';
    if (span) merges.push(`A${r}:${col(s.widths.length - 1)}${r}`);
    const cells = span ? [row.cells[0], ...Array(s.widths.length - 1).fill('')] : row.cells;
    const attrs = row.level ? ` outlineLevel="${row.level}"` : '';
    return `<row r="${r}"${attrs}>${cells.map((v, c) => cell(v, r, c, s.wrap?.includes(c) ? wrapped : plain)).join('')}</row>`;
  });
  const pane = s.freeze ? `<pane ySplit="${s.freeze}" topLeftCell="A${s.freeze + 1}" activePane="bottomLeft" state="frozen"/>` : '';
  const filter = s.filter ? `<autoFilter ref="A1:${col(s.widths.length - 1)}${s.rows.length}"/>` : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><outlinePr summaryBelow="0"/></sheetPr><sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="16" outlineLevelRow="1"/>
<cols>${s.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>
<sheetData>${rows.join('')}</sheetData>${filter}${merges.length ? `<mergeCells count="${merges.length}">${merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : ''}</worksheet>`;
}

async function workbook(sheets: Sheet[]) {
  const z = new JSZip();
  z.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`);
  z.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  const names = sheets.map((s, i) => (s.filter ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${xml(s.name)}'!$A$1:$${col(s.widths.length - 1)}$${s.rows.length}</definedName>` : '')).join('');
  z.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>${names ? `<definedNames>${names}</definedNames>` : ''}</workbook>`);
  z.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  // cellXfs：0 默认，1 表头，2 换行，3 普通，4 类别分节，5 工作项，6 工作项换行，7 标题，8 小标题；字体微软雅黑
  z.file('xl/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="4"><font><sz val="10"/><color rgb="FF1F2329"/><name val="Microsoft YaHei"/></font><font><b/><sz val="10"/><color rgb="FF1F2329"/><name val="Microsoft YaHei"/></font><font><b/><sz val="11"/><color rgb="FF1F2329"/><name val="Microsoft YaHei"/></font><font><b/><sz val="14"/><color rgb="FF1F2329"/><name val="Microsoft YaHei"/></font></fonts>
<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF2F3F5"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8EEF9"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF7F8FA"/></patternFill></fill></fills>
<borders count="2"><border/><border><left style="thin"><color rgb="FFE5E6EB"/></left><right style="thin"><color rgb="FFE5E6EB"/></right><top style="thin"><color rgb="FFE5E6EB"/></top><bottom style="thin"><color rgb="FFE5E6EB"/></bottom></border></borders>
<cellStyleXfs count="1"><xf/></cellStyleXfs>
<cellXfs count="9">
<xf/>
<xf fontId="1" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf borderId="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf borderId="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf fontId="2" fillId="3" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf fontId="1" fillId="4" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf fontId="1" fillId="4" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf fontId="3" applyFont="1"/>
<xf fontId="2" applyFont="1"/>
</cellXfs>
</styleSheet>`);
  sheets.forEach((s, i) => z.file(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)));
  return z.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/** 「其他 X 要求」和兜底分组排在本类最后，和页面一致 */
const tail = (w: WorkItem) => (w.grouping === 'fallback' || /^其他.+要求$/.test(w.title) ? 1 : 0);
const strong = (it: DecompItem) => it.strength === 'mandatory' || it.strength === 'prohibited';

/** 组装各张表；拆出来方便测试 */
export function breakdownSheets(r: TenderParseResult, items: WorkItem[], excluded: ExcludedClause[]): Sheet[] {
  const byId = new Map(r.items.map((i) => [i.id, i]));
  const seen = new Set<string>();

  // ---- 拆标分解表 ----
  const head = ['编号', '工作项 / 要求', '交付物 / 原文', '要求条数 · 强度', '待确认', '风险', '处理建议', '判断来源', '置信度', '判断理由', '文件', '章节', '页', '主责', '复核', '截止', '状态', '已修订'];
  const main: Row[] = [{ kind: 'head', cells: head }];
  const reqRow = (it: DecompItem): Row => ({
    kind: 'req', level: 1,
    cells: [
      it.id, it.summary || it.title, it.text, it.strength ? STRENGTH_LABEL[it.strength] : '一般',
      it.needsReview ? (it.reviewReasons?.join('；') || '待确认') : (it.source === 'human' ? '已复核' : ''),
      it.risks.map((x) => `${SEV_LABEL[x.severity]}·${x.label}`).join('；'), it.risks.map((x) => x.advice).join('；'),
      sourceLabel(it), it.confidence ?? '', it.reason || '', it.fileName, it.section, it.page,
      it.owner, it.reviewer, it.dueDate || '', '', it.amended ? '是' : '',
    ],
  });
  for (const c of TENDER_CATEGORIES) {
    const wis = items.filter((w) => w.category === c.label).sort((a, b) => tail(a) - tail(b));
    const reqsOf = (w: WorkItem) => (w.requirementIds || []).map((id) => byId.get(id)).filter((x): x is DecompItem => !!x);
    const all = wis.flatMap(reqsOf);
    if (!wis.length) continue;
    const review = all.filter((i) => i.needsReview).length;
    main.push({ kind: 'section', cells: [`${c.label}　${wis.length} 个工作项 · ${all.length} 条要求 · 强制 / 否决 ${all.filter(strong).length}${review ? ` · 待确认 ${review}` : ''}`] });
    wis.forEach((w, n) => {
      const reqs = reqsOf(w);
      const mandatory = reqs.filter(strong).length;
      const wr = reqs.filter((i) => i.needsReview).length;
      main.push({
        kind: 'wi',
        cells: [
          `${c.label}-${String(n + 1).padStart(2, '0')}`, w.title, w.deliverable || '', `${reqs.length} 条${mandatory ? ` · 强制 ${mandatory}` : ''}`,
          wr ? `${wr} 条待确认` : '', reqs.some((i) => i.risks.length) ? `${reqs.filter((i) => i.risks.length).length} 条有风险` : '', '',
          w.grouping === 'model' ? 'AI 归纳' : '按文件', '', '', [...new Set(reqs.map((i) => i.fileName))].length > 1 ? `${new Set(reqs.map((i) => i.fileName)).size} 个文件` : reqs[0]?.fileName || '',
          '', '', w.assigneeRole, w.reviewerRole || '', w.end, STATUS[w.status] || w.status, w.amended ? '是' : '',
        ],
      });
      for (const it of reqs) { if (seen.has(it.id)) continue; seen.add(it.id); main.push(reqRow(it)); }
    });
  }
  const loose = r.items.filter((i) => !seen.has(i.id));
  if (loose.length) {
    main.push({ kind: 'section', cells: [`未归入工作项　${loose.length} 条要求`] });
    loose.forEach((it) => main.push(reqRow(it)));
  }

  // ---- 解析概况 ----
  const s = r.stats;
  const cov = coverage(r);
  const ov: Row[] = [
    { kind: 'title', cells: [`拆标分解表 · ${r.packageName}`] },
    { kind: 'plain', cells: ['解析时间', r.createdAt.slice(0, 16).replace('T', ' ')] },
    { kind: 'plain', cells: ['规则版本', `v${r.ruleVersion}`] },
    { kind: 'plain', cells: ['文件 / 页', `${s.files} / ${s.pages}`] },
    { kind: 'plain', cells: ['我方要求', s.items] },
    { kind: 'plain', cells: ['工作项', items.length] },
    { kind: 'plain', cells: ['强制 / 否决', s.mandatory] },
    { kind: 'plain', cells: ['高风险', s.risks.high] },
    { kind: 'plain', cells: ['待确认', r.items.filter((i) => i.needsReview).length] },
    { kind: 'plain', cells: ['已排除', excluded.length] },
    { kind: 'plain', cells: ['覆盖情况', cov.line] },
    ...cov.key.map(({ file, fix }) => ({ kind: 'plain' as const, cells: ['可能漏要求', `${file.name}（${ROLE_LABEL[file.role]}）：${fix}`] })),
    { kind: 'plain', cells: ['模型判断', judgeLine(r)] },
    ...r.warnings.map((w) => ({ kind: 'plain' as const, cells: ['提示', w] })),
    { kind: 'plain', cells: [] },
    { kind: 'label', cells: ['关键字段'] },
    { kind: 'head', cells: ['字段', '采用值', '来源', '状态', '其他取值', ''] },
    ...r.fields.map((f) => ({ kind: 'plain' as const, cells: [f.label, f.value, f.source, FIELD_STATUS[f.status][0], f.values.filter((v) => v.value !== f.value).map((v) => v.normalized).join(' · '), ''] })),
    { kind: 'plain', cells: [] },
    { kind: 'label', cells: ['文件角色（按效力顺序）'] },
    { kind: 'head', cells: ['文件', '角色', '页', '章节 / 条款', '状态', '说明'] },
    ...[...r.files].sort((a, b) => b.precedence - a.precedence).map((f) => ({ kind: 'plain' as const, cells: [f.name, ROLE_LABEL[f.role], f.pages || '', f.clauses ? `${f.sections} / ${f.clauses}` : '只登记', STATUS_LABEL[f.status], fileNote(f)] })),
  ];

  return [
    { name: '拆标分解表', widths: [11, 44, 60, 14, 18, 22, 30, 9, 7, 36, 30, 24, 5, 7, 7, 11, 8, 7], rows: main, wrap: [1, 2, 4, 5, 6, 9], freeze: 1, filter: true },
    { name: '解析概况', widths: [44, 70, 40, 12, 36, 30], rows: ov, wrap: [1, 2, 4, 5] },
    {
      name: '已排除', widths: [70, 36, 40, 24, 6], freeze: 1, filter: true, wrap: [0, 1],
      rows: [{ kind: 'head', cells: ['原文', '排除原因', '文件', '章节', '页'] }, ...excluded.map((x) => ({ kind: 'plain' as const, cells: [x.text, x.reason, `${x.fileName}（${ROLE_LABEL[x.fileRole]}）`, x.section, x.page] }))],
    },
  ];
}

export async function exportBreakdownXlsx(r: TenderParseResult, items: WorkItem[], excluded: ExcludedClause[]) {
  const blob = await workbook(breakdownSheets(r, items, excluded));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `拆标分解表_${r.packageName.slice(0, 60)}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
