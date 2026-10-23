export function PageTitle({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 pt-10 md:pt-0">
      <h1 className="text-xl font-semibold">{title}</h1>
      {children}
    </div>
  );
}

const TONES = {
  green: "bg-green-50 text-green-800",
  red: "bg-church-soft text-church-red",
  amber: "bg-amber-50 text-amber-800",
  blue: "bg-brand-soft text-brand",
  grey: "bg-paper text-muted",
};
export function Pill({ tone, children }: { tone: keyof typeof TONES; children: React.ReactNode }) {
  return <span className={`pill ${TONES[tone]}`}>{children}</span>;
}

export function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-semibold text-muted">{label}</div>
      <div className="mt-1.5 font-serif text-2xl font-bold">{value}</div>
      {note && <div className="mt-1 text-xs text-muted">{note}</div>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="p-6 text-center text-sm text-muted">{children}</p>;
}

export const PAY_STATUS: Record<string, [keyof typeof TONES, string]> = {
  paid: ["green", "Paid"],
  pending: ["amber", "Waiting"],
  failed: ["grey", "Failed"],
  refunded: ["amber", "Refunded"],
};
