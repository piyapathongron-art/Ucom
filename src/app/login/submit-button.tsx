"use client";

import { useFormStatus } from "react-dom";

// Disabled with a label while the sign-in request is in flight, so a slow network doesn't invite
// a second press.
export function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="h-12 w-full rounded-full bg-primary text-base font-bold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:bg-muted disabled:text-muted-foreground"
    >
      {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
    </button>
  );
}
