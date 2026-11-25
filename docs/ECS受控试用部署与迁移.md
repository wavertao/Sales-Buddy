# ECS受控试用部署与迁移

适用：单台Linux服务器、在线模型API、SQLite及本地素材文件。代码在独立任务分支开发，运行数据和密钥从不提交Git。实际迁移清单、服务器地址、访问口令、日志及验收截图仅保存在本地runtime和服务器私有目录。

## 目录与运行

```text
/opt/sales-buddy/
  node/                 独立Node.js 24运行时
  releases/<release>/   应用、构建产物、知识库及标准PPT
  current -> releases/<release>
  shared/app.env        模型、搜索、路径及试用访问配置，权限600
  shared/app/           SQLite、Memory、个人素材
  shared/import/        首次迁移的校验清单与恢复副本
  backups/              首次迁移包及后续私有备份，目录权限700
  acme/                 独立证书工具环境
  acme-web/             HTTP证书校验目录
```

应用监听127.0.0.1:3001，由独立systemd服务以salesbuddy用户运行。Nginx按单独子域名代理，不替换同机其他站点。服务配置限制内存，并将可写路径限定到shared和私有临时目录。现有同机应用启停状态保持原样。

依赖：Node.js 24、项目锁定的npm依赖、LibreOffice Impress、Poppler和可分发的中文字体。字体安装需遵守其许可证。不要复制本机附带的私有Artifact运行时到云端；其许可不允许这样部署。

## 数据盘点与快照

```sh
node scripts/migration-inventory.mjs <本地应用目录> <私有inventory.json路径>
node scripts/migration-snapshot.mjs <本地应用目录> <新的私有快照目录>
```

盘点只输出文件数量、体积、记录数量及配置是否齐备，不输出对话正文和密钥值。盘点报告仍视为私有文件。

快照脚本要求当前没有运行中的对话/PPT任务，使用SQLite VACUUM INTO生成一致性数据库快照，复制Memory、个人素材、标准PPT及知识库；只在新快照中转换Windows路径，保留本地原件。校验数据库完整性、外键、全部素材原文件存在性，并生成逐文件SHA256清单。

本地知识目录可能保留旧布局：快照映射到knowledge/sales、knowledge/research及assets/presentations，随后以清单校验部署。知识库后台已导入的版本和项目画像仍以数据库迁移内容为准，不执行场景重置或知识覆盖导入。

真实对话、画像、Memory、个人文件及API密钥超出纯Mock业务数据时，必须明确迁移范围并取得授权；传输只通过已核对服务器的SSH/SFTP。服务器私有数据目录及归档限制访问权限。

`deploy/install-pilot.sh`只用于首次安装，拒绝覆盖已有release及数据库。升级应先备份，在新release部署代码，保留shared，并明确审查数据库升级；不重复执行首次数据导入。

## 访问保护

云端设置随机的`DEPLOYMENT_ACCESS_PASSWORD`（至少20字符），所有页面、API及Mock会话入口均经过部署闸门。正确登录后使用24小时HMAC签名cookie，具备HttpOnly、SameSite=Strict和HTTPS Secure属性；不占用应用Bearer令牌。

未设置该变量时本地原有流程不受影响。云端必须设置，并使用HTTPS，不允许把口令放进URL。口令从私有文件交付，禁止写入部署文档、Git或日志。

Agent调用本机HTTP MCP时，由服务端生成同一部署闸门的签名Cookie，并继续携带原用户Bearer。不得通过放行整个/mcp或信任任意回环来源来修复内部调用；公网MCP仍需部署凭据，CRM数据权限仍由用户令牌控制。验收必须实际发送消息并完成MCP查询，不能仅测试模型连通和页面浏览。

此功能保护内部试用入口；进入后仍可切换Mock身份，不等同企业个人账号认证。扩大使用范围前需接入正式认证、角色管理及审计。

Nginx模板通过`SALES_BUDDY_DOMAIN`替换实际子域名。HTTP仅用于ACME和跳转HTTPS，代理关闭响应缓冲以保留Agent流式输出，上传大小和超时与应用能力匹配。

## PPT云端适配

`PRESENTATION_ENGINE=libreoffice`启用可独立部署路径：PptxGenJS生成可编辑PPT，LibreOffice转换PDF，Poppler输出逐页PNG。中文字体由`PRESENTATION_FONT`指定；原页组合继续使用既有OOXML资源复制逻辑，保留原PPT页的可编辑对象。

默认引擎保持原有本地实现。云端生成/预览会因字体和渲染引擎存在排版差异，应通过实际PPT和预览验收。预制素材原文件与已保存预览直接迁移，不重新生成。

## 验收

1. 迁移包SHA256和全部文件清单匹配；SQLite integrity_check及foreign_key_check正常。
2. CRM记录数保持一致；原会话、消息、画像、Memory、会晤及素材ID均保留。
3. 逐份素材下载的哈希与磁盘原件相同；所有标记已有的预览可访问。
4. 七类知识库清单和版本可读。
5. 实测中文可编辑PPT生成、预览、原页组合和再渲染。
6. 模型Chat Completions及Exa从ECS返回成功。连接测试不等同模型全部业务准确性评估。
7. 从外网浏览器验证证书、试用口令、首页、项目概览与历史入口；检查同机原站点。

`deploy/verify-pilot.mjs`用于本方案固定私有目录中的云端验收，仅输出汇总信息。会建立少量技术会话并在shared/smoke生成测试PPT，不修改CRM业务事实；不会把验证资料混入个人素材库。

## 备份、证书与回滚

- `sales-buddy-backup.timer`每天执行备份。运行任务存在时跳过本次快照；已有备份保留，不自动删除。备份含密钥和个人资料，按私有数据管理。需监控磁盘，并另行配置离机备份及保留周期。
- `sales-buddy-cert-renew.timer`每天检查证书续期，成功后先检验Nginx配置再重载。应执行一次续期dry-run验证域名校验。
- 查看服务：`systemctl status sales-buddy`；日志：`journalctl -u sales-buddy`。启停该服务不影响其他应用。
- 回滚代码：在没有任务运行时停止Sales Buddy，切回已保留release并重新启动。数据库回滚必须单独核对版本和迁移后新数据，不能简单覆盖当前数据库。
- 初始本地环境和迁移包保留。云端启动后两端数据独立，后续本地修改不会自动覆盖云端，也没有配置双向同步。
