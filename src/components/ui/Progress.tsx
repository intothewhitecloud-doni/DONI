export function Progress({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
      <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

