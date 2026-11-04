import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { get, list, now, put, uid } from '../db.ts';
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

async function run(by: string, name: string, files: SourceFile[], source: 'sample' | 'upload', onProgress?: OnProgress) {
  const rules = getRules();
  // 没配模型就走规则，结果上会明确标「未经模型复核」
  const judge = rules.judge.enabled && modelStatus().configured ? makeJudge() : undefined;
  const result = await parsePackage(rules, name, files, source, { judge, onProgress, onExcluded: (runId, excluded) => put('tender_excluded', runId, excluded) });
  put('tender_runs', result.id, result);
  const idx: RunIndex = { id: result.id, packageName: result.packageName, source, createdAt: result.createdAt, durationMs: result.durationMs, ruleVersion: result.ruleVersion, stats: result.stats, by };
  put('tender_run_index', result.id, idx);
  return result;
}

export const parseSample = (by: string, id: string, onProgress?: OnProgress) => { const s = loadSample(id); return run(by, s.name, s.files, 'sample', onProgress); };
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
