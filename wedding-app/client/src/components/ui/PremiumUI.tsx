import React, { type ReactNode } from 'react';
import { Search, Filter, X } from 'lucide-react';
import {
  NAVY,
  GOLD,
  IVORY,
  ROSE,
  FONT_DISPLAY,
  cardStyle,
} from '../../constants/design';

/* ─── Page header ─── */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        {eyebrow && (
          <p className="text-sm font-semibold tracking-wide uppercase" style={{ color: GOLD }}>
            {eyebrow}
          </p>
        )}
        <h1
          className="text-3xl lg:text-4xl font-bold tracking-tight mt-0.5"
          style={{ fontFamily: FONT_DISPLAY, color: NAVY }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm mt-1.5 max-w-2xl" style={{ color: `${NAVY}70` }}>
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
    </div>
  );
}

/* ─── Metric card ─── */
export function MetricCard({
  label,
  value,
  subtext,
  trend,
  icon: Icon,
  onClick,
}: {
  label: string;
  value: string;
  subtext?: string;
  trend?: string;
  icon: React.ElementType;
  onClick?: () => void;
}) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      onClick={onClick}
      className="relative overflow-hidden rounded-xl p-5 transition-all hover:shadow-md text-left w-full"
      style={cardStyle}
    >
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ background: `linear-gradient(90deg, ${GOLD}, ${GOLD}60)` }}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: `${NAVY}80` }}>
            {label}
          </p>
          <p
            className="text-3xl font-bold mt-2 leading-none"
            style={{ fontFamily: FONT_DISPLAY, color: NAVY }}
          >
            {value}
          </p>
          {subtext && (
            <p className="text-sm mt-2" style={{ color: `${NAVY}70` }}>{subtext}</p>
          )}
          {trend && (
            <p className="text-xs mt-2 font-medium" style={{ color: GOLD }}>{trend}</p>
          )}
        </div>
        <div
          className="shrink-0 w-11 h-11 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${GOLD}15`, border: `1px solid ${GOLD}30` }}
        >
          <Icon className="h-5 w-5" style={{ color: GOLD }} />
        </div>
      </div>
    </Wrapper>
  );
}

/* ─── Status badge ─── */
type BadgeVariant = 'confirmed' | 'pending' | 'tour' | 'inquiry' | 'declined' | 'draft' | 'upcoming' | 'completed' | 'urgent';

const BADGE_STYLES: Record<BadgeVariant, { label: string; bg: string; color: string; border: string }> = {
  confirmed: { label: 'Confirmed', bg: `${GOLD}18`, color: '#8B6914', border: `${GOLD}40` },
  pending: { label: 'Pending', bg: `${ROSE}30`, color: '#9A6B55', border: `${ROSE}60` },
  tour: { label: 'Tour Scheduled', bg: `${NAVY}10`, color: NAVY, border: `${NAVY}20` },
  inquiry: { label: 'Inquiry', bg: IVORY, color: '#6B7280', border: '#E5E7EB' },
  declined: { label: 'Declined', bg: '#FEE2E2', color: '#991B1B', border: '#FECACA' },
  draft: { label: 'Draft', bg: `${NAVY}08`, color: `${NAVY}80`, border: `${NAVY}15` },
  upcoming: { label: 'Upcoming', bg: `${GOLD}12`, color: '#8B6914', border: `${GOLD}30` },
  completed: { label: 'Completed', bg: '#D1FAE5', color: '#065F46', border: '#A7F3D0' },
  urgent: { label: 'Urgent', bg: '#FEE2E2', color: '#991B1B', border: '#FECACA' },
};

