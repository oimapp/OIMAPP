"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const LINKS: (string[] | string)[] = [
  ["/", "Overview"], ["/payments", "Payments"], ["/members", "Members"],
  "Content",
  ["/books", "Books"], ["/calendar", "Church calendar"], ["/districts", "Districts and churches"],
  ["/babas", "Leaders"], ["/hymns", "Hymn book"], ["/messages", "Messages"],
  "Community",
  ["/prayers", "Prayer, counselling, testimonies"], ["/registers", "Class registers"],
  "Setup",
  ["/settings", "Settings"], ["/log", "Admin activity"],
];

/** A reader (for example the Chairman of the Prophet Council) only sees the private requests. */
const READER_LINKS: (string[] | string)[] = [["/prayers", "Prayer and counselling requests"]];

const ROLE_NAME: Record<string, string> = { owner: "Main admin", editor: "Content editor", support: "Support desk", reader: "Prayer and counselling" };

export function Nav({ name, role, privateRequests, signOut }: { name: string; role: string; privateRequests: boolean; signOut: () => Promise<void> }) {
  const links = role === "reader" ? READER_LINKS : LINKS;
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <>
      <button
        className="fixed left-3 top-3 z-40 print:hidden rounded-lg bg-brand-deep px-3 py-2 text-sm font-semibold text-white md:hidden"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {open ? "Close" : "Menu"}
      </button>
      <aside
        className={`print:hidden fixed inset-y-0 left-0 z-30 flex w-60 flex-col bg-brand-deep px-3 py-4 text-white transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="mb-5 flex items-center gap-2.5 px-2 pt-10 md:pt-0">
          <img src="/logo.jpg" alt="" className="h-10 w-10 rounded-full" />
          <div>
            <div className="font-serif text-[17px] font-bold leading-tight">Ona Iwa Mimo</div>
            <div className="text-xs opacity-70">Admin</div>
          </div>
        </div>
        <nav className="flex flex-col gap-0.5">
          {links.map((l) =>
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
          <div className="opacity-70">{ROLE_NAME[role] ?? role}{privateRequests && role !== "reader" ? " · reads private requests" : ""}</div>
          <form action={signOut}>
            <button className="mt-2 text-white/80 underline">Sign out</button>
          </form>
        </div>
      </aside>
    </>
  );
}
