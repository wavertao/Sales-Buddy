// P9 投标全流程 · 演示数据（文案与数字逐条取自设计稿 投标全流程.html，主标 BID-20261010-003）。
// 后端接通时由 live.ts 覆盖能从接口拿到的部分；接口没有的 AI 文案、样例对话等仍用这里的设计稿内容。

export type Status = '进行中' | '风险' | '已逾期' | '已交标' | '已定标' | '已流标';

export interface BidRow {
  id: string;            // 接口 id（演示模式等于编号）
  number: string;        // BID-YYYYMMDD-NNN
  customer: string;
  project: string;
  round: string;         // 首轮 / 第二轮
  node: number;          // 0..9
  owner: string;
  team: string;
  due: string;           // YYYY-MM-DD
  left: string;          // 12 天 / 已过
  leftTone?: 'orange' | 'red';
  from: string;
  fromDate: string;
  status: Status;
  mine?: boolean;
}

export const NODES = ['商机判断', '投标策略', '标书分解', '开工会', '澄清跟进', '投标文件制作', '交标', '澄清环节跟进', 'BAFO', '定标'];
export const NODE_NO = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
/** 节点条下方的日期 / 剩余说明（当前节点由组件改成「剩 N 天」）。 */
export const NODE_DATES = ['10-10', '10-12', '剩 12 天', '预计 10-22', '预计 10-25', '预计 10-26', '11-05 14:00', '待定', '待定', '待定'];

export const BIDS: BidRow[] = [
  { id: 'BID-20261010-003', number: 'BID-20261010-003', customer: '宁德时代', project: '储能项目', round: '首轮', node: 2, owner: '王强', team: '储能 SPP', due: '2026-11-05', left: '12 天', from: '李明', fromDate: '2026-10-10', status: '进行中', mine: true },
  { id: 'BID-20261008-002', number: 'BID-20261008-002', customer: '比亚迪', project: '储能柜二期', round: '首轮', node: 5, owner: '张伟', team: '储能 SPP', due: '2026-11-08', left: '15 天', from: '张伟', fromDate: '2026-10-08', status: '进行中', mine: true },
  { id: 'BID-20260928-007', number: 'BID-20260928-007', customer: '隆基绿能', project: '分布式储能', round: '第二轮', node: 8, owner: '陈磊', team: '光伏 SPP', due: '2026-10-28', left: '4 天', leftTone: 'orange', from: '王芳', fromDate: '2026-09-28', status: '风险', mine: true },
  { id: 'BID-20260922-005', number: 'BID-20260922-005', customer: '阳光电源', project: '电站储能', round: '首轮', node: 6, owner: '王芳', team: '储能 SPP', due: '2026-10-30', left: '6 天', leftTone: 'orange', from: '王强', fromDate: '2026-09-22', status: '进行中' },
  { id: 'BID-20261014-004', number: 'BID-20261014-004', customer: '天合光能', project: '储能一体机', round: '首轮', node: 1, owner: '李明', team: '汽车 SPP', due: '2026-11-15', left: '22 天', from: '李明', fromDate: '2026-10-14', status: '进行中' },
  { id: 'BID-20251205-011', number: 'BID-20251205-011', customer: '浙江工商业储能', project: '工商业储能集群', round: '首轮', node: 9, owner: '王强', team: '储能 SPP', due: '2026-10-12', left: '已过', leftTone: 'red', from: '王强', fromDate: '2025-12-05', status: '已逾期' },
];
export const LIST_FILTERS: [string, number][] = [['全部', 8], ['进行中', 5], ['待我处理', 3], ['已交标', 2], ['已定标', 2], ['已流标', 1]];
export const LIST_STATS = [
  { label: '进行中', value: '5', note: '其中 2 个本周交标', tone: 'blue' },
  { label: '待我处理', value: '3', note: '2 条阻塞 · 1 条今日到期', tone: 'red' },
  { label: '卡点', value: '3', note: '未派责任人 2 · 排期冲突 1', tone: 'orange' },
  { label: '中标率', value: '42%', note: '近 12 个月 19 投 8 中', tone: 'dark' },
];

/** P9.0.2 商机详情 · 投标 Tab：同一商机下的 3 条投标。 */
export const OPP = { customer: '宁德时代', project: '储能项目', stage: 'S4 商务谈判 · 赢单 75%', spec: '200 MW / 400 MWh · DC Block 直采' };
export const OPP_BIDS = [
  { id: 'BID-20261010-003', sub: '储能项目', rounds: [['R1 已交标', 'past'], ['R2 当前', 'now']], node: 2, due: '11-05 · 剩 12 天', owner: '王强', team: '储能 SPP', from: '李明', fromDate: '2026-10-10', status: '进行中' as Status },
  { id: 'BID-20260912-011', sub: '储能项目 · 二期', rounds: [['R1 当前', 'now']], node: 6, due: '10-30 · 剩 6 天', owner: '王芳', team: '储能 SPP', from: '王芳', fromDate: '2026-09-12', status: '进行中' as Status },
  { id: 'BID-20260820-004', sub: '储能项目 · 增补', rounds: [['R1-R2 已交标', 'past'], ['R3 当前', 'now']], node: 8, due: '10-28 · 剩 4 天', owner: '陈磊', team: '储能 SPP', from: '陈磊', fromDate: '2026-08-20', status: '风险' as Status },
];

export const BID_FORMS = ['公开招标', '邀请招标', '竞争性谈判', '竞争性磋商', '询价'];
export const BID_TARGETS = ['开发商', 'EPC', '集成商', '电池供应商', 'IPP', '联合体'];
export const COUNTRIES = ['中国', '美国', '德国', '英国', '澳大利亚', '沙特阿拉伯', '智利'];

