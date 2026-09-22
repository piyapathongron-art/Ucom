"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, type ReactNode } from "react";

type NavLink = { href: string; label: string; icon: string; disabled?: boolean };
type NavBarProps = { links: NavLink[]; onLogout: () => Promise<void>; displayName: string; role: string };

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
  return <Link href="/pos" className="flex items-center gap-2.5 text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"><span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-base font-bold text-background">U</span><span className="text-base font-semibold tracking-tight">Ucom POS</span></Link>;
}

export default function NavBar({ links, onLogout, displayName, role }: NavBarProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || (href !== "/pos" && pathname.startsWith(`${href}/`));
  const close = () => dialogRef.current?.close();
  const navItems = (mobile = false) => links.map((link) => {
    const active = isActive(link.href);
    const className = `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${link.disabled ? "cursor-not-allowed text-ink-muted/40" : active ? "bg-[#2c2a38] text-white" : "text-ink-muted hover:bg-surface hover:text-ink"}`;
    const chipClass = `grid h-6 w-6 shrink-0 place-items-center rounded-lg ${active ? "bg-accent text-background" : "text-current"}`;
    const icon = <span className={chipClass}><NavIcon name={link.icon} /></span>;
    if (link.disabled) return <span key={link.href} aria-disabled="true" className={className}>{icon}{link.label}<span className="ml-auto text-[0.62rem]">เร็วๆ นี้</span></span>;
    return <Link key={link.href} href={link.href} onClick={mobile ? close : undefined} aria-current={active ? "page" : undefined} className={className}>{icon}{link.label}</Link>;
  });

  return <>
    <aside className="hidden min-h-dvh w-52 shrink-0 flex-col border-r border-border bg-sunken px-3 py-4 lg:flex"><Brand /><nav aria-label="เมนูหลัก" className="mt-9 flex flex-col gap-1">{navItems()}</nav><div className="mt-auto space-y-2 border-t border-border pt-3"><div className="rounded-lg bg-surface px-3 py-2.5"><p className="truncate text-sm font-medium text-ink">{displayName}</p><p className="mt-0.5 text-xs text-ink-muted">{role}</p></div><form action={onLogout}><button type="submit" className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-muted hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"><span aria-hidden="true">↪</span>ออกจากระบบ</button></form></div></aside>
    <header className="flex h-14 items-center justify-between border-b border-border bg-sunken px-4 lg:hidden"><Brand /><button type="button" onClick={() => dialogRef.current?.showModal()} aria-label="เปิดเมนู" className="rounded-lg border border-border p-2 text-ink"><svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" /></svg></button></header>
    <dialog ref={dialogRef} onClick={(event) => event.target === dialogRef.current && close()} className="m-0 ml-auto h-full max-h-full w-[min(20rem,86vw)] border-l border-border bg-sunken p-4 text-ink shadow-2xl backdrop:bg-black/60 open:flex open:flex-col"><div className="flex items-center justify-between border-b border-border pb-4"><Brand /><button type="button" onClick={close} aria-label="ปิดเมนู" className="rounded-lg border border-border px-2 py-1 text-ink-muted">×</button></div><nav aria-label="เมนูหลัก" className="mt-5 flex flex-col gap-1">{navItems(true)}</nav><div className="mt-auto border-t border-border pt-3"><p className="px-3 text-sm font-medium">{displayName}</p><p className="px-3 text-xs text-ink-muted">{role}</p><form action={onLogout} className="mt-3"><button type="submit" className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-ink-muted hover:bg-surface hover:text-ink">ออกจากระบบ</button></form></div></dialog>
  </>;
}
