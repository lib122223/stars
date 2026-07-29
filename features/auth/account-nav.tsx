"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function AccountNav() {
  const pathname = usePathname();
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/me", { cache: "no-store", signal: controller.signal })
      .then((response) => response.json())
      .then((json) => setAuthenticated(json.code === 0 && json.data?.user != null))
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setAuthenticated(false);
      });
    return () => controller.abort();
  }, [pathname]);

  return (
    <Link
      href={authenticated ? "/account" : "/login"}
      className="text-sm text-white/60 transition-colors hover:text-white/90"
    >
      {authenticated ? "账户" : "登录"}
    </Link>
  );
}
