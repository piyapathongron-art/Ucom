"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, type ReactNode } from "react";

import type { NavLink } from "./navLinks";

type NavBarProps = { links: { main: NavLink[]; footer: NavLink[] }; onLogout: () => Promise<void>; displayName: string; role: string };

function NavIcon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    pos: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h8M8 11h8M8 15h3" /></>,
    stock: <><path d="m4 8 8-4 8 4-8 4-8-4Z" /><path d="M4 8v8l8 4 8-4V8M12 12v8" /></>,
    repair: <path d="m14.7 6.3 3-3a4 4 0 0 0-5.1 5.1l-7.3 7.3a2 2 0 0 0 2.8 2.8l7.3-7.3a4 4 0 0 0 5.1-5.1l-3 3-2.8-2.8Z" />,
    close: <><path d="M5 3h11l3 4v14H5V3Z" /><path d="M8 3v6h8V3M8 17h8" /></>,
    commission: <><circle cx="12" cy="8" r="3" /><path d="M5 21a7 7 0 0 1 14 0M18 11a3 3 0 0 1 0-6M19 21a5 5 0 0 0-3-4.6" /></>,
    topup: <><path d="M4 7h16v10H4z" /><path d="M8 12h8M12 9v6" /></>,
    consignment: <><path d="M3 7h18v13H3zM6 7V4h12v3" /><path d="M8 12h8" /></>,
    report: <><path d="M5 20V10M12 20V4M19 20v-7" /><path d="M3 20h18" /></>,
    expense: <><path d="M4 5h16v14H4z" /><path d="M8 10h8M8 14h5" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-4v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-2.8-2.8.1-.1A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.5-1H3v-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1L7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.5V3h4v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1v4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>,
  };
  return <svg aria-hidden="true" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">{paths[name]}</svg>;
}

function Brand() {
  return <Link href="/pos" className="flex items-center gap-3 text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-ink text-base font-bold text-white">U</span><span><span className="block text-[15px] font-bold leading-tight">Ucom POS</span><span className="block text-[11.5px] text-ink-muted">POS ร้านมือถือ</span></span></Link>;
}

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}

export default function NavBar({ links, onLogout, displayName, role }: NavBarProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || (href !== "/pos" && pathname.startsWith(`${href}/`));
  const close = () => dialogRef.current?.close();
  const renderLinks = (items: NavLink[], mobile: boolean) => items.map((link) => {
    const active = isActive(link.href);
    const className = `flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-colors ${active ? "bg-brand-ink text-white" : "text-ink-muted hover:bg-surface hover:text-ink"}`;
    const chipClass = `grid h-7 w-7 shrink-0 place-items-center rounded-lg ${active ? "bg-accent text-on-accent" : "text-current"}`;
    return <Link key={link.href} href={link.href} onClick={mobile ? close : undefined} aria-current={active ? "page" : undefined} className={className}><span className={chipClass}><NavIcon name={link.icon} /></span>{link.label}</Link>;
  });
  const bottom = (mobile: boolean) => <div className="mt-auto space-y-2 pt-3">
    <div className="flex flex-col gap-1 border-t border-dashed border-border-strong pt-3">{renderLinks(links.footer, mobile)}</div>
    <div className="flex items-center gap-3 rounded-2xl bg-surface px-3 py-2.5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-on-accent">{initials(displayName)}</span><span className="min-w-0"><span className="block truncate text-sm font-semibold text-ink">{displayName}</span><span className="block text-xs text-ink-muted">{role}</span></span></div>
    <form action={onLogout}><button type="submit" className="w-full rounded-2xl px-3 py-2.5 text-left text-sm font-semibold text-ink-muted hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">ออกจากระบบ</button></form>
  </div>;

  return <>
    <aside className="hidden min-h-dvh w-60 shrink-0 flex-col bg-sunken px-4 py-5 lg:flex"><Brand /><nav aria-label="เมนูหลัก" className="mt-8 flex flex-col gap-1">{renderLinks(links.main, false)}</nav>{bottom(false)}</aside>
    <header className="flex h-14 items-center justify-between bg-sunken px-4 lg:hidden"><Brand /><button type="button" onClick={() => dialogRef.current?.showModal()} aria-label="เปิดเมนู" className="rounded-xl bg-surface p-2 text-ink"><svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" /></svg></button></header>
    <dialog ref={dialogRef} onClick={(event) => event.target === dialogRef.current && close()} className="m-0 ml-auto h-full max-h-full w-[min(20rem,86vw)] bg-sunken p-4 text-ink shadow-2xl backdrop:bg-black/60 open:flex open:flex-col"><div className="flex items-center justify-between pb-4"><Brand /><button type="button" onClick={close} aria-label="ปิดเมนู" className="rounded-xl bg-surface px-2 py-1 text-ink-muted">×</button></div><nav aria-label="เมนูหลัก" className="mt-2 flex flex-col gap-1">{renderLinks(links.main, true)}</nav>{bottom(true)}</dialog>
  </>;
}
