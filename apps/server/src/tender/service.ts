import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import JSZip from 'jszip';
import { dbPath, get, list, now, put, uid } from '../db.ts';
import { AppError } from '../../../../packages/contracts/index.ts';
import type { TenderJob, TenderParseResult, TenderProgress } from '../../../../packages/contracts/tender.ts';
import { modelStatus } from '../model.ts';
import { getRules } from './rules.ts';
import { parsePackage } from './pipeline.ts';
import { makeJudge } from './judge.ts';
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
  const pushPackage = (p: string, name: string) => {
    const files = walk(p);
    packages.push({ id: relative(root, p).split(sep).join('/'), name, kind: 'package', files: files.length, size: files.reduce((s, f) => s + statSync(f).size, 0) });
  };
  const bundles = join(root, '整包');
  if (existsSync(bundles)) {
    for (const name of readdirSync(bundles).sort()) {
      const p = join(bundles, name);
      if (statSync(p).isDirectory()) pushPackage(p, name);
    }
  }
  // 根目录下直接放的文件夹也当一个整包（真实项目常直接把下载的整包目录丢进来）
  for (const name of readdirSync(root).sort()) {
    const p = join(root, name);
    if (statSync(p).isDirectory()) { if (name !== '整包') pushPackage(p, name); continue; }
    if (SKIP.test(name) || name.endsWith('.partial') || name.endsWith('.md')) continue;
    packages.push({ id: name, name, kind: 'single', files: 1, size: statSync(p).size });
  }
  return { root, packages };
}

export function loadSample(id: string): { name: string; files: SourceFile[] } {
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

type OnProgress = (p: TenderProgress) => void;

/** 上传的原文件存在数据目录（和数据库同级，Git 忽略），按解析记录分目录，相对路径不变 */
const uploadRoot = (runId: string) => join(dirname(dbPath), 'tender-uploads', runId);
const safeSegments = (path: string) => path.split(/[\\/]/).filter((s) => s && s !== '.' && s !== '..');

async function run(by: string, name: string, files: SourceFile[], source: 'sample' | 'upload', onProgress?: OnProgress, sampleId?: string) {
  const rules = getRules();
  // 没配模型就走规则，结果上会明确标「未经模型复核」
  const judge = rules.judge.enabled && modelStatus().configured ? makeJudge() : undefined;
  const result = await parsePackage(rules, name, files, source, { judge, onProgress, onExcluded: (runId, excluded) => put('tender_excluded', runId, excluded) });
  if (sampleId) result.sampleId = sampleId;
  if (source === 'upload') {
    for (const f of files) {
      const target = join(uploadRoot(result.id), ...safeSegments(f.path || f.name));
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, f.bytes);
    }
  }
  put('tender_runs', result.id, result);
  const idx: RunIndex = { id: result.id, packageName: result.packageName, source, createdAt: result.createdAt, durationMs: result.durationMs, ruleVersion: result.ruleVersion, stats: result.stats, by };
  put('tender_run_index', result.id, idx);
  return result;
}

export const parseSample = (by: string, id: string, onProgress?: OnProgress) => { const s = loadSample(id); return run(by, s.name, s.files, 'sample', onProgress, id); };

const MIME: Record<string, string> = {
  pdf: 'application/pdf', txt: 'text/plain; charset=utf-8', md: 'text/plain; charset=utf-8', csv: 'text/csv; charset=utf-8',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', doc: 'application/msword',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xlsm: 'application/vnd.ms-excel.sheet.macroEnabled.12',
  zip: 'application/zip', kmz: 'application/vnd.google-earth.kmz', dwg: 'application/acad',
};
/** 浏览器能直接看的就在新标签页打开，其余下载 */
const INLINE = new Set(['pdf', 'txt', 'md', 'csv', 'jpg', 'jpeg', 'png', 'gif', 'webp']);

/**
 * 读一次解析里某个文件的原始内容：样本从样本库读，上传的从数据目录读；压缩包里的文件现解压。
 * 路径都限制在各自根目录内。
 */
