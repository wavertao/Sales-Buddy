import type { Guards, ItemLevel, JudgeConfig, ReviewItem } from "../../../../packages/contracts/tender";

/** 规则页三层配置用到的类型别名（和契约同源，页面里少写一点泛型） */
export type ItemLevelKey = ItemLevel;
export type ReviewItemLike = ReviewItem;
export type GuardsConfig = Guards;
export type JudgeConfigLike = JudgeConfig;