// ---------------- P9.1.1 驾驶舱 ----------------
export const COCKPIT = {
  updated: '10-24 09:40',
  conclusion: '已解析 ATB 评审表 38 字段、拆标分解 14 条任务与 6 次澄清：健康度 68（安全线 80），3 个卡点、2 条逾期任务，距交标 12 天 —— 建议今天先闭环「技术标 12 项强制响应」与「报价文件过 BSD」。',
  urge: 5,
  health: { score: 68, safe: 80, status: '需关注', delta: '较昨日 -4 · 下降 2 项', reason: '下降主因：技术部分 55（技术标缺 12 项强制响应）、报价文件 64（成本未过 BSD 评审）' },
  dims: [['进度排期', 82], ['商务部分', 76], ['技术部分', 55], ['报价文件', 64], ['偏差管理', 61], ['澄清响应', 67]] as [string, number][],
  remain: {
    days: 12, hours: '天 06 小时', deadline: '2026-11-05 14:00', clar: '2026-10-25', clarLeft: 1,
    cells: [['9', '剩余工作日'], ['2', '关键截止'], ['4', '未闭环任务']] as [string, string][],
    keys: [['标书定稿', '需在 11-01 前完成', 'orange'], ['交标截止', '2026-11-05 · 剩 12 天', 'red']] as [string, string, string][],
    risk: '时间缺口：标书制作仍需 18 人日，仅剩 9 个工作日 —— 建议拆商务 / 技术两组并行，报价会前置到 10-28。',
  },
  blockers: [
    { title: '技术标缺 12 项强制响应', level: '高', state: '已升级 L2', over: '逾期 3 天', ai: 'AI 判定：缺 12 项 mandatory 响应条款，属废标风险（92 分）；已升级至 SPP 负责人。', owner: '王强', role: 'PM', src: '节点 ③ 标书分解', act: '追问进度', go: 'plan' },
    { title: '报价文件未过 BSD 评审', level: '高', state: '待升级 L3', over: '超时 26h', ai: 'AI 判定：报价 R2 已冻结 48h 无审批结论，阻塞交标准备（84 分）；今夜 22:00 升级 L3。', owner: '李明', role: 'SLS', src: '节点 ⑦ 报价提报', act: '立即催办', go: 'urge' },
    { title: '澄清 2 条超 48h 未回', level: '中', state: '已催办 2 次', over: '逾期 1 天', ai: 'AI 判定：答疑第 4 / 7 条由技术中心承办，超 48h 未回将拖延标书制作（66 分）。', owner: '陈磊', role: 'SC', src: '节点 ⑤ 澄清跟进', act: '查看答疑', go: 'todos' },
  ],
  overdue: [
    { title: '审阅拆标分解表并提交 BSD', level: 'P0', state: '已升级 L2', over: '逾期 2 天', ai: 'AI 判定：阻塞「投标文件制作」启动且为 P0，已升级至 SPP 负责人。', owner: '陈磊', role: 'SC', src: '节点 ③ 标书分解', act: '催办 BSD', go: 'urge' },
    { title: '处理技术评审与报价排期冲突', level: 'P1', state: '待升级 L3', over: '逾期 3 天', ai: 'AI 判定：报价冻结依赖技术评审结论，未解将延后报价 2 天；已催办 2 次。', owner: '张伟', role: 'QA', src: '节点 ③ 标书分解', act: '立即催办', go: 'urge' },
    { title: '补齐 3 个基本信息字段', level: 'P0', state: '今日到期', over: '剩 0 天', ai: 'AI 判定：项目地点 / 供货范围 / 保证金为空，属 ATB 缺失项，已提前 4h 预警。', owner: '李明', role: 'SLS', src: '节点 ① 商机判断', act: '去补齐', go: 'basic' },
  ],
};

export interface ChatMsg { who: 'ai' | 'me'; text: string; meta: string; chips?: string[] }
export const COCKPIT_CHAT: ChatMsg[] = [
  { who: 'me', text: '这个标还有救吗？', meta: '08:20' },
  { who: 'ai', text: '有。距交标 12 天，商务与交付材料已齐；真正的风险只有两处：技术标 12 项强制响应、报价未过 BSD。今天若闭环，按时交标没问题。', meta: '08:20 · 已引用健康度与节点进度' },
  { who: 'ai', text: '我已按 AI 解析结果盯着这个标：健康度 68，3 个卡点里「技术标缺 12 项强制响应」最危险（评分 92）；报价 R2 还卡在 BSD。今天建议先动这两件。', meta: '09:40 · 已引用驾驶舱 5 个数据块', chips: ['技术标响应清单', '催办报价过会'] },
  { who: 'me', text: '技术标那 12 项，现在谁还没交？', meta: '09:41' },
  { who: 'ai', text: '12 项由 SC 陈磊牵头，其中 4 项还在等他回填参数；L2 升级已发给 PM 王强，18:00 前未回我直接进 L3，并同步到部门主管的日报。', meta: '09:41 · 答复基于节点 ③ 标书分解' },
];
export const DOCK_WELCOME: ChatMsg = { who: 'ai', text: '我在。这个标的待办、澄清、卡点、健康度我都能直接查；也可以让我催一下责任人。', meta: '刚刚 · 已引用本屏数据' };
export const DOCK_QUICK = ['这个标的风险？', '我的待办？', '进度到哪了？'];

