"use client";

import { useEffect, useState } from "react";
import { Field, StatusBadge, btnPrimary, inputCls } from "./ui";

interface Req {
  id: string;
  title: string;
  details: string | null;
  status: string;
  createdAt: string;
}

export default function RequestsClient() {
  const [rows, setRows] = useState<Req[]>([]);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/requests");
    const data = await res.json();
    if (Array.isArray(data.requests)) setRows(data.requests);
  }

  useEffect(() => { load(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), details: details.trim() || null }),
    });
    const data = await res.json();
    if (!res.ok) {
      setNotice(data.error ?? "Could not save the request.");
      return;
    }
    setTitle("");
    setDetails("");
    load();
  }

  async function toggle(r: Req) {
    const res = await fetch(`/api/requests/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: r.status === "pending" ? "done" : "pending" }),
    });
    if (res.ok) load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this request?")) return;
    const res = await fetch(`/api/requests/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  return (
    <div className="space-y-6">
      {notice && <div className="border rounded-lg px-4 py-3 text-sm bg-neutral-100">{notice}</div>}

      <form onSubmit={save} className="border rounded-xl p-4 space-y-3 bg-white">
        <h2 className="font-medium">New request</h2>
        <Field label="What are you looking for?">
          <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. Privacy screen protector for iPhone 15 Pro" className={inputCls} />
        </Field>
        <Field label="Details (optional)">
          <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} placeholder="Size, color, budget…" className={inputCls} />
        </Field>
        <button type="submit" className={btnPrimary}>Save request</button>
      </form>

      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.id} className="border rounded-xl p-4 bg-white">
            <div className="flex items-start justify-between gap-2">
              <div className="font-medium">{r.title}</div>
              <StatusBadge status={r.status} />
            </div>
            {r.details && <div className="text-sm text-neutral-600 mt-1 whitespace-pre-wrap">{r.details}</div>}
            <div className="mt-2 flex gap-3">
              <button onClick={() => toggle(r)} className="text-sm text-neutral-600 hover:underline">
                {r.status === "pending" ? "Mark done" : "Reopen"}
              </button>
              <button onClick={() => remove(r.id)} className="text-sm text-red-600 hover:underline">
                Delete
              </button>
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-neutral-500">No requests yet.</p>}
      </div>
    </div>
  );
}
