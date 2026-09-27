"use client";

export function retailerLabel(r: string): string {
  return r.charAt(0).toUpperCase() + r.slice(1);
}

export function fmtPrice(price: string | number, currency = "USD"): string {
  const n = typeof price === "string" ? parseFloat(price) : price;
  if (Number.isNaN(n)) return `${currency} —`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
}

const STATUS_STYLES: Record<string, string> = {
  approved_for_checkout: "bg-blue-100 text-blue-800",
  processing: "bg-yellow-100 text-yellow-800",
  placed: "bg-green-100 text-green-800",
  needs_attention: "bg-red-100 text-red-800",
  fetching: "bg-yellow-100 text-yellow-800",
  ready: "bg-green-100 text-green-800",
  pending: "bg-neutral-200 text-neutral-700",
  done: "bg-green-100 text-green-800",
  available: "bg-green-100 text-green-800",
  connected: "bg-green-100 text-green-800",
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-neutral-200 text-neutral-700";
  const label = status.replace(/_/g, " ");
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${style}`}>
      {label}
    </span>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm text-neutral-600">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

export const inputCls =
  "w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-300";

export const btnPrimary =
  "bg-neutral-900 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50 hover:bg-neutral-700";

export const btnSecondary =
  "border border-neutral-300 rounded-lg px-4 py-2 text-sm hover:bg-neutral-100 disabled:opacity-50";
