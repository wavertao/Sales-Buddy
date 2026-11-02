// P9 投标全流程 · 通用展示组件（对齐设计稿 投标全流程.html 的卡片 / 胶囊 / 按钮 / 章节头 / 字段语言）
import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { CircleAlert, X } from 'lucide-react';

export type Tone = 'blue' | 'purple' | 'orange' | 'red' | 'green' | 'gray' | 'white';

export const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(' ');

/** 胶囊：r999 小标签（状态 / 统计 / 轮次）。shape="tag" 为 r6 的状态胶囊。 */
export function Pill({ tone = 'blue', shape = 'round', children, dot, className }: { tone?: Tone; shape?: 'round' | 'tag'; children: React.ReactNode; dot?: boolean; className?: string }) {
  return <span className={cx('p9-pill', 'tone-' + tone, shape === 'tag' && 'is-tag', className)}>{dot && <i className="p9-pill-dot" />}{children}</span>;
}

/** 轮次药丸：R1 灰、R2+ 主色。 */
export function RoundTag({ round, label }: { round: string; label?: string }) {
  return <span className={cx('p9-round', round === 'R1' ? 'is-past' : 'is-now')}>{round}{label ? ' · ' + label : ''}</span>;
}

type BtnKind = 'primary' | 'outline' | 'ghost' | 'ai' | 'soft' | 'danger';
export function Btn({ kind = 'outline', size = 'md', icon: Icon, iconRight: IconRight, children, onClick, disabled, title, className, type = 'button' }: {
  kind?: BtnKind; size?: 'sm' | 'md' | 'lg'; icon?: LucideIcon; iconRight?: LucideIcon; children?: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void; disabled?: boolean; title?: string; className?: string; type?: 'button' | 'submit';
}) {
  const s = size === 'sm' ? 11 : size === 'lg' ? 14 : 12;
  return (
    <button type={type} className={cx('p9-btn', 'kind-' + kind, 'size-' + size, className)} onClick={onClick} disabled={disabled} title={title}>
      {Icon && <Icon size={s} />}{children}{IconRight && <IconRight size={s} />}
    </button>
  );
}

/** 方形图标按钮（26 / 28 / 34）。 */
export function IconBtn({ icon: Icon, onClick, title, tone = 'gray', size = 26, round }: { icon: LucideIcon; onClick?: () => void; title?: string; tone?: 'gray' | 'blue' | 'white'; size?: number; round?: boolean }) {
  return (
    <button type="button" className={cx('p9-iconbtn', 'tone-' + tone, round && 'is-round')} style={{ width: size, height: size }} onClick={onClick} title={title} aria-label={title}>
      <Icon size={Math.round(size * 0.52)} />
    </button>
  );
}

/** 卡片：白底 r12，可选卡头（图标 + 标题 + 提示 + 右侧）与底栏（透明 + 顶部 1px 分割线）。 */
export function Card({ icon: Icon, iconTone = 'blue', title, hint, right, footer, children, className, bodyClass, flush }: {
  icon?: LucideIcon; iconTone?: 'blue' | 'purple' | 'red' | 'orange' | 'green'; title?: React.ReactNode; hint?: React.ReactNode; right?: React.ReactNode;
  footer?: React.ReactNode; children?: React.ReactNode; className?: string; bodyClass?: string; flush?: boolean;
}) {
  return (
    <section className={cx('p9-card', className)}>
      {title !== undefined && (
        <header className="p9-card-head">
          <div className="p9-card-head-left">
            {Icon && <Icon size={14} className={'ic-' + iconTone} />}
            <h3>{title}</h3>
            {hint && <span className="p9-card-hint">{hint}</span>}
          </div>
          {right && <div className="p9-card-head-right">{right}</div>}
        </header>
      )}
      <div className={cx('p9-card-body', flush && 'is-flush', bodyClass)}>{children}</div>
      {footer && <footer className="p9-card-foot">{footer}</footer>}
    </section>
  );
}

