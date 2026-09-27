"use client";

import { useEffect, useState } from "react";
import { Field, btnPrimary, btnSecondary, inputCls } from "./ui";

interface Address {
  id: string;
  label: string;
  fullName: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone: string | null;
  isDefault: boolean;
}

const EMPTY = { label: "Home", fullName: "", street: "", city: "", state: "", zip: "", country: "US", phone: "" };

export default function AddressesClient() {
  const [rows, setRows] = useState<Address[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/addresses");
    const data = await res.json();
    if (Array.isArray(data.addresses)) setRows(data.addresses);
  }

  useEffect(() => { load(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    const res = await fetch("/api/addresses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, phone: form.phone || null }),
    });
    const data = await res.json();
    if (!res.ok) {
      setNotice(data.error ?? "Could not save the address.");
      return;
    }
    setForm(EMPTY);
    setNotice("Address saved.");
    load();
  }

  async function setDefault(id: string) {
    const res = await fetch(`/api/addresses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    if (res.ok) load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this address?")) return;
    const res = await fetch(`/api/addresses/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <div className="space-y-6">
      {notice && <div className="border rounded-lg px-4 py-3 text-sm bg-neutral-100">{notice}</div>}
      {!rows.some((a) => a.isDefault) && rows.length > 0 && (
        <div className="text-sm text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
          Pick a default shipping address — Buy is blocked until one is set.
        </div>
      )}

      <div className="space-y-3">
        {rows.map((a) => (
          <div key={a.id} className="border rounded-xl p-4 bg-white">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium">
                  {a.label}
                  {a.isDefault && (
                    <span className="ml-2 text-xs bg-neutral-900 text-white rounded-full px-2 py-0.5">Default</span>
                  )}
                </div>
                <div className="text-sm text-neutral-600 mt-1">
                  {a.fullName}<br />
                  {a.street}<br />
                  {a.city}, {a.state} {a.zip} {a.country}
                  {a.phone && <><br />{a.phone}</>}
                </div>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                {!a.isDefault && (
                  <button onClick={() => setDefault(a.id)} className={btnSecondary}>Set default</button>
                )}
                <button onClick={() => remove(a.id)} className="text-sm text-red-600 hover:underline">
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-neutral-500">No addresses yet.</p>}
      </div>

      <form onSubmit={save} className="border rounded-xl p-4 space-y-3 bg-white">
        <h2 className="font-medium">Add address</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Label"><input value={form.label} onChange={set("label")} required className={inputCls} /></Field>
          <Field label="Full name"><input value={form.fullName} onChange={set("fullName")} required className={inputCls} /></Field>
        </div>
        <Field label="Street"><input value={form.street} onChange={set("street")} required className={inputCls} /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="City"><input value={form.city} onChange={set("city")} required className={inputCls} /></Field>
          <Field label="State"><input value={form.state} onChange={set("state")} required className={inputCls} /></Field>
          <Field label="ZIP"><input value={form.zip} onChange={set("zip")} required className={inputCls} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Country"><input value={form.country} onChange={set("country")} required className={inputCls} /></Field>
          <Field label="Phone (optional)"><input value={form.phone} onChange={set("phone")} className={inputCls} /></Field>
        </div>
        <button type="submit" className={btnPrimary}>Save address</button>
      </form>
    </div>
  );
}
