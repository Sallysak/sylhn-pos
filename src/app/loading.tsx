export default function Loading() {
  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
      <div className="text-center">
        <div className="h-12 w-12 rounded-full border-4 border-emerald-200 border-t-emerald-500 animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-500 font-medium">Loading…</p>
      </div>
    </div>
  );
}