// ---------------- P9.2.1 基本信息（ATB 评审表）----------------
export interface Round { no: string; label: string; state: 'done' | 'now' | 'todo'; date: string; note: string }
export const ROUNDS: Round[] = [
  { no: 'R1', label: '首轮', state: 'done', date: '10-12 开始', note: '已归档 · 只读' },
  { no: 'R2', label: '次轮', state: 'now', date: '10-28 开始', note: '进行中 · 可继续补字段' },
  { no: 'R3', label: '短名单', state: 'todo', date: '预计 11-10', note: '点击推进到此轮 →' },
  { no: 'R4', label: '终审', state: 'todo', date: '预计 11-20', note: '点击推进到此轮 →' },
];
export const NECESSITY: [string, string][] = [['需求真实性', '有明确业主 / 资方与资金路径？'], ['可执行性', '并网、环评、土地、接入可行？'], ['商业合理性', '是否匹配战略与投产比？']];
export interface AtbGroup { key: string; name: string; summary: string; fields: [string, string][] }
export const ATB_GROUPS: AtbGroup[] = [
  { key: 'basic', name: '基本信息', summary: '16 项', fields: [['商机名称', '宁德时代·储能项目'], ['国家', '中国'], ['省州', '福建省'], ['详细地址', ''], ['经纬度', ''], ['风光配储', '是 · 风光储一体'], ['项目应用类型', '用户侧储能'], ['产品终端一级应用', '工商业储能'], ['客户名称', '宁德时代新能源'], ['客户角色', '业主 / IPP'], ['招标对象', ''], ['招标形式', ''], ['AC/DC', 'DC 侧'], ['开标时间', '2026-11-05 14:00'], ['并网时间', '2027-06'], ['投标保证金', ''], ['NDA签署状态', '']] },
  { key: 'business', name: '商务情况', summary: '7 项 · 全部待补', fields: [['友商参与情况', ''], ['质保年限', ''], ['质保范围', ''], ['付款节点', ''], ['是否需要审核合同', ''], ['违约责任及比例', ''], ['报价币种', '']] },
  { key: 'technical', name: '技术模块', summary: '10 项 · 缺 6 项', fields: [['AC侧方案', '需要 · AC 集成'], ['BESS选型', '5MWh 液冷柜'], ['BESS台数', '80 台'], ['PCS选型', ''], ['PCS台数', ''], ['EMS选型', ''], ['产品年限', '25 年'], ['产品标准响应要求', ''], ['电芯能量密度要求', ''], ['指定产品供应商', '']] },
  { key: 'afterSales', name: '售后模块', summary: '4 项 · 缺 3 项', fields: [['售后服务需求范围', '含 5 年运维'], ['售后服务年限需求', ''], ['售后培训需求', ''], ['可利用率需求', '']] },
  { key: 'team', name: 'SPP 团队角色', summary: '6 项 · 缺 售前 ID', fields: [['SLS 销售负责人', '李明'], ['PM 项目经理', '王强'], ['SC 方案工程师', '陈磊'], ['QA 质量', '张伟'], ['AMD 交付', '王芳'], ['售前 ID', '']] },
];
/** 基本信息组里「商机名称」为多选（设计稿：已选 chip + 「+2」）。 */
export const OPP_NAME_CHOICES = ['宁德时代·储能项目', '宁德时代·储能项目二期', '宁德时代·储能增补'];

// ---------------- P9.2.2 投标策略 ----------------
export const STRATEGY_JUDGE: [string, string][] = [
  ['招标范围', 'DC Block 直采 · 200 MW / 400 MWh · 不含 EPC 总包'],
  ['对客策略', '决策链：技术中心 → 采购 → 集团投决；价值主线：全生命周期 IRR / LTSA'],
  ['竞争策略', '对手：阳光电源 / 比亚迪；差异化：10 年质保 + 备件 2 年，不打纯价格战'],
];
export const STRATEGY_FIELDS: [string, string][] = [
  ['业务模式', 'DC Block 直采'], ['装机容量', '200 MW / 400 MWh'], ['交货期', '2027 Q2 分批'],
  ['采购方式', '公开招标 · 两阶段'], ['评标办法', '技术 60 / 商务 40'], ['价格锚点', '度电成本 LCOE'],
  ['决策链', '技术中心 → 采购 → 投决'], ['价值主线', '全生命周期 IRR / LTSA'], ['差异化', '10 年质保 + 备件 2 年'],
  ['主要对手', '阳光电源 / 比亚迪'], ['让价空间', '首轮 6-8%'], ['合规底线', '不含 EPC 与土建'],
];
export const STRATEGY_SECTIONS: [string, string, string][] = [
  ['报价策略', '3 段：首轮锚定 / 短名单让价 / BAFO 收敛', '首轮按度电成本锚定、不报最低价；进入短名单后在 6-8% 空间内分两次让价；BAFO 只收敛付款与质保口径，不再降单价。'],
  ['技术策略', '10 年质保 + LTSA 为主线，不承诺超配', '技术标以 LTSA 长期服务协议 + 10 年质保为主线，可用率承诺按 20 台方案测算；不承诺超出招标要求的冗余配置。'],
  ['服务策略', '备件 2 年 + 4 小时响应', '备件含 2 年；远程诊断 7×24，现场 4 小时响应；运维培训 2 期写入技术标。'],
  ['团队分工', '技术中心主责技术标，商务主责报价', 'SC 陈磊主责技术标与澄清答复；SLS 李明主责报价与商务偏差；PM 王强统筹排期与 BSD 审核。'],
];
export const AI_DIRECTION: [string, string][] = [
  ['主打点', '用全生命周期 IRR 打穿：技术标写 LTSA + 10 年质保，商务标给 3-3-4 付款'],
  ['避让点', '不接纯价格战；EPC 总包与土建不在报价范围'],
  ['报价姿态', '锚定度电成本而非设备单价，首轮留 6-8%，BAFO 再收敛'],
];

