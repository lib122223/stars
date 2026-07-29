"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Mode = "login" | "register";

function PasswordToggle({ visible, onToggle, label }: { visible: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-white/35 transition-colors hover:text-white/70"
      aria-label={visible ? `隐藏${label}` : `显示${label}`}
      title={visible ? `隐藏${label}` : `显示${label}`}
    >
      <span aria-hidden="true" className="text-[11px]">{visible ? "隐藏" : "显示"}</span>
    </button>
  );
}

export default function AuthForm({ initialMode = "login" }: { initialMode?: Mode }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setMessage("");
    setPassword("");
    setPasswordConfirm("");
    setShowPassword(false);
    setShowPasswordConfirm(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (mode === "register" && password !== passwordConfirm) {
      setMessage("两次输入的密码不一致");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      let json: { code?: number; message?: string; data?: { claimedRecords?: number } } | null = null;
      try {
        json = await response.json();
      } catch {
        setMessage(response.status >= 500
          ? "账号服务异常，请检查服务端数据库连接和环境变量"
          : "账号服务返回了无效响应，请稍后重试");
        return;
      }
      if (!response.ok || json?.code !== 0) {
        setMessage(json?.message || "操作失败，请稍后重试");
        return;
      }

      const claimedRecords = Number(json.data?.claimedRecords ?? 0);
      if (claimedRecords > 0) {
        window.sessionStorage.setItem("auth_message", `已将当前浏览器的 ${claimedRecords} 条记录同步到账户`);
      }
      router.push("/observations");
      router.refresh();
    } catch {
      setMessage("账号服务暂时无法连接");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="grid grid-cols-2 border-b border-white/10" role="tablist" aria-label="账号操作">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "login"}
          onClick={() => switchMode("login")}
          className={`border-b-2 px-3 py-3 text-sm transition-colors ${mode === "login" ? "border-accent text-white/85" : "border-transparent text-white/35 hover:text-white/55"}`}
        >
          登录
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "register"}
          onClick={() => switchMode("register")}
          className={`border-b-2 px-3 py-3 text-sm transition-colors ${mode === "register" ? "border-accent text-white/85" : "border-transparent text-white/35 hover:text-white/55"}`}
        >
          注册
        </button>
      </div>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <label className="block" htmlFor="account-email">
          <span className="text-xs text-white/45">邮箱</span>
          <input
            id="account-email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="input-field mt-1.5"
            placeholder="name@example.com"
          />
        </label>

        <label className="block" htmlFor="account-password">
          <span className="text-xs text-white/45">密码</span>
          <div className="relative mt-1.5">
            <input
              id="account-password"
              type={showPassword ? "text" : "password"}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              required
              minLength={8}
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="input-field pr-11"
              placeholder={mode === "register" ? "至少 8 个字符" : "输入密码"}
            />
            <PasswordToggle visible={showPassword} onToggle={() => setShowPassword((value) => !value)} label="密码" />
          </div>
        </label>

        {mode === "register" && (
          <label className="block" htmlFor="account-password-confirm">
            <span className="text-xs text-white/45">确认密码</span>
            <div className="relative mt-1.5">
              <input
                id="account-password-confirm"
                type={showPasswordConfirm ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
                value={passwordConfirm}
                onChange={(event) => setPasswordConfirm(event.target.value)}
                className="input-field pr-11"
                placeholder="再次输入密码"
              />
              <PasswordToggle visible={showPasswordConfirm} onToggle={() => setShowPasswordConfirm((value) => !value)} label="确认密码" />
            </div>
          </label>
        )}

        {message && (
          <p className="text-xs leading-relaxed text-amber-100/65" role="alert">{message}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-accent/18 px-4 py-2.5 text-sm font-medium text-accent transition-colors hover:bg-accent/26 disabled:cursor-wait disabled:opacity-50"
        >
          {submitting ? "处理中…" : mode === "register" ? "创建账号并同步记录" : "登录"}
        </button>
      </form>

      <p className="mt-5 text-center text-[11px] leading-relaxed text-white/22">
        注册后，当前浏览器已有的匿名观测记录会自动归入该账号。
      </p>
    </div>
  );
}
