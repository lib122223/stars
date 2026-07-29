"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => void logout()}
      className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/55 transition-colors hover:bg-white/[0.08] hover:text-white/75 disabled:opacity-40"
    >
      {pending ? "正在退出…" : "退出登录"}
    </button>
  );
}
