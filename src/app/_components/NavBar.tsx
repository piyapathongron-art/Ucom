"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, type ReactNode } from "react";

import type { NavLink } from "./navLinks";

type NavBarProps = { links: { main: NavLink[]; footer: NavLink[] }; onLogout: () => Promise<void>; displayName: string; role: string };

function NavIcon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    pos: <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2M10 21h.01M17 21h.01" />,
    stock: <><path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" /><path d="m3 8 9 5 9-5M12 13v8" /></>,
    repair: <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4 2.5-2.5Z" />,
    consignment: <><path d="M4 7h16v13H4z" /><path d="M8 7V5a4 4 0 0 1 8 0v2" /></>,
    topup: <><rect x="6" y="2" width="12" height="20" rx="1.5" /><path d="M11 19h2" /></>,
    expense: <><path d="M3 7h18v10H3z" /><circle cx="12" cy="12" r="3" /></>,
    report: <path d="M4 20V10m6 10V4m6 16v-7m4 7H2" />,
    ledger: <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6m-6 4h6" />,
    close: <path d="M12 3v9m6.4-5.4a9 9 0 1 1-12.8 0" />,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19 12h2M3 12h2m7-9v2m0 14v2m5-15.5-1.4 1.4M7.4 16.6 6 18m12 0-1.4-1.4M7.4 7.4 6 6" /></>,
    commission: <><circle cx="12" cy="8" r="3" /><path d="M5 21a7 7 0 0 1 14 0" /></>,
    logout: <><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 17l-5-5 5-5M5 12h11" /></>,
  };
  return (
    <svg aria-hidden="true" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      {paths[name]}
    </svg>
  );
}

function Brand({ role }: { role: string }) {
  return (
    <Link href="/pos" className="flex min-h-10 items-center gap-2.5 rounded-xl text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
      <span className="grid size-9 place-items-center rounded-md bg-primary text-lg font-bold text-primary-foreground">U</span>
      <span>
        <span className="block text-base leading-tight font-bold">Ucom</span>
        <span className="block text-xs text-muted-foreground">{role}</span>
      </span>
    </Link>
  );
}

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}

// ADR 0033 shell: a white rounded sidebar card from lg (1024px), a top bar with a drawer below it.
// navLinks.ts stays the single place that decides which links each role sees.
export default function NavBar({ links, onLogout, displayName, role }: NavBarProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || (href !== "/pos" && pathname.startsWith(`${href}/`));
  const close = () => dialogRef.current?.close();

  const item = "flex h-11 items-center gap-3 rounded-full px-3.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
  const renderLinks = (items: NavLink[], mobile: boolean) =>
    items.map((link) => {
      const active = isActive(link.href);
      return (
        <Link
          key={link.href}
          href={link.href}
          onClick={mobile ? close : undefined}
          aria-current={active ? "page" : undefined}
          className={`${item} ${active ? "bg-primary font-semibold text-primary-foreground" : "font-medium text-foreground hover:bg-muted"}`}
        >
          <NavIcon name={link.icon} />
          {link.label}
        </Link>
      );
    });

  const footer = (mobile: boolean) => (
    <div className="mt-auto flex flex-col gap-1 pt-2">
      <div className="mx-1 mb-1 border-t border-border" />
      {renderLinks(links.footer, mobile)}
      <div className="mt-2 flex items-center gap-2.5 px-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">{initials(displayName)}</span>
        <span className="min-w-0 text-sm">
          <span className="block truncate font-semibold text-foreground">{displayName}</span>
          <span className="block text-xs text-muted-foreground">{role}</span>
        </span>
      </div>
      <form action={onLogout}>
        <button type="submit" className={`${item} w-full font-medium text-muted-foreground hover:bg-muted hover:text-foreground`}>
          <NavIcon name="logout" />
          ออกจากระบบ
        </button>
      </form>
    </div>
  );

  return (
    <>
      <aside className="sticky top-4 hidden h-[calc(100dvh-2rem)] w-58 shrink-0 flex-col gap-1 overflow-y-auto rounded-xl bg-card px-3.5 py-5 shadow-card lg:flex">
        <div className="px-2 pb-4">
          <Brand role={role} />
        </div>
        <nav aria-label="เมนูหลัก" className="flex flex-col gap-1">
          {renderLinks(links.main, false)}
        </nav>
        {footer(false)}
      </aside>

      <header className="sticky top-0 z-20 flex h-16 items-center justify-between bg-card px-4 shadow-card lg:hidden">
        <Brand role={role} />
        <button
          type="button"
          onClick={() => dialogRef.current?.showModal()}
          aria-label="เปิดเมนู"
          className="grid size-11 place-items-center rounded-full bg-muted text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <svg aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </header>

      <dialog
        ref={dialogRef}
        aria-label="เมนูหลัก"
        onClick={(event) => event.target === dialogRef.current && close()}
        className="m-0 ml-auto h-full max-h-full w-[min(20rem,86vw)] rounded-l-xl bg-card px-3.5 py-5 text-foreground shadow-2xl backdrop:bg-black/50 open:flex open:flex-col"
      >
        <div className="flex items-center justify-between px-2 pb-4">
          <Brand role={role} />
          <button
            type="button"
            onClick={close}
            aria-label="ปิดเมนู"
            className="grid size-11 place-items-center rounded-full bg-muted text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <svg aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <nav aria-label="เมนูหลัก" className="flex flex-col gap-1">
          {renderLinks(links.main, true)}
        </nav>
        {footer(true)}
      </dialog>
    </>
  );
}
