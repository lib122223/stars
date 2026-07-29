export interface AchievementMember {
  slug: string;
  name: string;
  confirmed: boolean;
  confirmedAt: string | null;
  observations: number;
}

export interface AchievementSeries {
  slug: string;
  name: string;
  description: string;
  badgeKey: string;
  progress: number;
  total: number;
  completed: boolean;
  unlockedAt: string | null;
  members: AchievementMember[];
}

export interface AchievementCenterData {
  confirmedCount: number;
  uniqueTargetCount: number;
  completedSeriesCount: number;
  totalSeriesCount: number;
  account: { email: string } | null;
  series: AchievementSeries[];
}
