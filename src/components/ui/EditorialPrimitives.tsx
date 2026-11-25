import React from 'react';
import { X } from 'lucide-react';

export interface EditorialButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'ink' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const EditorialButton: React.FC<EditorialButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  type = 'button',
  ...rest
}) => {
  const sizeClass =
    size === 'sm'
      ? 'px-3.5 py-1.5 text-[11px] min-h-[34px]'
      : size === 'lg'
      ? 'px-6 py-3 text-xs min-h-[44px]'
      : 'px-4.5 py-2 text-xs min-h-[40px]';

  const variantClass =
    variant === 'primary'
      ? 'bg-[var(--editorial-primary)] hover:bg-[var(--editorial-accent)] text-white shadow-xs'
      : variant === 'ink'
      ? 'bg-[var(--editorial-ink)] text-[var(--editorial-paper)] hover:opacity-90 shadow-xs'
      : variant === 'secondary'
      ? 'bg-[var(--editorial-surface)] text-[var(--editorial-ink)] border border-[var(--editorial-border)] hover:border-[var(--editorial-primary)] hover:text-[var(--editorial-primary)]'
      : variant === 'danger'
      ? 'bg-red-600 hover:bg-red-700 text-white'
      : 'text-[var(--editorial-ink)] hover:bg-[var(--editorial-surface-subtle)]';

  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full font-display font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed whitespace-nowrap ${sizeClass} ${variantClass} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
};

export interface FilterChipProps {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}

export const FilterChip: React.FC<FilterChipProps> = ({
  active = false,
  onClick,
  children,
  className = '',
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 min-h-[36px] rounded-full text-xs font-display font-bold uppercase tracking-wider border transition-colors cursor-pointer whitespace-nowrap ${
      active
        ? 'bg-[var(--editorial-primary)] text-white border-[var(--editorial-primary)] shadow-xs'
        : 'bg-[var(--editorial-surface)] text-[var(--editorial-ink)] border-[var(--editorial-border)] hover:border-[var(--editorial-ink)]'
    } ${className}`}
  >
    {children}
  </button>
);

export interface SectionHeaderProps {
  kicker?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  ornament?: React.ReactNode;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  kicker,
  title,
  subtitle,
  action,
  ornament,
  className = '',
}) => (
  <div
    className={`flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-[var(--editorial-border)] pb-3.5 ${className}`}
  >
    <div className="space-y-1 min-w-0">
      {kicker && (
        <p className="font-display text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--editorial-primary)]">
          {kicker}
        </p>
      )}
      <h2 className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-tight leading-none flex items-center gap-2.5 text-[var(--editorial-ink)]">
        {ornament}
        <span>{title}</span>
      </h2>
      {subtitle && (
        <p className="text-xs sm:text-sm text-[var(--editorial-muted)] max-w-[62ch] leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

export interface EditorialNoticeProps {
  tone?: 'info' | 'success' | 'warning' | 'error';
  children: React.ReactNode;
  className?: string;
}

export const EditorialNotice: React.FC<EditorialNoticeProps> = ({
  tone = 'info',
  children,
  className = '',
}) => {
  const toneClass =
    tone === 'success'
      ? 'border-emerald-600/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
      : tone === 'warning'
      ? 'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200'
      : tone === 'error'
      ? 'border-red-600/40 bg-red-500/10 text-red-800 dark:text-red-200'
      : 'border-[var(--editorial-border)] bg-[var(--editorial-surface-subtle)] text-[var(--editorial-ink)]';

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-xl border px-4 py-3 text-xs sm:text-sm leading-relaxed ${toneClass} ${className}`}
    >
      {children}
    </div>
  );
};

export interface EmptyStateProps {
  icon?: React.ReactNode;
  illustration?: React.ReactNode;
  kicker?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  illustration,
  kicker,
  title,
  description,
  action,
  className = '',
}) => (
  <div
    className={`rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] px-6 py-12 text-center flex flex-col items-center justify-center gap-3 ${className}`}
  >
    {illustration ? (
      <div className="mb-1">{illustration}</div>
    ) : icon ? (
      <div className="w-12 h-12 rounded-2xl bg-[var(--editorial-primary)]/10 text-[var(--editorial-primary)] flex items-center justify-center">
        {icon}
      </div>
    ) : null}
    {kicker && (
      <p className="font-display text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--editorial-primary)]">
        {kicker}
      </p>
    )}
    <h3 className="font-display text-xl sm:text-2xl font-extrabold uppercase tracking-tight text-[var(--editorial-ink)]">
      {title}
    </h3>
    <p className="text-sm text-[var(--editorial-muted)] max-w-md leading-relaxed">
      {description}
    </p>
    {action && <div className="pt-2">{action}</div>}
  </div>
);

export interface EditorialModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  kicker?: string;
  maxWidthClass?: string;
  children: React.ReactNode;
}

export const EditorialModal: React.FC<EditorialModalProps> = ({
  open,
  onClose,
  title,
  kicker,
  maxWidthClass = 'max-w-lg',
  children,
}) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full ${maxWidthClass} max-h-[88vh] overflow-y-auto rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] text-[var(--editorial-ink)] p-6 shadow-2xl space-y-4`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--editorial-border)] pb-3">
          <div>
            {kicker && (
              <p className="font-display text-[11px] font-bold uppercase tracking-widest text-[var(--editorial-primary)]">
                {kicker}
              </p>
            )}
            <h3 className="font-display text-2xl font-extrabold uppercase tracking-tight mt-0.5">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Cerrar ${title}`}
            className="p-2 rounded-full hover:bg-[var(--editorial-surface-subtle)] cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

export interface EditorialStatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  accent?: boolean;
}

export const EditorialStatCard: React.FC<EditorialStatCardProps> = ({
  label,
  value,
  hint,
  icon,
  accent = false,
}) => (
  <div
    className={`rounded-2xl border p-4 sm:p-5 space-y-1.5 transition-colors ${
      accent
        ? 'border-[var(--editorial-primary)]/40 bg-[var(--editorial-primary)]/[0.06]'
        : 'border-[var(--editorial-border)] bg-[var(--editorial-surface)]'
    }`}
  >
    <div className="flex items-center justify-between gap-2">
      <p className="font-display text-[11px] font-bold uppercase tracking-wider text-[var(--editorial-muted)]">
        {label}
      </p>
      {icon && <span className="text-[var(--editorial-primary)]">{icon}</span>}
    </div>
    <p className="font-tabular text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--editorial-ink)]">
      {value}
    </p>
    {hint && <p className="text-[11px] text-[var(--editorial-muted)]">{hint}</p>}
  </div>
);

export const editorialInputClass =
  'w-full px-3.5 py-2.5 rounded-xl bg-[var(--editorial-paper)] text-[var(--editorial-ink)] border border-[var(--editorial-border)] text-sm placeholder:text-[var(--editorial-muted)]/70 focus:outline-none focus:border-[var(--editorial-primary)] transition-colors';