// ---------------- P9.2.3 节点推进 ----------------
export const ADVANCE_CHECKS = ['拆标分解表 34 条已提交', '责任人与 RACI 22 人已指派', 'BSD 审核已通过'];

// ---------------- P9.3 计划 ----------------
export type PlanStatus = '未开始' | '进行中' | '已完成' | '已逾期';
export interface StageRow { name: string; round: string; owner: string; part: string; status: PlanStatus; start: number; len: number }
/** 阶段级（招标文件未上传时）：start / len 以「10/17 起第几天」计，WK1–WK4 共 28 天。 */
export const STAGES: StageRow[] = [
  { name: '① 商机判断', round: 'R1', owner: 'SLS 李明', part: 'PM 王强', status: '进行中', start: 0, len: 4 },
  { name: '② 投标策略', round: 'R1', owner: 'SLS + PM', part: '王强、陈磊', status: '未开始', start: 4, len: 8 },
  { name: '③ 标书分解', round: 'R1', owner: 'BSD 审核', part: 'SLS、PM', status: '未开始', start: 12, len: 10 },
  { name: '④ 开工会', round: 'R1', owner: 'PM 王强', part: '全员', status: '未开始', start: 22, len: 2 },
  { name: '⑤ 澄清跟进', round: 'R2', owner: 'SLS + SC', part: 'SC 陈磊', status: '已逾期', start: 24, len: 6 },
  { name: '⑥ 投标文件制作', round: 'R2', owner: 'SC / AMD', part: 'AMD 王芳', status: '未开始', start: 30, len: 8 },
  { name: '⑦ 交标', round: 'R2', owner: 'SLS 李明', part: '—', status: '未开始', start: 38, len: 2 },
];
export interface PlanItem { id: string; title: string; round: string; owner: string; part: string; status: PlanStatus; start: string; end: string; cat: '技术' | '交付' | '商务' }
export const PLAN_START = '2026-10-17';
export const PLAN_ITEMS: PlanItem[] = [
  { id: 'p1', title: '4.1 技术规格书', round: 'R2', owner: '王强', part: '陈磊、张伟', status: '进行中', start: '2026-10-20', end: '2026-10-23', cat: '技术' },
  { id: 'p2', title: '4.2 并网性能', round: 'R2', owner: '陈磊', part: '王强', status: '未开始', start: '2026-10-21', end: '2026-10-25', cat: '技术' },
  { id: 'p3', title: '4.3 消防认证', round: 'R2', owner: '', part: '陈磊', status: '已逾期', start: '2026-10-22', end: '2026-10-26', cat: '技术' },
  { id: 'p4', title: '交付周期承诺', round: 'R1', owner: '张伟', part: '王强', status: '已完成', start: '2026-10-18', end: '2026-10-21', cat: '交付' },
  { id: 'p5', title: '物流与关务', round: 'R1', owner: '张伟', part: '王芳', status: '进行中', start: '2026-10-24', end: '2026-10-28', cat: '交付' },
  { id: 'p6', title: '商务偏差表', round: 'R2', owner: '王芳', part: '李明', status: '进行中', start: '2026-10-21', end: '2026-10-25', cat: '商务' },
  { id: 'p7', title: '付款节点审查', round: 'R2', owner: '', part: '王芳', status: '已逾期', start: '2026-10-22', end: '2026-10-26', cat: '商务' },
  { id: 'p8', title: '资质与业绩', round: 'R1', owner: '王芳', part: '李明', status: '已完成', start: '2026-10-18', end: '2026-10-22', cat: '商务' },
];
export const PEOPLE = ['李明', '王强', '陈磊', '张伟', '王芳'];
export const ROLE_OF: Record<string, string> = { 李明: 'SLS', 王强: 'PM', 陈磊: 'SC', 张伟: 'QA', 王芳: 'AMD' };

// ---------------- P9.4 招标文件 ----------------
export const CHAPTERS: { name: string; count: number; subs?: string[] }[] = [
  { name: '第一章 招标公告', count: 4 }, { name: '第二章 投标人须知', count: 8 }, { name: '第三章 评标办法', count: 3 },
  { name: '第四章 技术要求', count: 12, subs: ['4.1 技术规格书', '4.2 并网性能', '4.3 消防认证'] },
  { name: '第五章 商务条款', count: 8 }, { name: '第六章 投标文件格式', count: 5 },
];
export const DOC_GROUPS: { cat: string; count: number; rows: { title: string; owner: string; date: string; status: '进行中' | '待开始' | '阻塞' | '已完成' }[] }[] = [
  { cat: '技术', count: 12, rows: [
    { title: '4.1 储能系统技术规格书响应', owner: '王强', date: '10-20 → 10-23', status: '进行中' },
    { title: '4.2 并网性能与涉网要求', owner: '陈磊', date: '10-21 → 10-25', status: '待开始' },
    { title: '4.3 消防与安全认证', owner: '', date: '10-22 → 10-26', status: '阻塞' },
  ] },
  { cat: '交付', count: 6, rows: [
    { title: '交付周期与里程碑承诺', owner: '张伟', date: '10-20 → 10-24', status: '已完成' },
    { title: '物流与关务方案', owner: '张伟', date: '10-24 → 10-28', status: '进行中' },
  ] },
  { cat: '商务', count: 8, rows: [
    { title: '商务偏差表（Scope / 付款 / 质保）', owner: '王芳', date: '10-21 → 10-25', status: '进行中' },
    { title: '付款节点与合同审查确认', owner: '', date: '10-22 → 10-26', status: '阻塞' },
  ] },
];
export const PARSE_STEPS: [string, string][] = [['上传完成', '42 页 · 18 MB'], ['解析章节结构', '正在识别第六章 投标文件格式…'], ['抽取技术要求与商务条款', '34 条候选要求'], ['按配置表生成拆标分解条目', '预计 4 步后生成 34 条']];