/** 章节头：浅灰底 r8 + 3×14 竖条 + 名称 + 摘要 + 迷你进度 + 完成胶囊 + 动作。 */
export function SectionHead({ name, summary, bar = 'blue', progress, badge, action, onAction }: {
  name: string; summary?: React.ReactNode; bar?: 'blue' | 'purple' | 'red' | 'orange' | 'gray' | 'green';
  progress?: { done: number; total: number }; badge?: React.ReactNode; action?: React.ReactNode; onAction?: () => void;
}) {
  const pct = progress ? Math.round(progress.done / Math.max(1, progress.total) * 100) : 0;
  const tone = progress ? (progress.done >= progress.total ? 'green' : progress.done === 0 ? 'red' : 'orange') : 'orange';
  return (
    <div className="p9-sec-head">
      <i className={'p9-sec-bar bar-' + bar} />
      <b className="p9-sec-name">{name}</b>
      {summary && <span className="p9-sec-summary">{summary}</span>}
      <span className="p9-grow" />
      {progress && <span className="p9-mini-track"><i className={'tone-' + tone} style={{ width: pct + '%' }} /></span>}
      {progress && <Pill tone={tone}>{progress.done} / {progress.total}</Pill>}
      {badge}
      {action && <button type="button" className="p9-sec-action" onClick={onAction}>{action}</button>}
    </div>
  );
}

/** 表单字段：标签在上 + 框（已填 / 缺失「点击填写」）。 */
export function Field({ label, value, onChange, required, placeholder, children }: {
  label: string; value?: string; onChange?: (v: string) => void; required?: boolean; placeholder?: string; children?: React.ReactNode;
}) {
  const missing = !children && !value;
  return (
    <label className="p9-field">
      <span className="p9-field-label">{label}{required && <i className="p9-req">*</i>}</span>
      {children ?? (
        <span className={cx('p9-field-box', missing && 'is-missing')}>
          <input value={value ?? ''} placeholder={placeholder ?? '点击填写'} onChange={e => onChange?.(e.target.value)} />
          {missing && <CircleAlert size={10} />}
        </span>
      )}
    </label>
  );
}

export function Avatar({ name, tone = 'blue', size = 16 }: { name: string; tone?: 'blue' | 'purple' | 'orange' | 'green' | 'teal'; size?: number }) {
  return <span className={'p9-avatar tone-' + tone} style={{ width: size, height: size, fontSize: Math.max(8, size * 0.5) }}>{name.slice(0, 1)}</span>;
}

/** 数字序号块（16×16 r4）。 */
export function Num({ n, tone = 'gray' }: { n: React.ReactNode; tone?: 'gray' | 'blue' | 'red' | 'orange' | 'purple' }) {
  return <span className={'p9-num tone-' + tone}>{n}</span>;
}

/** 表格：列宽模板 + 表头列分割线 + 行分割线。 */
export function Table({ cols, head, children, className }: { cols: string; head: React.ReactNode[]; children: React.ReactNode; className?: string }) {
  return (
    <div className={cx('p9-table', className)} style={{ '--cols': cols } as React.CSSProperties}>
      <div className="p9-tr is-head">{head.map((h, i) => <div key={i} className="p9-th">{h}</div>)}</div>
      {children}
    </div>
  );
}
export function Tr({ children, onClick, className }: { children: React.ReactNode; onClick?: () => void; className?: string }) {
  return <div className={cx('p9-tr', onClick && 'is-click', className)} onClick={onClick} role={onClick ? 'button' : undefined}>{children}</div>;
}

export function Check({ checked, onChange, label }: { checked: boolean; onChange?: () => void; label?: string }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={label} className={cx('p9-check', checked && 'is-on')} onClick={e => { e.stopPropagation(); onChange?.(); }}>
      {checked && <svg viewBox="0 0 12 12" width="10" height="10"><path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
    </button>
  );
}

/** 弹窗外壳：标题行 + 内容 + 底部按钮行；overlay=false 时无遮罩（贴在触发位置下方）。 */
export function Modal({ icon: Icon, iconTone = 'blue', title, width = 440, onClose, children, footer, overlay = true, style, className }: {
  icon?: LucideIcon; iconTone?: 'blue' | 'green' | 'purple'; title: React.ReactNode; width?: number; onClose: () => void;
  children: React.ReactNode; footer?: React.ReactNode; overlay?: boolean; style?: React.CSSProperties; className?: string;
}) {
  const box = (
    <div className={cx('p9-modal', className)} style={{ width, ...style }} role="dialog" aria-label={typeof title === 'string' ? title : undefined} onClick={e => e.stopPropagation()}>
      <header className="p9-modal-head">
        {Icon && <Icon size={15} className={'ic-' + iconTone} />}
        <h3>{title}</h3>
        <span className="p9-grow" />
        <button type="button" className="p9-modal-x" onClick={onClose} aria-label="关闭"><X size={12} /></button>
      </header>
      <div className="p9-modal-body">{children}</div>
      {footer && <footer className="p9-modal-foot">{footer}</footer>}
    </div>
  );
  return overlay ? <div className="p9-overlay" onClick={onClose}>{box}</div> : box;
}

export function Toast({ text }: { text: string }) {
  return text ? <div className="p9-toast" role="status">{text}</div> : null;
}
