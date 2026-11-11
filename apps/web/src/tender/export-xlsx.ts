import JSZip from 'jszip';
import { TENDER_CATEGORIES } from '../../../../packages/contracts/tender';
import type { DecompItem, ExcludedClause, TenderParseResult } from '../../../../packages/contracts/tender';
import { CAT_LABEL, ROLE_LABEL, SEV_LABEL, SOURCE_LABEL, STRENGTH_LABEL } from './TenderResult';
import type { WorkItem } from './TenderBreakdown';

/**
 * 导出拆标分解表（.xlsx），和页面一样按「类别 → 工作项 → 要求」组织：
 * 工作项总表、要求明细（每条带所属工作项）、已排除。用 jszip 直接写 OOXML，不另引表格库。
 */
type Cell = string | number | null | undefined;
type Sheet = { name: string; widths: number[]; head: string[]; rows: Cell[][]; wrap?: number[] };

const xml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!)).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const col = (n: number) => { let s = ''; for (n += 1; n; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };

function sheetXml(s: Sheet) {
  const cell = (v: Cell, r: number, c: number, style: number) => {
    const ref = `${col(c)}${r}`;
    if (v === null || v === undefined || v === '') return `<c r="${ref}" s="${style}"/>`;
    if (typeof v === 'number') return `<c r="${ref}" s="${style}"><v>${v}</v></c>`;
    return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(String(v).slice(0, 32000))}</t></is></c>`;
  };
  const rows = [
    `<row r="1">${s.head.map((h, c) => cell(h, 1, c, 1)).join('')}</row>`,
    ...s.rows.map((row, i) => `<row r="${i + 2}">${row.map((v, c) => cell(v, i + 2, c, s.wrap?.includes(c) ? 2 : 3)).join('')}</row>`),
  ];
  const last = `${col(s.head.length - 1)}${s.rows.length + 1}`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${s.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>
<sheetData>${rows.join('')}</sheetData><autoFilter ref="A1:${last}"/></worksheet>`;
}

async function workbook(sheets: Sheet[]) {
  const z = new JSZip();
  z.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`);
  z.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  z.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets><definedNames>${sheets.map((s, i) => `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${xml(s.name)}'!$A$1:$${col(s.head.length - 1)}$${s.rows.length + 1}</definedName>`).join('')}</definedNames></workbook>`);
  z.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  // 样式：0 默认，1 表头（加粗、灰底），2 自动换行，3 普通单元格；都顶端对齐，字体微软雅黑
  z.file('xl/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="10"/><name val="Microsoft YaHei"/></font><font><b/><sz val="10"/><name val="Microsoft YaHei"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF2F3F5"/></patternFill></fill></fills>
<borders count="2"><border/><border><left style="thin"><color rgb="FFE5E6EB"/></left><right style="thin"><color rgb="FFE5E6EB"/></right><top style="thin"><color rgb="FFE5E6EB"/></top><bottom style="thin"><color rgb="FFE5E6EB"/></bottom></border></borders>
<cellStyleXfs count="1"><xf/></cellStyleXfs>
<cellXfs count="4"><xf/><xf fontId="1" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf borderId="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf borderId="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf></cellXfs>
</styleSheet>`);
  sheets.forEach((s, i) => z.file(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)));
  return z.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/** 组装三张表；拆出来方便测试 */
export function breakdownSheets(r: TenderParseResult, items: WorkItem[], excluded: ExcludedClause[]): Sheet[] {
  const byId = new Map(r.items.map((i) => [i.id, i]));
  const order = TENDER_CATEGORIES.map((c) => c.label);
  const wis = [...items].sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
  const req = (it: DecompItem, w: WorkItem | undefined): Cell[] => [
    CAT_LABEL[it.category], w?.title || '（未归入工作项）', it.id, it.summary || it.title,
    it.strength ? STRENGTH_LABEL[it.strength] : '', it.needsReview ? (it.reviewReasons?.join('；') || '待确认') : '',
    it.risks.map((x) => `${SEV_LABEL[x.severity]}·${x.label}`).join('；'), it.risks.map((x) => x.advice).join('；'),
    SOURCE_LABEL[it.source || 'rule'], it.text, it.fileName, it.section, it.page, it.owner, it.reviewer, it.dueDate || '', it.amended ? '是' : '',
  ];
  const seen = new Set<string>();
  const detail: Cell[][] = [];
  for (const w of wis) for (const id of w.requirementIds || []) { const it = byId.get(id); if (it && !seen.has(id)) { seen.add(id); detail.push(req(it, w)); } }
  for (const it of r.items) if (!seen.has(it.id)) detail.push(req(it, undefined));
  return [
    {
      name: '工作项', widths: [8, 36, 48, 8, 10, 8, 10, 10, 11, 10],
      head: ['类别', '工作项', '交付物', '要求条数', '强制 / 否决', '待确认', '主责', '复核', '响应截止', '状态'],
      wrap: [1, 2],
      rows: wis.map((w) => [w.category, w.title, w.deliverable || '', w.requirementCount ?? w.requirementIds?.length ?? 0, w.mandatoryCount ?? 0, w.reviewCount || 0, w.assigneeRole, w.reviewerRole || '', w.end, w.status]),
    },
    {
      name: '要求明细', widths: [8, 28, 10, 44, 10, 18, 22, 30, 8, 60, 30, 24, 6, 8, 8, 11, 8],
      head: ['类别', '工作项', '编号', '要求（中文要点）', '强度', '待确认原因', '风险', '处理建议', '判断来源', '原文', '文件', '章节', '页', '负责', '复核', '截止', '已修订'],
      wrap: [1, 3, 5, 6, 7, 9],
      rows: detail,
    },
    {
      name: '已排除', widths: [60, 30, 30, 24, 6],
      head: ['原文', '排除原因', '文件', '章节', '页'],
      wrap: [0, 1],
      rows: excluded.map((x) => [x.text, x.reason, `${x.fileName}（${ROLE_LABEL[x.fileRole]}）`, x.section, x.page]),
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
