import express from 'express';
import multer from 'multer';
import { z } from 'zod';
import { AppError } from '../../../../packages/contracts/index.ts';
import type { User } from '../../../../packages/contracts/index.ts';
import { getRules, resetRules, restoreRules, ruleHistory, ruleSetSchema, saveRules } from './rules.ts';
import { previewText } from './pipeline.ts';
import { getJob, getRun, listRuns, listSamples, parseSample, parseUpload } from './service.ts';
import { generateSuggestions, library, publish, reject, replay, suggestions, versions } from './evolve.ts';
import { record } from '../db.ts';
import { modelStatus } from '../model.ts';
import type { TenderRuleSet } from '../../../../packages/contracts/tender.ts';

/**
 * 标书解析接口（挂在 /api 下，沿用 index.ts 的 Bearer 鉴权）：
 *   规则：GET/PUT /tender/rules · POST /tender/rules/reset · GET /tender/rules/history · POST /tender/rules/restore · POST /tender/rules/preview
 *   自进化：GET /tender/evolve/library · GET /tender/evolve/suggestions · POST …/suggestions/generate · POST …/suggestions/:id/replay|publish|reject · GET /tender/evolve/versions
 *   解析：GET /tender/samples · POST /tender/parse（样本）· POST /tender/upload（上传整包）· GET /tender/runs · GET /tender/runs/:id
 * 改规则只给 manager / admin（对应方案里的 BSD 维护口径，待 Q3 确认）；所有人都能解析和试跑。
 */
export const tenderRoutes = express.Router();
const r = tenderRoutes;
const user = (res: express.Response) => res.locals.user as User;
const editor = (res: express.Response) => {
  const u = user(res);
  if (u.role !== 'admin' && u.role !== 'manager') throw new AppError('FORBIDDEN', '只有主管或管理员可以修改解析规则', 403);
  return u;
};
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 120 * 1024 * 1024, files: 60, fields: 4 } });

r.get('/tender/rules', (_req, res) => res.json({ rules: getRules(), canEdit: ['admin', 'manager'].includes(user(res).role), model: modelStatus().configured ? modelStatus().model : null }));
r.put('/tender/rules', (req, res) => res.json(saveRules(editor(res), req.body)));
r.post('/tender/rules/reset', (_req, res) => res.json(resetRules(editor(res))));
r.get('/tender/rules/history', (_req, res) => res.json(ruleHistory()));
r.post('/tender/rules/restore', (req, res) => res.json(restoreRules(editor(res), z.object({ version: z.number().int().min(1) }).parse(req.body).version)));
r.post('/tender/rules/preview', (req, res) => {
  const body = z.object({ text: z.string().min(1, '请贴一段文字').max(120000), rules: z.unknown().optional() }).parse(req.body);
  // 试跑可用页面上尚未保存的草稿规则；不传就用当前生效规则
  const rules = body.rules ? ({ ...getRules(), ...ruleSetSchema.parse(body.rules) } as TenderRuleSet) : getRules();
  res.json(previewText(rules, body.text));
});

// 自进化：看谁都能看，生成、回放、发布、驳回只给主管和管理员
const bidName = (id: string) => { const b = record(id); return b ? String(b.name || b.number || id).replace(/^.*?·\s*/, '') : id; };
r.get('/tender/evolve/library', (_req, res) => res.json(library(bidName)));
r.get('/tender/evolve/suggestions', (_req, res) => res.json(suggestions()));
r.post('/tender/evolve/suggestions/generate', async (_req, res) => res.json(await generateSuggestions(editor(res).name)));
r.post('/tender/evolve/suggestions/:id/replay', async (req, res) => { editor(res); res.json(await replay(req.params.id)); });
r.post('/tender/evolve/suggestions/:id/publish', (req, res) => res.json(publish(req.params.id, editor(res).name)));
r.post('/tender/evolve/suggestions/:id/reject', (req, res) => res.json(reject(req.params.id, editor(res).name, z.object({ note: z.string().max(300).optional() }).parse(req.body || {}).note)));
r.get('/tender/evolve/versions', (_req, res) => res.json(versions()));
r.get('/tender/samples', (_req, res) => res.json(listSamples()));
r.post('/tender/parse', async (req, res) => {
  const { sample } = z.object({ sample: z.string().min(1).max(400) }).parse(req.body);
  res.json(await parseSample(user(res).name, sample));
});
r.post('/tender/upload', upload.array('files', 60), async (req, res) => {
  const files = ((req.files as Express.Multer.File[]) || []).map((f) => {
    const name = Buffer.from(f.originalname, 'latin1').toString('utf8');
    return { name: name.split(/[\\/]/).pop()!, path: name, bytes: new Uint8Array(f.buffer) };
  });
  res.json(await parseUpload(user(res).name, String((req.body as { name?: string }).name || ''), files));
});
r.get('/tender/jobs/:id', (req, res) => res.json(getJob(req.params.id)));
r.get('/tender/runs', (_req, res) => res.json(listRuns()));
r.get('/tender/runs/:id', (req, res) => res.json(getRun(req.params.id)));

export default tenderRoutes;
