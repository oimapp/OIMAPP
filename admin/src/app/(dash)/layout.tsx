import { requireAdmin } from "@/lib/auth";
import { Nav } from "@/components/Nav";
import { signOut } from "../actions";

export const dynamic = "force-dynamic";

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="flex min-h-screen">
      <Nav name={admin.name} role={admin.role} signOut={signOut} />
      <main className="min-w-0 flex-1 p-4 md:p-7">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
