import { createClient } from "@/lib/supabase/server";
import { validLiffId } from "@/lib/line/liff";
import LoginForm from "@/app/login/login-form";
import CashContent from "@/app/(staff)/cash/cash-content";
import LiffShell from "./liff-shell";

export default async function LiffDepositPage({ searchParams }: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await searchParams;
  const isLocalLab = process.env.NODE_ENV === "development" && process.env.UCOM_LOCAL_CASH_LAB === "1";
  return (
    <LiffShell liffId={validLiffId(process.env.LINE_LIFF_ID)} sdkUrl={isLocalLab
      ? "http://localhost:55441/liff-sdk.js"
      : "https://static.line-scdn.net/liff/edge/2/sdk.js"}>
      {user ? <CashContent isCompact searchParams={Promise.resolve({})} />
        : <LoginForm appearance="phone" searchParams={Promise.resolve({ error, next: "/liff/deposit" })} />}
    </LiffShell>
  );
}
