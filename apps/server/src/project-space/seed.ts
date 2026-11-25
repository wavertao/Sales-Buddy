import { get, put, record } from '../db.ts';
import { users } from '../crm.ts';
import type { ExpertId, ProjectSpace, SpaceAuthor, SpaceMessage, SpaceThread, SpaceTodo } from '../../../../packages/contracts/project-space.ts';
import { spaceExperts } from '../../../../packages/contracts/project-space.ts';
import { mainThreadId } from './service.ts';

/**
 * 示例项目空间：宁德时代 · 储能项目（OP-CATL-001，P9 主标 BID-20261010-003 对应的商机）。
 * 只在空间不存在时写入，不覆盖用户在空间里的任何操作。
 */
const SPACE_ID = 'PS-CATL-001';
const OPP_ID = 'OP-CATL-001';

export function seedProjectSpaces() {
  if (get(SPACES_KEY.collection, SPACE_ID)) return;
  const opp = record(OPP_ID);
  if (!opp) return; // 投标演示数据不存在时不生成示例空间。
  const people = new Map(users().map((x) => [x.id, x.name]));
  const name = (id: string) => people.get(id) ?? id;
  const t0 = Date.now() - 2 * 86400_000;
  const at = (minutes: number) => new Date(t0 + minutes * 60_000).toISOString();
  const day = (days: number) => new Date(Date.now() + days * 86400_000).toISOString().slice(0, 10);
  const ex = (id: ExpertId) => spaceExperts.find((e) => e.id === id)!;

  const userMembers = [
    ['U-018', '销售'], ['U-021', '投标专员'], ['U-022', 'SC'], ['U-023', 'PM'], ['U-024', '合同专员'], ['U-020', '销售经理'],
  ] as const;
  const expertMembers: ExpertId[] = ['bid', 'solution', 'win-navigator', 'account'];
  const space: ProjectSpace = {
    id: SPACE_ID, opportunityId: OPP_ID, customerId: opp.customerId,
    customerName: record(opp.customerId)?.name ?? '宁德时代新能源', opportunityName: '储能项目',
    winConfidence: 65, stage: 'S4',
    members: [
      ...userMembers.filter(([id]) => people.has(id)).map(([userId, role], i) => ({ id: 'PM-CATL-U' + i, kind: 'user' as const, userId, name: name(userId), role, addedAt: at(0) })),
      ...expertMembers.map((expertId, i) => ({ id: 'PM-CATL-E' + i, kind: 'expert' as const, expertId, name: ex(expertId).name, role: 'AI 专家' as const, addedAt: at(0) })),
    ],
    createdBy: 'U-018', createdAt: at(0), updatedAt: at(300),
  };

  const u = (userId: string, role: string): SpaceAuthor => ({ kind: 'user', userId, name: name(userId), role });
  const e = (id: ExpertId): SpaceAuthor => ({ kind: 'expert', expertId: id, name: ex(id).name });
  const sys: SpaceAuthor = { kind: 'system', name: '系统' };
  const main = mainThreadId(SPACE_ID);
  const threads: SpaceThread[] = [{ id: main, spaceId: SPACE_ID, kind: 'main', title: '项目群聊', status: 'done', createdAt: at(0), updatedAt: at(300) }];
  const messages: SpaceMessage[] = [];
  let n = 0;
  const msg = (threadId: string, author: SpaceAuthor, content: string, minutes: number, extra: Partial<SpaceMessage> = {}) =>
    messages.push({ id: `MSG-CATL-${String(++n).padStart(3, '0')}`, spaceId: SPACE_ID, threadId, author, content, mentions: [], createdAt: at(minutes), ...extra });
  const task = (id: string, expertId: ExpertId, title: string, minutes: number, ask: string, askBy: SpaceAuthor, answer: string, summary: string) => {
    threads.push({ id, spaceId: SPACE_ID, kind: 'expert', expertId, title, status: 'done', createdBy: 'U-018', summary, createdAt: at(minutes), updatedAt: at(minutes + 6) });
    msg(id, askBy, ask, minutes);
    msg(id, e(expertId), answer.replace(/\n+摘要：.*$/s, '').trim(), minutes + 6);
    msg(main, e(expertId), '', minutes + 1, { card: { threadId: id, expertId, title, status: 'done', summary } });
  };

  msg(main, sys, '张小小 创建了项目空间，并邀请项目成员和 AI 专家加入。', 0);
  const kickoff = '招标文件已经下来了，11 月 5 日截标。@投标专家 先把否决项和保函要求拆出来；@方案专家 核对技术规范里的效率指标和检测要求。';
  msg(main, u('U-018', '销售'), kickoff, 5, { mentions: ['bid', 'solution'] });
  task('TH-CATL-BID', 'bid', '拆解否决项与保函要求', 6, kickoff, u('U-018', '销售'), [
    '已通读招标文件第 2 章「投标人须知」和第 6 章「技术规范」，识别出 3 项否决条款：',
    '',
    '| # | 条款 | 要求 | 当前状态 | 建议负责人 |',
    '|---|---|---|---|---|',
    '| 1 | 须知 2.7 投标保证金 | 银行保函 80 万元，有效期不少于投标有效期后 30 天 | 未开具 | 王强 |',
    '| 2 | 技术规范 6.3.2 | 交流并网点系统效率 ≥ 87% | 需核对检测报告测点 | 陈磊 |',
    '| 3 | 须知 3.1 资格条件 | 近三年 ≥ 2 个 100MWh 以上储能项目业绩 | 已满足，需附合同扫描件 | 张小小 |',
    '',
    '另有 2 项高风险但非否决的条款：质保期 10 年、逾期交付违约金每日 0.1%，建议合同专员提前评估。',
    '',
    '摘要：识别出 3 项否决条款：80 万元保函未开具、87% 效率需核对测点、业绩证明需附件；另有 2 项高风险商务条款。',
  ].join('\n'), '识别出 3 项否决条款：80 万元保函未开具、87% 效率需核对测点、业绩证明需附件；另有 2 项高风险商务条款。');
  task('TH-CATL-SOL', 'solution', '核对效率指标与检测要求', 7, kickoff, u('U-018', '销售'), [
    '技术规范 6.3.2 要求的是**交流并网点**系统效率 ≥ 87%。',
    '',
    '我们现有的型式检测报告，效率测点在 PCS 直流侧，实测 89.1%，但不能直接证明并网点效率。按经验折算并网点约 86.5%–87.5%，处在临界区间。',
    '',
    '建议：',
    '1. 陈磊（SC）联系检测机构，按交流并网点补测，或取得同型号项目的并网点实测数据；',
    '2. 如补测来不及，在技术偏差表里如实说明测点差异，并附折算依据，避免被判虚假响应。',
    '',
    '摘要：87% 要求在交流并网点，现有报告测点在直流侧，折算处于临界；建议补测或在偏差表中说明。',
  ].join('\n'), '87% 要求在交流并网点，现有报告测点在直流侧，折算处于临界；建议补测或在偏差表中说明。');
  msg(main, u('U-021', '投标专员'), '保函我来办，周四前开出来，开好后发群里。', 40);
  msg(main, u('U-022', 'SC'), '测点的问题我今天联系实验室，补测周期确认后同步。', 55);
  msg(main, u('U-023', 'PM'), '交付排期我按 6 个月倒排了一版，资源上没问题，明天评审会上过一下。', 70);
  const ask = '@赢单领航员 结合上面这些，帮我们更新一下赢单信心度和关键风险。';
  msg(main, u('U-018', '销售'), ask, 120, { mentions: ['win-navigator'] });
  task('TH-CATL-WIN', 'win-navigator', '更新赢单信心度与关键风险', 121, ask, u('U-018', '销售'), [
    '建议赢单信心度从 70% 下调到 **65%**。',
    '',
    '主要依据：',
    '- 效率指标处于临界，若评标时被认定不满足，会直接否决，这是最大的单点风险；',
    '- 保函和业绩证明是可控项，按计划推进即可；',
    '- 客户技术负责人此前对我们的循环寿命数据认可度高，技术评分仍有优势。',
    '',
    '接下来一周的关键动作：',
    '1. 陈磊：周一前给出补测结论；',
    '2. 王强：周四前开出保函；',
    '3. 张小小：截标前一周组织投标评审，确认响应版本。',
    '',
    '摘要：建议信心度下调到 65%，最大风险是效率测点；本周盯紧补测结论和保函。',
  ].join('\n'), '建议信心度下调到 65%，最大风险是效率测点；本周盯紧补测结论和保函。');
  msg(main, u('U-020', '销售经理'), '同意按 65% 报，补测结论出来后再评估。', 150);
  msg(main, sys, '张小小 将赢单信心度从 70% 调整为 65%。', 152);

  const todos: SpaceTodo[] = [
    { id: 'TD-CATL-1', spaceId: SPACE_ID, threadId: 'TH-CATL-BID', title: '开具 80 万元投标保函', assigneeId: 'U-021', assigneeName: name('U-021'), dueAt: day(2), status: 'pending', createdAt: at(40) },
    { id: 'TD-CATL-2', spaceId: SPACE_ID, threadId: 'TH-CATL-SOL', title: '补测交流并网点效率，给出结论', assigneeId: 'U-022', assigneeName: name('U-022'), dueAt: day(4), status: 'pending', createdAt: at(55) },
    { id: 'TD-CATL-3', spaceId: SPACE_ID, title: '确认交付排期与资源', assigneeId: 'U-023', assigneeName: name('U-023'), dueAt: day(1), status: 'pending', createdAt: at(70) },
    { id: 'TD-CATL-4', spaceId: SPACE_ID, threadId: 'TH-CATL-WIN', title: '组织投标评审，确认响应版本', assigneeId: 'U-018', assigneeName: name('U-018'), dueAt: day(5), status: 'pending', createdAt: at(121) },
  ];

  put(SPACES_KEY.collection, space.id, space, null, space.opportunityId);
  for (const t of threads) put('space_threads', t.id, t, null, SPACE_ID);
  for (const m of messages) put('space_messages', m.id, m, null, SPACE_ID);
  for (const t of todos) put('space_todos', t.id, t, t.assigneeId, SPACE_ID);
}

const SPACES_KEY = { collection: 'project_spaces' };