// ---------------- P9.5 会议 ----------------
export interface Meeting { id: string; name: string; round: string; roundLabel: string; type: string; time: string; people: number; host: string; rec: string; todo: string; concl: string; status: '待开' | '待纪要' | '已出纪要' }
export const MEETINGS: Meeting[] = [
  { id: 'm1', name: '开工会 · 分工晾晒', round: 'R1', roundLabel: '首轮', type: '开工会', time: '10-22 14:00', people: 6, host: '王强', rec: '未录音', todo: '—', concl: '—', status: '待开' },
  { id: 'm2', name: '客户澄清会（第一轮）', round: 'R1', roundLabel: '首轮', type: '客户会', time: '10-25 10:00', people: 3, host: '李明', rec: '已转写', todo: '3 条', concl: '3 条', status: '待纪要' },
  { id: 'm3', name: '投标策略评审', round: 'R1', roundLabel: '首轮', type: '评审会', time: '10-12 16:00', people: 4, host: '李明', rec: '已转写', todo: '2 条', concl: '—', status: '已出纪要' },
  { id: 'm4', name: '标书分解对齐会', round: 'R1', roundLabel: '首轮', type: '内部会', time: '10-20 14:00', people: 4, host: '王强', rec: '已转写', todo: '1 条', concl: '—', status: '已出纪要' },
  { id: 'm5', name: '招标文件答疑会', round: 'R2', roundLabel: '短名单', type: '客户会', time: '10-16 09:30', people: 8, host: '李明', rec: '已转写', todo: '1 条', concl: '2 条', status: '已出纪要' },
  { id: 'm6', name: '投标文件定稿评审', round: 'R2', roundLabel: '短名单', type: '评审会', time: '10-30 15:00', people: 5, host: '王强', rec: '未录音', todo: '—', concl: '—', status: '待开' },
];
export const MEETING_DETAIL = {
  time: '10-25 10:00–11:20',
  minutes: [
    ['议题', '客户就 BESS 台数优化、质保年限延长、远程调试支持提出 3 个澄清问题。'],
    ['讨论要点', '技术侧：18 台会影响可用率承诺，建议维持 20 台。商务侧：质保以 5 年为基础、10 年做可选包单独报价。远程调试可做，但需在技术标中明确边界（不含现场网络改造）。'],
    ['决议', '维持 20 台报价；质保出 5 年 / 10 年两版；远程调试写入技术标作为加分项；剩余 1 项由陈磊 10-26 前书面答复。'],
  ] as [string, string][],
  conclusions: ['BESS 可按 20 台报价，不接受减至 18 台', '质保以 5 年为基础版本，10 年作为可选项单独报价', '远程调试要求写入技术标，作为加分项', '澄清答复截止 10-25 18:00，逾期视为放弃'],
  todos: [
    { t: '补充储能系统消防方案细节', who: '陈磊 · 10-26', status: '进行中', done: false },
    { t: '明确远程调试实现方案与成本', who: '陈磊 · 10-26', status: '待开始', done: false },
    { t: '质保 5 年 / 10 年两版重新报价', who: '王芳 · 10-28', status: '已完成', done: true },
  ],
  people: [['李明', 'SLS · 发起人', 'blue'], ['陈磊', 'SC · 技术答复', 'teal'], ['王芳', 'AMD · 商务答复', 'orange']] as [string, string, string][],
  record: [['文件', '客户澄清会录音.m4a'], ['时长', '80 分钟 · 32 MB'], ['转写', '已完成 · 98% 准确'], ['发言', '3 人 · 自动分离']] as [string, string][],
  links: [['澄清条目', '3 条 · 已同步到澄清 Tab'], ['会议待办', '3 条 · 待派发'], ['相关文件', '客户澄清会录音.m4a']] as [string, string][],
};

// ---------------- P9.6 文件 ----------------
export const FOLDERS: { name: string; count: number; subs?: [string, number][] }[] = [
  { name: '投标文件', count: 6, subs: [['商务标', 2], ['技术标', 2], ['报价文件', 1], ['资质业绩', 1]] },
  { name: '会议文档', count: 7 }, { name: '澄清材料', count: 3 }, { name: '招标文件原件', count: 2 },
];
export interface FileRow { name: string; type: string; v: string; size: string; who: string; time: string; status: '进行中' | '历史' | '已归档'; folder: string; sub?: string; kind: 'doc' | 'xls' | 'pdf' }
export const FILES: FileRow[] = [
  { name: '商务标 v2.docx', type: '投标文件', v: 'v2', size: '4.2 MB', who: '王芳', time: '10-20 14:20', status: '进行中', folder: '投标文件', sub: '商务标', kind: 'doc' },
  { name: '商务标 v1.docx', type: '投标文件', v: 'v1', size: '3.8 MB', who: '王芳', time: '10-12 09:40', status: '历史', folder: '投标文件', sub: '商务标', kind: 'doc' },
  { name: '技术标 v3.docx', type: '投标文件', v: 'v3', size: '5.1 MB', who: '陈磊', time: '10-22 11:05', status: '进行中', folder: '投标文件', sub: '技术标', kind: 'doc' },
  { name: '技术标 v2.docx', type: '投标文件', v: 'v2', size: '4.9 MB', who: '陈磊', time: '10-15 16:30', status: '历史', folder: '投标文件', sub: '技术标', kind: 'doc' },
  { name: '报价表 v1.xlsx', type: '投标文件', v: 'v1', size: '1.2 MB', who: '李明', time: '10-21 18:10', status: '进行中', folder: '投标文件', sub: '报价文件', kind: 'xls' },
  { name: '资质与业绩清单.pdf', type: '资质业绩', v: 'v1', size: '2.4 MB', who: '张伟', time: '10-10 10:00', status: '已归档', folder: '投标文件', sub: '资质业绩', kind: 'pdf' },
];

