import { EquatorFromVector, MakeTime, VectorFromSphere } from "astronomy-engine";

const ARCSEC_TO_DEG = 1 / 3600;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

function normalizeRaHours(hours: number): number {
  return ((hours % 24) + 24) % 24;
}

/**
 * Converts catalog J2000 coordinates to true equator/equinox of date.
 * Horizon expects coordinates in the latter frame.
 */
export function stellarEquatorOfDate(
  raHoursJ2000: number,
  decDegJ2000: number,
  date: Date,
): { ra: number; dec: number } {
  const time = MakeTime(date);
  // Astronomy Engine stores TT as days from J2000, not as a full Julian date.
  const T = time.tt / 36525;
  const ra = raHoursJ2000 * 15 * DEG_TO_RAD;
  const dec = decDegJ2000 * DEG_TO_RAD;

  const zeta = (2306.2181 * T + 0.30188 * T ** 2 + 0.017998 * T ** 3) * ARCSEC_TO_DEG * DEG_TO_RAD;
  const z = (2306.2181 * T + 1.09468 * T ** 2 + 0.018203 * T ** 3) * ARCSEC_TO_DEG * DEG_TO_RAD;
  const theta = (2004.3109 * T - 0.42665 * T ** 2 - 0.041833 * T ** 3) * ARCSEC_TO_DEG * DEG_TO_RAD;

  const a = Math.cos(dec) * Math.sin(ra + zeta);
  const b = Math.cos(theta) * Math.cos(dec) * Math.cos(ra + zeta) - Math.sin(theta) * Math.sin(dec);
  const c = Math.sin(theta) * Math.cos(dec) * Math.cos(ra + zeta) + Math.cos(theta) * Math.sin(dec);
  const meanRa = Math.atan2(a, b) + z;
  const meanDec = Math.asin(Math.max(-1, Math.min(1, c)));

  // Apply the small nutation correction so the result matches true-of-date
  // coordinates expected by Horizon rather than only mean-of-date.
  const L = (280.4665 + 36000.7698 * T) * DEG_TO_RAD;
  const Lp = (218.3165 + 481267.8813 * T) * DEG_TO_RAD;
  const omega = (125.04452 - 1934.136261 * T + 0.0020708 * T ** 2 + T ** 3 / 450000) * DEG_TO_RAD;
  const dPsi = (-17.20 * Math.sin(omega) - 1.32 * Math.sin(2 * L) - 0.23 * Math.sin(2 * Lp) + 0.21 * Math.sin(2 * omega)) * ARCSEC_TO_DEG * DEG_TO_RAD;
  const dEps = (9.20 * Math.cos(omega) + 0.57 * Math.cos(2 * L) + 0.10 * Math.cos(2 * Lp) - 0.09 * Math.cos(2 * omega)) * ARCSEC_TO_DEG * DEG_TO_RAD;
  const meanObliquity = (23.43929111 - 0.013004167 * T - 0.000000164 * T ** 2 + 0.000000504 * T ** 3) * DEG_TO_RAD;
  const trueRa = meanRa + (Math.cos(meanObliquity) + Math.sin(meanObliquity) * Math.sin(meanRa) * Math.tan(meanDec)) * dPsi - Math.cos(meanRa) * Math.tan(meanDec) * dEps;
  const trueDec = meanDec + Math.sin(meanObliquity) * Math.cos(meanRa) * dPsi + Math.sin(meanRa) * dEps;

  return {
    ra: normalizeRaHours(trueRa * RAD_TO_DEG / 15),
    dec: trueDec * RAD_TO_DEG,
  };
}

export function stellarVectorOfDate(
  raHoursJ2000: number,
  decDegJ2000: number,
  date: Date,
) {
  const eq = stellarEquatorOfDate(raHoursJ2000, decDegJ2000, date);
  return VectorFromSphere({ lat: eq.dec, lon: eq.ra * 15, dist: 1 }, date);
}

export function validateStellarCoordinateConversion(date = new Date()): boolean {
  const vector = stellarVectorOfDate(18.6156, 38.7837, date);
  const eq = EquatorFromVector(vector);
  return Number.isFinite(eq.ra) && Number.isFinite(eq.dec);
}
