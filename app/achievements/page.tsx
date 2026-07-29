import type { Metadata } from "next";
import AchievementCenter from "@/features/achievements/achievement-center";

export const metadata: Metadata = {
  title: "观测成就 | Echo of Photons",
  description: "查看星空识别任务、系列进度和已获得的观测徽章",
};

export default function AchievementsPage() {
  return <AchievementCenter />;
}
