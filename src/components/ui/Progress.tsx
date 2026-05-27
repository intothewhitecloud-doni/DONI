export function Progress({ value }: { value: number }) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div aria-valuemax={100} aria-valuemin={0} aria-valuenow={safeValue} className="h-2 overflow-hidden rounded-full bg-surface-strong" role="progressbar">
      <div className="h-full rounded-full bg-brand-accent transition-[width]" style={{ width: `${safeValue}%` }} />
    </div>
  );
}
