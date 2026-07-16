import React from 'react';

export const PageHeader = ({ eyebrow, title, description, actions = null, meta = null }) => (
  <div className="surface-card p-5 sm:p-6">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="section-kicker mb-2">{eyebrow}</p>}
        <h1 className="text-2xl font-bold leading-tight text-[color:var(--text-main)] sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--text-muted)]">
            {description}
          </p>
        )}
        {meta && <div className="mt-4">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  </div>
);

export const SurfaceCard = ({ children, className = '' }) => (
  <div className={`surface-card ${className}`}>{children}</div>
);

export const EmptyState = ({ icon: Icon, title, description, action = null }) => (
  <div className="surface-card p-8 text-center">
    {Icon && (
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--primary-soft)] text-[color:var(--primary)]">
        <Icon size={28} />
      </div>
    )}
    <h2 className="text-xl font-semibold text-[color:var(--text-main)]">{title}</h2>
    {description && (
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[color:var(--text-muted)]">
        {description}
      </p>
    )}
    {action && <div className="mt-5 flex justify-center">{action}</div>}
  </div>
);

export const StatusPill = ({ children, tone = 'neutral' }) => {
  const tones = {
    neutral: 'bg-gray-100 text-gray-700',
    primary: 'bg-teal-100 text-teal-800',
    success: 'bg-emerald-100 text-emerald-800',
    warning: 'bg-amber-100 text-amber-800',
    danger: 'bg-rose-100 text-rose-800',
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone] || tones.neutral}`}>
      {children}
    </span>
  );
};
