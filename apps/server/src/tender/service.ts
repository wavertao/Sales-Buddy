import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { get, list, put } from '../db.ts';
import { AppError } from '../../../../packages/contracts/index.ts';
import type { TenderParseResult } from '../../../../packages/contracts/tender.ts';
import { getRules } from './rules.ts';
import { parsePackage } from './pipeline.ts';
import type { SourceFile } from './extract.ts';

/**
 * 样本目录：默认是仓库上一级的「招标文件样本」（D:\AICRM\招标文件样本），可用 TENDER_SAMPLE_DIR 覆盖。
 * 根目录下每个文件算一个单文件包；「整包」下每个子目录算一个多文件包。
 */
export const sampleRoot = () => resolve(process.env.TENDER_SAMPLE_DIR || '../招标文件样本');
const SKIP = /^(目录\.txt|\.DS_Store|Thumbs\.db)$/i;
const MAX_PACKAGE_BYTES = 400 * 1024 * 1024;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (!SKIP.test(name) && !name.endsWith('.partial')) out.push(p);
  }
  return out.sort();
}

export function listSamples() {
  const root = sampleRoot();
  if (!existsSync(root)) return { root, packages: [] as { id: string; name: string; kind: 'single' | 'package'; files: number; size: number }[] };
  const packages: { id: string; name: string; kind: 'single' | 'package'; files: number; size: number }[] = [];
  const bundles = join(root, '整包');
  if (existsSync(bundles)) {
    for (const name of readdirSync(bundles).sort()) {
      const p = join(bundles, name);
      if (!statSync(p).isDirectory()) continue;
      const files = walk(p);
      packages.push({ id: relative(root, p).split(sep).join('/'), name, kind: 'package', files: files.length, size: files.reduce((s, f) => s + statSync(f).size, 0) });
    }
  }
  for (const name of readdirSync(root).sort()) {
    const p = join(root, name);
    if (statSync(p).isDirectory() || SKIP.test(name) || name.endsWith('.partial') || name.endsWith('.md')) continue;
    packages.push({ id: name, name, kind: 'single', files: 1, size: statSync(p).size });
  }
  return { root, packages };
}

function loadSample(id: string): { name: string; files: SourceFile[] } {
  const root = sampleRoot();
  const target = resolve(root, id);
  if (target !== root && !target.startsWith(root + sep)) throw new AppError('INVALID_ARGUMENT', '样本路径不在样本目录内', 400);
  if (!existsSync(target)) throw new AppError('NOT_FOUND', `样本不存在：${id}`, 404);
  const paths = statSync(target).isDirectory() ? walk(target) : [target];
  let total = 0;
  const files = paths.map((p) => {
    const bytes = new Uint8Array(readFileSync(p));
    total += bytes.length;
    return { name: p.split(sep).pop()!, path: relative(target, p).split(sep).join('/') || p.split(sep).pop()!, bytes };
  });
  if (total > MAX_PACKAGE_BYTES) throw new AppError('INVALID_ARGUMENT', '整包超过 400 MB，请拆开解析', 400);
  return { name: id.split('/').pop()!, files };
}

type RunIndex = Pick<TenderParseResult, 'id' | 'packageName' | 'source' | 'createdAt' | 'durationMs' | 'ruleVersion' | 'stats'> & { by: string };

async function run(by: string, name: string, files: SourceFile[], source: 'sample' | 'upload') {
  const result = await parsePackage(getRules(), name, files, source);
  put('tender_runs', result.id, result);
  const idx: RunIndex = { id: result.id, packageName: result.packageName, source, createdAt: result.createdAt, durationMs: result.durationMs, ruleVersion: result.ruleVersion, stats: result.stats, by };
  put('tender_run_index', result.id, idx);
  return result;
}

export const parseSample = (by: string, id: string) => { const s = loadSample(id); return run(by, s.name, s.files, 'sample'); };
export const parseUpload = (by: string, name: string, files: SourceFile[]) => {
  if (!files.length) throw new AppError('INVALID_ARGUMENT', '请至少上传一个文件', 400);
  return run(by, name || files[0].name, files, 'upload');
};
export const listRuns = () => list<RunIndex>('tender_run_index').slice(0, 50);
export function getRun(id: string): TenderParseResult {
  const r = get<TenderParseResult>('tender_runs', id);
  if (!r) throw new AppError('NOT_FOUND', '解析记录不存在', 404);
  return r;
}
