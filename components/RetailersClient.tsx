"use client";

import { useEffect, useState } from "react";
import { Field, StatusBadge, btnPrimary, btnSecondary, inputCls, retailerLabel } from "./ui";

interface Connection {
  id: string;
  retailer: string;
  usernameMasked: string;
  status: string;
  lastCheckedAt: string | null;
}

const LOGIN_RETAILERS = ["amazon", "walmart", "target"];
const DISPLAY_RETAILERS = ["amazon", "walmart", "target", "costco"];

export default function RetailersClient() {
  const [rows, setRows] = useState<Connection[]>([]);
  const [retailer, setRetailer] = useState("amazon");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/retailers");
    const data = await res.json();
    if (Array.isArray(data.connections)) setRows(data.connections);
  }

  useEffect(() => { load(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    const res = await fetch("/api/retailers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ retailer, username: username.trim(), password }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setNotice(data.error ?? "Could not save the login.");
      return;
    }
    setUsername("");
    setPassword("");
    setNotice(`${retailerLabel(retailer)} login saved (encrypted).`);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Remove this retailer login?")) return;
    const res = await fetch(`/api/retailers/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  return (
    <div className="space-y-6">
      {notice && <div className="border rounded-lg px-4 py-3 text-sm bg-neutral-100">{notice}</div>}

      <div className="space-y-3">
        {DISPLAY_RETAILERS.map((r) => {
          const conn = rows.find((c) => c.retailer === r);
          const loginAvailable = LOGIN_RETAILERS.includes(r);
          return (
            <div key={r} className="border rounded-xl p-4 bg-white flex items-center justify-between">
              <div>
                <div className="font-medium">{retailerLabel(r)}</div>
                {conn ? (
                  <div className="text-sm text-neutral-500 mt-1 flex items-center gap-2">
                    <span className="font-mono">{conn.usernameMasked}</span>
                    <StatusBadge status={conn.status} />
                  </div>
                ) : loginAvailable ? (
                  <div className="text-sm text-neutral-400 mt-1">Not connected</div>
                ) : (
                  <div className="text-sm text-neutral-400 mt-1">Login not available yet</div>
                )}
              </div>
              {conn && (
                <button onClick={() => remove(conn.id)} className={btnSecondary}>Remove</button>
              )}
            </div>
          );
        })}
      </div>

      <form onSubmit={save} className="border rounded-xl p-4 space-y-3 bg-white">
        <h2 className="font-medium">Add or update login</h2>
        <p className="text-sm text-neutral-500">
          Stored encrypted. Only a masked username is ever shown. Used only for checkouts and returns you approve.
        </p>
        <Field label="Retailer">
          <select value={retailer} onChange={(e) => setRetailer(e.target.value)} className={inputCls}>
            {LOGIN_RETAILERS.map((r) => (
              <option key={r} value={r}>{retailerLabel(r)}</option>
            ))}
          </select>
        </Field>
        <Field label="Username / email">
          <input value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="username" className={inputCls} />
        </Field>
        <Field label="Password">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" className={inputCls} />
        </Field>
        <button type="submit" disabled={busy} className={btnPrimary}>
          {busy ? "Saving…" : "Save login"}
        </button>
      </form>
    </div>
  );
}
