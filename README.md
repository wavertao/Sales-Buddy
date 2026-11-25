# Sales Buddy · 海外储能赢单领航员

销售战略参谋已升级为「赢单领航员」。项目对话右侧提供M/P/T评估、当前画像、阶段重点事项、M×P矩阵、候选阶段核对和对话更新确认；CRM的S0–S8保持独立。管理员可在「赢单知识库」按七类Excel维护617条基线知识，支持完整内容、导入确认、版本记录及回退。

使用与验证见[赢单领航员实施记录](docs/赢单领航员-本地系统实施记录.md)。沿用原 `/advisor` 路由兼容历史入口，现有会话和记忆不重置。

本地Mock CRM、真实MCP查询/创建、P10对话界面、知识与Memory验证台，以及P11关键会晤赋能和个人素材库。

## 仓库与协作

GitHub：[YunhaoPeter/Sales-Buddy](https://github.com/YunhaoPeter/Sales-Buddy)。`main` 为稳定基线，`develop` 为集成分支，后续每次迭代从 `develop` 新建 `codex/<任务名>` 分支，通过PR集成。详见[分支管理与发布流程](docs/分支管理与发布流程.md)及[助手协作约定](AGENTS.md)。

原始Pencil及HTML设计参考位于[designs/](designs/)，完整建设方案和模块规划位于[docs/](docs/)，预制PPT位于[assets/presentations/library/](assets/presentations/library/)。运行数据库、API密钥、用户上传、对话记忆和自动生成报告不上传。

## 项目结构

目录职责、知识/PPT边界及迁移说明见[项目目录结构与迁移](docs/项目目录结构与迁移.md)。源码、知识和静态素材进入Git；数据库、用户素材、测试现场及报告统一归入忽略提交的 `runtime/`。成功测试自动清理本次临时数据，失败测试保留现场。

## 启动

要求Node.js 24以上。项目目录内执行：

~~~powershell
npm ci
Copy-Item .env.example .env
npm run seed
npm run dev
~~~

打开 http://127.0.0.1:3001 。默认使用在线模型；选择“张小小”开始，管理员用于知识、记忆、日志和场景控制。

- 用户对话使用已配置的在线模型，CRM数据通过真实MCP读取。
- 企业、人员、报价、活动和外部资讯均为虚构Mock。
- 在线模型未配置或调用失败时明确提示，不回退到固定模板回答。

## 在线模型

首次克隆后从 .env.example 复制 .env（已有配置请勿覆盖），在该文件填写：

~~~dotenv
MODEL_PROTOCOL=chat_completions
MODEL_API_BASE_URL=https://你的服务/v1
MODEL_API_KEY=你的密钥
MODEL_NAME=你的模型名
~~~

也可使用演示管理员进入“管理员设置”，在线编辑、测试并保存API配置；保存立即生效，无需重启。密钥留空保留现有值。直接修改.env文件后需重启服务器。用户界面不提供模式切换。
详细说明见[管理员API配置](docs/api-settings.md)。
适配器支持Chat Completions的流式内容与tool_calls。供应商协议兼容性和30条live验证必须配置后实际测试。

## 账号与权限

- 张小小：销售TEAM-A，自有客户。
- 李明：销售TEAM-B，自有客户。
- 王经理：TEAM-A经理。
- 演示管理员：管理后台与授权记忆。
- Mock身份切换用于本地测试，不是生产SSO。

## 验证

~~~powershell
npm test
npm run build
npm run test:e2e
npm run test:live
~~~

浏览器测试需先安装：npm exec playwright install chromium。测试自动构建并在3002端口启动独立服务，使用隔离数据库、配置和固定响应，不调用真实模型，不改动用户数据。固定响应只允许在显式开启的隔离测试环境运行。
test:live未配置模型时执行0条并返回退出码2，明确标记blocked。

## 数据与维护

~~~powershell
npm run db:migrate
npm run knowledge:reindex
npm run mcp:stdio
npm run scenario:reset -- --confirm=RESET_MOCK
~~~

重置会移除Mock会话和创建记录；不删除PEN源文件。数据库runtime/app/app.sqlite，生成的Memory文件在runtime/app/memory。
重置后重新选择Mock身份。当前MCP仅支持查询及创建活动、进展、待办，不支持改阶段、完成待办、发邮件。

## 主要界面

首页搜索客户、线索和商机；S0为线索，S1—S8为商机。右栏统一为任务规划与本轮数据。
回答下蓝紫色按钮继续生成分析与计划；绿色创建按钮才打开CRM草稿，最终确认后才通过MCP创建。详见[建议与创建按钮](docs/suggestion-actions.md)。来源弹窗与工作台使用同一份来源快照。

## 文件与报告

- [建设方案](docs/Sales-Buddy-本地Mock系统建设与验证方案-v1.0.md)
- [验收报告](docs/acceptance-report.md)
- [建设方案执行映射](docs/implementation-map.md)
- 本地自动测试结果：`runtime/reports/test-results.json`
- 本地浏览器测试结果：`runtime/reports/e2e-results.json`
- 本地在线验证状态：`runtime/reports/live-results.json`
- [MCP合同](docs/mcp-contract.md)
- [数据模型与差异](docs/data-model.md)
- [知识目录](docs/knowledge-catalog.md)
- [演示脚本](docs/scenario-guide.md)

当前主库为30份原创销售策略与活动文档，见[全流程合并MD](knowledge/sales/guides/储能销售策略与关键活动全流程指引-v2.md)。支持echarts结构化表格/图形和历史Markdown表格；客户与项目最近沟通及逐轮日志已加入。正式使用前需业务审核。详细已知限制见验收报告。


更新说明：[知识主库](docs/knowledge-catalog.md) · [表格与ECharts](docs/rich-output.md) · [最近沟通与布局修复](docs/conversation-history-fix.md)。

## 回答与个人记忆 v3

默认约1000字、最多8个行动，规范见[prompts/战略参谋.md](prompts/战略参谋.md)。回答下生成上下文追问，固定能力在输入框“常用工具”。记忆管理对所有用户开放，分用户记忆、用户×客户及用户×项目；管理员可筛选所有人。旧版来源不明记忆已归档，不自动注入。

详见[实施报告](docs/战略参谋与记忆系统-v3实施报告.md)。在线验证结果在本地docs目录生成，不随仓库提交。

## P11 关键会晤赋能

首页/左侧“关键会晤赋能”进入：选择客户或项目 → 多轮背景交流 → 编辑确认章节大纲 → 编辑确认逐页问题 → 选择真实PPT原页或主动生成 → 确认采用并导出可编辑PPT。左侧“个人素材库”保留本人上传、成功生成草稿及历史导出。“储能知识库 → 面客PPT资料库”提供24类目录、12套96页可编辑Mock PPT。

- [实施架构与开发明细](docs/P11-实施架构与开发明细.md)
- [公开资料研究与Mock PPT说明](docs/P11-储能资料研究与MockPPT说明.md)
- [实施与验收报告](docs/P11-实施与验收报告.md)
- [PPT目录与文件](assets/presentations/library/README.md)

PPT生成/预览使用Codex本机Artifact Tool运行时；普通开发环境需提供兼容的运行时模块路径。环境配置可选项见.env.example。使用`npm run knowledge:ppt:build`复建素材（已有文件不覆盖）；`npx tsx scripts/p11-live-smoke.ts`执行隔离数据的真实在线模型烟雾测试，会消耗已配置API。正式功能不使用固定回复。

P11会晤交互与匹配规则已修订：[背景追问、流式回复、中文规划与原文档预览](docs/P11-会晤交互与素材匹配修订.md)。

## 联网搜索与三类知识框架

已接入Exa公开联网检索，在线战略参谋可调用`web_search`，管理员设置可维护搜索密钥。见[Exa接入说明](docs/Exa联网搜索-接入说明.md)。

[定方向、识风险、递资源知识库框架](docs/储能销售知识库-定方向识风险递资源-框架设计.md)为业务设计文档，本次不改造现有知识库或阶段逻辑。

## 项目画像与三类知识库

项目对话右上角“项目画像”，或“记忆管理 → 项目画像”，可查看按用户和具体项目隔离的16项状态、来源、冲突、历史与后续追问。销售陈述会持续更新，CRM正式阶段不自动改变。

知识库已按定方向、识风险、递资源组织，新增28个专题并保留30份原有文档，共58份。可按子分类/阶段/模式筛选。

- [三类知识完整汇编](knowledge/sales/strategic/储能项目全生命周期-三类知识库汇编.md)
- [分类汇总](docs/储能知识库-三类分类汇总.md)
- [画像与知识库实施说明](docs/项目画像与三类知识库-实施说明.md)

执行`npm run knowledge:reindex`更新索引，`npm run knowledge:export`复建三类MD目录与汇编。

## 赢单领航员当前版本

客户/项目先进入概览，再选择历史会话或新建对话。项目阶段采用独立M/P/T画像，用户确认阶段与AI核实结论分别记录；日常对话仅在用户确认更新建议后写入画像。阶段重点事项为固定清单。

- [产品与实施方案](docs/赢单领航员-产品与落地实施方案.md)
- [原型与当前界面对齐](docs/赢单领航员-原型与当前系统界面对齐.md)
- [客户项目概览](docs/赢单领航员-客户项目概览与会话入口.md)
- [PR整合与发布记录](docs/PR整合与发布记录-2026-11-01.md)

早期项目画像及MPT预览保留作历史设计参考；正式设计以 `designs/CRM智能助手vzyh_2026.9.23.pen` 和最新界面对齐文档为准。上文旧画像描述不代表当前MPT的自动更新规则。

### CI检查

Linux受控试用部署、完整数据快照、PPT独立运行路径及访问口令保护见[ECS部署与迁移说明](docs/ECS受控试用部署与迁移.md)。密钥、真实运行数据和验收报告不进入Git仓库。

PR和分支推送自动运行 `npm run security:check -- --tracked`、`npm run test:ci` 和 `npm run build`。可移植测试不包括依赖本机Artifact运行时的P11完整生成/导出测试；后者仍需在已配置运行时的本地运行 `npm test` 和对应浏览器旅程。
