// P9 投标全流程 · 种子加载器（新增文件，不改现有 seed.ts）。
// 只读 fixtures/p9/*.json，不写库、不调后端、不含任何密钥。
// 演示时钟：P9 演示时钟固定 2026-10-24，只用于 P9 相对标签计算，
// 绝不改全局 BUSINESS_CLOCK（implementation-plan §1）。
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const P9_DEMO_CLOCK = '2026-10-24';
export const P9_MAIN_BID_ID = 'BID-20261010-003';

export interface P9Seed {
  bid: any;
  bids: any;
  planItems: any;
  todos: any;
  clarifications: any;
  meetings: any;
  files: any;
  blockers: any;
  submissionCheck: any;
  bafo: any;
  review: any;
  strategyVersions: any;
  pipelineExamples: any;
  reminders: any;
}

const SEED_FILES: Array<[keyof P9Seed, string]> = [
  ['bid', 'bid-20261010-003.json'],
  ['bids', 'bids.json'],
  ['planItems', 'plan-items.json'],
  ['todos', 'todos.json'],
  ['clarifications', 'clarifications.json'],
  ['meetings', 'meetings.json'],
  ['files', 'files.json'],
  ['blockers', 'blockers.json'],
  ['submissionCheck', 'submission-check.json'],
  ['bafo', 'bafo.json'],
  ['review', 'review.json'],
  ['strategyVersions', 'strategy-versions.json'],
  ['pipelineExamples', 'pipeline-examples.json'],
  ['reminders', 'reminders.json'],
];

function fixturesDir(): string {
  // 本文件位于 apps/server/src/p9/，仓库根为上 4 级。
  const here = dirname(fileURLToPath(import.meta.url));
  const candidate = join(here, '..', '..', '..', '..', 'fixtures', 'p9');
  if (existsSync(join(candidate, 'bid-20261010-003.json'))) return candidate;
  // 兜底：从当前工作目录向上找（测试以仓库根运行时）。
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const c = join(dir, 'fixtures', 'p9');
    if (existsSync(join(c, 'bid-20261010-003.json'))) return c;
    dir = dirname(dir);
  }
  throw new Error('P9 seed fixtures not found: fixtures/p9/bid-20261010-003.json');
}

function loadJson(dir: string, file: string): any {
  return JSON.parse(readFileSync(join(dir, file), 'utf8'));
}

/** 校验种子自洽性：所有计数由条目算出，硬编码的原型冲突数字一律不采信。 */
export function validateP9Seed(seed: P9Seed): string[] {
  const errors: string[] = [];
  const atb = seed.bid.atb as any[];
  if (atb.length !== 43) errors.push(`ATB total ${atb.length} !== 43`);
  if (atb.filter((x) => x.status === 'filled').length !== 21) errors.push('ATB filled !== 21');
  if (atb.filter((x) => x.status === 'gap').length !== 22) errors.push('ATB gap !== 22');
  if (seed.bid.demoClock !== P9_DEMO_CLOCK) errors.push('demoClock !== 2026-10-24');
  if (seed.bid.health.score !== 68 || seed.bid.health.safetyLine !== 80) errors.push('health 68/80 mismatch');
  if (seed.bids.list.rows.length !== 6) errors.push('list rows !== 6');
  if (seed.bids.sameOpportunity.length !== 3) errors.push('same-opportunity rows !== 3');
  if (seed.planItems.items.length !== 34) errors.push('plan items !== 34');
  if (seed.todos.todos.length !== 12) errors.push('todos !== 12');
  if (seed.clarifications.clarifications.length !== 8) errors.push('clarifications !== 8');
  if (seed.clarifications.clarifications.filter((x: any) => x.status === 'pending').length !== 3) errors.push('clarifications pending !== 3');
  if (seed.meetings.meetings.length !== 6) errors.push('meetings !== 6');
  if (seed.files.files.length !== 18) errors.push('files !== 18');
  if (seed.bafo.fieldDiffsR1ToR2.length !== 4) errors.push('BAFO field diffs !== 4');
  if (!String(seed.review.conclusion).includes('6.2%') || !String(seed.review.conclusion).includes('6分')) errors.push('review conclusion mismatch');
  return errors;
}

/** 加载全部 P9 种子并校验；校验失败抛错，不返回半截数据。 */
export function loadP9Seed(): P9Seed {
  const dir = fixturesDir();
  const seed = {} as P9Seed;
  for (const [key, file] of SEED_FILES) (seed as any)[key] = loadJson(dir, file);
  const errors = validateP9Seed(seed);
  if (errors.length) throw new Error('P9 seed validation failed: ' + errors.join('; '));
  return seed;
}

let cached: P9Seed | null = null;
/** 缓存版加载（同一进程内复用；协调人接线时可直接用它）。 */
export function getP9Seed(): P9Seed {
  if (!cached) cached = loadP9Seed();
  return cached;
}

/** 由条目算出的派生计数（界面一律用这些值，不硬抄原型数字）。 */
export function p9SeedCounts(seed: P9Seed) {
  const items = seed.planItems.items as any[];
  const todos = seed.todos.todos as any[];
  const overdue = todos.filter(
    (t) => t.status !== 'completed' && String(t.due).slice(0, 10) < P9_DEMO_CLOCK,
  );
  return {
    atbTotal: seed.bid.atb.length,
    atbFilled: seed.bid.atb.filter((x: any) => x.status === 'filled').length,
    atbGap: seed.bid.atb.filter((x: any) => x.status === 'gap').length,
    planTotal: items.length,
    planUnassigned: items.filter((x) => !x.owner).length,
    planCompleted: items.filter((x) => x.status === 'completed').length,
    planBlocked: items.filter((x) => x.status === 'blocked').length,
    todosTotal: todos.length,
    todosOverdue: overdue.length,
    todosCompleted: todos.filter((t) => t.status === 'completed').length,
    clarificationsTotal: seed.clarifications.clarifications.length,
    clarificationsPending: seed.clarifications.clarifications.filter((x: any) => x.status === 'pending').length,
    blockersOpen: seed.blockers.blockers.filter((x: any) => x.status !== '已闭环').length,
    filesTotal: seed.files.files.length,
    meetingsTotal: seed.meetings.meetings.length,
  };
}
