import sharp from "sharp";
import { nightLightTileAt } from "./astronomy/sky-visibility";

export interface LightPollutionEstimate {
  available: boolean;
  darknessScore: number;
  lightLevel: number | null;
  label: string;
  summary: string;
  source: string;
  sourceYear: number | null;
}

interface RawTile {
  data: Buffer;
  width: number;
  height: number;
}

const ZOOM = 8;
const TILE_SIZE = 256;
const SAMPLE_RADIUS = 8;
const SOURCE = "NASA GIBS · VIIRS Night Lights";

function tileUrl(zoom: number, x: number, y: number): string {
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Night_Lights/default/2016-01-01/GoogleMapsCompatible_Level8/${zoom}/${y}/${x}.png`;
}

async function loadTile(zoom: number, x: number, y: number): Promise<RawTile> {
  const response = await fetch(tileUrl(zoom, x, y), { next: { revalidate: 86_400 } });
  if (!response.ok) throw new Error(`NASA night-light tile failed: ${response.status}`);
  const input = Buffer.from(await response.arrayBuffer());
  const decoded = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: decoded.data, width: decoded.info.width, height: decoded.info.height };
}

function labelForDarkness(score: number): string {
  if (score >= 85) return "暗夜潜力高";
  if (score >= 65) return "夜光较少";
  if (score >= 35) return "夜光中等";
  return "夜光较强";
}

function summaryForDarkness(score: number): string {
  if (score >= 85) return "长期夜间灯光较少，具备观察更多暗星的基础条件。";
  if (score >= 65) return "周边夜间灯光相对较少，避开近处直射灯后更适合观星。";
  if (score >= 35) return "周边存在明显夜间灯光，暗星可见度会受到一定影响。";
  return "周边长期夜光较强，肉眼通常只能稳定看到较亮目标。";
}

export function unavailableLightPollution(): LightPollutionEstimate {
  return {
    available: false,
    darknessScore: 45,
    lightLevel: null,
    label: "夜光数据暂缺",
    summary: "暂时无法读取 NASA 夜间灯光，星表按中等夜光保守估算。",
    source: SOURCE,
    sourceYear: null,
  };
}

export async function fetchLightPollutionEstimate(lat: number, lng: number): Promise<LightPollutionEstimate> {
  const center = nightLightTileAt(lat, lng, ZOOM);
  const centerGlobalX = center.x * TILE_SIZE + center.pixelX;
  const centerGlobalY = center.y * TILE_SIZE + center.pixelY;
  const required = new Map<string, { x: number; y: number }>();

  for (let dy = -SAMPLE_RADIUS; dy <= SAMPLE_RADIUS; dy++) {
    for (let dx = -SAMPLE_RADIUS; dx <= SAMPLE_RADIUS; dx++) {
      const tileX = Math.floor((centerGlobalX + dx) / TILE_SIZE);
      const tileY = Math.floor((centerGlobalY + dy) / TILE_SIZE);
      required.set(`${tileX}:${tileY}`, { x: tileX, y: tileY });
    }
  }

  const decoded = new Map<string, RawTile>();
  await Promise.all([...required.entries()].map(async ([key, tile]) => {
    decoded.set(key, await loadTile(ZOOM, tile.x, tile.y));
  }));

  let lightSum = 0;
  let sampleCount = 0;
  for (let dy = -SAMPLE_RADIUS; dy <= SAMPLE_RADIUS; dy++) {
    for (let dx = -SAMPLE_RADIUS; dx <= SAMPLE_RADIUS; dx++) {
      const globalX = centerGlobalX + dx;
      const globalY = centerGlobalY + dy;
      const tileX = Math.floor(globalX / TILE_SIZE);
      const tileY = Math.floor(globalY / TILE_SIZE);
      const pixelX = ((globalX % TILE_SIZE) + TILE_SIZE) % TILE_SIZE;
      const pixelY = ((globalY % TILE_SIZE) + TILE_SIZE) % TILE_SIZE;
      const tile = decoded.get(`${tileX}:${tileY}`);
      if (!tile || pixelX >= tile.width || pixelY >= tile.height) continue;
      const offset = (pixelY * tile.width + pixelX) * 4;
      const luminance = (tile.data[offset] + tile.data[offset + 1] + tile.data[offset + 2]) / (255 * 3);
      const alpha = tile.data[offset + 3] / 255;
      lightSum += luminance * alpha;
      sampleCount++;
    }
  }

  if (sampleCount === 0) throw new Error("NASA night-light tile contained no samples");
  const lightLevel = Math.round(lightSum / sampleCount * 100);
  const darknessScore = 100 - lightLevel;

  return {
    available: true,
    darknessScore,
    lightLevel,
    label: labelForDarkness(darknessScore),
    summary: summaryForDarkness(darknessScore),
    source: SOURCE,
    sourceYear: 2016,
  };
}
