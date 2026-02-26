export default function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-4 border-brand-200 border-t-brand-600 animate-spin" />
        </div>
        <p className="text-sm text-slate-500 font-medium">Loading NexusGrid…</p>
      </div>
    </div>
  );
}
