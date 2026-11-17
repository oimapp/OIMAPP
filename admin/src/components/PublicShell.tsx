import Link from "next/link";

// The page frame for the public pages anyone can open: welcome, privacy, delete account.
export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpg" alt="" className="h-12 w-12 rounded-full" />
          <Link href="/" className="min-w-0">
            <div className="font-serif text-xl font-bold text-brand-deep">Ona Iwa Mimo</div>
            <div className="truncate text-xs text-muted">Cherubim and Seraphim Church of Nigeria and Overseas</div>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap gap-x-5 gap-y-2 px-4 py-5 text-sm text-muted">
          <Link href="/" className="underline">Home</Link>
          <Link href="/privacy" className="underline">Privacy policy</Link>
          <Link href="/delete-account" className="underline">Delete your account</Link>
          <span className="ml-auto">© Ona Iwa Mimo C&amp;S Church</span>
        </div>
      </footer>
    </div>
  );
}