export function StatusBadge({ variant, label }: { variant: BadgeVariant; label?: string }) {
  const s = BADGE_STYLES[variant];
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap"
      style={{ backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {label ?? s.label}
    </span>
  );
}

/* ─── Premium card shell ─── */
export function PremiumCard({
  children,
  className = '',
  padding = true,
}: {
  children: ReactNode;
  className?: string;
  padding?: boolean;
}) {
  return (
    <div className={`rounded-xl ${padding ? 'p-6' : ''} ${className}`} style={cardStyle}>
      {children}
    </div>
  );
}

export function PremiumCardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div>
        <h2 className="text-xl font-semibold" style={{ fontFamily: FONT_DISPLAY, color: NAVY }}>
          {title}
        </h2>
        {subtitle && (
          <p className="text-sm mt-0.5" style={{ color: `${NAVY}70` }}>{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

/* ─── Buttons ─── */
export function BtnPrimary({
  children,
  onClick,
  icon: Icon,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  icon?: React.ElementType;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98] ${className}`}
      style={{ backgroundColor: GOLD, color: NAVY, boxShadow: `0 2px 12px ${GOLD}35` }}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function BtnSecondary({
  children,
  onClick,
  icon: Icon,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  icon?: React.ElementType;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all hover:bg-white/80 ${className}`}
      style={{ backgroundColor: IVORY, color: NAVY, border: `1px solid ${GOLD}35` }}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function BtnGhost({
  children,
  onClick,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-black/5 ${className}`}
      style={{ color: `${NAVY}80` }}
    >
      {children}
    </button>
  );
}

/* ─── Search + filter bar ─── */
export function SearchBar({
  value,
  onChange,
  placeholder = 'Search…',
  onFilterClick,
  filterActive,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onFilterClick?: () => void;
  filterActive?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1 max-w-lg">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
          style={{ color: `${NAVY}50` }}
        />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2.5 rounded-lg text-sm outline-none transition-shadow focus:ring-2 focus:ring-[#C9A84C40]"
          style={{
            backgroundColor: IVORY,
            border: `1px solid ${GOLD}30`,
            color: NAVY,
          }}
        />
        {value && (
          <button
            onClick={() => onChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded"
            style={{ color: `${NAVY}50` }}
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {onFilterClick && (
        <button
          onClick={onFilterClick}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          style={{
            backgroundColor: filterActive ? `${GOLD}15` : IVORY,
            border: `1px solid ${filterActive ? GOLD : `${GOLD}30`}`,
            color: filterActive ? '#8B6914' : NAVY,
          }}
        >
          <Filter className="h-4 w-4" />
          Filters
        </button>
      )}
    </div>
  );
}

/* ─── Filter pills ─── */
export function FilterPills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all"
            style={
              active
                ? { backgroundColor: NAVY, color: IVORY, border: `1px solid ${NAVY}` }
                : { backgroundColor: IVORY, color: `${NAVY}80`, border: `1px solid ${GOLD}25` }
            }
          >
            {opt.label}
            {opt.count !== undefined && (
              <span
                className="text-xs px-1.5 py-0.5 rounded-full"
                style={
                  active
                    ? { backgroundColor: `${GOLD}30`, color: GOLD }
                    : { backgroundColor: `${NAVY}08`, color: `${NAVY}60` }
                }
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Avatar initials ─── */
export function AvatarInitials({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const parts = name.split(/[\s&]+/).filter(Boolean);
  const initials = (parts[0]?.[0] ?? '') + (parts[parts.length > 1 ? 1 : 0]?.[0] ?? '');
  const dim = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-12 h-12 text-base' : 'w-10 h-10 text-sm';
  return (
    <div
      className={`${dim} rounded-full flex items-center justify-center font-semibold shrink-0`}
      style={{ backgroundColor: `${GOLD}20`, color: '#8B6914', border: `1px solid ${GOLD}35` }}
    >
      {initials.toUpperCase()}
    </div>
  );
}

/* ─── Progress ring ─── */
export function ProgressRing({ value, size = 40 }: { value: number; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`${NAVY}10`} strokeWidth={3} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={GOLD}
        strokeWidth={3}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ─── Empty state ─── */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ backgroundColor: `${GOLD}12`, border: `1px solid ${GOLD}25` }}
      >
        <Icon className="h-8 w-8" style={{ color: GOLD }} />
      </div>
      <h3 className="text-lg font-semibold" style={{ fontFamily: FONT_DISPLAY, color: NAVY }}>
        {title}
      </h3>
      <p className="text-sm mt-2 max-w-sm" style={{ color: `${NAVY}70` }}>{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/* ─── Tag chip ─── */
export function TagChip({ label, color = 'gold' }: { label: string; color?: 'gold' | 'rose' | 'sage' | 'navy' }) {
  const styles = {
    gold: { bg: `${GOLD}15`, color: '#8B6914', border: `${GOLD}30` },
    rose: { bg: `${ROSE}25`, color: '#9A6B55', border: `${ROSE}50` },
    sage: { bg: '#D1FAE520', color: '#065F46', border: '#A7F3D030' },
    navy: { bg: `${NAVY}08`, color: NAVY, border: `${NAVY}15` },
  };
  const s = styles[color];
  return (
    <span
      className="inline-flex px-2 py-0.5 rounded text-xs font-medium"
      style={{ backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {label}
    </span>
  );
}

export function formatCurrency(value: number) {
  if (value === 0) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}
