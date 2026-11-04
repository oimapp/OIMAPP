// The plain page frame for the public payment pages (no admin menu).
export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-paper px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpg" alt="" className="h-14 w-14 rounded-full" />
          <div>
            <div className="font-serif text-xl font-bold text-brand-deep">Ona Iwa Mimo</div>
            <div className="text-xs text-muted">Cherubim and Seraphim Church of Nigeria and Overseas</div>
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}
