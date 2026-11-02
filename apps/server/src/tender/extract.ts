import JSZip from 'jszip';
import mammoth from 'mammoth';
import { XMLParser } from 'fast-xml-parser';
import type { ExtractStatus } from '../../../../packages/contracts/tender.ts';

/** 第一步：把整包里每个文件抽成按页的纯文本。只做抽取，不做判断。 */
export type SourceFile = { name: string; path: string; bytes: Uint8Array };
export type ExtractedPage = { page: number; text: string };
export type Extracted = {
  name: string; path: string; ext: string; size: number;
  status: ExtractStatus; note?: string; pages: ExtractedPage[]; totalPages: number;
};

const PSEUDO_PAGE = 3000; // 无分页概念的格式（docx / doc / txt）按字数切成虚拟页，方便回指出处
const ZIP_MAX_ENTRIES = 80;

export const extOf = (name: string) => (name.match(/\.([^.\\/]+)$/)?.[1] || '').toLowerCase();

function pseudoPages(text: string): ExtractedPage[] {
  const out: ExtractedPage[] = [];
  const lines = text.split(/\r?\n/);
  let buf = '';
  for (const line of lines) {
    if (buf.length + line.length > PSEUDO_PAGE && buf) { out.push({ page: out.length + 1, text: buf }); buf = ''; }
    buf += line + '\n';
  }
  if (buf.trim()) out.push({ page: out.length + 1, text: buf });
  return out;
}

async function pdfPages(bytes: Uint8Array, maxPages: number): Promise<{ pages: ExtractedPage[]; total: number }> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loading = pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: false, verbosity: 0 });
  const pdf = await loading.promise;
  try {
    const pages: ExtractedPage[] = [];
    const n = Math.min(pdf.numPages, maxPages);
    for (let i = 1; i <= n; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      let text = '';
      for (const item of content.items as { str?: string; hasEOL?: boolean }[]) {
        text += item.str || '';
        text += item.hasEOL ? '\n' : (item.str && !/\s$/.test(item.str) ? ' ' : '');
      }
      pages.push({ page: i, text });
      page.cleanup();
    }
    return { pages, total: pdf.numPages };
  } finally { await loading.destroy(); }
}

const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', textNodeName: '#text' });
const arr = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
function textOf(node: unknown): string {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (typeof node === 'object') {
    const o = node as Record<string, unknown>;
    if ('#text' in o) return String(o['#text']);
    if ('t' in o) return textOf(o.t);
    if ('r' in o) return arr(o.r as unknown[]).map(textOf).join('');
  }
  return '';
}

/** xlsx：每张表一页，每行「A | B | C」。共享字符串与内联字符串都处理。 */
async function xlsxPages(bytes: Uint8Array): Promise<ExtractedPage[]> {
  const zip = await JSZip.loadAsync(bytes);
  const sstXml = await zip.file('xl/sharedStrings.xml')?.async('string');
  const sst = sstXml ? arr((xml.parse(sstXml).sst?.si) as unknown[]).map(textOf) : [];
  const wbXml = await zip.file('xl/workbook.xml')?.async('string');
  const sheetNames = wbXml ? arr(xml.parse(wbXml).workbook?.sheets?.sheet as { name: string }[]).map((s) => s.name) : [];
  const sheetFiles = Object.keys(zip.files).filter((f) => /^xl\/worksheets\/sheet\d+\.xml$/.test(f))
    .sort((a, b) => Number(a.match(/(\d+)\.xml$/)![1]) - Number(b.match(/(\d+)\.xml$/)![1]));
  const pages: ExtractedPage[] = [];
  for (const [i, f] of sheetFiles.entries()) {
    const doc = xml.parse(await zip.file(f)!.async('string'));
    const rows = arr(doc.worksheet?.sheetData?.row as Record<string, unknown>[]);
    const lines: string[] = [`【${sheetNames[i] || `Sheet${i + 1}`}】`];
    for (const row of rows) {
      const cells = arr(row.c as Record<string, unknown>[]).map((c) => {
        if (c.t === 's') return sst[Number(textOf(c.v))] ?? '';
        if (c.t === 'inlineStr') return textOf(c.is);
        return textOf(c.v);
      }).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
      if (cells.length) lines.push(cells.join(' | '));
    }
    pages.push({ page: i + 1, text: lines.join('\n') });
  }
  return pages;
}

