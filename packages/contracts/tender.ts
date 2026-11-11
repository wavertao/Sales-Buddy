/**
 * 标书解析（招标文件整包 → 拆标分解表）共享类型。
 *
 * 流水线五步：文件抽取 → 文件角色识别 → 章节切分 → 条款打标（分类 / 强制项 / 风险 / 字段）→ 包级汇总
 * （修订覆盖、字段矛盾、拆标分解表）。每一步用到的判定都来自 TenderRuleSet，规则在「规则配置」页维护。
 */

/** 拆标五类：对应《投标流程-方案与待办》标书分解口径「技术 / 交付 / 价格 / 商务 / 偏差」。 */
export type TenderCategory = 'technical' | 'delivery' | 'price' | 'commercial' | 'deviation';
export const TENDER_CATEGORIES: { key: TenderCategory; label: string }[] = [
  { key: 'technical', label: '技术' },
  { key: 'delivery', label: '交付' },
  { key: 'price', label: '价格' },
  { key: 'commercial', label: '商务' },
  { key: 'deviation', label: '偏差' },
];

/** 文件角色：决定文件在包内的效力顺序（澄清 > 修订 > 正文）以及是否参与条款抽取。 */
export type FileRole =
  | 'notice' | 'itb' | 'contract' | 'technical_spec' | 'amendment' | 'clarification'
  | 'boq' | 'drawing' | 'form' | 'integrity' | 'result' | 'reference' | 'other';

export type Severity = 'high' | 'medium' | 'low';
export type Strength = 'prohibited' | 'mandatory' | 'required' | 'recommended';
export type TeamRole = 'SLS' | 'PM' | 'SC' | 'QA' | 'AMD' | 'BSD';

export interface FileRoleRule {
  id: string; role: FileRole; label: string;
  /** 文件名正则（不区分大小写），命中一次 +3 分 */
  namePatterns: string[];
  /** 前两页内容关键词，每命中一个 +1 分 */
  contentKeywords: string[];
  /** 效力顺序，数字越大越优先（同一条款被多个文件提到时，以高者为准） */
  precedence: number;
  /** 是否从该类文件抽取条款进入拆标分解表（图纸、廉洁协议等通常只登记不拆） */
  extractClauses: boolean;
  enabled: boolean;
}
export interface HeadingRule { id: string; label: string; pattern: string; level: number; enabled: boolean }
export interface CategoryRule { id: string; category: TenderCategory; label: string; keywords: string[]; weight: number; enabled: boolean }
export interface MandatoryRule { id: string; label: string; pattern: string; strength: Strength; enabled: boolean }
export interface FieldRule {
  id: string; key: string; label: string;
  /** 正则，第 1 个捕获组为值 */
  pattern: string;
  normalize: 'number' | 'date' | 'text';
  unit?: string;
  /** 字段值在不同文件间不一致时是否报矛盾 */
  checkConflict: boolean;
  enabled: boolean;
}
export interface RiskRule { id: string; label: string; pattern: string; severity: Severity; category: TenderCategory; advice: string; enabled: boolean }
export interface OwnerRule { category: TenderCategory; role: TeamRole; reviewer: TeamRole; dueOffsetDays: number }
/** 模型判断的标注示例：模型照着这些判断同类条款。 */
export interface JudgeExample {
  id: string; text: string; isRequirement: boolean;
  category?: TenderCategory; strength?: Strength; note?: string; enabled: boolean;
}
/** 模型判断配置：和规则同一个版本，一起保存、试跑、回滚。 */
export interface JudgeConfig {
  enabled: boolean;
  prompt: string;
  /** 公司口径，每条一句，如「质保超过 10 年算高风险」 */
  policies: string[];
  examples: JudgeExample[];
  batchSize: number; concurrency: number;
  /** 置信度低于此值的结论标待确认 */
  minConfidence: number;
}
export interface TenderOptions {
  /** 每页可抽字符数低于该值视为扫描页 */
  minCharsPerPage: number;
  /** 单文件最多读取页数 */
  maxPagesPerFile: number;
  clauseMinLength: number;
  clauseMaxLength: number;
  /** 分类得分低于此值的条款不进分解表（强制项和风险项除外） */
  minCategoryScore: number;
}
export interface TenderRuleSet {
  version: number; updatedAt: string; updatedBy: string;
  fileRoles: FileRoleRule[];
  headings: HeadingRule[];
  categories: CategoryRule[];
  mandatory: MandatoryRule[];
  fields: FieldRule[];
  risks: RiskRule[];
  owners: OwnerRule[];
  options: TenderOptions;
  judge: JudgeConfig;
}

