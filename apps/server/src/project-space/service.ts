import { allRecords, get, list, now, put, record, uid } from '../db.ts';
import { allowedRecord, canAccess, users } from '../crm.ts';
import { modelStatus, modelTurn } from '../model.ts';
import { AppError } from '../../../../packages/contracts/index.ts';
import {
  spaceExperts, spaceStages,
  type ExpertId, type ProjectSpace, type SpaceAuthor, type SpaceDetail, type SpaceMember,
  type SpaceMessage, type SpaceStageId, type SpaceThread, type SpaceTodo, type TaskCard,
} from '../../../../packages/contracts/project-space.ts';

/**
 * 项目空间服务。存储用 documents 表的四个集合：
 *   project_spaces / space_threads / space_messages / space_todos
 * 主会话 id 固定为 `<spaceId>:main`；每个专家任务一个子会话。
 */
type User = { id: string; name: string; role: string; teamId: string };

const SPACES = 'project_spaces', THREADS = 'space_threads', MESSAGES = 'space_messages', TODOS = 'space_todos';
export const mainThreadId = (spaceId: string) => spaceId + ':main';
const expert = (id: ExpertId) => spaceExperts.find((e) => e.id === id)!;

/** CRM 商机阶段（S1–S8）→ 业务主线（S1–S5）。 */
const STAGE_FROM_CRM: Record<string, SpaceStageId> = { S1: 'S1', S2: 'S2', S3: 'S3', S4: 'S4', S5: 'S4', S6: 'S5', S7: 'S5', S8: 'S5' };

function canView(u: User, s: ProjectSpace) {
  return u.role === 'admin' || s.members.some((m) => m.kind === 'user' && m.userId === u.id) || canAccess(u as any, s.customerId);
}
export function spaceFor(u: User, id: string) {
  const s = get<ProjectSpace>(SPACES, id);
  if (!s) throw new AppError('NOT_FOUND', '项目空间不存在', 404);
  if (!canView(u, s)) throw new AppError('FORBIDDEN', '你不是该项目空间的成员', 403);
  return s;
}
const saveSpace = (s: ProjectSpace) => put(SPACES, s.id, { ...s, updatedAt: now() }, null, s.opportunityId) as ProjectSpace;
const saveThread = (t: SpaceThread) => put(THREADS, t.id, { ...t, updatedAt: now() }, null, t.spaceId) as SpaceThread;
const saveMessage = (m: SpaceMessage) => put(MESSAGES, m.id, m, null, m.spaceId) as SpaceMessage;
const userAuthor = (u: User, s: ProjectSpace): SpaceAuthor => {
  const m = s.members.find((x) => x.kind === 'user' && x.userId === u.id);
  return { kind: 'user', userId: u.id, name: u.name, role: m?.role ?? (u.role === 'manager' ? '销售经理' : u.role === 'admin' ? '管理员' : '访客') };
};
const byTime = <T extends { createdAt: string }>(a: T, b: T) => a.createdAt.localeCompare(b.createdAt);

export function threadsOf(spaceId: string) {
  return list<SpaceThread>(THREADS).filter((t) => t.spaceId === spaceId).sort(byTime);
}
export function messagesOf(threadId: string) {
  return list<SpaceMessage>(MESSAGES).filter((m) => m.threadId === threadId).sort(byTime);
}

// ---------- 空间 ----------

