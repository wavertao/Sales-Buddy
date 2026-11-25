import express from 'express';
import { z } from 'zod';
import {
  addMemberSchema, createSpaceSchema, postMessageSchema, todoStatusSchema, updateSpaceSchema,
} from '../../../../packages/contracts/project-space.ts';
import * as S from './service.ts';

/** 项目空间接口，挂在 /api 下，沿用 index.ts 的 Bearer 鉴权与统一错误处理。 */
export const projectSpaceRoutes = express.Router();
const r = projectSpaceRoutes;
const u = (res: express.Response) => res.locals.user;
const id = (v: unknown) => z.string().min(1).parse(v);

r.get('/project-spaces', (_req, res) => res.json(S.listSpaces(u(res))));
r.post('/project-spaces', (req, res) => res.json(S.createSpace(u(res), createSpaceSchema.parse(req.body).opportunityId)));
r.get('/project-spaces/options/opportunities', (req, res) => res.json(S.opportunityOptions(u(res), String(req.query.q || ''))));
r.get('/project-spaces/options/members', (_req, res) => res.json(S.memberCandidates()));
r.get('/project-spaces/todos/mine', (_req, res) => res.json(S.myTodos(u(res))));
r.patch('/project-spaces/todos/:todoId', (req, res) => res.json(S.setTodoStatus(u(res), id(req.params.todoId), todoStatusSchema.parse(req.body).status)));

r.get('/project-spaces/:spaceId', (req, res) => res.json(S.spaceDetail(u(res), id(req.params.spaceId), req.query.thread ? String(req.query.thread) : undefined)));
r.patch('/project-spaces/:spaceId', (req, res) => res.json(S.updateSpace(u(res), id(req.params.spaceId), updateSpaceSchema.parse(req.body))));
r.post('/project-spaces/:spaceId/members', (req, res) => res.json(S.addMember(u(res), id(req.params.spaceId), addMemberSchema.parse(req.body) as any)));
r.delete('/project-spaces/:spaceId/members/:memberId', (req, res) => res.json(S.removeMember(u(res), id(req.params.spaceId), id(req.params.memberId))));
r.post('/project-spaces/:spaceId/threads/:threadId/messages', (req, res) =>
  res.json(S.postMessage(u(res), id(req.params.spaceId), id(req.params.threadId), postMessageSchema.parse(req.body))));
r.post('/project-spaces/threads/:threadId/retry', (req, res) => res.json(S.retryThread(u(res), id(req.params.threadId))));
