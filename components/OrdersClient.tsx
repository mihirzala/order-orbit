"use client";

import { useEffect, useState } from "react";
import { StatusBadge, btnSecondary, fmtPrice, retailerLabel } from "./ui";

interface Order {
  id: string;
  title: string;
  retailer: string;
  productUrl: string;
  quantity: string;
  priceAtApproval: string;
  currency: string;
  checkoutStatus: string;
  confirmationNumber: string | null;
  chargedTotal: string | null;
  failureReason: string | null;
  createdAt: string;
}

export default function OrdersClient() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [returningId, setReturningId] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/orders");
    const data = await res.json();
    if (Array.isArray(data.orders)) setOrders(data.orders);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  async function requestReturn(orderId: string) {
    setReturningId(orderId);
    setNotice(null);
    const res = await fetch("/api/returns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    });
    const data = await res.json();
    setReturningId(null);
    if (!res.ok) {
      setNotice(data.error ?? "Could not request the return.");
      return;
    }
    setNotice("Return requested. Track it in the Returns tab.");
  }

  if (orders.length === 0) {
    return <p className="text-sm text-neutral-500">No orders yet. Approve a purchase from the Deals tab.</p>;
  }

  return (
    <div className="space-y-3">
      {notice && <div className="border rounded-lg px-4 py-3 text-sm bg-neutral-100">{notice}</div>}
      {orders.map((o) => (
        <div key={o.id} className="border rounded-xl p-4 bg-white space-y-2">
          <div className="flex items-start justify-between gap-2">
            <a href={o.productUrl} target="_blank" rel="noreferrer" className="font-medium hover:underline line-clamp-2">
              {o.title}
            </a>
            <StatusBadge status={o.checkoutStatus} />
          </div>
          <div className="text-sm text-neutral-500">
            {retailerLabel(o.retailer)} · Qty {o.quantity} · Approved at {fmtPrice(o.priceAtApproval, o.currency)}
          </div>
          {o.checkoutStatus === "placed" && (
            <div className="text-sm">
              Order <span className="font-mono">{o.confirmationNumber}</span> · Charged{" "}
              {o.chargedTotal ? fmtPrice(o.chargedTotal, o.currency) : "—"}
            </div>
          )}
          {o.checkoutStatus === "needs_attention" && o.failureReason && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {o.failureReason}
            </div>
          )}
          {o.checkoutStatus === "placed" && (
            <button
              onClick={() => requestReturn(o.id)}
              disabled={returningId === o.id}
              className={btnSecondary}
            >
              {returningId === o.id ? "Requesting…" : "Request return"}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
