import express from 'express';
import { z } from 'zod';
import {
  bafoRoundSchema, chatSchema, clarificationSchema, clarificationUpdateSchema,
  closeSchema, commentSchema, completeTodoSchema, createBidSchema, docSchema, meetingSchema,
  planItemSchema, regenerateSchema, rescheduleSchema, reviewSchema, strategySchema, submitSchema, todoSchema,
} from '../../../../packages/contracts/p9.ts';
import * as S from './service.ts';

/**
 * P9 路由：挂载方式（由协调人统一接线，本文件不改 index.ts）：
 *   import { p9Routes } from './p9/routes.ts';
 *   app.use('/api', p9Routes);   // 须放在 index.ts 现有鉴权中间件之后（res.locals.user 已注入）
 * 鉴权沿用仓库现有 Bearer 链；本路由只读 res.locals.user，不自建鉴权。
 * 错误格式沿用 index.ts 末尾统一处理（AppError → {error, message}，Zod → 中文分号串）。
 */
export const p9Routes = express.Router();
const r = p9Routes;
const u = (_req: express.Request, res: express.Response) => res.locals.user;
const q = (req: express.Request) => req.query as Record<string, string>;
const parse = <T>(schema: z.ZodType<T>, body: unknown): T => schema.parse(body);

r.get('/bids', (req, res) => res.json(S.listBids(u(req, res), q(req))));
r.get('/bids/:id', (req, res) => res.json(S.bidDetail(u(req, res), req.params.id)));
r.post('/bids', async (req, res) => res.status(201).json(await S.createBid(u(req, res), parse(createBidSchema, req.body) as unknown as Record<string, unknown>)));

r.get('/bids/:id/strategy', (req, res) => res.json(S.getStrategy(u(req, res), req.params.id)));
r.put('/bids/:id/strategy', (req, res) => res.json(S.putStrategy(u(req, res), req.params.id, parse(strategySchema, req.body) as unknown as Record<string, unknown>)));
r.post('/bids/:id/strategy/regenerate', async (req, res) => res.json(await S.regenerateStrategy(u(req, res), req.params.id, parse(regenerateSchema, req.body) as unknown as Record<string, unknown>)));

r.get('/bids/:id/plan', (req, res) => res.json(S.getPlan(u(req, res), req.params.id)));
r.post('/bids/:id/plan/items', (req, res) => res.status(201).json(S.addPlanItem(u(req, res), req.params.id, parse(planItemSchema, req.body) as unknown as Record<string, unknown>)));
r.post('/bids/:id/plan/items/:itemId/reschedule', (req, res) => res.json(S.reschedulePlanItem(u(req, res), req.params.id, req.params.itemId, parse(rescheduleSchema, req.body))));
r.post('/bids/:id/plan/items/:itemId/reopen', (req, res) => res.json(S.reopenPlanItem(u(req, res), req.params.id, req.params.itemId)));

r.get('/bids/:id/documents', (req, res) => res.json(S.listDocs(u(req, res), req.params.id)));
r.post('/bids/:id/documents', (req, res) => res.status(201).json(S.addDoc(u(req, res), req.params.id, parse(docSchema, req.body) as unknown as Record<string, unknown>)));
r.post('/bids/:id/documents/:docId/parse', async (req, res) => res.json(await S.parseDoc(u(req, res), req.params.id, req.params.docId)));

r.get('/bids/:id/meetings', (req, res) => res.json(S.listMeetings(u(req, res), req.params.id)));
r.post('/bids/:id/meetings', (req, res) => res.status(201).json(S.addMeeting(u(req, res), req.params.id, parse(meetingSchema, req.body) as unknown as Record<string, unknown>)));
r.get('/bids/:id/files', (req, res) => res.json(S.listDocs(u(req, res), req.params.id)));

