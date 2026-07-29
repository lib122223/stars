import type { AchievementMember } from "@/lib/achievements/types";

interface AchievementBadgeProps {
  badgeKey: string;
  name: string;
  members: AchievementMember[];
  completed: boolean;
  size?: "small" | "large";
}

interface BadgePattern {
  points: Array<[number, number]>;
  lines: Array<[number, number]>;
  primary: string;
  secondary: string;
}

const patterns: Record<string, BadgePattern> = {
  summer_triangle: {
    points: [[26, 82], [58, 22], [96, 80]],
    lines: [[0, 1], [1, 2], [2, 0]],
    primary: "#8de3f4",
    secondary: "#f2bf63",
  },
  northern_dipper: {
    points: [[16, 59], [34, 47], [53, 52], [66, 69], [79, 58], [94, 43], [107, 48]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]],
    primary: "#f3c66f",
    secondary: "#dce7ef",
  },
  orion: {
    points: [[29, 25], [90, 28], [39, 55], [59, 59], [79, 56], [31, 94], [91, 92]],
    lines: [[0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6], [0, 1]],
    primary: "#ef776c",
    secondary: "#86c7ee",
  },
  scorpius: {
    points: [[26, 24], [43, 35], [54, 51], [60, 69], [73, 84], [91, 84], [103, 68], [101, 49]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7]],
    primary: "#ef6b62",
    secondary: "#e7ad66",
  },
  cassiopeia: {
    points: [[16, 38], [37, 79], [59, 45], [82, 80], [105, 34]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4]],
    primary: "#c4a7ed",
    secondary: "#f0d17c",
  },
  winter_hexagon: {
    points: [[60, 15], [96, 38], [96, 80], [60, 104], [23, 82], [22, 39]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]],
    primary: "#a7dcf1",
    secondary: "#f0a968",
  },
};

export default function AchievementBadge({ badgeKey, name, members, completed, size = "large" }: AchievementBadgeProps) {
  const pattern = patterns[badgeKey] ?? patterns.summer_triangle;
  const pointStates = pattern.points.map((_, index) => members[index]?.confirmed ?? false);
  const dimensionClass = size === "small" ? "h-16 w-16" : "h-28 w-28 sm:h-32 sm:w-32";

  return (
    <svg
      viewBox="0 0 120 120"
      role="img"
      aria-label={`${name}${completed ? "徽章已获得" : "徽章尚未获得"}`}
      className={`${dimensionClass} shrink-0 ${completed ? "" : "opacity-65"}`}
    >
      <circle cx="60" cy="60" r="55" fill="#0b121a" stroke={completed ? pattern.primary : "#53606a"} strokeWidth="2" />
      <circle cx="60" cy="60" r="48" fill="#111b24" stroke={completed ? pattern.secondary : "#35404a"} strokeWidth="1" strokeDasharray={completed ? undefined : "3 5"} />
      {pattern.lines.map(([from, to]) => (
        <line
          key={`${from}-${to}`}
          x1={pattern.points[from][0]}
          y1={pattern.points[from][1]}
          x2={pattern.points[to][0]}
          y2={pattern.points[to][1]}
          stroke={pointStates[from] && pointStates[to] ? pattern.primary : "#42505b"}
          strokeWidth="1.5"
        />
      ))}
      {pattern.points.map(([x, y], index) => {
        const confirmed = pointStates[index];
        return (
          <g key={`${x}-${y}`}>
            {confirmed && <circle cx={x} cy={y} r="7" fill={pattern.primary} opacity="0.12" />}
            <circle
              cx={x}
              cy={y}
              r={confirmed ? 3.2 : 2.2}
              fill={confirmed ? (index === 0 ? pattern.secondary : pattern.primary) : "#64717b"}
            />
          </g>
        );
      })}
      {completed && <circle cx="60" cy="60" r="52" fill="none" stroke={pattern.secondary} strokeWidth="0.8" opacity="0.55" />}
    </svg>
  );
}
