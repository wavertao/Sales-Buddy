# Sales Buddy 销售战略参谋：本地 Mock 系统建设与能力验证方案

> 版本：v1.0  
> 编制日期：2026-10-25（Asia/Shanghai）  
> 文档用途：后续开发、知识建设、联调、演示和验收的执行基线。  
> 对应设计：CRM智能助手vzyh_2026.9.23.pen 中的 P10 原型区。  
> 本文档是建设规格，不表示系统、知识库或真实模型集成已经完成。

## 阅读导航

- [0. 文档使用与决策约定](#s0)
- [1. 目标与成功标准](#s1)
- [2. 历史讨论与已确认要求](#s2)
- [3. 当前资产与技术默认值](#s3)
- [4. 系统架构与职责边界](#s4)
- [5. 业务实体与关系模型](#s5)
- [6. Mock场景与种子数据](#s6)
- [7. Mock CRM界面](#s7)
- [8. MCP能力与接口合同](#s8)
- [9. 储能知识库建设](#s9)
- [10. S0—S8阶段规则](#s10)
- [11. 知识检索与回答引用](#s11)
- [12. Agent、Prompt与按钮执行](#s12)
- [13. 会话、工作台与来源](#s13)
- [14. Memory系统](#s14)
- [15. 页面、路由与前端行为](#s15)
- [16. 应用API、流式事件与持久化](#s16)
- [17. 测试、评估与验收](#s17)
- [18. 分阶段执行计划](#s18)
- [19. 建议目录与配置](#s19)
- [20. 交付清单](#s20)
- [21. 所需用户材料与缺失时策略](#s21)
- [22. 后续执行检查表](#s22)
- [23. 技术与设计参考](#s23)
- [24. 文档修订约定](#s24)

> 执行建议：先读0—8章锁定边界，再按18章分阶段推进；验收统一使用17章，实际交付对照20—22章。


---

<a id="s0"></a>

## 0. 文档使用与决策约定

### 0.1 如何基于本文执行

后续收到“基于此文档开始执行”时，按以下顺序工作：

1. 阅读本文和工作目录内适用的 AGENTS.md。
2. 检查本地代码、运行环境和已完成交付物，避免重复建设。
3. 按第18章里程碑执行，先完成业务合同、Mock CRM 和真实 MCP 链路，再接入 Agent。
4. 每完成一个里程碑，运行其验收用例并记录实际结果。
5. 仅在确实需要用户提供密钥、真实接口样例或业务政策时，提出具体缺失项；继续推进不依赖这些输入的工作。
6. 所有未接入能力应明确显示，不允许使用固定回复伪装成真实模型推理或工具调用。
7. 每次验收注明运行模式、模型配置、数据版本、知识版本和代码版本。

### 0.2 决策优先级

按以下顺序处理冲突：

1. 用户后续明确指令。
2. 本文“已确认要求”。
3. 本文“实现默认值”。
4. Pencil 原型中的交互和视觉表达。
5. 原型里的示例文字、日期、数量和阶段示意。

原型与本文冲突时，优先修正实现和原型中的业务表达，不为保持演示文字而破坏实体或权限规则。

### 0.3 本文中的三种信息

- **已确认要求**：用户已经明确确认，实施时必须遵守。
- **实现默认值**：为避免后续执行反复决策而给出的首版技术及产品默认。
- **待配置输入**：实际模型地址、密钥、企业资料等。可以先建适配和界面，但真实验证需补齐。

---

<a id="s1"></a>

## 1. 目标与成功标准

### 1.1 建设目标

构建一个可在本机启动的销售战略参谋验证系统，验证以下完整链路：

选择客户、线索或商机 → 查询 Mock CRM → 检索储能知识与阶段规则 → 分析现状及阶段证据 → 追问关键缺口 → 生成建议和行动 → 用户确认 → 创建商务活动、进展或待办 → 更新记忆 → 跨会话续接。

验证对象是业务理解、工具调用、证据引用、动作执行和持续记忆，界面作为完整链路的承载。

### 1.2 核心成功标准

- 能区分客户、线索、商机及各自关联数据。
- S0严格属于线索；S1—S8严格属于商机。
- 根据CRM事实与阶段规则提供有依据的阶段指导。
- 能区分已知事实、用户陈述、外部情报、AI判断和未知事项。
- 能处理大储直销、工商业储能、渠道项目三类业务。
- 能查询、创建并在CRM中再次查到实际记录。
- 所有CRM写入都经过明确确认和服务端校验。
- 用户、对象、会话之间的数据、历史及关注记忆不串用。
- 工作台步骤和来源由真实执行状态生成。
- 同一个回答的来源清单、工作台数量及工具返回记录能够对应。
- 关闭浏览器或重启应用后，数据库中的会话、记忆和创建结果仍可恢复。
- 有完整的场景、日志、回放和验收结果，能够定位错误发生在哪一层。

### 1.3 第一版不承担的目标

- 不重建企业完整CRM、ERP、合同、财务或交付系统。
- 不把演示知识、示例政策当成企业正式制度。
- 不承诺预测成交概率或精确收益。
- 不直接对外发邮件、发送会议邀请、报价或做商务承诺。
- 不实现未授权的商机阶段修改、任务完成、任务更新等Agent操作。
- 不训练专用大模型；首先验证知识检索、规则和工具编排。
- 不以固定脚本的流畅程度替代真实Agent能力验收。
- 不以一次演示成功证明具备生产系统的安全性、稳定性和业务准确性。

---

<a id="s2"></a>

## 2. 历史讨论与已确认要求

### 2.1 用户、市场和业务范围

| 项目 | 已确认要求 |
|---|---|
| 目标用户 | 海外储能业务销售团队 |
| 市场 | 欧洲、北美、中东、亚太 |
| 业务模式 | 大储直销、工商业储能、渠道分销相关项目 |
| 系统底层 | CRM |
| 重点生命周期 | S0—S5售前深入指导 |
| 辅助生命周期 | S6交付、S7验收、S8回款 |
| 运行方式 | 本地应用、数据与知识；在线模型API |
| 项目含义 | 线索或商机的前端统称，不建立重复项目主实体 |
| 实体划分 | S0为线索；S1开始为商机 |
| 执行能力 | 查询CRM；创建商务活动、线索/商机进展、任务 |

### 2.2 对话与首页

- 战略参谋作为PC首页客户360右侧的一级入口。
- 战略参谋首页只有两个主要业务板块：
  1. 搜索你的客户/项目。
  2. 最近沟通的项目。
- 搜索结果标识“客户”“线索”“商机”，前端可统一使用“项目”描述后两者。
- 打开客户后展示该用户的客户级历史对话。
- 打开线索或商机后展示该用户在该业务对象下的历史对话。
- 最近沟通按实际会话时间排序，不按CRM记录修改时间代替。
- 新建会话仍继承同一对象的有效记忆；原始会话互不覆盖。

### 2.3 对话输出

- 能详细解释现状、阶段、推进条件和主要阻碍。
- 能回答客户关系、竞争异议、拜访、谈判、资源协调和机会取舍问题。
- 阶段判断和具体分析直接呈现在对话中。
- 删除“查看阶段证据”“查看详情”等分散下钻按钮。
- 保留“查看全部来源”，用弹窗展示当前回答实际使用的记录。

### 2.4 统一会话工作台

所有对话页面使用同一组件，固定两类内容：

1. 本次任务规划：目标、步骤、执行状态及完成数量。
2. 本轮关联数据：数据类型、记录数量及“查看全部来源”。

约束：

- 问题变化只改变数据，不生成不同结构的右栏。
- 任务规划显示助手执行步骤，不等于业务待办已经完成。
- 每个回答保存自己的工作台快照。
- 切换历史回答时恢复对应快照。

### 2.5 按钮与Prompt

- 不为每个按钮预设一套独立完整Prompt。
- 采用通用动作类型、当前目标、当前对象和上下文。
- 高频业务场景可增加知识模板，不因此增加一套独立Agent。
- 内容生成与CRM创建分开。
- “生成激活计划”先生成计划；“创建待办”在确认后调用创建工具。

### 2.6 Memory

- 参考可读、可编辑、持续更新的Memory文件思路。
- 区分对象背景和用户对象记忆。
- 从对话中提取状态变化、用户关注、已问问题和未决事项。
- 单纯提问不能成为项目事实。
- 关键冲突不自动覆盖CRM正式状态。
- 后台能查看内容、来源、版本、变更和人工修订。

---

<a id="s3"></a>

## 3. 当前资产与技术默认值

### 3.1 已存在资产

工作目录：

C:/Users/heype/Desktop/AI Research/Sales Buddy

已核对存在：

- CRM智能助手vzyh_2026.9.23.pen
- 客户智能操作系统 - 建议方案V1.0.html
- CRM-Sales-Buddy推广计划.html

编制时尚无应用代码仓库、包清单、数据库或知识库目录。

PEN文件应继续通过Pencil MCP读取和修改，不用普通文件工具解析加密内容。

### 3.2 运行环境

已验证：

- Node.js v24.22.0。
- npm 11.19.1。
- Node内置SQLite可运行。
- SQLite FTS5可用。

首版使用TypeScript技术栈，不依赖系统Python。

### 3.3 技术选型默认

| 层 | 默认方案 |
|---|---|
| Web | React、TypeScript、Vite |
| UI | 通用组件、CSS变量，复用P10蓝紫色与浅色视觉 |
| API | Node.js、TypeScript、Express |
| 数据 | Node内置SQLite，启用外键约束 |
| 参数与响应校验 | Zod或等价的显式Schema校验 |
| MCP | 官方TypeScript SDK，Streamable HTTP；提供stdio测试入口 |
| 在线模型 | 自有ChatModelAdapter，供应商配置与业务逻辑隔离 |
| 知识检索 | SQLite FTS5、结构化标签、双语术语、阶段过滤 |
| 流式前端事件 | 应用自己的SSE事件流 |
| 测试 | 单元/集成测试＋Playwright端到端测试 |
| 运行记录 | SQLite结构化事件及可导出JSON |

说明：

- 安装时核对官方稳定SDK文档，锁定实际依赖版本并提交锁文件。
- MCP传输与浏览器接收Agent流式事件是两条不同链路，不混用会话标识或协议。
- 首版不依赖Docker、Redis、云数据库、独立向量库。
- 语义检索作为后续增强适配，不阻止首版端到端验证。
- 本地系统默认仅监听127.0.0.1。
- 在线模型密钥仅由后端读取，不进入前端代码和数据库工具日志。

### 3.4 简化部署

一个代码库，两个常规开发进程：

1. Web开发服务。
2. Node后端，承载应用API、Agent运行和HTTP MCP端点。

SQLite按模块分表，但使用同一个本地数据库。CRM服务函数被管理界面和MCP工具复用；Agent业务查询必须通过MCP链路完成。

---

<a id="s4"></a>

## 4. 系统架构与职责边界

~~~text
浏览器
  ├─ Sales Buddy首页
  ├─ 战略参谋对话页
  ├─ 统一会话工作台/来源弹窗
  ├─ Mock CRM数据查看
  └─ 知识、记忆、验证后台
             │ 应用API/SSE
             ▼
本地应用后端
  ├─ 会话与对象上下文
  ├─ Agent Runner / 通用动作注册表
  ├─ 阶段证据评估
  ├─ 知识检索
  ├─ Memory更新及版本管理
  ├─ 确认/执行/幂等处理
  ├─ 工作台快照与执行日志
  └─ MCP Client
             │ 真实MCP调用
             ▼
Mock CRM MCP Server
  ├─ 查询客户/组织/联系人
  ├─ 查询线索/商机及各自进展
  ├─ 查询活动/待办
  ├─ 可配置扩展查询资讯/会议/资料
  └─ 创建活动/进展/待办
             │
             ▼
本地SQLite及受控资料目录
~~~

### 4.1 必须明确的边界

- CRM是业务记录事实源。
- 知识库是方法、规则和资料依据，不保存某客户的实时事实作为通用知识。
- 对话是原始交互记录，不等同于正式CRM进展。
- Memory是带出处的摘要与关注状态，不替代CRM。
- 工作台是执行状态投影，不由另一个自由Prompt编造。
- 来源快照绑定回答，不临时查询整个客户全量数据代替。
- Mock管理员可调整场景；Agent不能因此获得管理权限。

---

<a id="s5"></a>

## 5. 业务实体与关系模型

### 5.1 核心关系

~~~text
Customer
  ├─ OrganizationUnit
  ├─ Contact
  ├─ Lead（S0）
  │    └─ LeadProgress
  ├─ Opportunity（S1—S8）
  │    └─ OpportunityProgress
  ├─ BusinessActivity
  ├─ Task
  ├─ ExternalNews
  ├─ MeetingRecord
  └─ EvidenceDocument

Lead --显式转换关系--> Opportunity

Conversation
  └─ Scope = Customer | Lead | Opportunity
       ├─ Messages
       ├─ Answers
       ├─ WorkbenchSnapshots
       └─ SourceSnapshots
~~~

### 5.2 Scope通用结构

~~~ts
type ObjectType = "customer" | "lead" | "opportunity";

interface BusinessScope {
  objectType: ObjectType;
  objectId: string;
  customerId: string;
}
~~~

约束：

- 不允许objectType为project。
- 页面可显示“项目”，提交与存储必须携带真实类型。
- 不通过名字、标题或容量推断对象身份。
- 客户类型、客户角色、业务模式分开。
- 同一客户可在不同事项中承担EPC、渠道或开发商角色。
- 功率MW、容量MWh分字段，未知时为null，不用0代替未知。
- 金额必须有币种，日期必须有明确时区语义。
- 概率未知时为空，不根据阶段机械生成20%、60%等数字。

### 5.3 主要实体字段

| 实体 | 首版关键字段 |
|---|---|
| User | id、displayName、role、teamId、可访问对象/管理权限 |
| Customer | id、name、countryCode、region、roles、ownerId、description、updatedAt |
| OrganizationUnit | id、customerId、parentId、name、function |
| Contact | id、customerId、organizationUnitId、name、title、knownRoles、ownerId、lastContactAt |
| Lead | id、customerId、name、stage=S0、source、businessMode、ownerId、status、需求摘要 |
| Opportunity | id、customerId、name、stage=S1..S8、businessMode、ownerId、金额/币种、功率/容量、关键节点 |
| LeadProgress | id、leadId、occurredAt、createdBy、content、evidenceRefs |
| OpportunityProgress | id、opportunityId、occurredAt、createdBy、content、evidenceRefs |
| BusinessActivity | id、customerId、关联线索/商机、type、title、参与人、计划时间、记录内容 |
| Task | id、关联Scope、title、description、assigneeId、dueAt、priority、status、createdBy |
| ExternalNews | id、customerIds、关联业务、title、sourceUrl、publishedAt、retrievedAt、summary |
| MeetingRecord | id、customerId、关联业务、participants、occurredAt、summary、content |
| EvidenceDocument | id、关联Scope、type、title、version、issuedAt、summary、localRef/sourceUrl |

具体字段分为“Mock内部字段”和“映射真实CRM字段”，不得因为Mock中有字段就假定真实接口一定支持写入。

### 5.4 线索转商机

**已确认：S0为线索，S1开始为商机。**

实现默认：

- 转换在Mock管理后台执行，Agent不具备该操作工具。
- 新建Opportunity，stage=S1。
- Lead保留原ID和历史，status=converted。
- 保存convertedFromLeadId与转换事件。
- 转换后禁止给旧线索创建新的普通跟进进展，提示选择关联商机。
- 不删除、不改写旧LeadProgress。

历史和记忆承接：

1. 新商机可显示当前用户的转化前线索会话，单独标记“转化前”。
2. 新会话绑定商机，新进展写商机。
3. 旧回答的来源和工作台快照保持不变。
4. 新商机背景可引用线索摘要，不批量复制原始会话。
5. 用户关注中的未决问题可关联承接，保留原来源。
6. 两个不同线索转化出的商机不能因客户相同而合并。

### 5.5 P10示例ID映射

| 界面案例 | 实际实体 | 业务编号/别名 |
|---|---|---|
| 英国储能一期 | Opportunity OP-UK-026 | ESS-UK-026 |
| 德国园区储能 | Opportunity OP-DE-041 | ESS-DE-041 |
| 西班牙渠道首批项目 | Opportunity OP-ES-018 | CH-ES-018 |
| Northstar Energy | Customer C-UK-0086 | 客户名称 |

P10中旧的projects路径、ESS示例编号应映射到实际实体，不照抄为另一套主键系统。

---

<a id="s6"></a>

## 6. Mock场景与种子数据

### 6.1 首批规模

| 数据 | 默认规模 |
|---|---:|
| 用户 | 4：2名销售、1名经理、1名管理员 |
| 客户 | 12：四大区域各3家 |
| 客户部门 | 36 |
| 联系人 | 48 |
| 线索 | 6：全部S0，其中2条已转换 |
| 商机 | 24 |
| 线索进展 | 18 |
| 商机进展 | 144 |
| 商务活动 | 48 |
| 待办 | 60 |
| 会议记录 | 24 |
| 外部资讯 | 24 |
| 证据资料 | 24 |

商机分布：

- S1、S2、S3、S4、S5各4条，共20条。
- S6两条，S7一条，S8一条，共4条。
- 2条已转换线索与其中2个S1商机显式关联。
- 计数为数据库记录数，不代表30个完全不同的经济项目。

数量是首版种子目标，允许为完整故事增加必要记录，但每次调整应同步数据清单和测试。

### 6.2 区域与客户覆盖

首批国家样例：

- 欧洲：英国、德国、西班牙。
- 北美：美国、加拿大。
- 中东：沙特、阿联酋、阿曼。
- 亚太：澳大利亚、日本、新加坡。

客户角色覆盖开发商、Utility、业主、EPC、集成商、渠道伙伴。全部使用虚构企业与人员，避免给真实公司编造订单、价格或联系人。

区域知识不能仅按大区判定；技术、政策和采购条件必须记录具体适用国家/地区。

### 6.3 三类业务

**大储直销**

- 客户：开发商、Utility、EPC。
- 要素：项目规模、采购路径、技术边界、预算/融资、并网与交付节点。
- 典型问题：有方案但决策人不明确、投标前技术范围未定、客户比较价格口径不同。

**工商业储能**

- 客户：园区、制造业业主、投资/服务主体。
- 要素：负荷、电费结构、场地、投资方式、运行策略、运维责任。
- 典型问题：只问回本周期但缺原始资料、投资人与用能主体不同。

**渠道相关项目**

- 客户：分销商、集成商、伙伴。
- 要素：覆盖市场、终端机会、技术服务能力、项目报备、合作规则。
- 对象仍是客户及关联线索/商机。
- 不把伙伴合作状态强行套成一个独立“项目S0—S8”；具体终端机会使用线索/商机阶段。

### 6.4 每个重点案例必须包含

- 案例说明、对象关系与时间线。
- 当前正式阶段及预期证据评估。
- 销售已经知道和仍然不知道的事项。
- 至少一条可引用的支持证据。
- 至少一条缺失、过期或相互矛盾的信息。
- 建议下一步与不应给出的建议。
- 可创建的活动/进展/任务。
- 预置会话及用户关注。
- 关联测试用例ID。

### 6.5 可重复演示

- seedVersion明确且可查询。
- 支持初始化、重置和导出。
- 使用可注入的业务时钟，避免“昨天”“逾期”随机器日期变化。
- 演示默认基准日期为2026-10-25，后续场景通过显式推进时钟模拟。
- 重置仅作用于Mock数据，必须有确认；不删除知识原文、配置或源设计文件。
- 提供正常、缺信息、证据冲突、无权限、工具故障五类场景开关。
- 故障注入状态不能被模型或普通工具参数随意修改。

---

<a id="s7"></a>

## 7. Mock CRM界面

### 7.1 页面

- 客户列表与详情。
- 组织架构和联系人。
- 线索列表、详情及进展。
- 商机列表、详情及进展。
- 商务活动列表与详情。
- 待办列表与详情。
- 客户资讯、会议及证据资料。
- 管理员场景与数据重置页。

### 7.2 功能深度

- 以查询、筛选、关联浏览及验证创建结果为主。
- 无需复刻企业复杂表单或审批。
- 创建成功后，CRM页面能实时查询到新记录。
- 可用简单角色切换测试用户隔离，界面持续标注Mock身份。
- 管理后台可调整正式阶段、完成待办、模拟转化；这些是测试控制台能力，不暴露给Agent。
- S6—S8以商机进展、里程碑说明和演示资料模拟，不伪装已连接真实ERP或财务。

---

<a id="s8"></a>

## 8. MCP能力与接口合同

### 8.1 查询能力

建议的逻辑工具：

| 工具 | 主要输入 | 输出 |
|---|---|---|
| search_customers | 关键词、国家/角色过滤、分页 | 客户摘要列表 |
| get_customer | customerId | 客户基本信息 |
| get_customer_organization | customerId | 部门关系 |
| list_contacts | customerId、可选业务关联 | 联系人 |
| list_leads | customerId、stage/status、分页 | 线索 |
| get_lead | leadId | 线索详情 |
| list_opportunities | customerId、stage、分页 | 商机 |
| get_opportunity | opportunityId | 商机详情 |
| list_lead_progress | leadId、时间、分页 | 线索进展 |
| list_opportunity_progress | opportunityId、时间、分页 | 商机进展 |
| list_business_activities | Scope、时间、分页 | 商务活动 |
| list_tasks | Scope、状态、负责人、分页 | 待办 |
| get_records_by_refs | 允许的实体类型及ID列表 | 来源清单所需记录 |

明确扩展、可以关闭的查询：

- list_customer_news
- list_meeting_records
- list_evidence_documents

扩展关闭时，Agent说明当前无法查询，不编造返回结果。对接真实CRM时，以实际工具合同为准。

### 8.2 创建能力

| 工具 | 校验要点 |
|---|---|
| create_business_activity | 客户/业务关联、活动类型、标题、时间及接口必填字段 |
| create_lead_progress | 必须S0线索且未转换，内容、发生时间及创建人 |
| create_opportunity_progress | 必须商机，内容、发生时间及创建人 |
| create_task | 标题、关联对象、负责人、期限、优先级等实际接口字段 |

可在Agent内部统一为prepare_progress，再按类型调用不同创建工具。对外数据与存储仍保持实体区别。

### 8.3 不提供给Agent的工具

- 创建或删除客户。
- 创建、转换或删除线索/商机。
- 修改商机正式阶段。
- 修改、完成或删除待办。
- 发邮件、发会议邀请。
- 发起审批或对外报价。
- 模拟真实ERP回款操作。

### 8.4 通用输出与错误

工具输出至少包括：

~~~json
{
  "status": "success",
  "records": [],
  "recordRefs": [],
  "pagination": {"nextCursor": null},
  "requestId": "req_example",
  "asOf": "2026-10-25T09:20:00+08:00"
}
~~~

错误类型：

- INVALID_ARGUMENT
- NOT_FOUND
- FORBIDDEN
- TIMEOUT
- UPSTREAM_UNAVAILABLE
- CONFLICT
- ALREADY_CREATED
- UNSUPPORTED_CAPABILITY

工具结果使用真实结构化响应和错误标识，不只返回一段无法校验的自然语言。

### 8.5 权限与身份

- 身份从应用会话传入MCP连接上下文，不由模型工具参数选择。
- 工具参数不允许任意指定tenantId、createdBy等身份字段。
- 本地Mock身份由后端发放会话令牌，UI角色切换用于测试。
- 区分“测试身份切换”与生产身份认证；首版不声称已具备生产SSO。
- 查询、单条详情、来源清单、创建都执行相同权限检查。

### 8.6 创建、确认与重复提交

- 先生成草稿，再确认，再执行。
- 确认绑定draftId、draftVersion、Scope和当前用户。
- 修改草稿后旧确认失效。
- 服务端生成执行标识并记录结果。
- 相同执行标识重复提交返回原结果，不重复创建。
- MCP本身不保证业务幂等，Mock需自行实现。
- 对接真实CRM时，优先使用真实幂等字段；没有时由适配层维护执行账本并做必要查询核对。
- 多条创建逐项记录成功与失败，不模拟不存在的跨接口事务。
- 创建成功但响应超时，先核查执行账本再重试。

---

<a id="s9"></a>

## 9. 储能知识库建设

### 9.1 三层知识

| 层 | 内容 |
|---|---|
| 业务事实与参考 | 场景、技术/供货边界、采购、收益输入、交付验收 |
| 阶段作战规则 | S0—S8目标、证据、缺口、动作、材料与下一阶段条件 |
| 销售方法与模板 | 需求澄清、决策链、竞争回应、谈判、拜访、渠道激活 |

区分公开来源事实、原创归纳打法、企业正式政策和虚构演示政策。

### 9.2 首批资料来源

以下链接在方案分析过程中检索过；正式入库时重新读取并记录采集日期、有效性和具体引用位置。

| 来源 | 资料 | 用途/限制 |
|---|---|---|
| DOE FEMP | [BESS采购清单](https://www.energy.gov/cmei/femp/articles/battery-energy-storage-system-procurement-checklist) | 早期需求与采购问题；美国联邦采购背景 |
| DOE FEMP | [储能技术规格模板](https://www.energy.gov/cmei/femp/articles/lithium-ion-battery-storage-technical-specifications) | 技术边界与材料；不能直接当作所有市场的法规 |
| 世界银行 | [光储项目规划指引介绍](https://www.worldbank.org/en/news/press-release/2023/11/27/world-bank-unveils-comprehensive-framework-to-accelerate-solar-plus-storage-adoption-in-developing-countries) | 可行性、商业模式、风险与采购；需进一步获取适用原文 |
| EPRI | [Utility BESS Handbook](https://storagewiki.epri.com/index.php/Utility_BESS_Handbook) | 生命周期、角色和阶段依据；受限章节不能仅靠摘要编造 |
| EPRI | [Integration and Deployment](https://storagewiki.epri.com/index.php/Energy_Storage_101/Integration_and_Deployment) | 需求、采购、部署和验收 |
| NLR/REopt | [REopt说明](https://www.nlr.gov/reopt/curriculum/what-is-reopt) | 工商业用能、费率及模型输入 |
| MEDDICC | [方法FAQ](https://meddicc.com/faqs) | 决策标准、决策流程、经济买方、竞争和签约路径 |
| SolarPower Europe | [官方出版物](https://www.solarpowereurope.org/publications?filter=bestPracticeGuideline) | 欧洲项目尽调、EPC及混合储能资料，正式入库逐篇核实 |

参考链接和研究发现不等于知识库已经建成。

### 9.3 检索与入库流程

1. 按问题清单检索，不只按“储能销售策略”一个关键词抓文章。
2. 优先政府、实验室、协会、招标主体、项目方及方法原作者。
3. 保存来源链接、必要摘录、原创摘要；允许保存的源文件放受控目录。
4. 不绕过付费或访问限制。
5. 提取适用场景、阶段、国家、日期、结论和前提。
6. 将买方采购与项目指引转译成卖方需要验证的问题。
7. 区分原文事实与本项目作者归纳的销售建议。
8. 形成知识卡片并人工检查引用。
9. 建索引，运行检索与问答用例。
10. 过期知识停用，不直接删除历史引用。

### 9.4 首版知识产出目标

- 约30份高相关公开来源记录。
- 不少于45张可检索知识卡。
- 9份阶段作战手册。
- 3份业务模式手册：大储、工商业、渠道项目。
- 4份区域索引，按国家细分有效规则。
- 不少于30个典型问答。
- 一套带“演示政策”标签的虚构产品与商务规则，用于权限、折扣和承诺边界测试。
- 一份知识缺口表，记录需要企业补充的内容。

### 9.5 知识卡片元数据

~~~yaml
id: KB-S3-SCOPE-001
title: 售前阶段的供货边界澄清
kind: author_synthesis
businessModes: [utility_scale, commercial_industrial]
stages: [S2, S3, S4]
regions: [global]
countries: []
sourceRefs: [SRC-DOE-002]
publishedAt: null
retrievedAt: 2026-10-25
validFrom: null
validUntil: null
reviewStatus: reviewed
authority: public_guidance
language: zh-CN
version: 1
~~~

正文包含：

- 适用情境。
- 需要知道的事实。
- 销售应问的问题。
- 证据门槛。
- 推荐动作和期望产出。
- 不适用情况。
- 来源及原文位置。
- 原作者事实与本项目归纳的区别。

### 9.6 四大区域

首版应覆盖四大区域，但不追求一次穷尽所有国家。

- 通用方法作为global层。
- 国家规则只对明确国家生效。
- 欧洲不直接等同于欧盟，北美不等同于美国。
- 中东、亚太国家各自维护并网、采购或市场资料。
- 技术标准、政策和市场机制记录版本与适用时间。
- 查询到过期资料时说明时点，不套用到所有当前项目。
- 招标文件只适用于对应招标，不直接变成行业统一门槛。

### 9.7 企业内部资料缺口

互联网无法替代：

- 自家产品的有效参数与配置边界。
- 正式折扣、底价、账期、质保与交期授权。
- 企业内部阶段定义、审批和资源申请流程。
- 可对外使用的成功案例与性能证据。
- 正式渠道准入、报备、区域和价格规则。

首版没有这些资料时，使用明确标记的演示政策；回答中不得声称“公司规定”而无来源。

---

<a id="s10"></a>

## 10. S0—S8阶段规则

### 10.1 阶段表

| 阶段 | 实体 | 当前目标 | 关键证据/缺口 | 典型推进动作 |
|---|---|---|---|---|
| S0线索导入 | Lead | 验证主体、需求来源及潜在机会 | 客户是谁、角色、应用意向、可联系对象、信息可信度 | 首次验证、补基础信息、判断是否转商机 |
| S1需求引导 | Opportunity | 识别客户业务目标和储能用途 | 痛点、应用场景、目标指标、初步规模、约束 | 需求访谈、资料清单、初步价值假设 |
| S2机会点跟踪 | Opportunity | 验证机会真实性与推进可行性 | 预算路径、投资主体、时间、关键人、竞争、项目条件 | 资格判断、关系补齐、机会排序 |
| S3售前项目 | Opportunity | 建立客户认可的方案基础 | 技术基线、供货范围、接口、服务、评审标准与路径 | 技术澄清、方案评审、证据准备 |
| S4投标 | Opportunity | 形成可响应、可竞争的投标方案 | 招标资格、评分、偏差、截止日、保证要求 | 投标清单、风险澄清、资源协同 |
| S5合同 | Opportunity | 闭合商务与签署路径 | 价格、授权、付款、质保、交期、签批、合同偏差 | 条件交换、内部协同、签约障碍清单 |
| S6交付 | Opportunity | 管理销售承诺与交接风险 | 交接范围、节点、变更和客户沟通 | 风险跟踪、协调与进展记录 |
| S7验收 | Opportunity | 推动条件满足和问题闭环 | 验收标准、测试、资料、遗留问题、责任人 | 验收准备、问题清单、客户沟通 |
| S8回款 | Opportunity | 跟踪付款条件与争议 | 节点、资料、验收关联、承诺、争议原因 | 资料补齐、跟进安排、升级建议 |

### 10.2 每阶段Profile

~~~ts
interface StageProfile {
  stage: "S0" | "S1" | "S2" | "S3" | "S4" | "S5" | "S6" | "S7" | "S8";
  entityType: "lead" | "opportunity";
  goal: string;
  requiredEvidence: EvidenceRequirement[];
  optionalEvidence: EvidenceRequirement[];
  commonBlockers: string[];
  recommendedQuestions: string[];
  recommendedActions: ActionTemplate[];
  nextStageConditions: EvidenceRequirement[];
  applicableBusinessModes: string[];
  sourceRefs: string[];
  version: number;
}
~~~

### 10.3 判断方式

- 先读取CRM正式阶段。
- 用阶段Profile核对证据。
- 结构化输出：具备、部分具备、缺失、冲突。
- 模型负责解释证据、提出追问及组织策略。
- 可以提示成熟度不足，但不自动修改正式阶段。
- 缺少记录不代表事情一定未发生，先提示核实。
- 重大信息冲突保留双方来源。
- 不将阶段自动映射成固定赢单概率。

### 10.4 示例

CRM为S3，已有报价但无客户确认需求：

- 正式阶段：S3售前项目。
- 证据评估：部分充分。
- 已具备：应用场景、初步方案、沟通联系人。
- 未具备：客户确认的技术和供货边界。
- 推进建议：先澄清并取得基线确认，再做同口径商务比较。
- 不允许的输出：直接宣称客户已认可全部方案，或自动推进S4。

---

<a id="s11"></a>

## 11. 知识检索与回答引用

### 11.1 检索流程

1. 从当前Scope、CRM阶段和问题识别检索条件。
2. 过滤业务模式、国家及有效时间。
3. 进行全文检索与术语扩展。
4. 基于相关性、权威性、适用性及有效性排序。
5. 返回卡片片段与引用ID。
6. 回答引用实际使用的片段。

### 11.2 首版默认

- 先使用SQLite FTS5，不引入独立向量库。
- 中文检索建立规范化词项/必要的二元词索引；不能假定默认分词已理解中文。
- 建立中英术语映射：BESS、PCS、EMS、RFP、FAT、SAT、需求费、并网、供货边界等。
- 源资料可为英文，卡片提供经核对的中文摘要。
- 每次默认选取最多6个高相关片段，单片段控制长度。
- 向量检索通过接口保留扩展位置，只有检索基线不达标时再加入。
- 模型自身常识不能作为伪造的知识库引用。

### 11.3 引用约束

回答中的业务事实应能定位到：

- CRM记录；
- 当前用户明确陈述；
- 外部资讯；
- 知识卡；
- 已记录的记忆条目及其底层依据。

历史回答保存当时引用版本。源记录后来更新时，可显示“已有新版本”，但不改写旧回答的证据快照。

---

<a id="s12"></a>

## 12. Agent、Prompt与按钮执行

### 12.1 一个可见Agent，多个内部能力

首版不建设多个面向用户的专家Agent。使用一个Agent Runner调用：

- CRM查询工具。
- 知识检索。
- 阶段证据评估。
- 通用分析和计划模板。
- 草稿生成。
- 经确认的动作执行。
- Memory读取与更新。
- 工作台与来源快照存储。

这些能力通过明确接口组合，避免为每个P10页面写独立逻辑。

### 12.2 标准处理链

1. 校验会话身份。
2. 解析并校验Scope。
3. 判断是通用知识问题还是客户/项目问题。
4. 创建answerId、runId和工作台初始状态。
5. 生成公开的任务步骤，不展示模型隐藏推理。
6. 读取必要CRM记录及有效Memory索引。
7. 检索适用知识和阶段Profile。
8. 评估证据、识别冲突和信息缺口。
9. 生成回答、可用动作及引用。
10. 保存回答、工具日志、工作台和来源快照。
11. 异步更新Memory。
12. 等待用户继续讨论或确认创建草稿。

### 12.3 信息不足

- 能形成部分建议时先给有边界的初步判断。
- 每轮优先追问最多3个最影响策略的问题。
- 不为了填满表单一次询问所有字段。
- 用户可继续按现有信息分析，输出说明限制。
- Scope不明确且需要读取CRM时，先让用户选择对象。
- 没有Scope的通用销售问题可只检索知识，不写入某个项目Memory。
- 创建动作缺必填项时只补相关字段。

### 12.4 Prompt层次

| 层 | 职责 |
|---|---|
| 全局规则 | 事实、引用、权限、承诺边界、动作确认 |
| 动作模板 | 分析、计划、沟通材料、待办、活动、进展 |
| 业务模板 | 大储、工商业、渠道项目的分析维度 |
| 阶段规则 | S0—S8的证据与推进条件 |
| 当前上下文 | 当前问题、Scope、CRM结果、Memory及检索片段 |
| 输出Schema | 回答、引用、按钮和草稿的结构 |

所有Prompt与规则有版本；运行日志记录使用版本。不会把客户资料当成能够修改全局行为的指令。

### 12.5 通用动作注册表

~~~ts
type ActionType =
  | "analyze"
  | "generate_plan"
  | "prepare_communication"
  | "prepare_task"
  | "prepare_activity"
  | "prepare_progress";

interface SuggestedAction {
  actionId: string;
  actionType: ActionType;
  label: string;
  goal: string;
  scope: BusinessScope;
  conversationId: string;
  answerId: string;
  parameters: Record<string, unknown>;
}
~~~

服务端校验动作类型、Scope、上下文归属、参数及权限。按钮标签可动态生成，动作类型只能来自注册表。

### 12.6 按钮映射

| P10按钮 | 通用动作 | 后续执行 |
|---|---|---|
| 如何回应客户比价 | analyze | 查询与指导，不写CRM |
| 生成伙伴评估与激活计划 | generate_plan | 形成计划，行动可继续转草稿 |
| 生成客户行动计划 | generate_plan | 同上 |
| 生成数据收集清单 | generate_plan | 输出资料清单 |
| 准备客户沟通/英文回复 | prepare_communication | 输出草稿，不发送 |
| 生成拜访提纲/英文议程 | prepare_communication | 输出议程 |
| 将准备事项转为行动 | prepare_task | 生成可编辑任务草稿 |
| 创建商务活动 | prepare_activity | 确认后调用创建活动 |
| 补充客户反馈 | prepare_progress | 绑定线索/商机后生成草稿 |
| 我来处理 | prepare_task | 负责人默认当前用户 |
| 派发 | prepare_task | 仅接口支持且有权限时允许选负责人 |
| 查看全部来源 | 普通应用查询 | 打开来源快照，不调用生成模型 |

### 12.7 生成计划不等于执行

伙伴计划示例输出：

- 目标。
- 当前依据。
- 能力与真实项目证据。
- 缺失信息。
- 推荐步骤。
- 每步建议负责人、时间、依赖、预期产出。
- 可生成待办或商务活动的事项。

首次点击只生成内容。用户选中事项后形成创建草稿，再确认写CRM。

### 12.8 创建草稿

~~~ts
interface ActionDraft {
  draftId: string;
  version: number;
  actionKind: "task" | "activity" | "lead_progress" | "opportunity_progress";
  scope: BusinessScope;
  fields: Record<string, unknown>;
  sourceAnswerId: string;
  sourceActionId: string;
  validation: { missingFields: string[]; errors: string[] };
  status: "draft" | "ready" | "confirmed" | "executing" | "succeeded" | "failed";
}
~~~

- 字段由模型提取，Schema由程序校验。
- 用户能编辑后确认。
- 负责人必须是允许的用户，日期必须有效。
- 普通讨论不自动沉淀为CRM进展。
- 创建进展要区分“计划采取”与“已经发生”，不能把建议写成完成事实。
- 不支持的字段不假装已写入。

### 12.9 模型适配与运行限额

应用内部定义ChatModelAdapter，不让业务代码直接绑定某供应商：

~~~ts
interface ChatModelAdapter {
  checkCapabilities(): Promise<ModelCapabilities>;
  generate(request: ModelRequest): Promise<ModelResult>;
  stream(request: ModelRequest): AsyncIterable<ModelEvent>;
}
~~~

至少验证：

- 多轮对话。
- 工具调用。
- 结构化输出。
- 流式文本。
- 用量信息可用时记录，缺失时保存null。

默认限制：

- 每次回答最多8轮模型/工具循环。
- 最多20次工具调用。
- 单次普通列表查询最多30条，按需要分页。
- 不一次把客户所有历史与全知识库塞入上下文。
- 单工具超时默认10秒，可配置。
- 整次回答超时默认120秒，可配置。
- 批量创建最多10项，超过时让用户拆分确认。

分析过程只向模型暴露查询类能力。写入由Action Executor在确认后直接通过MCP执行，减少自由规划中的误写。

模型配置缺失或不支持工具调用时，真实Agent模式给出明确状态，不静默切换成固定脚本。

---

<a id="s13"></a>

## 13. 会话、工作台与来源

### 13.1 会话存储

Conversation至少包含：

- id、userId、Scope。
- title、createdAt、lastMessageAt。
- status。
- predecessorScopeRefs（可选，转化前线索引用）。

Message保存用户和助手原始消息。Answer保存回答、引用、动作、模型与版本信息。原始消息不因Memory压缩而覆盖。

### 13.2 最近沟通列表

- 以当前用户与该线索/商机最近一次有效对话时间排序。
- 同一对象多个会话聚合为一项。
- 显示对象类型、客户、最近问题摘要、时间和会话次数。
- 客户级会话不伪装成项目项，可通过搜索打开。
- 无最近项目时展示空态和搜索入口。
- CRM有项目但用户未讨论过，不放进“最近沟通”。

### 13.3 工作台数据

~~~ts
interface WorkbenchSnapshot {
  conversationId: string;
  answerId: string;
  runId: string;
  scope: BusinessScope;
  plan: {
    goal: string;
    status: "pending" | "running" | "completed" | "failed" | "waiting_confirmation";
    steps: {
      id: string;
      title: string;
      status: "pending" | "running" | "completed" | "failed" | "waiting_confirmation";
    }[];
  };
  relatedData: {
    status: "idle" | "loading" | "completed" | "partial_failure" | "failed";
    groups: {
      sourceKind: "crm" | "knowledge" | "conversation" | "memory";
      entityType: string;
      label: string;
      recordRefs: SourceRef[];
    }[];
    snapshotId: string;
  };
  updatedAt: string;
  error: { code: string; message: string } | null;
}
~~~

- 显示数量由recordRefs去重计算。
- 模型可以生成步骤标题，状态由Runner/Executor事件更新。
- 分析完成不表示任务已创建。
- 生成创建草稿时显示待确认；确认成功后才显示对应执行结果。
- 当前组件宽度默认300px，可收起。
- 步骤过多时采用同一列表展开，不引入场景专属面板。
- Knowledge/Memory如使用也走同一分组结构，不另造“客户参谋工作台”。

### 13.4 工作台状态

- 新问题：建立新answerId，不能把上轮步骤和数量当作本轮结果。
- 检索中：显示当前步骤及加载状态。
- 无数据：明确没有匹配记录。
- 部分失败：保留成功记录，显示失败项和重试入口。
- 完成：保存快照。
- 历史恢复：默认加载选中回答自己的快照。
- 切换对象：重新绑定Scope。
- 取消：停止尚未执行步骤，已成功写入的动作保留回执，不显示为已撤销。

### 13.5 来源快照

~~~ts
interface SourceRef {
  sourceKind: "crm" | "knowledge" | "conversation" | "memory";
  entityType: string;
  recordId: string;
  version: string | null;
  title: string;
  relation: { objectType: string; objectId: string };
  updatedAt: string | null;
  capturedAt: string;
}
~~~

数据库保存允许展示的必要摘要与版本，不仅保存一个可能已失效的ID。

### 13.6 来源弹窗

项目范围：

- 明确显示是线索还是商机。
- 展示当前对象、所属客户、关联联系人、对应进展、活动、任务和已使用资料。
- 仅显示本轮参与分析的记录。
- 不把同客户其他项目记录混入，除非当前问题明确进行了授权比较。

客户范围：

- 显示客户基本信息、联系人。
- 展示本轮使用的线索、商机。
- 每条进展明确所属线索或商机。
- 活动、会议、资料保留关联对象。
- 知识和Memory作为统一来源类型可筛选。

操作：

- 搜索记录名/编号。
- 按来源类型和实体筛选。
- 分页。
- 显示名称、编号、关联对象、更新时间。
- 居中弹窗、遮罩、关闭后回到原位置。
- 不新增“查看详情”“查看阶段证据”等第二层分散下钻。
- 源已更新或无权访问时显示状态，不绕过权限读取。

---

<a id="s14"></a>

## 14. Memory系统

### 14.1 四种作用域

| 类型 | 键 | 主要内容 |
|---|---|---|
| 客户背景 | tenantId + customerId | 客户背景、关系、机会概要 |
| 业务背景 | tenantId + entityType + entityId | 线索/商机背景、当前状态、阶段证据 |
| 用户客户 | tenantId + userId + customerId | 经营目标、关注、问题、偏好 |
| 用户业务 | tenantId + userId + entityType + entityId | 当前项目关注、已问问题、待跟进 |

同一客户下不同商机不共享同一份项目背景。

### 14.2 Memory.md的存储方式

数据库是结构化记忆和版本的事实源，同时生成可读文件：

~~~text
runtime/app/memory/
  entities/
    customers/C-UK-0086/Memory.md
    opportunities/OP-UK-026/Memory.md
    leads/LD-UK-032/Memory.md
  users/
    U-018/customers/C-UK-0086/Memory.md
    U-018/opportunities/OP-UK-026/Memory.md
  versions/
    <memoryId>/v0001.md
    <memoryId>/v0002.md
~~~

- 文件由服务生成，不要求销售手工维护。
- 文件不通过静态目录直接公开。
- 后台通过鉴权API展示内容。
- 修订先写数据库新版本，再更新文件投影。
- 文件写入失败记录错误并可重建，不让数据库与文件成为两个独立编辑源。
- 编辑Markdown时必须解析为经过校验的条目或受控修订，不允许改身份和作用域字段。
- 所有路径由服务按ID构造，不能接受任意文件路径参数。

### 14.3 背景记忆

包含：

- 对象及客户标识。
- 业务背景与当前正式阶段引用。
- 已确认事实。
- 已知关键关系。
- 证据缺口与冲突。
- 最近变化、未决事项。
- 依据和时间。

用户私有对话中的新陈述处理：

1. 先记录为“用户陈述/待核实”，保留作者和出处。
2. 默认归入该用户对象记忆及背景候选，其他销售不可直接读到私有原文。
3. 通过CRM资料核实或经授权审核后，才合并为对象共享背景。
4. CRM或已授权业务资料可自动刷新共享背景。
5. 关键状态冲突始终保留双方来源，不能让未核实陈述覆盖正式值。

### 14.4 用户对象记忆

包含：

- 用户目标。
- 当前讨论重点。
- 重点关注主题和最近出现时间。
- 已问问题、是否已回答、是否等待业务反馈。
- 回答形式偏好。
- 下次应续接的未决事项。
- 用户新提供的待验证信息。

提问频率只用于识别关注强度，不形成敏感人格画像，不推断无关私人属性。

### 14.5 条目结构

~~~ts
interface MemoryEntry {
  id: string;
  memoryId: string;
  category: string;
  content: string;
  epistemicType: "crm_fact" | "confirmed_evidence" | "user_statement" | "ai_assessment" | "user_focus";
  visibility: "object_authorized" | "author_only";
  status: "effective" | "pending_verification" | "superseded" | "disabled";
  sourceRefs: SourceRef[];
  occurredAt: string | null;
  updatedAt: string;
  supersedesEntryId: string | null;
}
~~~

### 14.6 增量更新

- 在一轮有效回答完成后异步启动。
- 以answerId作为更新幂等键。
- 提取新事实候选、关注、问题和状态变化。
- 与有效条目去重合并。
- 更新频率和最后关注时间，不重复堆积同一句话。
- 保存变更前后、原因、提取器/Prompt版本和来源。
- 并发更新使用版本检查，冲突后重新合并。
- 失败可重试，不影响用户继续对话。
- 对话无有效新信息时不强制制造新版本。

### 14.7 读取与续接

- 先读取当前对象的有效背景摘要及该用户关注索引。
- 按当前问题读取相关条目和必要历史片段。
- 不将全部Memory文件与全部原始对话直接注入。
- 回答前检查关键CRM记录是否更新，陈旧Memory不能覆盖新记录。
- 默认最多载入12条相关记忆条目，按需要读取证据。
- 客户级汇总可引用授权项目摘要，不能因此读取其他用户私有项目对话。

### 14.8 后台管理

- 列表：对象、类型、用户、状态、版本、最近更新时间。
- 内容：结构化预览和Markdown视图。
- 更新队列：候选、冲突、失败。
- 版本：前后差异、出处、操作人、原因。
- 修订：新增版本，不原地改历史。
- 停用/遗忘：可排除错误来源，防止下一轮再次提取。
- 回滚：明确确认，产生新版本。
- 管理员读取用户记忆需要相应授权并记录访问。
- 经理不会因为能看团队CRM就自动获得销售私有会话和用户Memory。

---

<a id="s15"></a>

## 15. 页面、路由与前端行为

### 15.1 路由默认

| 路由 | 作用 |
|---|---|
| / | Sales Buddy PC首页 |
| /advisor | 战略参谋首页 |
| /advisor/customer/:id | 客户范围会话 |
| /advisor/lead/:id | 线索范围会话 |
| /advisor/opportunity/:id | 商机范围会话 |
| /crm/customers | Mock客户列表 |
| /crm/leads | Mock线索列表 |
| /crm/opportunities | Mock商机列表 |
| /crm/activities | 商务活动 |
| /crm/tasks | 待办 |
| /admin/knowledge | 知识与来源管理 |
| /admin/stages | 阶段Profile |
| /admin/memory | 记忆列表和文件 |
| /admin/memory/updates | 变更与冲突 |
| /admin/runs | Agent执行与工具日志 |
| /admin/scenarios | 场景/时钟/故障注入 |
| /admin/evaluations | 用例与验收结果 |

会话ID和选中回答可作为query参数保存。来源弹窗不需要独立顶层页面。

### 15.2 P10到开发组件的映射

| P10 | 组件/功能 |
|---|---|
| 0 | Sales Buddy能力入口 |
| 1、15 | AdvisorHome、ObjectSearch、RecentProjects |
| 2—9、12 | AdvisorConversation、AnswerRenderer |
| 6 | ActionDraftCard、ActionConfirmation |
| 11、13、14 | SourceDialog |
| 16、17 | ScopedConversationList |
| 18—24 | MemoryAdmin、MemoryFile、MemoryDiff、MemoryPolicy |
| 25、26 | ConversationWorkbench及状态 |

### 15.3 视觉与交互默认

- 以1440×900桌面为设计验收基准。
- 左侧导航约224px，右侧工作台300px。
- 主区自适应，工作台可收起。
- 浅灰背景、白色内容、蓝色主操作、紫色AI区域。
- 颜色同时配合文字状态，不只依赖红绿。
- 列表、动作卡、错误状态使用统一组件。
- 主结论和详细分析层次清楚。
- 阶段、关系、竞争等内容放回答中，不根据问题生成新的侧栏结构。
- 暂不实现语音录音、实时转写和复杂附件解析；可用预置会议/资料及文本粘贴验证流程。
- 未接入的入口隐藏或清楚说明，不能点击后无反馈。

### 15.4 必备状态

- 搜索未输入、无结果、多结果。
- 对象暂无历史。
- 模型未配置。
- 工具读取中、空数据、部分失败、完全失败。
- 用户取消回答。
- 草稿字段不足。
- 创建中、成功、失败、部分成功。
- 无权限。
- Memory更新中、成功、待核实、失败。
- 历史来源有更新。
- 页面刷新恢复当前会话与运行状态。

---

<a id="s16"></a>

## 16. 应用API、流式事件与持久化

### 16.1 应用API

以下是首版建议合同，不冒充现有CRM接口：

| API | 用途 |
|---|---|
| POST /api/mock-session | 切换Mock用户并建立本地会话 |
| GET /api/session | 当前用户及能力 |
| GET /api/objects/search | 搜索客户、线索、商机 |
| GET /api/advisor/recent | 最近沟通对象 |
| POST /api/conversations | 新建指定Scope会话 |
| GET /api/conversations | 当前用户/Scope历史 |
| GET /api/conversations/:id | 会话与消息 |
| POST /api/conversations/:id/messages | 提交问题并建立run |
| GET /api/runs/:id/events | 流式事件 |
| POST /api/runs/:id/cancel | 取消 |
| POST /api/actions/prepare | 通用动作生成草稿/材料 |
| PATCH /api/drafts/:id | 编辑草稿并增加版本 |
| POST /api/drafts/:id/confirm | 校验、确认并执行 |
| GET /api/executions/:id | 创建结果 |
| GET /api/answers/:id/workbench | 工作台快照 |
| GET /api/answers/:id/sources | 来源快照、筛选、分页 |
| GET /api/admin/memory | 授权范围记忆 |
| GET /api/admin/memory/:id | 内容、版本、来源 |
| POST /api/admin/memory/:id/revisions | 人工修订 |
| POST /api/admin/memory/:id/rollback | 确认回滚 |
| GET /api/admin/runs/:id | 调试记录 |
| POST /api/admin/scenarios/reset | 确认后重置Mock场景 |

### 16.2 流式事件

~~~ts
type RunEvent =
  | { type: "run_started"; runId: string; answerId: string }
  | { type: "plan_updated"; plan: unknown }
  | { type: "step_status_changed"; stepId: string; status: string }
  | { type: "tool_started"; callId: string; toolName: string }
  | { type: "data_retrieved"; groups: unknown[] }
  | { type: "answer_delta"; text: string }
  | { type: "actions_ready"; actions: SuggestedAction[] }
  | { type: "draft_ready"; draftId: string; version: number }
  | { type: "run_completed"; answerId: string }
  | { type: "run_failed"; code: string; message: string }
  | { type: "memory_status_changed"; status: string };
~~~

每条事件包含sequence和时间。重连可根据序号恢复；网络断开不直接丢失已完成回答。

### 16.3 表分类

CRM：

- users、teams、object_permissions
- customers、organization_units、contacts
- leads、opportunities、lead_conversions
- lead_progress、opportunity_progress
- business_activities、tasks
- external_news、meeting_records、evidence_documents、record_relations

Agent：

- conversations、messages、answers
- runs、run_events、tool_calls
- suggested_actions、action_drafts、executions、execution_items
- workbench_snapshots、source_snapshots

知识：

- knowledge_sources、knowledge_cards、knowledge_versions
- knowledge_search_index、stage_profiles

记忆：

- memories、memory_entries、memory_versions、memory_changes
- memory_jobs、memory_source_exclusions、memory_access_logs

验证：

- scenarios、fault_rules、evaluation_cases、evaluation_runs、evaluation_results

### 16.4 日志要求

记录：

- userId、Scope、conversationId、answerId、runId。
- 模型配置标识，Prompt/规则/知识版本。
- 工具名、脱敏参数、耗时、状态、返回记录引用。
- 工作台事件。
- 写入确认、执行标识和回执。
- Memory更新结果。
- token/用量在供应商返回时记录；没有时为null。

不记录API密钥、完整授权头或无法解释的伪造费用。系统可导出一份回答的验证包。

---

<a id="s17"></a>

## 17. 测试、评估与验收

### 17.1 三种验证

1. **确定性测试**：Schema、权限、实体、创建、幂等、快照、记忆版本等。
2. **Agent集成测试**：真实模型、真实MCP、固定场景，检查工具和输出。
3. **业务评审**：销售专家判断建议质量与适用性。

作者编写的预期答案是初始测试基线，不自动等同于经过销售专家验证的行业标准。

### 17.2 演示与真实模式

- replay：固定事件与回答，验证UI和失败状态。
- live：实际调用在线模型和MCP。
- 所有页面、日志、报告显示当前模式。
- 未配置模型时live不可运行，不能静默用replay替代。
- replay通过不能计入live业务能力通过率。

### 17.3 至少60个初始用例

阶段用例27个：

| ID范围 | 内容 |
|---|---|
| ST-S0-N/M/C | S0正常、缺信息、证据冲突 |
| ST-S1-N/M/C | S1正常、缺信息、证据冲突 |
| ST-S2-N/M/C | S2正常、缺信息、证据冲突 |
| ST-S3-N/M/C | S3正常、缺信息、证据冲突 |
| ST-S4-N/M/C | S4正常、缺信息、证据冲突 |
| ST-S5-N/M/C | S5正常、缺信息、证据冲突 |
| ST-S6-N/M/C | S6正常、缺信息、证据冲突 |
| ST-S7-N/M/C | S7正常、缺信息、证据冲突 |
| ST-S8-N/M/C | S8正常、缺信息、证据冲突 |

其中N=正常、M=缺信息、C=冲突。S6—S8只要求基础判断和跟进建议，不要求完整工程或财务系统。

补充33个：

| ID | 必须验证 |
|---|---|
| EN-01 | 同客户两个商机不串容量与报价 |
| EN-02 | 同名线索/商机按类型和ID区分 |
| EN-03 | S0不能作为商机阶段写入 |
| EN-04 | S1不能作为线索阶段写入 |
| EN-05 | 转化后保留原线索进展 |
| EN-06 | 转化后新进展写商机，旧回答不变 |
| AU-01 | 无权客户无法搜索或读取 |
| AU-02 | 不能通过来源列表绕过权限 |
| AU-03 | 用户关注与原始对话不跨用户 |
| AU-04 | 模型工具参数不能切换身份 |
| AC-01 | 创建待办后CRM可查到 |
| AC-02 | 创建商务活动后CRM可查到 |
| AC-03 | 线索/商机进展分别正确创建 |
| AC-04 | 修改草稿后旧确认无效 |
| AC-05 | 重复点击不重复创建 |
| AC-06 | 多条创建部分失败可区分和重试 |
| AC-07 | 创建成功但响应超时不重复建单 |
| AC-08 | 不支持的阶段修改/发邮件被明确拒绝 |
| MM-01 | 仅提问不变成项目事实 |
| MM-02 | 明确新陈述进入待核实候选 |
| MM-03 | CRM新证据更新背景并保留版本 |
| MM-04 | 新会话承接用户未决问题 |
| MM-05 | Memory回滚产生新版本且可追溯 |
| MM-06 | 排除错误来源后不再次提取 |
| WB-01 | 工作台数量与来源去重清单一致 |
| WB-02 | 历史回答恢复当时快照 |
| WB-03 | 新回答不继承旧轮计数 |
| KB-01 | 不适用国家规则不用于当前项目 |
| KB-02 | 过期政策显示时间限制 |
| KB-03 | 缺收益输入不编造回收期 |
| KB-04 | 无授权资料不编造底价/质保承诺 |
| RT-01 | 重启应用后恢复数据、会话和Memory |
| RT-02 | 模型未配置不伪装live成功 |

### 17.4 用例格式

~~~yaml
id: ST-S3-M
scope:
  objectType: opportunity
  objectId: OP-UK-026
userId: U-018
question: 这个项目为什么还推不动？下一步做什么？
expected:
  mustRead: [opportunity, opportunity_progress]
  mustRecognize: [需求基线缺口, 采购路径未明确]
  mustKeepCrmStage: S3
  mustSuggest: [技术澄清, 确认采购评审路径]
  forbidden: [自动推进S4, 编造已确认方案, 未确认创建任务]
  evidenceRefsRequired: true
~~~

### 17.5 验收门槛

确定性功能：

- 所有核心实体/权限/写入/幂等测试通过。
- 未确认写CRM为0次。
- 无权限数据泄露为0次。
- 不支持动作实际执行为0次。
- 来源引用ID有效率100%。
- 任务创建成功提示与实际记录一致。
- 重启恢复测试通过。

Agent初始基线：

- 至少30条代表性问题在live模式运行。
- 每条检查工具选择、引用、阶段判断、建议及禁止项。
- 首版目标不少于90%达到预设核心检查项；不得以平均分掩盖越权或误写。
- 关键禁止项出现一次就记录阻断问题。
- 结果需区分自动检查、模型评审与人工评审。
- 建议质量最终由业务评审确认，不只看关键词匹配。
- 记录首字延迟、总耗时、工具次数和模型用量，先形成基线，不承诺未经验证的速度或费用。

---

<a id="s18"></a>

## 18. 分阶段执行计划

### M0：业务与接口基线

工作：

- 建立代码目录和版本管理。
- 形成实体Schema、Scope、阶段和权限合同。
- 固定种子数据版本与时钟。
- 建立用例目录。
- 确认真实接口与Mock差异表。

验收：

- 客户、线索、商机关系明确。
- S0/S1边界与转换测试已定义。
- 写入能力清单与禁止清单明确。

### M1：Mock CRM与真实MCP

工作：

- SQLite迁移与种子数据。
- CRM基础查看和管理员控制台。
- 查询/创建工具。
- MCP Client/Server联通。
- 权限、Schema、幂等和故障注入。

验收：

- 用实际MCP查询到关联记录。
- 创建后能再次通过MCP和CRM页面查询。
- 部分失败、重复提交和无权限可复现。

### M2：知识库与阶段规则

工作：

- 检索公开来源、建来源目录。
- 整理知识卡、阶段手册、区域索引。
- 建全文索引和术语表。
- 建规则检查与检索评测。

验收：

- S0—S8都有Profile。
- 四大区域有索引，国家适用性可过滤。
- 固定问题能找到适用片段和引用。
- 演示政策与公开资料明确区分。

### M3：第一条live闭环

工作：

- 模型适配器。
- Agent Runner和查询工具循环。
- 回答、引用、通用动作。
- 草稿、确认、创建和执行回执。

首条验收链：

英国大储S3 → 询问卡点 → 查询进展 → 识别采购路径缺口 → 输出建议 → 生成2条待办草稿 → 用户确认 → 创建成功 → CRM可查。

### M4：P10前端完整交互

工作：

- 首页、搜索、最近项目、对象历史。
- 对话、结构化回答和动作卡。
- 统一工作台、来源弹窗。
- 流式、取消、失败和恢复。
- 工商业/渠道场景。

验收：

- 所有核心旅程可操作。
- 没有以独立页面硬编码每类回答。
- 工作台和来源与真实执行一致。

### M5：持续记忆与后台

工作：

- 四类Memory。
- 异步提取、去重、合并和版本。
- 背景候选与用户关注分离。
- 文件投影与后台。
- 转化前后历史承接。

验收：

- 新会话能续接。
- 用户问题不污染事实。
- 冲突、修订、回滚、来源排除有效。

### M6：评估与交付

工作：

- 运行至少60个初始用例。
- 运行至少30条live问题。
- 完成截图、浏览器操作检查与数据回查。
- 修复阻断问题。
- 编制启动、场景演示和验收报告。

验收：

- 核心禁止项无违例。
- 已知限制明确。
- 可由用户独立按文档启动和重置。
- 报告记录实际通过、失败及未测试项。

模型配置未提供时，可先完成M0、M1、M2和replay前端。M3的live验收必须有有效API配置。

---

<a id="s19"></a>

## 19. 建议目录与配置

### 19.1 目录

~~~text
sales-buddy-mock/
  apps/
    web/
      src/components/
      src/pages/
      src/features/advisor/
      src/features/crm/
      src/features/admin/
    server/
      src/api/
      src/auth/
      src/crm/
      src/mcp/
      src/agent/
      src/knowledge/
      src/stages/
      src/memory/
      src/actions/
      src/events/
      src/evaluations/
      src/db/
  packages/
    contracts/
  knowledge/
    sources/
    cards/
    stages/
    playbooks/
    regions/
    glossary/
  prompts/
    system/
    actions/
    memory/
  fixtures/
    crm/
    scenarios/
    conversations/
    evaluations/
  data/
    app.sqlite
    memory/
    exports/
  docs/
    architecture.md
    data-model.md
    mcp-contract.md
    knowledge-catalog.md
    scenario-guide.md
    acceptance-report.md
  tests/
    unit/
    integration/
    e2e/
    live/
  .env.example
  package.json
  package-lock.json
  README.md
~~~

实际生成文件放在新子目录，不覆盖原PEN和已有HTML文件。

### 19.2 环境配置

~~~dotenv
APP_HOST=127.0.0.1
APP_PORT=3001
WEB_PORT=3000
DATABASE_PATH=./runtime/app/app.sqlite
APP_MODE=mock
AGENT_MODE=replay
MODEL_API_BASE_URL=
MODEL_API_KEY=
MODEL_NAME=
MODEL_PROTOCOL=
MODEL_TIMEOUT_MS=120000
TOOL_TIMEOUT_MS=10000
BUSINESS_CLOCK=2026-10-25T09:00:00+08:00
KNOWLEDGE_SEARCH_MODE=fts
~~~

- MODEL_PROTOCOL由模型适配器明确支持，不仅凭供应商名字猜测协议。
- .env不提交；.env.example只包含变量及说明。
- 模型密钥不可通过普通前端配置接口读回。
- 提供模型能力检查和错误提示。
- 未提供模型时默认replay，界面明确标识。

### 19.3 预期命令

~~~text
npm install
npm run db:migrate
npm run seed
npm run dev
npm run test
npm run test:e2e
npm run test:live
npm run knowledge:reindex
npm run scenario:reset
npm run mcp:stdio
~~~

命令需实际实现并验证。涉及重置和删除的命令先确认目标范围，只作用于Mock子目录数据。

---

<a id="s20"></a>

## 20. 交付清单

### 20.1 可运行系统

- 本地Web。
- Mock CRM数据库及界面。
- 真实MCP查询与创建服务。
- 在线模型适配及replay模式。
- Agent对话和动作闭环。
- 工作台与来源。
- Memory与后台。
- 验证和日志页面。

### 20.2 数据与知识

- 数据字典、关系模型和迁移。
- 版本化种子数据。
- 场景矩阵与故障规则。
- 来源目录、知识卡、阶段Profile、区域索引。
- 演示产品/商务政策。
- 知识缺口及待企业确认项。

### 20.3 工程文档

- 启动与配置。
- MCP合同。
- 模型适配说明。
- Prompt与动作注册表。
- Memory更新规则。
- 测试与验收报告。
- 场景演示脚本。
- 真实CRM接入差异表。
- 已知限制和未验证项。

### 20.4 最终演示脚本

至少演示：

1. 搜索线索S0，讨论真实性与转化条件。
2. 管理员模拟转化S1，打开商机承接历史。
3. 大储S3诊断与竞品异议。
4. 生成并确认任务，回查CRM。
5. 记录新的商机进展，重新分析。
6. 工商业缺收益资料时索取输入。
7. 渠道计划生成并转为行动草稿。
8. 客户级跨线索商机经营分析。
9. 新会话通过Memory续接。
10. 工作台和来源快照恢复。
11. 无权限与部分失败。
12. 后台审阅冲突并回滚记忆。

---

<a id="s21"></a>

## 21. 所需用户材料与缺失时策略

| 输入 | 作用 | 未提供时 |
|---|---|---|
| 模型地址、协议、模型名、密钥 | live能力 | 先replay，live明确不可用 |
| 真实MCP描述与样例 | 后续对接 | 使用本文Mock合同并记录差异 |
| S0—S8内部标准 | 企业口径 | 使用本文初版Profile，标记待业务确认 |
| 产品与方案资料 | 准确方案与差异化 | 演示产品包，不做真实承诺 |
| 商务授权规则 | 价格/质保/交期边界 | 演示政策，不能称正式公司规定 |
| 渠道规则 | 准入、报备、激励 | 生成初步评估和资料收集计划 |
| 脱敏项目样本 | 业务真实性 | 使用虚构案例并标记 |
| 好/坏回答样例 | 评估标准 | 使用作者基线，后续业务评审 |
| 品牌资源 | 视觉 | 复用P10样式与文字标识 |

已经确认、不重复询问：

- 本地应用＋在线模型API。
- S0线索，S1—S8商机。
- 欧洲、北美、中东、亚太。
- 大储、工商业、渠道分销相关业务。
- 统一工作台和对象范围历史。
- 确认后创建活动、进展和待办。

---

<a id="s22"></a>

## 22. 后续执行检查表

### 22.1 开始前

- [ ] 检查最新用户指令和适用AGENTS.md。
- [ ] 阅读本方案，检查已完成代码与文档。
- [ ] 在新子目录建设，不覆盖设计源文件。
- [ ] 固定依赖、Schema和数据版本。
- [ ] 建立验收用例及结果记录。
- [ ] 明确当前是replay还是live。
- [ ] 不读取或输出不必要的密钥。

### 22.2 开发中

- [ ] 客户、线索、商机实体保持独立。
- [ ] 所有工具按Scope和权限运行。
- [ ] 创建走草稿、确认与幂等。
- [ ] 查询和写入可从CRM界面回查。
- [ ] 工作台只渲染真实状态。
- [ ] 来源与回答快照一致。
- [ ] 用户关注与项目事实分离。
- [ ] 知识有来源、适用性和版本。
- [ ] 错误不被伪装成成功。
- [ ] 不扩张Agent写入能力。

### 22.3 交付前

- [ ] 从干净数据库启动并跑通首条链路。
- [ ] 重启恢复、重置和故障场景通过。
- [ ] 确定性测试通过。
- [ ] live问题集实际运行，报告不混入replay成绩。
- [ ] 页面截图与浏览器操作验证。
- [ ] 文档中的命令都实际执行过或明确标记未验证。
- [ ] 无权限、重复提交和部分成功测试通过。
- [ ] 交付实际成果、未完成项、已知限制及所需下一步输入。

---

<a id="s23"></a>

## 23. 技术与设计参考

- [原PEN设计文件](./CRM智能助手vzyh_2026.9.23.pen)
- [MCP官方：构建服务端](https://modelcontextprotocol.io/docs/develop/build-server)
- [MCP官方：Tools规范](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)
- [MCP TypeScript SDK文档](https://ts.sdk.modelcontextprotocol.io/)
- [Muse设计说明：持续记忆与可编辑文件](https://introducing.muse.ai/)

使用参考资料时：

- 以实际当前官方文档和锁定版本为准。
- Muse仅作为产品交互参考，不假定其内部实现与本方案相同。
- 本方案中的双层业务记忆、权限与数据模型是针对Sales Buddy设计的实现规则。
- 不把引用链接、PEN中的示例或模型生成的常识当成已经验证的企业事实。

---

<a id="s24"></a>

## 24. 文档修订约定

后续范围或实现发生变化时：

1. 在文末新增修订记录。
2. 同步更新相关Schema、场景、知识规则与测试。
3. 说明旧数据和记忆版本是否需要迁移。
4. 对实际未完成项使用明确状态，不把计划写成完成结果。
5. 修订不覆盖用户已经明确确认的边界，除非获得新指令。

| 版本 | 日期 | 修订内容 |
|---|---|---|
| v1.0 | 2026-10-25 | 汇总历史讨论与P10原型，确立本地Mock、MCP、知识、阶段、Agent、工作台、Memory及验收执行基线 |


