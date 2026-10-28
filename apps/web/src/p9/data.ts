// P9 投标全流程 · 前端种子数据（来源：prototype-spec §8/§9 + implementation-plan §1/§4）。
// 演示时钟固定为 2026-10-24（仅用于 P9 相对标签，不改全局 BUSINESS_CLOCK）。
// 原型内冲突已按 implementation-plan §1 处理：计数由本文件实际条目算出，
// 冲突原文在汇报中单列，不在界面硬抄冲突数字。
export type Any = any;
export const DEMO_TODAY = '2026-10-24';
export const MAIN_BID = 'BID-20261010-003';
export const MAIN_BID_LABEL = 'BID-20261010-003 · R2';

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
export const NODE_BAR = [
  { n: '商机判断', d: '10-10' }, { n: '投标策略', d: '10-12' }, { n: '标书分解', d: '剩 12 天 · 卡点 3' },
  { n: '开工会', d: '预计 10-22' }, { n: '澄清跟进', d: '预计 10-25' }, { n: '投标文件制作', d: '预计 10-26' },
  { n: '交标', d: '11-05 14:00' }, { n: '澄清环节跟进', d: '待定' }, { n: 'BAFO', d: '待定' }, { n: '定标', d: '待定' },
];
export const HEALTH_DIMS = [
  { k: '进度排期', v: 82 }, { k: '商务部分', v: 76 }, { k: '技术部分', v: 55 },
  { k: '报价文件', v: 64 }, { k: '偏差管理', v: 61 }, { k: '澄清响应', v: 67 },
];
export const BLOCKERS = [
  { t: '技术标缺 12 项强制响应', level: '高', state: '已升级 L2', over: '逾期 3 天', score: 92, owner: '王强 · PM · 节点 ③ 标书分解', act: '追问进度', note: '缺 12 项 mandatory 响应条款，属废标风险；已升级至 SPP 负责人。' },
  { t: '报价文件未过 BSD 评审', level: '高', state: '待升级 L3', over: '超时 26h', score: 84, owner: '李明 · SLS · 节点 ⑦ 报价提报', act: '立即催办', note: '报价 R2 已冻结 48h 无审批结论，阻塞交标准备；今夜 22:00 升级 L3。' },
  { t: '澄清 2 条超 48h 未回', level: '中', state: '已催办 2 次', over: '逾期 1 天', score: 66, owner: '陈磊 · SC · 节点 ⑤ 澄清跟进', act: '查看答疑', note: '答疑第 4 / 7 条由技术中心承办，超 48h 未回将拖延标书制作。' },
];
export const OVERDUE = [
  { t: '审阅拆标分解表并提交 BSD', pri: 'P0', state: '已升级 L2', over: '逾期 2 天', owner: '陈磊 · SC · 节点 ③ 标书分解', act: '催办 BSD' },
  { t: '处理技术评审与报价排期冲突', pri: 'P1', state: '待升级 L3', over: '逾期 3 天', owner: '张伟 · QA · 节点 ③ 标书分解', act: '立即催办' },
  { t: '补齐 3 个基本信息字段', pri: 'P0', state: '今日到期', over: '剩 0 天', owner: '李明 · SLS · 节点 ① 商机判断', act: '去补齐' },
];
const F = (k: string, v: string) => ({ k, v });
export const ATB_GROUPS = [
  { title: '基本信息', total: 16, rows: [F('商机名称', '宁德时代·储能项目'), F('国家', '中国'), F('省州', '福建省'), F('详细地址', '点击填写'), F('经纬度', '点击填写'), F('风光配储', '是 · 风光储一体'), F('项目应用类型', '用户侧储能'), F('产品终端一级应用', '工商业储能'), F('客户名称', '宁德时代新能源'), F('客户角色', '业主 / IPP'), F('招标对象', '点击填写'), F('招标形式', '点击填写'), F('AC/DC', 'DC 侧'), F('开标时间', '2026-11-05 14:00'), F('并网时间', '2027-06'), F('投标保证金', '点击填写')] },
  { title: '商务情况', total: 7, rows: [F('友商参与情况', '点击填写'), F('质保年限', '点击填写'), F('质保范围', '点击填写'), F('付款节点', '点击填写'), F('是否需要审核合同', '点击填写'), F('违约责任及比例', '点击填写'), F('报价币种', '点击填写')] },
  { title: '技术模块', total: 10, rows: [F('AC 侧方案', '需要 · AC 集成'), F('BESS 选型', '5MWh 液冷柜'), F('BESS 台数', '80 台'), F('PCS 选型', '点击填写'), F('PCS 台数', '点击填写'), F('EMS 选型', '点击填写'), F('产品年限', '25 年'), F('产品标准响应要求', '点击填写'), F('电芯能量密度要求', '点击填写'), F('指定产品供应商', '点击填写')] },
  { title: '售后模块', total: 4, rows: [F('售后服务需求范围', '含 5 年运维'), F('售后服务年限需求', '点击填写'), F('售后培训需求', '点击填写'), F('可利用率需求', '点击填写')] },
  { title: 'SPP 团队角色', total: 6, rows: [F('SLS 销售负责人', '李明'), F('PM 项目经理', '王强'), F('SC 方案工程师', '陈磊'), F('QA 质量', '张伟'), F('AMD 交付', '王芳'), F('售前 ID', '点击填写')] },
];
export const STRATEGY_SECTIONS = [
  { k: '招标范围', v: 'DC Block 直采 · 200 MW / 400 MWh · 不含 EPC 总包' },
  { k: '对客策略', v: '决策链：技术中心 → 采购 → 集团投决；价值主线：全生命周期 IRR / LTSA' },
  { k: '竞争策略', v: '对手：阳光电源 / 比亚迪；差异化：10 年质保 + 备件 2 年，不打纯价格战' },
];
export const STRATEGY_FIELDS = [
  ['业务模式', 'DC Block 直采'], ['装机容量', '200 MW / 400 MWh'], ['交货期', '2027 Q2 分批'], ['采购方式', '公开招标 · 两阶段'],
  ['评标办法', '技术 60 / 商务 40'], ['价格锚点', '度电成本 LCOE'], ['决策链', '技术中心 → 采购 → 投决'], ['价值主线', '全生命周期 IRR / LTSA'],
  ['差异化', '10 年质保 + 备件 2 年'], ['主要对手', '阳光电源 / 比亚迪'], ['让价空间', '由报价管理部门另行确定'], ['合规底线', '不含 EPC 与土建'],
];
export const STAGE_ROWS = [
  { s: '① 商机判断', owner: 'SLS 李明', part: 'PM 王强', status: '进行中' },
  { s: '② 投标策略', owner: 'SLS + PM', part: '王强、陈磊', status: '未开始' },
  { s: '③ 标书分解', owner: 'BSD 审核', part: 'SLS、PM', status: '未开始' },
  { s: '④ 开工会', owner: 'PM 王强', part: '全员', status: '未开始' },
  { s: '⑤ 澄清跟进', owner: 'SLS + SC', part: 'SC 陈磊', status: '已逾期' },
  { s: '⑥ 投标文件制作', owner: 'SC', part: 'AMD 王芳', status: '未开始' },
  { s: '⑦ 交标', owner: 'SLS 李明', part: '—', status: '未开始' },
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
// 拆解条目 34 条（由条目算出）：技术 12 / 交付 6 / 商务 8 / 其余章节 8；章节合计 34，与原型章节原文合计 40 的冲突见汇报。
export const CHAPTERS = [
  { n: '第一章 招标公告', c: 4 }, { n: '第二章 投标人须知', c: 8 }, { n: '第三章 评标办法', c: 3 },
  { n: '第四章 技术要求', c: 12 }, { n: '第五章 商务条款', c: 5 }, { n: '第六章 投标文件格式', c: 2 },
];
export const DOC_ITEMS = [
  { t: '4.1 储能系统技术规格书响应', src: '第四章 4.1', cat: '技术', owner: '王强', date: '10-20 → 10-23', status: '进行中' },
  { t: '4.2 并网性能与涉网要求', src: '第四章 4.2', cat: '技术', owner: '陈磊', date: '10-21 → 10-25', status: '待开始' },
  { t: '4.3 消防与安全认证', src: '第四章 4.3', cat: '技术', owner: '未派', date: '10-22 → 10-26', status: '阻塞' },
  { t: '交付周期与里程碑承诺', src: '第五章', cat: '交付', owner: '张伟', date: '10-20 → 10-24', status: '已完成' },
  { t: '物流与关务方案', src: '第五章', cat: '交付', owner: '张伟', date: '10-24 → 10-28', status: '进行中' },
  { t: '商务偏差表（Scope / 付款 / 质保）', src: '第五章', cat: '商务', owner: '王芳', date: '10-21 → 10-25', status: '进行中' },
  { t: '付款节点与合同审查确认', src: '第五章', cat: '商务', owner: '未派', date: '10-22 → 10-26', status: '阻塞' },
  ...Array.from({ length: 27 }, (_, i) => ({ t: `拆解条目 ${i + 8}（按配置表生成）`, src: i % 3 === 0 ? '第一章' : i % 3 === 1 ? '第二章' : '第六章', cat: i % 3 === 0 ? '技术' : i % 3 === 1 ? '商务' : '交付', owner: ['王强', '陈磊', '王芳', '张伟'][i % 4], date: '10-20 → 10-28', status: ['进行中', '待开始', '已完成'][i % 3] })),
];
export const MEETINGS = [
  { name: '开工会 · 分工晾晒', type: '开工会', time: '10-22 14:00', people: '6 人', from: '王强', rec: '未录音', todo: '—', concl: '—', status: '待开' },
  { name: '客户澄清会（第一轮）', type: '客户会', time: '10-25 10:00', people: '3 人', from: '李明', rec: '已转写', todo: '3 条', concl: '3 条', status: '待纪要' },
  { name: '投标策略评审', type: '评审会', time: '10-12 16:00', people: '4 人', from: '李明', rec: '已转写', todo: '2 条', concl: '—', status: '已出纪要' },
  { name: '标书分解对齐会', type: '内部会', time: '10-20 14:00', people: '4 人', from: '王强', rec: '已转写', todo: '1 条', concl: '—', status: '已出纪要' },
  { name: '招标文件答疑会', type: '客户会', time: '10-16 09:30', people: '8 人', from: '李明', rec: '已转写', todo: '1 条', concl: '2 条', status: '已出纪要' },
  { name: '投标文件定稿评审', type: '评审会', time: '10-30 15:00', people: '5 人', from: '王强', rec: '未录音', todo: '—', concl: '—', status: '待开' },
];
export const FILES = [
  { n: '商务标 v2.docx', type: '投标文件', v: 'v2', size: '4.2 MB', u: '王芳', t: '10-20 14:20', s: '进行中' },
  { n: '技术标 v3.docx', type: '投标文件', v: 'v3', size: '8.1 MB', u: '陈磊', t: '10-20 16:05', s: '进行中' },
  { n: '报价表 v1.xlsx', type: '投标文件', v: 'v1', size: '640 KB', u: '李明', t: '10-18 11:30', s: '待更新' },
  { n: '开工会纪要.pdf', type: '会议文档', v: 'v1', size: '620 KB', u: 'AI 听记', t: '10-22 15:30', s: '已归档' },
  { n: '客户澄清会录音.m4a', type: '会议文档', v: '—', size: '32 MB', u: '李明', t: '10-25 10:40', s: '已转写' },
  { n: '澄清问题清单.xlsx', type: '澄清材料', v: 'v2', size: '210 KB', u: '陈磊', t: '10-25 18:00', s: '进行中' },
  { n: '资质与业绩清单.pdf', type: '资质证明', v: 'v1', size: '12 MB', u: '王芳', t: '10-19 09:15', s: '已定稿' },
  { n: '招标文件 v3.0.pdf', type: '招标文件', v: 'v3', size: '18 MB', u: 'AI 解析', t: '10-10 09:30', s: '只读' },
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
export const CLARS = [
  { type: '技术', dir: 'pre-bid', q: '澄清 4.2 节：是否接受远程调试？', owner: '陈磊', due: '10-25', status: '待答复', inBid: false },
  { type: '商务', dir: 'post-bid', q: '质保年限可否延长至 10 年？', owner: '王芳', due: '10-26', status: '待答复', inBid: false },
  { type: '偏差', dir: 'pre-bid', q: '付款节点能否接受 3-4-3？', owner: '王芳', due: '10-25', status: '已答复', inBid: true },
  { type: '技术', dir: 'post-bid', q: 'BESS 台数由 20 台优化为 18 台是否可行？', owner: '陈磊', due: '10-28', status: '待答复', inBid: false },
  { type: '商务', dir: 'pre-bid', q: '投标保证金能否用保函替代？', owner: '李明', due: '10-24', status: '已答复', inBid: true },
  { type: '技术', dir: 'pre-bid', q: 'UL9540A 报告是否为强制响应项？', owner: '陈磊', due: '10-26', status: '已答复', inBid: true },
  { type: '商务', dir: 'post-bid', q: '付款节点 3-3-4 是否为最终口径？', owner: '王芳', due: '10-27', status: '已答复', inBid: true },
  { type: '偏差', dir: 'post-bid', q: '消防认证偏差是否接受偏离表说明？', owner: '张伟', due: '10-28', status: '已答复', inBid: false },
];
export const CHECKS = [
  { src: '待办闭环', detail: '12 项待办 · 2 条未闭环：技术标强制响应 / 报价过 BSD', state: '偏差未闭环' },
  { src: '澄清答复', detail: '8 条澄清 · 3 条超 48h 未回：答疑第 4 / 7 条', state: '偏差未闭环' },
  { src: 'checklist', detail: '14 项 · 技术标强制响应缺 1 项（UL9540A 报告）', state: '偏差未闭环' },
  { src: '客户要求', detail: '8 项 · 付款节点 3-3-4 与客户要求 3-4-3 偏差', state: '待检查' },
];
export const BAFO_ROUNDS = [
  { r: 'R1 · 首轮', time: '10-12 · 已提交', diff: '质保 5 年版 / 基础版本，备件不含；付款节点 3-4-3', concl: '已提交' },
  { r: 'R2 · 短名单', time: '10-25 · 待确认', diff: '质保 10 年版 / 可选项单独报价 / 质保范围扩大；付款节点 3-4-3 改为 3-3-4；备件含 2 年', concl: '待确认' },
  { r: 'R3 · BAFO', time: '预计 11-02 · 待提交', diff: '待招标方澄清', concl: '等待澄清回复，AI 收到新版本后自动比对' },
];
// 字段差异只呈现旧值→新值，不做优劣判断、不含金额、不做评分/排序/区间建议。
export const BAFO_DIFFS = [
  { f: '质保年限', old: '5 年', next: '10 年（可选项单独报价）', state: '已确认' },
  { f: '付款节点', old: '3-4-3', next: '3-3-4', state: '待确认' },
  { f: '备件范围', old: '不含备件', next: '含 2 年备件', state: '已确认' },
  { f: '质保范围', old: '整机质保', next: '整机 + 延保服务', state: '已确认' },
];
export const LESSONS = [
  { t: '强制响应项前置', d: '招标文件解析阶段就建「消防认证」响应任务，R2 才补已经来不及——本次技术分因此丢 6 分' },
  { t: '口径锁定', d: '质保年限需在 R2 与技术标锁定同一口径（5 年 vs 10 年），避免商务标与技术标互相矛盾' },
  { t: '偏差前置确认', d: '付款节点 3-4-3 → 3-3-4 应在 BAFO 前与商务确认，不带进交标阶段' },
];
// AI 协管流水线（implementation-plan §8）
export const PIPELINE_STEPS = [
  { id: 'idle', label: '待启动' }, { id: 'planning', label: 'AI 正在排计划' }, { id: 'plan_draft', label: 'AI 计划草稿待确认' },
  { id: 'decomposing', label: 'AI 正在拆标书' }, { id: 'dispatched', label: '已下发' }, { id: 'executing', label: '执行中 · 提醒与升级' },
  { id: 'checking', label: 'AI 检查中' }, { id: 'review', label: '人工复查' }, { id: 'submitted', label: '已交标' },
];
export const PIPELINE_LABEL: Record<string, string> = {
  idle: '待启动', planning: 'AI 正在排计划…', plan_draft: 'AI 计划草稿已生成，待确认', decomposing: 'AI 正在拆标书…',
  dispatched: '已下发', executing: '执行中', checking: 'AI 检查中…', review: '人工复查中', submitted: '已交标',
};
