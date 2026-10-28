// P9 演示种子写入（协调人集成文件）。
// 来源：fixtures/p9/*.json（数据组）+ apps/web/src/p9/data.ts（前端演示数据，保证前端本地 ID 与后端记录对齐）。
// 幂等：以 meta p9SeedVersion 为准，已写入则跳过；失败只告警不阻断服务器启动。
// 注意：演示数据 only；生产路径不受影响；不含任何密钥与金额字段（报价版本只含商业条款）。
import { saveRecord, setMeta, meta, now } from '../db.ts';
import { getP9Seed } from './seed-data.ts';
import { CHECKLIST_TEMPLATES } from '../../../../packages/contracts/p9.ts';
import { BIDS, OPP_BIDS, PLAN_ITEMS, TODOS } from '../../../web/src/p9/data.ts';

export const P9_SEED_VERSION = '2026.10.29-p9-v1';
const MAIN_BID = 'BID-20261010-003';
const CATL_CUSTOMER = 'C-CATL-001';
const CATL_OPP = 'OP-CATL-001';

const USER_BY_NAME: Record<string, string> = { '李明': 'U-019', '张小小': 'U-018', '王经理': 'U-020' };
const userId = (name: string | null | undefined): string | null =>
  name ? USER_BY_NAME[name] ?? null : null;

