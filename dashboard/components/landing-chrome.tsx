"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronUp } from "lucide-react";
import { useAuth } from "@/lib/auth";
import "@/app/landing.css";
import "@/app/marketing.css";

/* Shared chrome for the public/marketing pages. All styling lives in
   app/landing.css — no Tailwind utilities, per the design spec. */

export const NAV_LINKS = [
  { label: "Product", href: "/product" },
  { label: "Pricing", href: "/pricing" },
  { label: "FAQs", href: "/faq" },
  { label: "Get in Touch", href: "/contact" },
  { label: "Docs", href: "https://github.com/RickyVishwakarma/sentinel" },
];

function Navbar({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  return (
    <nav className="snl-nav">
      <div className="snl-nav-inner">
        <Link href="/" className="snl-logo">
          Sentinel<sup>®</sup>
        </Link>
        <button
          className={`snl-menu-btn${open ? " is-open" : ""}`}
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? "Close" : "Menu"}
          <ChevronUp size={16} className="snl-chev" />
        </button>
      </div>
    </nav>
  );
}

function Drawer({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const { session } = useAuth();
  return (
    <div className={`snl-drawer${open ? " is-open" : ""}`}>
      <div className="snl-drawer-links">
        {NAV_LINKS.map((l) =>
          l.href.startsWith("http") ? (
            <a key={l.label} href={l.href} target="_blank" rel="noreferrer">
              {l.label}
            </a>
          ) : (
            <Link key={l.label} href={l.href} onClick={() => setOpen(false)}>
              {l.label}
            </Link>
          ),
        )}
        <Link href={session ? "/overview" : "/login"} onClick={() => setOpen(false)}>
          {session ? "Dashboard" : "Sign in"}
        </Link>
      </div>
      <div className="snl-drawer-footer">
        <span>© 2026 Sentinel</span>
        <span>Action governance for AI agents</span>
      </div>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="snl-footer">
      <div className="snl-footer-inner">
        <Link href="/" className="snl-logo snl-footer-logo">
          Sentinel<sup>®</sup>
        </Link>
        <div className="snl-footer-links">
          {NAV_LINKS.map((l) =>
            l.href.startsWith("http") ? (
              <a key={l.label} href={l.href} target="_blank" rel="noreferrer">
                {l.label}
              </a>
            ) : (
              <Link key={l.label} href={l.href}>
                {l.label}
              </Link>
            ),
          )}
        </div>
        <span className="snl-footer-copy">© 2026 Sentinel — action governance for AI agents</span>
      </div>
    </footer>
  );
}

/** Wraps a public page in the landing shell (nav + drawer + footer). */
export function LandingShell({
  children,
  footer = true,
}: {
  children: React.ReactNode;
  footer?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="snl">
      <Navbar open={open} setOpen={setOpen} />
      <Drawer open={open} setOpen={setOpen} />
      {children}
      {footer && <SiteFooter />}
    </div>
  );
}
