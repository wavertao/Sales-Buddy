// P9 种子 · 前端演示行（原 apps/web/src/p9/data.ts 中供种子使用的部分，前端重写后迁到服务端，保证主标待办 / 计划 ID 与前端演示数据对齐）。
// 改这里的 id 时同步检查 apps/web/src/p9/demo.ts。
export const BIDS = [
  { id: 'BID-20261010-003', name: '宁德时代 · 储能项目', round: '首轮', node: '标书分解', owner: '王强', team: '储能 SPP', due: '2026-11-05', left: '12 天', from: '李明', fromDate: '2026-10-10', status: '进行中' },
  { id: 'BID-20261008-002', name: '比亚迪 · 储能柜二期', round: '首轮', node: '投标文件制作', owner: '张伟', team: '储能 SPP', due: '2026-11-08', left: '15 天', from: '张伟', fromDate: '2026-10-08', status: '进行中' },
  { id: 'BID-20260928-007', name: '隆基绿能 · 分布式储能', round: '第二轮', node: 'BAFO', owner: '陈磊', team: '光伏 SPP', due: '2026-10-28', left: '4 天', from: '王芳', fromDate: '2026-09-28', status: '风险' },
  { id: 'BID-20260922-005', name: '阳光电源 · 电站储能', round: '首轮', node: '交标', owner: '王芳', team: '储能 SPP', due: '2026-10-30', left: '6 天', from: '王强', fromDate: '2026-09-22', status: '进行中' },
  { id: 'BID-20261014-004', name: '天合光能 · 储能一体机', round: '首轮', node: '投标策略制定', owner: '李明', team: '汽车 SPP', due: '2026-11-15', left: '22 天', from: '李明', fromDate: '2026-10-14', status: '进行中' },
  { id: 'BID-20251205-011', name: '浙江工商业储能 · 工商业储能集群', round: '首轮', node: '定标', owner: '王强', team: '储能 SPP', due: '2026-10-12', left: '已过', from: '王强', fromDate: '2025-12-05', status: '已逾期' },
];
export const OPP_BIDS = [
  { id: 'BID-20261010-003', name: '储能项目', round: 'R1 已交标 / R2 当前', node: '标书分解', due: '11-05 · 剩 12 天', owner: '王强', team: '储能 SPP', from: '李明', fromDate: '2026-10-10', status: '进行中' },
  { id: 'BID-20260912-011', name: '储能项目 · 二期', round: 'R1 当前', node: '交标', due: '10-30 · 剩 6 天', owner: '王芳', team: '储能 SPP', from: '王芳', fromDate: '2026-09-12', status: '进行中' },
  { id: 'BID-20260820-004', name: '储能项目 · 增补', round: 'R1·R2 已交标 / R3 当前', node: 'BAFO', due: '10-28 · 剩 4 天', owner: '陈磊', team: '储能 SPP', from: '陈磊', fromDate: '2026-08-20', status: '风险' },
];
export type PlanItem = { id: string; title: string; owner: string; part: string; status: string; start: string; end: string };
export const PLAN_ITEMS: PlanItem[] = [
  { id: 'p1', title: '4.1 技术规格书', owner: '王强', part: '陈磊、张伟', status: '进行中', start: '2026-10-20', end: '2026-10-23' },
  { id: 'p2', title: '4.2 并网性能', owner: '陈磊', part: '王强', status: '未开始', start: '2026-10-21', end: '2026-10-25' },
  { id: 'p3', title: '4.3 消防认证', owner: '未派', part: '陈磊', status: '已逾期', start: '2026-10-22', end: '2026-10-26' },
  { id: 'p4', title: '交付周期承诺', owner: '张伟', part: '王强', status: '已完成', start: '2026-10-20', end: '2026-10-24' },
  { id: 'p5', title: '物流与关务', owner: '张伟', part: '王芳', status: '进行中', start: '2026-10-24', end: '2026-10-28' },
  { id: 'p6', title: '商务偏差表', owner: '王芳', part: '李明', status: '进行中', start: '2026-10-21', end: '2026-10-25' },
  { id: 'p7', title: '付款节点审查', owner: '未派', part: '王芳', status: '已逾期', start: '2026-10-22', end: '2026-10-26' },
  { id: 'p8', title: '资质与业绩', owner: '王芳', part: '李明', status: '已完成', start: '2026-10-20', end: '2026-10-24' },
];
export const TODOS = [
  { id: 't1', t: '补齐 3 个基本信息字段（项目地点 / 供货范围 / 保证金）', src: '① 商机判断', owner: '李明', role: 'SLS', due: '今天', pri: 'P0', comments: 3, status: '已完成', mine: true },
  { id: 't2', t: '指派 2 条拆解条目的责任人', src: '③ 标书分解', owner: '王强', role: 'PM', due: '今天', pri: 'P0', comments: 1, status: '进行中', mine: true },
  { id: 't3', t: '明确远程调试实现方案与成本', src: '会议 · 澄清会', owner: '陈磊', role: 'SC', due: '10-26', pri: 'P1', comments: 3, status: '待开始', mine: false },
  { id: 't4', t: '质保 5 年 / 10 年两版重新报价', src: '会议 · 澄清会', owner: '王芳', role: 'AMD', due: '10-28', pri: 'P1', comments: 2, status: '已完成', mine: false },
  { id: 't5', t: '审阅拆标分解表并提交 BSD', src: '③ 标书分解', owner: '陈磊', role: 'SC', due: '10-22', pri: 'P0', comments: 2, status: '进行中', mine: false },
  { id: 't6', t: '处理技术评审与报价排期冲突', src: '③ 标书分解', owner: '张伟', role: 'QA', due: '10-21', pri: 'P1', comments: 1, status: '进行中', mine: false },
  { id: 't7', t: '补充储能系统消防方案细节', src: '会议 · 澄清会', owner: '陈磊', role: 'SC', due: '10-26', pri: 'P1', comments: 0, status: '待开始', mine: true },
  { id: 't8', t: '技术标 12 项强制响应补齐', src: '③ 标书分解', owner: '陈磊', role: 'SC', due: '10-23', pri: 'P0', comments: 4, status: '进行中', mine: true },
  { id: 't9', t: '报价文件过 BSD 评审', src: '⑦ 报价提报', owner: '李明', role: 'SLS', due: '10-23', pri: 'P0', comments: 2, status: '进行中', mine: true },
  { id: 't10', t: '澄清答疑第 4 / 7 条书面答复', src: '⑤ 澄清跟进', owner: '陈磊', role: 'SC', due: '10-25', pri: 'P1', comments: 1, status: '待开始', mine: false },
  { id: 't11', t: '标书定稿前三一致性核查', src: '⑥ 投标文件制作', owner: '张伟', role: 'QA', due: '10-30', pri: 'P1', comments: 0, status: '待开始', mine: false },
  { id: 't12', t: '交标凭证与保证金材料归档', src: '⑦ 交标', owner: '王芳', role: 'AMD', due: '11-01', pri: 'P1', comments: 0, status: '待开始', mine: false },
];