export type ExtractStatus = 'ok' | 'partial_scanned' | 'scanned' | 'unsupported' | 'error';
export interface ParsedFile {
  id: string; name: string; path: string; ext: string; size: number;
  status: ExtractStatus; note?: string;
  pages: number; textPages: number; chars: number;
  role: FileRole; roleLabel: string; roleScore: number; precedence: number;
  sections: number; clauses: number;
}
export interface FieldHit {
  key: string; label: string; value: string; normalized: string; unit?: string;
  fileId: string; fileName: string; page: number; snippet: string; precedence: number;
}
export interface FieldSummary {
  key: string; label: string; unit?: string;
  /** 按效力顺序取的采用值 */
  value: string; source: string;
  values: { normalized: string; value: string; files: string[] }[];
  status: 'single' | 'consistent' | 'multiple' | 'overridden' | 'conflict';
}
export interface OverrideLink {
  fileId: string; fileName: string; role: FileRole; page: number;
  ref: string; snippet: string;
  /** 被修订的原条款（能定位到时） */
  target?: { fileName: string; section: string; page: number };
}
export interface DecompItem {
  id: string; no: number; category: TenderCategory; title: string; text: string;
  strength?: Strength; risks: { label: string; severity: Severity; advice: string }[];
  fileId: string; fileName: string; fileRole: FileRole; section: string; page: number;
  owner: TeamRole; reviewer: TeamRole; dueDate?: string; score: number;
  /** 本条所在章节被修订 / 澄清文件引用过 */
  amended: boolean;
  /** 由条款正文算出的稳定编号，重传新版后仍能对上 */
  clauseKey?: string;
  /** 结论来源：模型、规则，或测试用的确定性判断 */
  source?: JudgeSource;
  /** 模型给出的中文摘要、原文引用、理由、置信度（0–1） */
  summary?: string; quote?: string; reason?: string; confidence?: number;
  needsReview?: boolean; reviewReasons?: string[];
  /** 规则原本的判断，模型改过时用来对照 */
  ruleCategory?: TenderCategory; ruleStrength?: Strength;
  /** 人工指定的所属工作项，优先于模型归纳 */
  workItemKey?: string;
}
export type JudgeSource = 'model' | 'rule' | 'mock' | 'human';
/** 工作项：一组服务于同一交付物的要求。model = 模型归纳，fallback = 按「类别 + 文件」兜底分组 */
export interface TenderWorkItem {
  key: string; category: TenderCategory; title: string; deliverable: string; owner?: TeamRole;
  /** 包含的要求，按 clauseKey 记，改判、重排编号后仍能对上 */
  requirementKeys: string[]; source: 'model' | 'fallback';
}
/** 人工改判：同一投标下按 clauseKey 记一条，重传新版后继续生效；也是后续自进化的标准答案。 */
export interface ClauseReview {
  isRequirement: boolean; category?: TenderCategory; strength?: Strength; note?: string;
  /** 归他方：业主或其他承包商的责任，移出我方分解表 */
  party?: 'bidder' | 'owner' | 'other';
  /** 移到指定工作项（工作项的 key，即分解条目的 tenderKey） */
  workItemKey?: string;
}
export interface TenderFeedback extends ClauseReview {
  bidId: string; clauseKey: string; text: string; fileName: string; section: string;
  before: { isRequirement: boolean; category?: TenderCategory; strength?: Strength; source?: JudgeSource };
  by: string; at: string;
}
export interface JudgeSummary {
  mode: JudgeSource; model?: string | null; candidates: number; batches: number; failedBatches: number;
  cached: number; unverified: number; excluded: number; needsReview: number; note?: string;
}
/** 没进分解表的条款（模型判定不是要求、规则没选中、人工排除），留着供核对和捞回。 */
export interface ExcludedClause {
  clauseKey: string; text: string; fileId: string; fileName: string; fileRole: FileRole; section: string; page: number; reason: string;
  score: number; amended: boolean; ruleCategory?: TenderCategory; ruleStrength?: Strength;
}
export interface TenderProgress { stage: 'extract' | 'judge' | 'summary'; done: number; total: number; message: string }
export interface TenderJob {
  id: string; status: 'running' | 'done' | 'failed'; bidId?: string; by: string; packageName: string;
  progress: TenderProgress; runId?: string; error?: string; createdAt: string;
}
export interface TenderParseResult {
  id: string; packageName: string; source: 'sample' | 'upload'; createdAt: string; durationMs: number;
  ruleVersion: number;
  files: ParsedFile[];
  fields: FieldSummary[];
  overrides: OverrideLink[];
  items: DecompItem[];
  stats: {
    files: number; pages: number; scannedFiles: number; unsupportedFiles: number;
    items: number; mandatory: number; risks: Record<Severity, number>;
    byCategory: Record<TenderCategory, number>; conflicts: number;
  };
  warnings: string[];
  truncated: boolean;
  /** 旧解析记录没有这一项，视同纯规则 */
  judge?: JudgeSummary;
  /** 应答表（Returnable Schedules）里列出的要交付项，归纳工作项时当骨架 */
  schedules?: string[];
  /** 工作项分组；没有时按「类别 + 文件」分组 */
  workItems?: TenderWorkItem[];
}

/** 规则试跑：贴一段文字，看每条规则命中了什么。 */
export interface RulePreviewClause {
  text: string; section: string; category?: TenderCategory; score: number;
  scores: Record<TenderCategory, number>; strength?: Strength; mandatoryRule?: string;
  risks: string[]; fields: { label: string; value: string }[];
}
