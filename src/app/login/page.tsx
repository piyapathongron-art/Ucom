import LoginForm from "./login-form";

export default function LoginPage({ searchParams }: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  return <LoginForm searchParams={searchParams} />;
}
