import type { ReactNode } from 'react';

interface MetricCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: 'cyan' | 'amber' | 'violet' | 'green';
  progress?: number;
}

export function MetricCard({ icon, label, value, detail, tone, progress }: MetricCardProps) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <div className="metric-card__top">
        <span className="metric-card__icon" aria-hidden="true">{icon}</span>
        <span className="metric-card__label">{label}</span>
        <span className="metric-card__pulse" />
      </div>
      <strong className="metric-card__value">{value}</strong>
      <div className="metric-card__footer">
        <span>{detail}</span>
        {progress !== undefined && (
          <span className="metric-card__bar" aria-label={`${label} ${progress}%`}>
            <i style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }} />
          </span>
        )}
      </div>
    </article>
  );
}
