export default function RootLoading() {
  return (
    <div className="p-6 space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-32 w-full rounded-lg bg-muted animate-pulse" />
      ))}
    </div>
  );
}
