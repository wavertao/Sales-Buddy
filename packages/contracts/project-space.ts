import { z } from 'zod';

/** 项目空间：一个商机一个空间。主会话是多人群聊，专家的执行放在各自的子会话里。 */

export const spaceStages = [
  { id: 'S1', name: '需求引导' },
  { id: 'S2', name: '机会点跟踪' },
  { id: 'S3', name: '售前项目' },
  { id: 'S4', name: '投标' },
  { id: 'S5', name: '合同及履约' },
] as const;
export type SpaceStageId = (typeof spaceStages)[number]['id'];

/** 项目成员可选角色（与方案里的业务专家一致）。 */
export const memberRoles = ['销售', '销售经理', 'SC', 'PM', '投标专员', '合同专员'] as const;
export type MemberRole = (typeof memberRoles)[number];

/** AI 专家目录。duty 是一句话说明它负责什么；prompt 是子会话里的角色设定。 */
export const spaceExperts = [
  { id: 'market-intel', name: '市场情报专家', duty: '机会简报、政策影响、竞争态势', prompt: '你是市场情报专家，负责市场机会、政策影响与竞争态势分析。' },
  { id: 'lead-ops', name: '线索运营专家', duty: '线索验证、评分与分配建议', prompt: '你是线索运营专家，负责线索验证、评分与分配建议。' },
  { id: 'win-navigator', name: '赢单领航员', duty: '商机缺口、赢单策略与行动计划', prompt: '你是赢单领航员，负责识别商机缺口、评估赢单信心度并给出行动计划。' },
  { id: 'solution', name: '方案专家', duty: '技术方案、产品配置与符合性核对', prompt: '你是方案专家，负责技术方案、产品配置以及招标技术要求的符合性核对。' },
  { id: 'bid', name: '投标专家', duty: '条款拆解、否决项识别与响应审查', prompt: '你是投标专家，负责拆解招标条款、识别否决项与保函等硬性要求，并审查响应文件。' },
  { id: 'account', name: '客户经营专家', duty: '决策链、关键人与客户经营计划', prompt: '你是客户经营专家，负责梳理决策链与关键人，制定客户经营计划。' },
  { id: 'visit', name: '客户拜访专家', duty: '拜访准备、纪要与客户承诺跟进', prompt: '你是客户拜访专家，负责拜访准备、整理接洽纪要并跟进客户承诺。' },
] as const;
export type ExpertId = (typeof spaceExperts)[number]['id'];
export const expertIds = spaceExperts.map((e) => e.id) as [ExpertId, ...ExpertId[]];

export type SpaceMember =
  | { id: string; kind: 'user'; userId: string; name: string; role: MemberRole; addedAt: string }
  | { id: string; kind: 'expert'; expertId: ExpertId; name: string; role: 'AI 专家'; addedAt: string };

export type SpaceAuthor =
  | { kind: 'user'; userId: string; name: string; role: string }
  | { kind: 'expert'; expertId: ExpertId; name: string }
  | { kind: 'system'; name: string };

export type ThreadStatus = 'running' | 'done' | 'failed';

/** 主会话里指向子会话的任务卡片。 */
export interface TaskCard { threadId: string; expertId: ExpertId; title: string; status: ThreadStatus; summary?: string }

export interface SpaceMessage {
  id: string; spaceId: string; threadId: string;
  author: SpaceAuthor; content: string;
  mentions: ExpertId[]; card?: TaskCard; createdAt: string;
}

export interface SpaceThread {
  id: string; spaceId: string; kind: 'main' | 'expert';
  expertId?: ExpertId; title: string; status: ThreadStatus;
  /** 发起这个任务的主会话消息。 */
  originMessageId?: string; createdBy?: string;
  summary?: string; error?: string; createdAt: string; updatedAt: string;
}

export interface SpaceTodo {
  id: string; spaceId: string; threadId?: string; title: string;
  assigneeId: string; assigneeName: string; dueAt?: string;
  status: 'pending' | 'completed'; createdAt: string;
}

export interface ProjectSpace {
  id: string; opportunityId: string; customerId: string;
  customerName: string; opportunityName: string;
  /** 赢单信心度，0–100。 */
  winConfidence: number; stage: SpaceStageId;
  members: SpaceMember[]; createdBy: string; createdAt: string; updatedAt: string;
}

/** 空间详情：空间 + 会话列表 + 当前会话消息 + 待办。 */
export interface SpaceDetail {
  space: ProjectSpace; threads: SpaceThread[];
  messages: SpaceMessage[]; activeThreadId: string; todos: SpaceTodo[];
  modelConfigured: boolean;
}

export const createSpaceSchema = z.object({ opportunityId: z.string().min(1, '请选择商机') });
export const updateSpaceSchema = z.object({
  stage: z.enum(['S1', 'S2', 'S3', 'S4', 'S5']).optional(),
  winConfidence: z.number().int().min(0).max(100).optional(),
});
export const addMemberSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('user'), userId: z.string().min(1), role: z.enum(memberRoles) }),
  z.object({ kind: z.literal('expert'), expertId: z.enum(expertIds) }),
]);
export const postMessageSchema = z.object({
  content: z.string().trim().min(1, '请输入内容').max(4000, '内容过长'),
  /** 主会话里 @ 到的专家：每位专家各开一个子会话执行。 */
  mentions: z.array(z.enum(expertIds)).max(4).default([]),
});
export const todoStatusSchema = z.object({ status: z.enum(['pending', 'completed']) });