r.get('/bids/:id/todos', (req, res) => res.json(S.listTodos(u(req, res), req.params.id, q(req))));
r.post('/bids/:id/todos', (req, res) => res.status(201).json(S.addTodo(u(req, res), req.params.id, parse(todoSchema, req.body) as unknown as Record<string, unknown>)));
r.post('/bids/:id/todos/:todoId/complete', (req, res) => res.json(S.completeTodo(u(req, res), req.params.id, req.params.todoId, parse(completeTodoSchema, req.body))));
r.post('/bids/:id/todos/:todoId/comments', (req, res) => res.json(S.commentTodo(u(req, res), req.params.id, req.params.todoId, parse(commentSchema, req.body).text)));
r.post('/bids/:id/todos/:todoId/reopen', (req, res) => res.json(S.reopenTodo(u(req, res), req.params.id, req.params.todoId)));

r.get('/bids/:id/clarifications', (req, res) => res.json(S.listClarifications(u(req, res), req.params.id, q(req))));
r.post('/bids/:id/clarifications', (req, res) => res.status(201).json(S.addClarification(u(req, res), req.params.id, parse(clarificationSchema, req.body) as unknown as Record<string, unknown>)));
// 契约外补充：澄清状态流转口（§3 只列 GET/POST，见最终汇报说明）
r.post('/bids/:id/clarifications/:clarId/status', (req, res) => res.json(S.updateClarification(u(req, res), req.params.id, req.params.clarId, parse(clarificationUpdateSchema, req.body) as unknown as Record<string, unknown>)));

r.get('/bids/:id/checks', (req, res) => res.json(S.getChecks(u(req, res), req.params.id)));
// 契约外补充：checklist 实例完成口（见最终汇报说明）
r.post('/bids/:id/checklist/:itemId/done', (req, res) => res.json(S.completeChecklistItem(u(req, res), req.params.id, req.params.itemId, (req.body as { evidence?: string } | undefined)?.evidence)));
r.post('/bids/:id/submit-review', (req, res) => res.json(S.submitReview(u(req, res), req.params.id, parse(reviewSchema, req.body))));
r.post('/bids/:id/submit', (req, res) => res.json(S.submitBid(u(req, res), req.params.id, parse(submitSchema, req.body) as unknown as Record<string, unknown>)));

r.get('/bids/:id/bafo', (req, res) => res.json(S.getBafo(u(req, res), req.params.id)));
r.post('/bids/:id/bafo/rounds', (req, res) => res.status(201).json(S.createBafoRound(u(req, res), req.params.id, parse(bafoRoundSchema, req.body) as unknown as Record<string, unknown>)));

r.post('/bids/:id/close', (req, res) => res.json(S.closeBid(u(req, res), req.params.id, parse(closeSchema, req.body))));
r.post('/bids/:id/group', (req, res) => res.json(S.createGroup(u(req, res), req.params.id)));

r.get('/bids/:id/quote-versions', (req, res) => res.json(S.listQuoteVersions(u(req, res), req.params.id)));
r.get('/bids/:id/quote-visibility', (req, res) => res.json(S.quoteVisibility(u(req, res), req.params.id)));

r.post('/bids/:id/assistant/chat', async (req, res) => res.json(await S.assistantChat(u(req, res), req.params.id, parse(chatSchema, req.body).question)));

// ---- AI 协管主链路（§8 补充接口）----
r.post('/bids/:id/ai/plan', async (req, res) => res.json(await S.aiPlanRoute(u(req, res), req.params.id)));
r.post('/bids/:id/ai/decompose', async (req, res) => res.json(await S.aiDecomposeRoute(u(req, res), req.params.id, ((req.body as { documentId?: string } | undefined)?.documentId) || undefined)));
r.post('/bids/:id/ai/dispatch', (req, res) => res.json(S.aiDispatch(u(req, res), req.params.id)));
r.get('/bids/:id/ai/status', (req, res) => res.json(S.aiStatus(u(req, res), req.params.id)));
r.post('/bids/:id/ai/check', (req, res) => res.json(S.aiCheck(u(req, res), req.params.id)));

export default p9Routes;
