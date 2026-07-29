import Link from "next/link";
import { redirect } from "next/navigation";
import LogoutButton from "@/features/auth/logout-button";
import { getCurrentUser } from "@/lib/auth/session";

export default async function AccountPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/login");

  return (
    <div className="mx-auto min-h-[calc(100vh-3rem)] max-w-3xl px-4 py-10 sm:py-14">
      <p className="text-xs uppercase tracking-[0.22em] text-accent/55">账户</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white/90">个人观测档案</h1>

      <section className="mt-7 border-y border-white/8 py-5">
        <dl className="space-y-4 text-sm">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <dt className="text-white/35">登录邮箱</dt>
            <dd className="text-white/75">{user.email}</dd>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <dt className="text-white/35">账号创建时间</dt>
            <dd className="text-white/55">{new Date(user.createdAt).toLocaleDateString("zh-CN")}</dd>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <dt className="text-white/35">观测记录</dt>
            <dd><Link href="/observations" className="text-accent/75 hover:text-accent">查看已同步记录</Link></dd>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <dt className="text-white/35">观测成就</dt>
            <dd><Link href="/achievements" className="text-accent/75 hover:text-accent">查看任务和徽章</Link></dd>
          </div>
        </dl>
      </section>

      <div className="mt-6">
        <LogoutButton />
      </div>
    </div>
  );
}