// ---------------- P9.7 待办与澄清 ----------------
export interface Comment { who: string; time: string; text: string; system?: boolean }
export interface Todo {
  id: string; title: string; full?: string; round: string; src: string; owner: string; due: string; pri: 'P0' | 'P1' | 'P2';
  status: '待开始' | '进行中' | '已完成' | '部分完成' | '已取消' | '需延期'; mine: boolean; overdue?: boolean;
  comments: Comment[]; result?: { outcome: string; who: string; time: string; note: string; file?: string };
}
export const TODOS: Todo[] = [
  { id: 't1', title: '补齐 3 个基本信息字段（项目地点 / 供货范围 / 保证金）', full: '补齐 3 个基本信息字段（项目地点 / 我司供货范围 / 投标保证金）', round: 'R1', src: '① 商机判断', owner: '李明', due: '今天', pri: 'P0', status: '进行中', mine: true, overdue: true,
    comments: [
      { who: '王强', time: '10-24 16:40', text: '收到，供货范围这块我和 C 厂再核一下 PCS 型号，明天给结论。' },
      { who: '李明', time: '10-24 16:32', text: '项目地点和保证金我先补了，供货范围还需要陈磊确认 PCS 是自研还是外采。' },
      { who: '李明', time: '10-23 09:15', text: '项目地点是福建宁德还是福鼎？客户邮件里两个地方都提到了。' },
    ] },
  { id: 't2', title: '指派 2 条拆解条目的责任人', round: 'R1', src: '③ 标书分解', owner: '王强', due: '今天', pri: 'P0', status: '进行中', mine: true, overdue: true,
    comments: [{ who: '王强', time: '10-24 10:05', text: '4.3 消防认证和付款节点审查还没人接，今天下班前定。' }] },
  { id: 't3', title: '明确远程调试实现方案与成本', round: 'R2', src: '会议 · 澄清会', owner: '陈磊', due: '10-26', pri: 'P1', status: '待开始', mine: true,
    comments: [
      { who: '陈磊', time: '10-25 11:30', text: '远程调试边界先按「不含现场网络改造」写。' },
      { who: '李明', time: '10-25 11:22', text: '客户希望 10-26 前给书面方案。' },
      { who: '系统', time: '10-25 11:20', text: '由会议「客户澄清会（第一轮）」生成', system: true },
    ] },
  { id: 't4', title: '质保 5 年 / 10 年两版重新报价', round: 'R2', src: '会议 · 澄清会', owner: '王芳', due: '10-28', pri: 'P1', status: '已完成', mine: true,
    comments: [{ who: '王芳', time: '10-26 17:02', text: '两版报价已上传到报价文件夹。' }, { who: '系统', time: '10-25 11:20', text: '由会议「客户澄清会（第一轮）」生成', system: true }],
    result: { outcome: '已完成', who: '王芳', time: '10-26 17:00', note: '质保 5 年 / 10 年两版报价已出，10 年版作为可选项单独报价。' } },
  { id: 't5', title: '技术标 12 项强制响应未提交', round: 'R2', src: '③ 标书分解', owner: '陈磊', due: '10-21', pri: 'P0', status: '进行中', mine: false, overdue: true,
    comments: [{ who: '王强', time: '10-24 09:00', text: '已升级 L2，今天 18:00 前回填剩余 4 项参数。' }, { who: '系统', time: '10-22 09:00', text: '逾期 1 天，自动催办陈磊', system: true }] },
  { id: 't6', title: '报价版本未过 BSD 评审', round: 'R2', src: '⑥ 投标文件制作', owner: '李明', due: '10-23', pri: 'P0', status: '进行中', mine: false, overdue: true,
    comments: [{ who: '李明', time: '10-24 10:20', text: 'BSD 要求补成本拆分表，今晚提交。' }] },
];
export interface Clar { id: string; type: '技术' | '商务' | '偏差'; round: string; dir: 'pre-bid' | 'post-bid'; q: string; owner: string; due: string; status: '待答复' | '已答复'; comments: number; answer?: string }
export const CLARS: Clar[] = [
  { id: 'c1', type: '技术', round: 'R2', dir: 'pre-bid', q: '澄清 4.2 节：是否接受远程调试？', owner: '陈磊', due: '10-25', status: '待答复', comments: 3 },
  { id: 'c2', type: '商务', round: 'R2', dir: 'post-bid', q: '质保年限可否延长至 10 年？', owner: '王芳', due: '10-26', status: '待答复', comments: 3 },
  { id: 'c3', type: '偏差', round: 'R2', dir: 'pre-bid', q: '付款节点能否接受 3-4-3？', owner: '王芳', due: '10-25', status: '已答复', comments: 3, answer: '接受 3-4-3 付款节点，商务偏差表同步更新，偏差项撤销。' },
  { id: 'c4', type: '技术', round: 'R1', dir: 'post-bid', q: 'BESS 台数由 20 台优化为 18 台是否可行？', owner: '陈磊', due: '10-28', status: '待答复', comments: 3 },
  { id: 'c5', type: '商务', round: 'R1', dir: 'pre-bid', q: '投标保证金能否用保函替代？', owner: '李明', due: '10-24', status: '已答复', comments: 1, answer: '可以用银行保函替代，格式按招标文件附件 7，有效期覆盖投标有效期 + 30 天。' },
];
export const TODO_DETAIL_EXTRA = {
  creator: '王强 · 10-20 14:20', deadline: '2026-10-25（今天）', customer: '宁德时代', opp: '储能项目 200MW/400MWh', lead: '—',
  result: { who: '李明', time: '10-24 16:32', note: '项目地点补福建宁德；我司供货范围补 DC Block + PCS；投标保证金补 500 万元（2%）。', file: '供货范围截图.png · 240 KB', sync: '已回写计划 · 已写入今日日报' },
  system: '李明 将待办标记为「已完成」，并回写计划条目 ① 商机判断 · 基本信息',
};
export const COMPLETE_OUTCOMES: [string, string][] = [['已完成', 'green'], ['部分完成', 'orange'], ['已取消', 'gray'], ['需延期', 'red']];