export function listSpaces(u: User) {
  return list<ProjectSpace>(SPACES).filter((s) => canView(u, s)).map((s) => {
    const threads = threadsOf(s.id);
    return { ...s, running: threads.filter((t) => t.status === 'running').length, threads: threads.filter((t) => t.kind === 'expert').length };
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function createSpace(u: User, opportunityId: string) {
  const opp = allowedRecord(u as any, opportunityId, 'opportunity');
  const existing = list<ProjectSpace>(SPACES).find((s) => s.opportunityId === opp.id);
  if (existing) return existing;
  const customer = record(opp.customerId);
  const at = now(), id = uid('PS');
  const s: ProjectSpace = {
    id, opportunityId: opp.id, customerId: opp.customerId,
    customerName: customer?.name ?? opp.customerId, opportunityName: opp.name,
    winConfidence: 50, stage: STAGE_FROM_CRM[opp.stage] ?? 'S1',
    members: [
      { id: uid('PM'), kind: 'user', userId: u.id, name: u.name, role: '销售', addedAt: at },
      { id: uid('PM'), kind: 'expert', expertId: 'win-navigator', name: expert('win-navigator').name, role: 'AI 专家', addedAt: at },
    ],
    createdBy: u.id, createdAt: at, updatedAt: at,
  };
  saveSpace(s);
  saveThread({ id: mainThreadId(id), spaceId: id, kind: 'main', title: '项目群聊', status: 'done', createdAt: at, updatedAt: at });
  systemMessage(s, mainThreadId(id), `${u.name} 创建了项目空间。在群里 @ 专家即可派发任务，专家会在子会话里执行，完成后回到群里汇报。`);
  return s;
}

export function spaceDetail(u: User, id: string, threadId?: string): SpaceDetail {
  const space = spaceFor(u, id);
  const threads = threadsOf(id);
  const active = threadId && threads.some((t) => t.id === threadId) ? threadId : mainThreadId(id);
  const todos = list<SpaceTodo>(TODOS).filter((t) => t.spaceId === id).sort((a, b) => Number(a.status === 'completed') - Number(b.status === 'completed') || String(a.dueAt).localeCompare(String(b.dueAt)));
  return { space, threads, messages: messagesOf(active), activeThreadId: active, todos, modelConfigured: modelStatus().configured };
}

export function updateSpace(u: User, id: string, patch: { stage?: SpaceStageId; winConfidence?: number }) {
  const s = spaceFor(u, id);
  const next = { ...s, ...patch };
  saveSpace(next);
  if (patch.stage && patch.stage !== s.stage) {
    const st = spaceStages.find((x) => x.id === patch.stage)!;
    systemMessage(next, mainThreadId(id), `${u.name} 将业务主线推进到 ${st.id} ${st.name}。`);
  }
  if (patch.winConfidence !== undefined && patch.winConfidence !== s.winConfidence) {
    systemMessage(next, mainThreadId(id), `${u.name} 将赢单信心度从 ${s.winConfidence}% 调整为 ${patch.winConfidence}%。`);
  }
  return next;
}

// ---------- 成员 ----------

export function addMember(u: User, id: string, body: { kind: 'user'; userId: string; role: SpaceMember['role'] } | { kind: 'expert'; expertId: ExpertId }) {
  const s = spaceFor(u, id);
  const at = now();
  let member: SpaceMember;
  if (body.kind === 'user') {
    const target = users().find((x) => x.id === body.userId);
    if (!target) throw new AppError('NOT_FOUND', '成员不存在', 404);
    if (s.members.some((m) => m.kind === 'user' && m.userId === target.id)) throw new AppError('CONFLICT', `${target.name} 已在项目空间中`, 409);
    member = { id: uid('PM'), kind: 'user', userId: target.id, name: target.name, role: body.role as any, addedAt: at };
  } else {
    if (s.members.some((m) => m.kind === 'expert' && m.expertId === body.expertId)) throw new AppError('CONFLICT', `${expert(body.expertId).name} 已在项目空间中`, 409);
    member = { id: uid('PM'), kind: 'expert', expertId: body.expertId, name: expert(body.expertId).name, role: 'AI 专家', addedAt: at };
  }
  const next = saveSpace({ ...s, members: [...s.members, member] });
  systemMessage(next, mainThreadId(id), `${u.name} 邀请 ${member.name}（${member.role}）加入项目空间。`);
  return next;
}

export function removeMember(u: User, id: string, memberId: string) {
  const s = spaceFor(u, id);
  const m = s.members.find((x) => x.id === memberId);
  if (!m) throw new AppError('NOT_FOUND', '成员不存在', 404);
  if (m.kind === 'user' && m.userId === s.createdBy) throw new AppError('INVALID_ARGUMENT', '不能移除空间创建人', 400);
  const next = saveSpace({ ...s, members: s.members.filter((x) => x.id !== memberId) });
  systemMessage(next, mainThreadId(id), `${u.name} 将 ${m.name} 移出项目空间。`);
  return next;
}

// ---------- 消息与专家子会话 ----------

function systemMessage(s: ProjectSpace, threadId: string, content: string) {
  return saveMessage({ id: uid('MSG'), spaceId: s.id, threadId, author: { kind: 'system', name: '系统' }, content, mentions: [], createdAt: now() });
}

export function postMessage(u: User, spaceId: string, threadId: string, body: { content: string; mentions: ExpertId[] }) {
  let s = spaceFor(u, spaceId);
  const thread = get<SpaceThread>(THREADS, threadId);
  if (!thread || thread.spaceId !== spaceId) throw new AppError('NOT_FOUND', '会话不存在', 404);
  const message = saveMessage({ id: uid('MSG'), spaceId, threadId, author: userAuthor(u, s), content: body.content, mentions: thread.kind === 'main' ? body.mentions : [], createdAt: now() });

  if (thread.kind === 'expert') {
    // 子会话里继续追问：同一位专家接着执行。
    if (thread.status === 'running') throw new AppError('CONFLICT', '专家正在执行，请稍候再追问', 409);
    saveThread({ ...thread, status: 'running', error: undefined });
    void runExpert(thread.id);
    return { message, threads: [] as SpaceThread[] };
  }

  // 主会话：每个 @ 到的专家开一个子会话执行任务。未在空间里的专家自动加入。
  const created: SpaceThread[] = [];
  for (const expertId of [...new Set(body.mentions)]) {
    if (!s.members.some((m) => m.kind === 'expert' && m.expertId === expertId)) s = addMember(u, spaceId, { kind: 'expert', expertId });
    const at = now();
    const t = saveThread({
      id: uid('TH'), spaceId, kind: 'expert', expertId, title: taskTitle(body.content),
      status: 'running', originMessageId: message.id, createdBy: u.id, createdAt: at, updatedAt: at,
    });
    saveMessage({ id: uid('MSG'), spaceId, threadId: t.id, author: userAuthor(u, s), content: body.content, mentions: [], createdAt: at });
    saveMessage({ id: uid('MSG'), spaceId, threadId: mainThreadId(spaceId), author: { kind: 'expert', expertId, name: expert(expertId).name }, content: '', mentions: [], card: { threadId: t.id, expertId, title: t.title, status: 'running' }, createdAt: now() });
    created.push(t);
    void runExpert(t.id);
  }
  saveSpace(s);
  return { message, threads: created };
}

function taskTitle(content: string) {
  const plain = content.replace(/@\S+/g, '').replace(/\s+/g, ' ').trim();
  return plain.length > 28 ? plain.slice(0, 28) + '…' : plain || '新任务';
}

/** 把主会话最近的群聊作为背景交给专家，子会话自身的往来作为对话历史。 */
function expertMessages(s: ProjectSpace, t: SpaceThread) {
  const e = expert(t.expertId!);
  const st = spaceStages.find((x) => x.id === s.stage)!;
  const people = s.members.map((m) => `${m.name}（${m.role}）`).join('、');
  const recentGroup = messagesOf(mainThreadId(s.id)).filter((m) => m.content).slice(-12)
    .map((m) => `${m.author.name}：${m.content}`).join('\n');
  const system = [
    e.prompt,
    `你在「${s.customerName} · ${s.opportunityName}」的项目空间里工作。当前业务阶段：${st.id} ${st.name}；赢单信心度 ${s.winConfidence}%。`,
    `项目成员：${people}。`,
    '用中文回答，直接给结论和可执行的下一步，指明由哪位成员负责；信息不足时列出需要补充的具体问题，不要编造数据。',
    '最后单独一行写「摘要：」开头的一句话（不超过 80 字），这句话会同步到项目群聊。',
  ].join('\n');
  const history = messagesOf(t.id).map((m) => ({
    role: m.author.kind === 'expert' ? 'assistant' : 'user',
    content: m.author.kind === 'user' ? `${m.author.name}（${m.author.role}）：${m.content}` : m.content,
  }));
  return [{ role: 'system', content: system }, { role: 'system', content: '项目群聊近况（仅供参考）：\n' + (recentGroup || '暂无') }, ...history];
}

function splitSummary(text: string) {
  const lines = text.trim().split('\n');
  const at = lines.map((l) => l.replace(/^[#>*\s]+/, '')).findLastIndex((l) => l.startsWith('摘要：') || l.startsWith('摘要:'));
  if (at < 0) return { body: text.trim(), summary: text.replace(/\s+/g, ' ').trim().slice(0, 80) };
  return { body: lines.slice(0, at).join('\n').trim(), summary: lines[at].replace(/^[#>*\s]+/, '').replace(/^摘要[：:]\s*/, '').trim() };
}

function updateCard(t: SpaceThread, patch: Partial<TaskCard>) {
  const card = messagesOf(mainThreadId(t.spaceId)).find((m) => m.card?.threadId === t.id);
  if (card) saveMessage({ ...card, card: { ...card.card!, ...patch } });
}

const running = new Set<string>();
export async function runExpert(threadId: string) {
  if (running.has(threadId)) return;
  running.add(threadId);
  const t = get<SpaceThread>(THREADS, threadId)!;
  const s = get<ProjectSpace>(SPACES, t.spaceId)!;
  const e = expert(t.expertId!);
  const first = messagesOf(t.id).filter((m) => m.author.kind === 'expert').length === 0;
  try {
    const reply = await modelTurn(expertMessages(s, t), [], AbortSignal.timeout(180_000), () => {});
    const { body, summary } = splitSummary(reply.content || '');
    if (!body && !summary) throw new AppError('MODEL_API_ERROR', '模型没有返回内容', 502);
    saveMessage({ id: uid('MSG'), spaceId: s.id, threadId: t.id, author: { kind: 'expert', expertId: e.id, name: e.name }, content: body || summary, mentions: [], createdAt: now() });
    saveThread({ ...get<SpaceThread>(THREADS, t.id)!, status: 'done', summary, error: undefined });
    updateCard(t, { status: 'done', summary });
    // 首次完成回群里汇报；子会话里的后续追问只更新卡片摘要。
    if (first) saveMessage({ id: uid('MSG'), spaceId: s.id, threadId: mainThreadId(s.id), author: { kind: 'expert', expertId: e.id, name: e.name }, content: summary, mentions: [], createdAt: now() });
  } catch (err: any) {
    const error = err?.code === 'MODEL_NOT_CONFIGURED' ? '在线模型未配置，专家暂时无法执行。请管理员在“管理员设置”中配置模型。' : (err?.message || '专家执行失败');
    saveThread({ ...get<SpaceThread>(THREADS, t.id)!, status: 'failed', error });
    updateCard(t, { status: 'failed', summary: error });
  } finally {
    running.delete(threadId);
  }
}

export function retryThread(u: User, threadId: string) {
  const t = get<SpaceThread>(THREADS, threadId);
  if (!t || t.kind !== 'expert') throw new AppError('NOT_FOUND', '子会话不存在', 404);
  spaceFor(u, t.spaceId);
  if (t.status === 'running') return t;
  const next = saveThread({ ...t, status: 'running', error: undefined });
  updateCard(t, { status: 'running', summary: undefined });
  void runExpert(t.id);
  return next;
}

/** 服务重启时，未完成的专家任务标为失败，可在子会话里重试。 */
export function recoverInterruptedThreads() {
  for (const t of list<SpaceThread>(THREADS)) if (t.status === 'running' && t.kind === 'expert') {
    saveThread({ ...t, status: 'failed', error: '服务重启，任务已中断，请重试' });
    updateCard(t, { status: 'failed', summary: '服务重启，任务已中断，请重试' });
  }
}

// ---------- 待办 ----------

export function myTodos(u: User) {
  return list<SpaceTodo>(TODOS).filter((t) => t.assigneeId === u.id && t.status === 'pending').map((t) => {
    const s = get<ProjectSpace>(SPACES, t.spaceId);
    return s && canView(u, s) ? { ...t, spaceName: `${s.customerName} · ${s.opportunityName}` } : null;
  }).filter(Boolean).sort((a: any, b: any) => String(a.dueAt).localeCompare(String(b.dueAt)));
}

export function setTodoStatus(u: User, id: string, status: SpaceTodo['status']) {
  const t = get<SpaceTodo>(TODOS, id);
  if (!t) throw new AppError('NOT_FOUND', '待办不存在', 404);
  const s = spaceFor(u, t.spaceId);
  const next = put(TODOS, id, { ...t, status }, t.assigneeId, t.spaceId) as SpaceTodo;
  if (status === 'completed' && t.status !== 'completed') systemMessage(s, mainThreadId(s.id), `${u.name} 完成了待办「${t.title}」。`);
  return next;
}

/** 可加入空间的人员，供“添加成员”使用。 */
export function memberCandidates() {
  return users().filter((x) => x.role !== 'admin').map((x) => ({ id: x.id, name: x.name, teamId: x.teamId }));
}

/** 可创建空间的商机（当前用户可见，且还没有空间）。 */
export function opportunityOptions(u: User, q = '') {
  const used = new Set(list<ProjectSpace>(SPACES).map((s) => s.opportunityId));
  return allRecords('opportunity').filter((o) => !used.has(o.id) && canAccess(u as any, o.customerId) && (!q || (o.name + o.id).toLowerCase().includes(q.toLowerCase())))
    .slice(0, 20).map((o) => ({ id: o.id, name: o.name, customerName: record(o.customerId)?.name ?? o.customerId, stage: o.stage }));
}
