import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ordering and Returns",
  description: "Deals, in-app buying, and returns in one place.",
};

const TABS = [
  { href: "/deals", label: "Deals" },
  { href: "/orders", label: "Orders" },
  { href: "/returns", label: "Returns" },
  { href: "/requests", label: "Requests" },
  { href: "/addresses", label: "Addresses" },
  { href: "/retailers", label: "Retailers" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="border-b bg-white">
            <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between">
              <Link href="/deals" className="font-semibold text-lg">
                Ordering &amp; Returns
              </Link>
              <form action="/api/auth/logout" method="post">
                <button
                  type="submit"
                  className="text-sm text-neutral-500 hover:text-neutral-800"
                >
                  Sign out
                </button>
              </form>
            </div>
            <nav className="mx-auto max-w-3xl px-4 pb-3 flex gap-1 overflow-x-auto">
              {TABS.map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  className="px-3 py-1.5 rounded-full text-sm bg-neutral-100 hover:bg-neutral-200 whitespace-nowrap"
                >
                  {t.label}
                </Link>
              ))}
            </nav>
          </header>
          <main className="mx-auto max-w-3xl w-full px-4 py-6 flex-1">{children}</main>
          <footer className="border-t py-4 text-center text-xs text-neutral-400">
            Nothing is charged without your explicit Buy approval.
          </footer>
        </div>
      </body>
    </html>
  );
}
