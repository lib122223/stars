"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface MeteorEvent {
  slug: string;
  nameZh: string;
  nameEn: string;
  peakDate: string;
  zhr: number;
  activeStart: string;
  activeEnd: string;
  recommendedTime: string;
}

function fmtActive(start: string, end: string): string {
  const [sm, sd] = start.split("-");
  const [em, ed] = end.split("-");
  return `${parseInt(sm)}/${parseInt(sd)}–${parseInt(em)}/${parseInt(ed)}`;
}

function zhrLabel(zhr: number): string {
  if (zhr >= 100) return "强";
  if (zhr >= 50) return "中等";
  return "较弱";
}

export default function EventsPage() {
  const [events, setEvents] = useState<MeteorEvent[] | null>(null);

  useEffect(() => {
    fetch("/api/tools/upcoming-events")
      .then((r) => r.json())
      .then((json) => {
        if (json.code === 0 && json.data?.events) {
          setEvents(json.data.events);
        } else {
          setEvents([]);
        }
      })
      .catch(() => setEvents([]));
  }, []);

  return (
    <div className="mx-auto min-h-[calc(100vh-3rem)] max-w-xl px-4 py-12">
      <div className="mb-8">
        <p className="text-accent/40 text-xs tracking-wider uppercase">
          天象日历
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-white">
          未来一年可计划天象
        </h1>
        <p className="mt-1 text-sm text-white/30">
          以流星雨为主的观测计划参考，按峰值日期排序
        </p>
      </div>

      {events === null && (
        <div className="text-sm text-white/20">加载中...</div>
      )}

      {events !== null && events.length === 0 && (
        <div className="rounded-xl bg-surface/60 p-8 text-center text-sm text-white/25">
          暂无近期天象数据
        </div>
      )}

      {events !== null && events.length > 0 && (
        <div className="space-y-2">
          {events.map((e) => (
            <div
              key={e.slug}
              className="rounded-lg bg-surface/40 px-4 py-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/80">{e.nameZh}</p>
                  <p className="text-xs text-white/25">{e.nameEn}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-white/50">
                    {new Date(e.peakDate).toLocaleDateString("zh-CN", {
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                  <p className="text-[10px] text-white/30">{zhrLabel(e.zhr)}</p>
                </div>
              </div>
              <p className="mt-1 text-[11px] text-white/20">
                活跃期 {fmtActive(e.activeStart, e.activeEnd)}
                {" · "}推荐时段 {e.recommendedTime}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 flex justify-center">
        <Link
          href="/tools"
          className="inline-flex items-center rounded-lg bg-white/[0.06] px-4 py-2 text-xs text-white/35 transition-colors hover:bg-white/[0.10] hover:text-white/55"
        >
          返回工具页
        </Link>
      </div>
    </div>
  );
}