// ---------------- P9.8 交标与结果 ----------------
export const CHECK_SUMMARY = '齐备性 5 项缺 1（报价表待上传）；四源核查发现 3 项偏差未闭环 —— 建议补齐后再发起签章流程。';
export interface CheckSection { key: string; name: string; summary: string; state: '偏差未闭环' | '待检查' | '未复查' | '已通过'; bar: 'red' | 'orange' | 'gray' | 'green'; items?: { title: string; meta: string; todo?: string; clar?: string }[]; note?: string; action?: string }
export const CHECK_SECTIONS: CheckSection[] = [
  { key: 'todo', name: '待办闭环', summary: '12 项待办 · 2 条未闭环', state: '偏差未闭环', bar: 'red', items: [
    { title: '技术标 12 项强制响应未提交', meta: '陈磊 SC · 逾期 3 天 · P0', todo: 't5' },
    { title: '报价版本未过 BSD 评审', meta: '李明 SLS · 超时 26h · P0', todo: 't6' },
  ], note: '来自待办与澄清 · 处理完点「开始检查」重跑' },
  { key: 'clar', name: '澄清答复', summary: '8 条澄清 · 3 条超 48h 未回', state: '偏差未闭环', bar: 'red', items: [
    { title: '澄清 4.2 节：是否接受远程调试？', meta: '陈磊 SC · 截止 10-25 · 待答复', clar: 'c1' },
    { title: '质保年限可否延长至 10 年？', meta: '王芳 AMD · 截止 10-26 · 待答复', clar: 'c2' },
    { title: 'BESS 台数由 20 台优化为 18 台是否可行？', meta: '陈磊 SC · 截止 10-28 · 待答复', clar: 'c4' },
  ], note: '来自待办与澄清 · 答复后点「开始检查」重跑' },
  { key: 'checklist', name: 'checklist', summary: '14 项 · 缺 1 项 UL9540A 报告', state: '偏差未闭环', bar: 'red', items: [
    { title: 'UL9540A 热失控测试报告', meta: '张伟 QA · 资质类 · 必选' },
  ], note: '来自交标 checklist 模板 · 上传证明材料后自动勾选' },
  { key: 'req', name: '客户要求', summary: '8 项 · 付款节点偏差', state: '待检查', bar: 'orange', items: [
    { title: '付款节点 3-4-3（我方报 3-3-4）', meta: '王芳 AMD · 偏差 · 待业务确认' },
  ], note: '来自招标文件第五章商务条款' },
  { key: 'review', name: '人工复查', summary: '王强（技术负责人）· 待签字', state: '未复查', bar: 'gray', action: '发起复查' },
];
export const TENDER_FILES: { name: string; meta: string; uploaded: boolean }[] = [
  { name: '商务标 v2.pdf', meta: 'v2 · 2.4 MB · 11-02 14:20', uploaded: true },
  { name: '技术标 v3.pdf', meta: 'v3 · 5.1 MB · 11-02 15:05', uploaded: true },
  { name: '报价表 v1.xlsx', meta: '待上传 · 需盖章版', uploaded: false },
];

// ---------------- P9.9 BAFO ----------------
export const BAFO_ROUNDS = [
  { r: 'R1 · 首轮', time: '10-12 · 已提交', v: '质保 5 年版', vNote: '基础版本', diff: '基础版本，备件不含；付款节点 3-4-3', concl: '已提交', tone: 'green' },
  { r: 'R2 · 短名单', time: '10-25 · 待确认', v: '质保 10 年版', vNote: '可选项单独报价', diff: '质保范围扩大；付款节点 3-4-3 改为 3-3-4；备件含 2 年', concl: '待确认', tone: 'orange' },
  { r: 'R3 · BAFO', time: '预计 11-02', v: '待提交', vNote: '待招标方澄清', diff: '等待澄清回复，AI 收到新版本后自动比对', concl: '待提交', tone: 'gray' },
];
export const BAFO_DIFFS = [
  { f: '质保年限', old: '5 年', next: '10 年（可选项单独报价）', ok: true },
  { f: '付款节点', old: '3-4-3', next: '3-3-4', ok: false },
  { f: '备件范围', old: '不含备件', next: '含 2 年备件', ok: true },
  { f: '质保范围', old: '整机质保', next: '整机 + 延保服务', ok: true },
];
export const QUOTE_ACCESS: [string, string, string, string][] = [
  ['SPP PM（王强）', '可见 · 可编辑 · 可下载', '通过', 'green'],
  ['SLS（李明）', '可见 · 只读 · 下载需审批', '待审批', 'orange'],
  ['SC / 财务', '仅状态 · 不含金额', '受限', 'gray'],
  ['其他成员', '不可见', '不可见', 'red'],
];

