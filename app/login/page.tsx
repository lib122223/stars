import { redirect } from "next/navigation";
import AuthForm from "@/features/auth/auth-form";
import { getCurrentUser } from "@/lib/auth/session";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const user = await getCurrentUser().catch(() => null);
  if (user) redirect("/account");
  const { mode } = await searchParams;

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl items-start justify-center px-4 py-12 sm:py-20">
      <section className="w-full max-w-sm">
        <p className="text-xs uppercase tracking-[0.22em] text-accent/55">个人观测档案</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white/90">
          {mode === "register" ? "创建账号" : "登录账号"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-white/38">让观测记录在不同设备之间保持同步。</p>
        <div className="mt-7 rounded-lg border border-white/8 bg-surface/45 p-5 sm:p-6">
          <AuthForm initialMode={mode === "register" ? "register" : "login"} />
        </div>
      </section>
    </div>
  );
}
