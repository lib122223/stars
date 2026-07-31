"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { searchObjects } from "./search-data";
import { withTimeContext, type TimeContextKey } from "@/lib/time-context";
import type { AstronomyCatalog } from "@/lib/astronomy/catalog-types";

const typeLabel: Record<string, string> = {
  star: "恒星",
  planet: "行星",
  bright_star: "亮星",
  constellation: "星座",
  galaxy: "星系",
  nebula: "星云",
  open_cluster: "疏散星团",
  globular_cluster: "球状星团",
};

interface SearchBarProps {
  timeContext: TimeContextKey;
  mode?: "2d" | "observe" | "ar";
  catalog?: AstronomyCatalog;
}

function SearchIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="text-white/35"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export default function SearchBar({ timeContext, mode = "2d", catalog }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const router = useRouter();

  const results = searchObjects(query, 5, catalog);
  const showResults = focused && query.trim().length >= 1;

  function handleSelect(slug: string) {
    const url = withTimeContext(
      `/sky-map?target=${slug}&source=search&mode=${mode}`,
      timeContext,
    );
    router.push(url);
  }

  return (
    <div className="relative">
      {/* 搜索框 — 轻量但可发现 */}
      <div
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 transition-colors ${
          focused
            ? "border-white/15 bg-surface/90"
            : "border-white/10 bg-surface/50 hover:border-white/15 hover:bg-surface/70"
        }`}
      >
        <SearchIcon />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="搜索天体或星座"
          className="w-20 bg-transparent text-xs text-white/65 placeholder:text-white/20 outline-none sm:w-40"
        />
      </div>

      {showResults && (
        <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-white/5 bg-surface/95 backdrop-blur-sm shadow-lg z-30 py-1">
          {results.length > 0 ? (
            results.map((r) => (
              <button
                key={r.slug}
                className="w-full flex items-center justify-between px-3 py-1.5 text-left transition-colors hover:bg-white/[0.06]"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(r.slug)}
              >
                <span className="text-xs text-white/70">{r.nameZh}</span>
                <span className="text-[10px] text-white/20">
                  {typeLabel[r.objectType] ?? r.objectType}
                </span>
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-[10px] text-white/15 text-center">
              没找到可定位对象
            </p>
          )}
        </div>
      )}
    </div>
  );
}