// ---------------- P9.10 定标复盘 ----------------
export const REVIEW = {
  conclusion: '核心结论：报价高出中标方 6.2%、技术分差 6 分（消防认证未响应），两处都能提前规避；商务分在 R2 靠「质保扩到 10 年 + 单独报价」追回 5 分，说明主动改口径有效。',
  reasons: ['价格', '技术未达', '客户预算取消'],
  attribution: 'AI 归因：价格（同类项目我司均价高于中标方约 6%）与强制响应缺失是主因；评标反馈未提交付与售后失分，说明本次竞争的主战场是技术与价格。中标时本块自动切换为赢单原因分析。',
  lessons: [
    ['强制响应项前置', '招标文件解析阶段就建「消防认证」响应任务，R2 才补已经来不及——本次技术分因此丢 6 分'],
    ['口径锁定', '质保年限需在 R2 与技术标锁定同一口径（5 年 vs 10 年），避免商务标与技术标互相矛盾'],
    ['偏差前置确认', '付款节点 3-4-3 → 3-3-4 应在 BAFO 前与商务确认，不带进交标阶段'],
  ] as [string, string][],
  sinks: [
    ['案例库', '本标过程、标书亮点与缺口结构化归档', '待生成', 'book-open'],
    ['竞对库', '本标 5 家竞对格局、报价区间与评标反馈', '待更新', 'users'],
    ['评标反馈', '客户评标意见与失分项逐条录入', '待归档', 'message-square'],
    ['合同 register', '3 项偏差自动带入：消防认证 / 质保口径 10 年 / 付款节点 3-3-4', '可带入', 'shield-check'],
  ] as [string, string, string, string][],
};

// ---------------- 移动端 ----------------
export const M_TODOS = [
  { id: 't1', group: '今天到期', title: '补齐 3 个基本信息字段', sub: '项目地点 / 供货范围 / 保证金', pri: 'P0', due: '今天 18:00', second: '催办' },
  { id: 'm2', group: '今天到期', title: '报价过 BSD 评审', sub: '节点 ⑥ 投标文件制作', pri: 'P0', due: '今天 20:00', second: '延期' },
  { id: 'm3', group: '本周', title: '技术标 12 项强制响应', sub: '节点 ③ 标书分解', pri: 'P1', due: '10-29', second: '催办' },
  { id: 'm4', group: '本周', title: '答疑第 4 / 7 条回填', sub: '节点 ⑤ 澄清跟进', pri: 'P1', due: '10-30', second: '催办' },
];
export const M_FORM: { k: string; v: string }[] = [
  { k: '项目名称', v: '宁德时代储能项目' }, { k: '项目地点', v: '' }, { k: '功率 / 容量', v: '200 MW / 400 MWh' },
  { k: '客户性质', v: 'Developer / IPP' }, { k: '招标范围', v: '' }, { k: '开标时间', v: '2026-11-05 14:00' }, { k: '投标保证金', v: '' },
];
export const M_STRATEGY: [string, string, string][] = [
  ['招标范围', '来自招标文件', 'DC Block 直采 · 200 MW / 400 MWh · 不含 EPC 总包 · 交货 2027 Q2'],
  ['对客策略', '来自策略会', '决策链：技术中心 → 采购 → 集团投决；价值主线：全生命周期 IRR / LTSA'],
  ['竞争策略', '来自竞对分析', '对手：阳光电源 / 比亚迪；差异化：10 年质保 + 备件 2 年，不打纯价格战'],
];

/** 澄清条目的评论（P9.7 澄清行的评论弹层 / 澄清详情）。 */
export const CLAR_COMMENTS: Record<string, Comment[]> = {
  c1: [
    { who: '陈磊', time: '10-24 17:20', text: '远程调试可以支持，边界写「不含现场网络改造」，答复稿今晚给。' },
    { who: '李明', time: '10-24 15:02', text: '客户要求 10-25 18:00 前书面答复，逾期视为放弃。' },
    { who: '系统', time: '10-23 10:00', text: '由会议「招标文件答疑会」生成', system: true },
  ],
  c2: [
    { who: '王芳', time: '10-25 11:40', text: '10 年质保做成可选项单独报价，基础版本仍是 5 年。' },
    { who: '王强', time: '10-25 11:10', text: '和技术标口径保持一致，别出现两套年限。' },
    { who: '系统', time: '10-25 11:00', text: '由会议「客户澄清会（第一轮）」生成', system: true },
  ],
  c3: [
    { who: '王芳', time: '10-24 16:00', text: '已答复：接受 3-4-3，偏差表同步更新。' },
    { who: '李明', time: '10-24 10:30', text: '我方原报 3-3-4，需商务确认能否让步。' },
    { who: '系统', time: '10-23 10:00', text: '由招标文件第五章商务条款识别', system: true },
  ],
  c4: [
    { who: '陈磊', time: '10-26 09:30', text: '18 台会拉低可用率承诺，建议坚持 20 台。' },
    { who: '王强', time: '10-25 18:20', text: '先测算两种方案的可用率再答复。' },
    { who: '系统', time: '10-25 11:00', text: '由会议「客户澄清会（第一轮）」生成', system: true },
  ],
  c5: [{ who: '李明', time: '10-24 09:00', text: '已答复：可用银行保函替代，格式按招标文件附件 7。' }],
};
