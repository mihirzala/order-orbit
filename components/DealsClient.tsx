"use client";

import { useEffect, useState } from "react";
import {
  Field, StatusBadge, btnPrimary, btnSecondary, fmtPrice, inputCls, retailerLabel,
} from "./ui";

interface Deal {
  id: string;
  title: string;
  price: string;
  currency: string;
  retailer: string;
  imageUrl: string | null;
  productUrl: string;
  availability: string;
}

const RETAILERS = ["", "amazon", "walmart", "target"];

export default function DealsClient() {
  const [query, setQuery] = useState("");
  const [retailer, setRetailer] = useState("");
  const [deals, setDeals] = useState<Deal[]>([]);
  const [searchStatus, setSearchStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: "", price: "", retailer: "amazon", productUrl: "", imageUrl: "" });

  async function runSearch(e?: React.FormEvent) {
    e?.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    setNotice(null);
    const res = await fetch("/api/deals/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: query.trim(), retailer: retailer || null }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setNotice(data.error ?? "Search failed.");
      return;
    }
    setDeals(data.deals);
    setSearchStatus(data.searchStatus);
  }

  async function buy(dealId: string) {
    setBuyingId(dealId);
    setNotice(null);
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealId }),
    });
    const data = await res.json();
    setBuyingId(null);
    if (!res.ok) {
      setNotice(data.error ?? "Could not place the order request.");
      return;
    }
    setNotice("Order approved. The background worker will process checkout — track it in the Orders tab.");
  }

  async function addDeal(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title.trim(),
        price: form.price,
        retailer: form.retailer,
        productUrl: form.productUrl.trim(),
        imageUrl: form.imageUrl.trim() || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setNotice(data.error ?? "Could not add the deal.");
      return;
    }
    setForm({ title: "", price: "", retailer: "amazon", productUrl: "", imageUrl: "" });
    setShowAdd(false);
    setNotice("Deal added.");
    if (query) runSearch();
  }

  useEffect(() => {
    // Load the latest available deals on first open.
    fetch("/api/deals")
      .then((r) => r.json())
      .then((d) => Array.isArray(d.deals) && setDeals(d.deals))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <form onSubmit={runSearch} className="flex flex-col sm:flex-row gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search deals, e.g. privacy screen protector iphone 15 pro"
          className={`${inputCls} flex-1`}
        />
        <select value={retailer} onChange={(e) => setRetailer(e.target.value)} className={inputCls + " sm:w-40"}>
          <option value="">All retailers</option>
          <option value="amazon">Amazon</option>
          <option value="walmart">Walmart</option>
          <option value="target">Target</option>
          <option value="costco">Costco</option>
        </select>
        <button type="submit" disabled={busy || !query.trim()} className={btnPrimary}>
          {busy ? "Searching…" : "Search"}
        </button>
      </form>

      {notice && (
        <div className="border rounded-lg px-4 py-3 text-sm bg-neutral-100">{notice}</div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="font-medium">
          Deals{searchStatus ? <span className="ml-2"><StatusBadge status={searchStatus} /></span> : null}
        </h2>
        <button onClick={() => setShowAdd((s) => !s)} className={btnSecondary}>
          {showAdd ? "Close" : "Add a deal"}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={addDeal} className="border rounded-xl p-4 space-y-3 bg-white">
          <p className="text-sm text-neutral-500">
            Paste a product you found yourself. Only genuinely available listings are shown.
          </p>
          <Field label="Title">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price (USD)">
              <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required inputMode="decimal" placeholder="19.99" className={inputCls} />
            </Field>
            <Field label="Retailer">
              <select value={form.retailer} onChange={(e) => setForm({ ...form, retailer: e.target.value })} className={inputCls}>
                <option value="amazon">Amazon</option>
                <option value="walmart">Walmart</option>
                <option value="target">Target</option>
                <option value="costco">Costco</option>
              </select>
            </Field>
          </div>
          <Field label="Product URL">
            <input value={form.productUrl} onChange={(e) => setForm({ ...form, productUrl: e.target.value })} required placeholder="https://…" className={inputCls} />
          </Field>
          <Field label="Image URL (optional)">
            <input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://…" className={inputCls} />
          </Field>
          <button type="submit" className={btnPrimary}>Save deal</button>
        </form>
      )}

      {deals.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No deals yet. Search above, or add a deal manually with the button.
        </p>
      ) : (
        <ul className="space-y-3">
          {deals.map((d) => (
            <li key={d.id} className="border rounded-xl p-4 bg-white flex gap-4">
              {d.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.imageUrl} alt="" className="w-20 h-20 object-cover rounded-lg shrink-0" />
              ) : (
                <div className="w-20 h-20 rounded-lg bg-neutral-100 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <a href={d.productUrl} target="_blank" rel="noreferrer" className="font-medium hover:underline line-clamp-2">
                  {d.title}
                </a>
                <div className="text-sm text-neutral-500 mt-1">
                  {retailerLabel(d.retailer)} · {fmtPrice(d.price, d.currency)}
                </div>
                <div className="mt-2">
                  <button
                    onClick={() => buy(d.id)}
                    disabled={buyingId === d.id}
                    className={btnPrimary}
                    title="Tapping Buy approves the purchase. The background worker checks out with your saved retailer login."
                  >
                    {buyingId === d.id ? "Approving…" : `Buy — ${fmtPrice(d.price, d.currency)}`}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