export async function readRunFile(runId: string, fileId: string) {
  const r = getRun(runId);
  const f = r.files.find((x) => x.id === fileId);
  if (!f) throw new AppError('NOT_FOUND', '解析记录里没有这个文件', 404);
  let root: string;
  if (r.sampleId) root = resolve(sampleRoot(), r.sampleId);
  else if (r.source === 'upload') root = uploadRoot(r.id);
  else throw new AppError('NOT_FOUND', '这次解析没有保存原文件，重新解析一次后可以打开', 404);
  if (!existsSync(root)) throw new AppError('NOT_FOUND', '原文件已不在，重新上传后可以打开', 404);
  const segs = safeSegments(f.path || f.name);
  let bytes: Uint8Array | undefined;
  if (statSync(root).isFile()) bytes = new Uint8Array(readFileSync(root));
  else {
    const direct = join(root, ...segs);
    if (!direct.startsWith(root + sep)) throw new AppError('INVALID_ARGUMENT', '文件路径不合法', 400);
    if (existsSync(direct) && statSync(direct).isFile()) bytes = new Uint8Array(readFileSync(direct));
    // 压缩包里的文件：路径是「包路径/内部路径」，从后往前找到压缩包再解压
    for (let i = segs.length - 1; !bytes && i >= 1; i--) {
      const zipPath = join(root, ...segs.slice(0, i));
      if (!/\.zip$/i.test(zipPath) || !existsSync(zipPath) || !statSync(zipPath).isFile()) continue;
      const entry = (await JSZip.loadAsync(readFileSync(zipPath))).file(segs.slice(i).join('/'));
      if (entry) bytes = await entry.async('uint8array');
    }
  }
  if (!bytes) throw new AppError('NOT_FOUND', '原文件已不在，重新上传后可以打开', 404);
  const ext = f.ext.toLowerCase();
  return { name: f.name, bytes, mime: MIME[ext] || 'application/octet-stream', inline: INLINE.has(ext) };
}
export const parseUpload = (by: string, name: string, files: SourceFile[], onProgress?: OnProgress) => {
  if (!files.length) throw new AppError('INVALID_ARGUMENT', '请至少上传一个文件', 400);
  return run(by, name || files[0].name, files, 'upload', onProgress);
};

// ---- 后台解析任务：接入模型后大包要几分钟，不能占着一个 HTTP 请求 ----
const activeJobs = new Set<string>();

export function startJob(by: string, packageName: string, bidId: string | undefined, work: (onProgress: OnProgress) => Promise<{ runId: string }>): TenderJob {
  const job: TenderJob = { id: uid('tjob'), status: 'running', bidId, by, packageName, progress: { stage: 'extract', done: 0, total: 1, message: '排队中' }, createdAt: now() };
  put('tender_jobs', job.id, job);
  activeJobs.add(job.id);
  void work((progress) => { put('tender_jobs', job.id, { ...job, progress }); })
    .then(({ runId }) => { put('tender_jobs', job.id, { ...job, status: 'done', runId, progress: { stage: 'summary', done: 1, total: 1, message: '解析完成' } }); })
    .catch((e: Error) => { put('tender_jobs', job.id, { ...job, status: 'failed', error: e.message }); })
    .finally(() => { activeJobs.delete(job.id); });
  return job;
}
/** 任务只在进程内跑，服务重启后没跑完的任务不会自己恢复，读取时如实标失败。 */
const settled = (job: TenderJob): TenderJob => (job.status === 'running' && !activeJobs.has(job.id)
  ? { ...job, status: 'failed', error: '服务重启，解析中断，请重新解析' } : job);
export function getJob(id: string): TenderJob {
  const job = get<TenderJob>('tender_jobs', id);
  if (!job) throw new AppError('NOT_FOUND', '解析任务不存在', 404);
  return settled(job);
}
export const runningJobForBid = (bidId: string) => list<TenderJob>('tender_jobs').find((j) => j.bidId === bidId && settled(j).status === 'running');
export const listRuns = () => list<RunIndex>('tender_run_index').slice(0, 50);
export function getRun(id: string): TenderParseResult {
  const r = get<TenderParseResult>('tender_runs', id);
  if (!r) throw new AppError('NOT_FOUND', '解析记录不存在', 404);
  return r;
}
