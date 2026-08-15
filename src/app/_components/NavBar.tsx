"use client";

import Link from "next/link";
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

  const handleClose = () => {
    dialogRef.current?.close();
  };

  return (
    <>
      <header className="border-b border-border bg-surface px-4 py-3">
        {/* Desktop Navigation (md and above) */}
        <nav className="hidden items-center gap-4 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-ink-muted hover:text-ink font-medium text-sm transition-colors"
            >
              {l.label}
            </Link>
          ))}
          <form action={onLogout} className="ml-auto">
            <button
              type="submit"
              className="text-ink-muted hover:text-ink text-sm font-medium transition-colors"
            >
              ออกจากระบบ
            </button>
          </form>
        </nav>

        {/* Mobile Navigation Bar (below md) */}
        <div className="flex items-center justify-between md:hidden">
          <button
            type="button"
            onClick={() => dialogRef.current?.showModal()}
            aria-label="เปิดเมนู"
            className="text-ink hover:text-ink-muted p-1 transition-colors"
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
              className="text-ink-muted hover:text-ink text-sm font-medium transition-colors"
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
        className="bg-surface text-ink border-border backdrop:bg-black/40 open:flex open:flex-col border-l p-5 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
          <span className="font-bold text-ink text-base">เมนู</span>
          <button
            type="button"
            onClick={handleClose}
            aria-label="ปิดเมนู"
            className="text-ink-muted hover:text-ink p-1 transition-colors"
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
                  className="flex items-center justify-between py-2 text-ink-muted opacity-50 select-none"
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
                className="text-ink-muted hover:text-ink py-2 font-medium text-base transition-colors"
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
              className="text-ink-muted hover:text-ink w-full py-2 text-left font-medium text-base transition-colors"
            >
              ออกจากระบบ
            </button>
          </form>
        </div>
      </dialog>
    </>
  );
}
