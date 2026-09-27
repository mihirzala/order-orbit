"use client";

import { useEffect, useState } from "react";
import { StatusBadge } from "./ui";

interface ReturnRow {
  id: string;
  orderId: string;
  status: string;
  reason: string;
  qrImageUrl: string | null;
  qrData: string | null;
  failureReason: string | null;
  createdAt: string;
  orderTitle: string;
}

export default function ReturnsClient() {
  const [rows, setRows] = useState<ReturnRow[]>([]);

  async function load() {
    const res = await fetch("/api/returns");
    const data = await res.json();
    if (Array.isArray(data.returns)) setRows(data.returns);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  if (rows.length === 0) {
    return <p className="text-sm text-neutral-500">No returns yet. Request one from a placed order in the Orders tab.</p>;
  }

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.id} className="border rounded-xl p-4 bg-white space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="font-medium line-clamp-2">{r.orderTitle}</div>
            <StatusBadge status={r.status} />
          </div>
          {r.reason && <div className="text-sm text-neutral-500">{r.reason}</div>}
          {r.status === "ready" && (r.qrImageUrl || r.qrData) && (
            <div className="border rounded-lg p-3 bg-neutral-50">
              <div className="text-sm font-medium mb-2">Retailer return code</div>
              {r.qrImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.qrImageUrl} alt="Return QR code" className="w-40 h-40 object-contain bg-white rounded" />
              )}
              {r.qrData && !r.qrImageUrl && (
                <div className="font-mono text-sm break-all bg-white p-2 rounded border">{r.qrData}</div>
              )}
              <p className="text-xs text-neutral-500 mt-2">Show this at the drop-off. Issued by the retailer.</p>
            </div>
          )}
          {r.status === "needs_attention" && r.failureReason && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {r.failureReason}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
