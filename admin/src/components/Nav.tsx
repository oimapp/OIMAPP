"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const LINKS: (string[] | string)[] = [
  ["/", "Overview"], ["/payments", "Payments"], ["/members", "Members"],
  "Content",
  ["/books", "Books"], ["/calendar", "Church calendar"], ["/districts", "Districts and churches"],
  ["/babas", "Past Baba Aladura"], ["/messages", "Messages"],
  "Setup",
  ["/settings", "Settings"], ["/log", "Admin activity"],
];

export function Nav({ name, role, signOut }: { name: string; role: string; signOut: () => Promise<void> }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <>
      <button
        className="fixed left-3 top-3 z-40 rounded-lg bg-brand-deep px-3 py-2 text-sm font-semibold text-white md:hidden"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {open ? "Close" : "Menu"}
      </button>
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-60 flex-col bg-brand-deep px-3 py-4 text-white transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="mb-5 flex items-center gap-2.5 px-2 pt-10 md:pt-0">
          <img src="/logo.jpg" alt="" className="h-10 w-10 rounded-full" />
          <div>
            <div className="font-serif text-[17px] font-bold leading-tight">Ona Iwa Mimo</div>
            <div className="text-xs opacity-70">Admin</div>
          </div>
        </div>
        <nav className="flex flex-col gap-0.5">
          {LINKS.map((l) =>
            typeof l === "string" ? (
              <div key={l} className="px-3 pb-1.5 pt-4 text-xs font-semibold opacity-55">{l}</div>
            ) : (
              <Link
                key={l[0]}
                href={l[0]}
                onClick={() => setOpen(false)}
                aria-current={active(l[0]) ? "page" : undefined}
                className={`rounded-lg px-3 py-2.5 text-sm ${active(l[0]) ? "bg-white/15 font-semibold" : "text-white/80 hover:bg-white/10"}`}
              >
                {l[1]}
              </Link>
            ),
          )}
        </nav>
        <div className="mt-auto border-t border-white/15 px-2 pt-3 text-xs">
          <div className="font-semibold">{name}</div>
          <div className="capitalize opacity-70">{role}</div>
          <form action={signOut}>
            <button className="mt-2 text-white/80 underline">Sign out</button>
          </form>
        </div>
      </aside>
    </>
  );
}
