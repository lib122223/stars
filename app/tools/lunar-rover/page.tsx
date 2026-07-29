import type { Metadata } from "next";
import { Suspense } from "react";
import LunarRoverGame from "@/features/tools/lunar-rover-game";

export const metadata: Metadata = {
  title: "月球车任务 Demo | Echo of Photons",
  description: "驾驶月球车采集月壤、返回基地并建造第一个种植舱",
};

export default function LunarRoverPage() {
  return (
    <Suspense fallback={<div className="min-h-[calc(100vh-3rem)] bg-black" />}>
      <LunarRoverGame />
    </Suspense>
  );
}
