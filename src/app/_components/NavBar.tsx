"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";

interface NavLink {
  href: string;
  label: string;
}

interface NavBarProps {
  links: NavLink[];
  onLogout: () => Promise<void>;
}

export default function NavBar({ links, onLogout }: NavBarProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();

  const handleClose = () => {
    dialogRef.current?.close();
  };

  return (
    <>
      <header className="ucom-header-wash border-b border-border px-4 py-3 shadow-[0_1px_0_rgba(20,22,31,0.02)]">
        {/* Desktop Navigation (md and above) */}
        <nav className="mx-auto hidden max-w-[1440px] items-center gap-2 md:flex md:gap-4">
          <Link
            href="/"
            className="mr-2 shrink-0 text-base font-semibold tracking-tight text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink md:mr-5 md:text-lg"
          >
            Ucom <span className="font-mono text-xs font-medium text-ink-muted">POS</span>
          </Link>
          <div className="hidden items-center gap-4 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={pathname === l.href ? "page" : undefined}
              className={`border-b-2 py-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink ${
                pathname === l.href
                  ? "border-accent text-accent"
                  : "border-transparent text-ink-muted hover:border-border hover:text-ink"
              }`}
            >
              {l.label}
            </Link>
          ))}
          </div>
          <form action={onLogout} className="ml-auto">
            <button
              type="submit"
              className="text-sm font-medium text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
            >
              ออกจากระบบ
            </button>
          </form>
        </nav>

        {/* Mobile Navigation Bar (below md) */}
        <div className="mx-auto flex max-w-[1440px] items-center justify-between md:hidden">
          <button
            type="button"
            onClick={() => dialogRef.current?.showModal()}
            aria-label="เปิดเมนู"
            className="rounded border border-border p-2 text-ink transition-colors hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <form action={onLogout}>
            <button
              type="submit"
              className="text-sm font-medium text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
            >
              ออกจากระบบ
            </button>
          </form>
        </div>
      </header>

      {/* Mobile Drawer using HTML <dialog> */}
      <dialog
        ref={dialogRef}
        onClick={(e) => {
          if (e.target === dialogRef.current) {
            handleClose();
          }
        }}
        style={{
          margin: 0,
          marginInlineStart: "auto",
          height: "100%",
          maxHeight: "100%",
          width: "80vw",
          maxWidth: "20rem",
        }}
        className="border-border bg-surface p-5 text-ink shadow-xl backdrop:bg-black/40 open:flex open:flex-col"
      >
        <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
          <span className="text-base font-semibold tracking-tight text-ink">เมนู</span>
          <button
            type="button"
            onClick={handleClose}
            aria-label="ปิดเมนู"
            className="rounded border border-border p-2 text-ink-muted transition-colors hover:border-ink hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <nav className="flex flex-col gap-1">
          {links.map((l) => {
            if (l.href === "/pos") {
              return (
                <div
                  key={l.href}
                  className="flex select-none items-center justify-between border-b border-dashed border-border py-3 text-ink-muted opacity-50"
                >
                  <span className="font-medium text-base">{l.label}</span>
                  <span className="text-xs">(ใช้จอกว้าง)</span>
                </div>
              );
            }

            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={handleClose}
                aria-current={pathname === l.href ? "page" : undefined}
                className={`border-b border-border py-3 text-base font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink ${
                  pathname === l.href ? "text-ink" : "text-ink-muted hover:text-ink"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-border pt-4">
          <form action={onLogout}>
            <button
              type="submit"
              className="w-full py-3 text-left text-base font-medium text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
            >
              ออกจากระบบ
            </button>
          </form>
        </div>
      </dialog>
    </>
  );
}
