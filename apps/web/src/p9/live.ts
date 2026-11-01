// P9 读侧接线：后端 /api/bids* → 页面视图模型。接口不通或字段缺失时，调用方继续用 demo.ts 的设计稿数据。
// 只映射后端真实拥有的字段（列表、待办、澄清、会议、文件、健康度），AI 文案与样例对话不从这里来。
import type { BidRow, Clar, Comment, FileRow, Meeting, Status, Todo } from './demo';
import { NODES } from './demo';

type Json = Record<string, any>;
export type Api = (path: string, options?: Json) => Promise<any>;

const day = (v: unknown) => String(v || '').slice(0, 10);
const mmdd = (v: unknown, today: string | null) => { const d = day(v); return !d ? '—' : today && d === today ? '今天' : d.slice(5); };
const hm = (v: unknown) => { const m = String(v || '').match(/^\d{4}-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/); return m ? `${m[1]}-${m[2]} ${m[3]}:${m[4]}` : String(v || '—'); };
export const daysBetween = (from: string, to: string) => Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000);

function bidStatus(b: Json, today: string | null): Status {
  if (b.status === 'submitted') return '已交标';
  if (b.status === 'awarded') return '已定标';
  if (b.status === 'lost') return '已流标';
  if (b.riskFlag) return '风险';
  if (today && day(b.deadlineAt) && day(b.deadlineAt) < today) return '已逾期';
  return '进行中';
}

export function mapBidRow(b: Json, today: string | null, userId?: string): BidRow {
  const due = day(b.deadlineAt);
  const n = today && due ? daysBetween(today, due) : null;
  const [customer, ...rest] = String(b.name || '').split(' · ');
  return {
    id: b.id, number: b.number || b.id,
    customer: b.customerName || customer || '', project: b.projectName || rest.join(' · '),
    round: b.roundLabel || '首轮', node: Number(b.currentNode ?? 0),
    owner: b.ownerName || '—', team: b.sppTeam || '—', due,
    left: n === null ? '—' : n < 0 ? '已过' : n + ' 天', leftTone: n === null ? undefined : n < 0 ? 'red' : n <= 7 ? 'orange' : undefined,
    from: b.creatorName || b.ownerName || '—', fromDate: day(b.createdAt), status: bidStatus(b, today),
    mine: !!userId && b.ownerId === userId,
  };
}

const TODO_STATUS: Record<string, Todo['status']> = { done: '已完成', in_progress: '进行中', partial: '部分完成', cancelled: '已取消', delayed: '需延期', todo: '待开始' };
const OUTCOME_LABEL: Record<string, string> = { completed: '已完成', partial: '部分完成', cancelled: '已取消', delayed: '需延期' };
const srcLabel = (node: unknown, source: string) => source && !/^(manual|seed|decompose)/.test(source) ? source : (typeof node === 'number' ? `${'①②③④⑤⑥⑦⑧⑨⑩'[node]} ${NODES[node]}` : source || '—');

export function mapTodos(rows: Json[], today: string | null, overdueIds: Set<string>, userId?: string): Todo[] {
  return (rows || []).map(t => ({
    id: t.id, title: t.title, round: t.roundLabel || 'R1', src: srcLabel(t.node, t.source || ''),
    owner: t.assigneeName || '未派', due: mmdd(t.dueAt, today), pri: (t.priority || 'P2') as Todo['pri'],
    status: TODO_STATUS[t.status] || '待开始', mine: !!userId && t.assigneeId === userId, overdue: overdueIds.has(t.id),
    comments: (t.comments || []).slice().reverse().map((c: Json): Comment => ({ who: c.author, time: hm(c.at), text: c.text, system: c.author === '系统' })),
    result: t.result ? { outcome: OUTCOME_LABEL[t.result.outcome] || '已完成', who: t.assigneeName || '', time: hm(t.result.at), note: t.result.note || '' } : undefined,
  }));
}

const CLAR_TYPE: Record<string, Clar['type']> = { technical: '技术', business: '商务', deviation: '偏差' };
export function mapClars(rows: Json[], today: string | null): Clar[] {
  return (rows || []).map(c => ({
    id: c.id, type: CLAR_TYPE[c.clarType] || '技术', round: c.roundLabel || 'R1', dir: c.phase === 'post-bid' ? 'post-bid' : 'pre-bid',
    q: c.question, owner: c.ownerName || '—', due: mmdd(c.dueAt, today), status: c.status === 'open' ? '待答复' : '已答复', comments: (c.comments || []).length,
  }));
}