const NODE_BY_NAME: Record<string, number> = {
  '商机判断': 0, '投标策略制定': 1, '标书分解': 2, '开工会': 3, '澄清跟进': 4,
  '投标文件制作': 5, '交标': 6, '澄清环节跟进': 7, 'BAFO': 8, '定标': 9,
};
function nodeFromSource(src: string): number {
  if (src.includes('交标')) return 6;
  if (src.includes('报价提报')) return 5;
  if (src.includes('澄清会')) return 4;
  if (src.startsWith('①')) return 0;
  if (src.startsWith('③')) return 2;
  if (src.startsWith('⑤')) return 4;
  if (src.startsWith('⑥')) return 5;
  if (src.startsWith('⑦')) return 6;
  return 2;
}
function toISODateTime(date: string, time = '18:00:00+08:00'): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return `${date}T${time}`;
  return date;
}
function feDueToISO(due: string): string {
  if (due === '今天') return '2026-10-24T18:00:00+08:00';
  if (/^\d{2}-\d{2}$/.test(due)) return `2026-${due}T18:00:00+08:00`;
  return toISODateTime(due);
}
function meetingTimeToISO(t: string): string {
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00+08:00` : t;
}

function rec(r: Record<string, unknown>): void {
  saveRecord({ ...r, updatedAt: now() });
}

export function seedP9(): void {
  try {
    if (String(meta('p9SeedVersion', '')) === P9_SEED_VERSION) return;
    const s = getP9Seed();
    const bid = s.bid as Record<string, any>;
    const atbArr = Array.isArray(bid.atb) ? bid.atb : [];
    const atbGaps = atbArr.filter((x: any) => x.status === 'gap').map((x: any) => x.field);
    const atbFilled = atbArr.filter((x: any) => x.status === 'filled').length;
    const stratVers = (s.strategyVersions as any).versions as any[];
    const v1 = stratVers.find((v) => v.version === 1) ?? stratVers[0];
    const v2 = stratVers.find((v) => v.version === 2);
    const dirOf = (v: any) => ({
      main: v?.direction?.['主打点'] ?? v?.direction?.main ?? '',
      avoid: v?.direction?.['避让点'] ?? v?.direction?.avoid ?? '',
      posture: v?.direction?.posture ?? '',
    });
    const hist = stratVers.map((v: any) => ({
      version: v.version,
      direction: dirOf(v),
      changes: v.changes ?? `再制作（触发：${v.trigger ?? ''}）`,
      trigger: v.trigger ?? '',
      bafoRound: v.linkedBafoRound ?? '',
      status: v.status === '已采用' ? 'confirmed' : 'draft',
      createdAt: v.created ?? '2026-10-12',
      createdBy: 'U-019',
    }));
    const custReq = ((s.submissionCheck as any).customerRequirements ?? []).map((r: any) => ({
      id: r.id,
      requirement: r.requirement,
      status: r.status === 'passed' ? 'met' : r.status === 'deviation' ? 'deviation' : 'pending',
    }));

    // 客户与商机（默认演示用户张小小 U-018 归属，保证列表可见）。
    rec({ id: CATL_CUSTOMER, type: 'customer', customerId: CATL_CUSTOMER, name: '宁德时代新能源', country: '中国', region: '亚太', roles: ['业主'], businessMode: 'utility_scale', ownerId: 'U-018', description: 'P9 演示客户（宁德时代·储能项目）。' });
    rec({ id: CATL_OPP, type: 'opportunity', customerId: CATL_CUSTOMER, entityType: 'customer', entityId: CATL_CUSTOMER, name: '储能项目', stage: 'S4', businessMode: 'utility_scale', ownerId: 'U-018', description: 'P9 演示商机。' });

    // 主标。
    rec({
      id: MAIN_BID, type: 'bid', customerId: CATL_CUSTOMER, entityType: 'opportunity', entityId: CATL_OPP,
      number: MAIN_BID, customerName: '宁德时代', projectName: '储能项目', name: '宁德时代 · 储能项目',
      opportunityId: CATL_OPP, status: 'in_progress', currentNode: 2, ownerId: 'U-019', sppTeam: '储能 SPP',
      pricingTeam: [], deadlineAt: '2026-11-05T14:00:00+08:00', createdAt: '2026-10-10T09:00:00+08:00',
      atb: { total: atbArr.length || 43, filled: atbFilled || 21, gaps: atbGaps },
      strategy: {
        scope: v1?.inputs?.['招标范围'] ?? '', customer: v1?.inputs?.['对客策略'] ?? '',
        competition: v1?.inputs?.['竞争策略'] ?? '', aiDirection: dirOf(v1), status: 'saved', updatedAt: now(),
      },
      strategyHistory: hist, aiPipeline: 'executing', aiDraft: null, aiLastError: null,
      reviewStatus: 'none', submission: null, award: null, groupUrl: null,
      customerRequirements: custReq, approvalNo: null, approvalStatus: null,
      health: bid.health ?? null, deposit: bid.deposit ?? null, reviewDraft: (s.review as any) ?? null,
      demoClock: '2026-10-24',
    });

    const child = (r: Record<string, unknown>) => rec({ ...r, customerId: CATL_CUSTOMER, entityType: 'bid', entityId: MAIN_BID });
    // 分解条目（数据组 34 条）。
    for (const it of (s.planItems as any).items as any[]) {
      child({ id: it.id, type: 'bid_item', bidId: MAIN_BID, name: it.title, title: it.title, category: it.category, sourceClause: it.sourceClause ?? '', node: 2, assigneeId: userId(it.owner), assigneeRole: '', assigneeName: it.owner ?? null, start: it.start, end: it.end, status: it.status, deliverable: '' });
    }
    // 前端演示计划行（p1..p8，保证前端甘特拖拽在真实模式下命中后端记录）。
    for (const p of PLAN_ITEMS as any[]) {
      child({ id: p.id, type: 'bid_item', bidId: MAIN_BID, name: p.title, title: p.title, category: '计划', sourceClause: '', node: 2, assigneeId: userId(p.owner), assigneeRole: '', assigneeName: p.owner ?? null, start: p.start, end: p.end, status: p.status, deliverable: '', part: p.part ?? '' });
    }
    // 待办（数据组 12 条）。
    const todoStatus = (st: string) => (st === 'completed' ? 'done' : 'todo');
    for (const t of (s.todos as any).todos as any[]) {
      child({ id: t.id, type: 'bid_task', bidId: MAIN_BID, name: t.title, title: t.title, bidItemId: null, node: nodeFromSource(t.source ?? ''), assigneeId: userId(t.assignee), assigneeRole: '', assigneeName: t.assignee ?? null, dueAt: toISODateTime(t.due), priority: t.priority ?? 'P2', status: todoStatus(t.status), source: t.source ?? '', comments: [], result: t.status === 'completed' ? { outcome: 'completed', note: t.result ?? '', at: t.completedAt ?? null, by: t.assignee ?? '' } : null, completedAt: t.completedAt ?? null, escalationLevel: null });
    }
    // 前端演示待办（t1..t12，保证前端完成/重开/评论在真实模式下命中后端记录）。
    const feTodoStatus = (st: string) => (st === '已完成' ? 'done' : st === '进行中' ? 'in_progress' : 'todo');
    for (const t of TODOS as any[]) {
      child({ id: t.id, type: 'bid_task', bidId: MAIN_BID, name: t.t, title: t.t, bidItemId: null, node: nodeFromSource(t.src ?? ''), assigneeId: userId(t.owner), assigneeRole: t.role ?? '', assigneeName: t.owner ?? null, dueAt: feDueToISO(t.due), priority: t.pri ?? 'P2', status: feTodoStatus(t.status), source: t.src ?? '', comments: [], result: null, completedAt: null, escalationLevel: null });
    }
    // 澄清。
    const clarType = (t: string) => (t === '技术' ? 'technical' : t === '商务' ? 'business' : 'deviation');
    const clarStatus = (st: string) => (st === 'answered' ? 'answered' : 'open');
    for (const c of (s.clarifications as any).clarifications as any[]) {
      child({ id: c.id, type: 'clarification', bidId: MAIN_BID, name: c.question, phase: c.phase, clarType: clarType(c.type), question: c.question, answer: '', ownerId: userId(c.owner), ownerName: c.owner ?? null, dueAt: c.due ? toISODateTime(c.due) : null, status: clarStatus(c.status), incorporated: false, source: 'seed' });
    }
    // 文件（数据组文件无 id，按序生成）。
    (s.files as any).files.forEach((f: any, i: number) => {
      child({ id: `DOC-P9-${String(i + 1).padStart(2, '0')}`, type: 'bid_doc', bidId: MAIN_BID, name: f.name, filename: f.name, category: f.category, version: f.version, size: f.size, uploader: f.uploader, status: f.status, chapters: [], parseStatus: 'pending', updatedLabel: f.updated ?? '' });
    });
    // 会议。
    for (const m of (s.meetings as any).meetings as any[]) {
      child({ id: m.id, type: 'bid_meeting', bidId: MAIN_BID, name: m.name, title: m.name, meetingType: m.type, startsAt: meetingTimeToISO(m.time), endsAt: null, participants: [], participantsCount: m.participants ?? null, organizer: m.initiator ?? '', status: m.status, minutes: '', recording: m.recording ?? '' });
    }
    // BAFO 轮次与报价版本（只含商业条款字段，不含金额）。
    const bafo = s.bafo as any;
    bafo.rounds.forEach((r: any, i: number) => {
      const roundNo = Number(String(r.round).replace(/\D/g, '')) || i + 1;
      child({ id: `BR-${r.round}`, type: 'bid_round', bidId: MAIN_BID, name: r.label ?? r.round, roundNo, label: r.label ?? r.round, status: r.status ?? '', summary: r.scope ?? '' });
      child({ id: `QV-${r.round}`, type: 'quote_version', bidId: MAIN_BID, name: `报价版本 ${r.round}`, roundNo, version: r.round, fields: { warrantyYears: r.warranty ?? '', warrantyScope: r.scope ?? '', paymentTerms: r.payment ?? '', spareParts: r.spares ?? '', deliveryTerms: '', validity: '' }, status: r.status ?? '' });
    });
    // 检查清单（按模板顺序对齐）。
    (s.submissionCheck as any).checklist.forEach((c: any, i: number) => {
      const tpl = CHECKLIST_TEMPLATES[i];
      if (!tpl) return;
      child({ id: c.id, type: 'checklist_item', bidId: MAIN_BID, name: c.item, templateId: tpl.id, title: c.item, category: tpl.category, required: tpl.required, status: c.status === 'passed' ? 'done' : 'pending', evidence: '' });
    });

    // 其余列表标（前端 BIDS / OPP_BIDS 为准，主标除外；最小记录，保证列表接口行数与前端一致）。
    const seen = new Set<string>([MAIN_BID]);
    const others: any[] = [...(BIDS as any[]), ...(OPP_BIDS as any[])].filter((b) => !seen.has(b.id) && (seen.add(b.id), true));
    others.forEach((b, i) => {
      const custName = String(b.name).split('·')[0].trim();
      const projName = String(b.name).split('·').slice(1).join('·').trim() || String(b.name);
      const custId = `C-P9-${String(i + 1).padStart(2, '0')}`;
      rec({ id: custId, type: 'customer', customerId: custId, name: custName, country: '', region: '', roles: [], businessMode: 'utility_scale', ownerId: 'U-018', description: 'P9 演示客户。' });
      const dueRaw = String(b.due ?? '').split('·')[0].trim();
      const dueISO = /^\d{4}-\d{2}-\d{2}$/.test(dueRaw) ? `${dueRaw}T14:00:00+08:00` : /^\d{2}-\d{2}$/.test(dueRaw) ? `2026-${dueRaw}T14:00:00+08:00` : '2026-11-05T14:00:00+08:00';
      rec({
        id: b.id, type: 'bid', customerId: custId, entityType: 'opportunity', entityId: null,
        number: b.id, customerName: custName, projectName: projName, name: String(b.name),
        opportunityId: null, status: 'in_progress', currentNode: NODE_BY_NAME[String(b.node)] ?? 2,
        ownerId: 'U-018', sppTeam: b.team ?? '', pricingTeam: [], deadlineAt: dueISO,
        createdAt: b.fromDate ? `${b.fromDate}T09:00:00+08:00` : '2026-10-10T09:00:00+08:00',
        atb: { total: 0, filled: 0, gaps: [] },
        strategy: { scope: '', customer: '', competition: '', status: 'draft', updatedAt: now() },
        strategyHistory: [], aiPipeline: 'idle', aiDraft: null, aiLastError: null,
        reviewStatus: 'none', submission: null, award: null, groupUrl: null,
        customerRequirements: [], approvalNo: null, approvalStatus: null,
        riskFlag: b.status === '风险',
      });
    });

    setMeta('p9SeedVersion', P9_SEED_VERSION);
  } catch (e) {
    console.warn('P9 seed skipped:', e instanceof Error ? e.message : String(e));
  }
}
