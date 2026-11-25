# 预制PPT与标准页素材

本目录保存版本化的共享PPT素材：

- catalog.ts：售前、售中、产品、售后等业务分类和预制主题。
- library/manifest.json：12份PPT的版本、语言、页码、主题和研究来源。
- library/*.pptx：12份、共96页可编辑样例材料。
- library/previews/<资料ID>/<页码>.png：逐页预览图。
- research-sources.json：背景研究依据。

[资料清单](library/README.md)。使用 `npm run knowledge:ppt:build` 复建素材，需配置原有Artifact运行时；已有文件按现有构建规则保留。

这些是虚构业务样例及标准介绍素材，不代表经公司审核批准的产品参数、客户案例或商务政策。用户自行上传及面向具体客户生成、导出的PPT位于runtime/app/materials，通过个人素材库管理，不复制到这里。