export function mapMeetings(rows: Json[]): Meeting[] {
  return (rows || []).map((m, i) => ({
    id: m.id, name: m.title, round: m.roundLabel || (i < 4 ? 'R1' : 'R2'), roundLabel: m.roundLabel ? '' : (i < 4 ? '首轮' : '短名单'),
    type: m.meetingType || '内部会', time: hm(m.startsAt), people: m.participantsCount || (m.participants || []).length,
    host: m.organizer || '—', rec: m.recording || '未录音', todo: '—', concl: '—',
    status: (['待开', '待纪要', '已出纪要'].includes(m.status) ? m.status : m.status === 'scheduled' ? '待开' : '已出纪要') as Meeting['status'],
  }));
}

export function mapFiles(rows: Json[]): FileRow[] {
  return (rows || []).map(d => {
    const name = String(d.filename || '');
    return {
      name, type: d.category || '投标文件', v: d.version || 'v1', size: d.size || '—', who: d.uploader || '—', time: d.updatedLabel || hm(d.updatedAt),
      status: (['进行中', '历史', '已归档'].includes(d.status) ? d.status : '进行中') as FileRow['status'],
      folder: ['会议文档', '澄清材料', '招标文件原件'].includes(d.category) ? d.category : '投标文件', sub: name.startsWith('商务') ? '商务标' : name.startsWith('技术') ? '技术标' : name.startsWith('报价') ? '报价文件' : '资质业绩',
      kind: name.endsWith('.xlsx') ? 'xls' : name.endsWith('.pdf') ? 'pdf' : 'doc',
    };
  });
}

export interface LiveBundle {
  today: string | null;
  node: number;
  daysLeft: number | null;
  health: { score: number; dims: [string, number][] } | null;
  todos: Todo[];
  clars: Clar[];
  meetings: Meeting[];
  files: FileRow[];
  quoteVisible: boolean | null;
}

/** 拉取单个投标的读侧数据；任何一个接口失败只让该块回落演示数据。 */
export async function loadBundle(api: Api, bidId: string, userId?: string): Promise<LiveBundle | null> {
  const get = (p: string) => api(p).catch(() => null);
  const base = '/bids/' + encodeURIComponent(bidId);
  const [detail, todos, clars, meetings, files, quote] = await Promise.all([
    get(base), get(base + '/todos'), get(base + '/clarifications'), get(base + '/meetings'), get(base + '/files'), get(base + '/quote-visibility'),
  ]);
  if (!detail) return null;
  const today: string | null = detail.today || null;
  const dims = detail.health?.dimensions || {};
  const order = ['进度排期', '商务部分', '技术部分', '报价文件', '偏差管理', '澄清响应'];
  const overdueIds = new Set<string>((detail.overdueTasks || []).map((t: Json) => t.id));
  const deadline = day(detail.bid?.deadlineAt);
  return {
    today, node: Number(detail.node?.current ?? detail.bid?.currentNode ?? 2),
    daysLeft: today && deadline ? daysBetween(today, deadline) : null,
    health: typeof detail.health?.score === 'number' ? { score: detail.health.score, dims: order.filter(k => k in dims).map(k => [k, Number(dims[k])] as [string, number]) } : null,
    todos: todos ? mapTodos(todos, today, overdueIds, userId) : [],
    clars: clars ? mapClars(clars, today) : [],
    meetings: meetings ? mapMeetings(meetings) : [],
    files: files ? mapFiles(files) : [],
    quoteVisible: quote ? !!(quote.visible ?? quote.canView) : null,
  };
}

export async function loadList(api: Api, userId?: string): Promise<{ rows: BidRow[]; today: string | null } | null> {
  try {
    const r = await api('/bids?limit=50');
    const rows = Array.isArray(r?.records) ? r.records : null;
    if (!rows) return null;
    return { rows: rows.map((b: Json) => mapBidRow(b, r.today || null, userId)), today: r.today || null };
  } catch { return null; }
}