/**
 * 旧版 .doc（OLE 复合文档）没有现成解析库，这里做粗提取：正文在 WordDocument 流里多为 UTF-16LE，
 * 找连续的可读字符段（中文、ASCII、全角标点）拼回去。会丢格式和少量字，但足够做条款识别。
 */
function legacyDocText(bytes: Uint8Array): string {
  const out: string[] = [];
  let run = '';
  const flush = () => { if (run.replace(/\s/g, '').length >= 6) out.push(run); run = ''; };
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const code = bytes[i] | (bytes[i + 1] << 8);
    const ok = (code >= 0x20 && code < 0x7f) || code === 0x0d || code === 0x09
      || (code >= 0x4e00 && code <= 0x9fa5) || (code >= 0x3000 && code <= 0x303f) || (code >= 0xff00 && code <= 0xffef)
      || code === 0x2014 || code === 0x2026 || code === 0x201c || code === 0x201d || code === 0x2018 || code === 0x2019 || code === 0x2605 || code === 0x25b2;
    if (ok) run += code === 0x0d ? '\n' : String.fromCharCode(code);
    else flush();
  }
  flush();
  return out.join('\n');
}

export async function extractFile(f: SourceFile, maxPages: number, minChars: number): Promise<Extracted[]> {
  const ext = extOf(f.name);
  const base = { name: f.name, path: f.path, ext, size: f.bytes.length };
  try {
    let pages: ExtractedPage[] = [];
    let total = 0;
    let note: string | undefined;
    if (ext === 'pdf') {
      const r = await pdfPages(f.bytes, maxPages); pages = r.pages; total = r.total;
      if (total > maxPages) note = `共 ${total} 页，按规则只读前 ${maxPages} 页`;
    } else if (ext === 'docx') {
      pages = pseudoPages((await mammoth.extractRawText({ buffer: Buffer.from(f.bytes) })).value); total = pages.length;
    } else if (ext === 'xlsx' || ext === 'xlsm') {
      pages = await xlsxPages(f.bytes); total = pages.length;
    } else if (ext === 'doc') {
      pages = pseudoPages(legacyDocText(f.bytes)); total = pages.length; note = '旧版 .doc 为粗提取，建议另存为 .docx 再解析';
    } else if (ext === 'txt' || ext === 'md' || ext === 'csv') {
      pages = pseudoPages(Buffer.from(f.bytes).toString('utf8')); total = pages.length;
    } else if (ext === 'zip') {
      return await extractZip(f, maxPages, minChars);
    } else {
      return [{ ...base, status: 'unsupported', note: `不支持 .${ext || '无扩展名'} 格式`, pages: [], totalPages: 0 }];
    }
    const textPages = pages.filter((p) => p.text.replace(/\s/g, '').length >= minChars).length;
    let status: ExtractStatus = 'ok';
    // 只有 PDF 才有「扫描件」一说；表格 / 文本文件内容少只是内容少
    if (ext !== 'pdf') { if (!pages.some((p) => p.text.trim())) note = '文件里没有文字内容'; }
    else if (pages.length && textPages === 0) { status = 'scanned'; note = '没有文字层（扫描件），需 OCR 后再解析'; }
    else if (pages.length && textPages < pages.length * 0.6) { status = 'partial_scanned'; note = `${pages.length - textPages} 页没有文字层（图纸或扫描页）`; }
    return [{ ...base, status, note, pages, totalPages: total }];
  } catch (e) {
    return [{ ...base, status: 'error', note: `读取失败：${(e as Error).message}`, pages: [], totalPages: 0 }];
  }
}

/** 压缩包：展开一层，逐个文件按上面的规则抽取，路径记成「包名/内部路径」。 */
async function extractZip(f: SourceFile, maxPages: number, minChars: number): Promise<Extracted[]> {
  const zip = await JSZip.loadAsync(f.bytes);
  const entries = Object.values(zip.files).filter((e) => !e.dir).slice(0, ZIP_MAX_ENTRIES);
  const out: Extracted[] = [];
  for (const e of entries) {
    const inner = e.name.split('/').pop() || e.name;
    if (extOf(inner) === 'zip') continue;
    const bytes = await e.async('uint8array');
    out.push(...(await extractFile({ name: inner, path: `${f.path}/${e.name}`, bytes }, maxPages, minChars)));
  }
  if (!out.length) out.push({ name: f.name, path: f.path, ext: 'zip', size: f.bytes.length, status: 'unsupported', note: '压缩包内没有可解析的文件', pages: [], totalPages: 0 });
  return out;
}
