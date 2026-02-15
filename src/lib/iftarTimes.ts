// Prayer times from muftyat.kz API
// Cached in-memory per session, fetched via our API proxy

export interface DayTimes {
  date: string;
  imsak: string;  // suhoor end
  fajr: string;
  maghrib: string; // iftar
  sunrise?: string;
  dhuhr?: string;
  asr?: string;
  isha?: string;
}

export interface CityInfo {
  id: string;
  title: string;
  lat: string;
  lng: string;
  region?: string;
}

// Ramadan 2026 dates
export const RAMADAN_START = new Date('2026-02-17');
export const RAMADAN_END = new Date('2026-03-18');

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

// In-memory cache
let prayerTimesCache: Map<string, DayTimes[]> = new Map();
let majorCitiesCache: CityInfo[] | null = null;

export async function getMajorCities(): Promise<CityInfo[]> {
  if (majorCitiesCache) return majorCitiesCache;
  try {
    const res = await fetch(`${API_URL}/api/cities`);
    majorCitiesCache = await res.json();
    return majorCitiesCache!;
  } catch {
    return [];
  }
}

export async function searchCities(query: string): Promise<CityInfo[]> {
  try {
    const res = await fetch(`${API_URL}/api/cities/search?q=${encodeURIComponent(query)}`);
    return res.json();
  } catch {
    return [];
  }
}

export async function fetchPrayerTimes(lat: string, lng: string, year?: number): Promise<DayTimes[]> {
  const key = `${lat}/${lng}`;
  const cached = prayerTimesCache.get(key);
  if (cached) return cached;

  try {
    const y = year || new Date().getFullYear();
    const res = await fetch(`${API_URL}/api/prayer-times/${lat}/${lng}?year=${y}`);
    const raw = await res.json();
    // Normalize Date -> date field
    const data: DayTimes[] = (Array.isArray(raw) ? raw : []).map((item: any) => ({
      ...item,
      date: item.Date || item.date,
    }));
    prayerTimesCache.set(key, data);
    return data;
  } catch {
    return [];
  }
}

export function getDayTimesFromCache(times: DayTimes[], date: Date): DayTimes | null {
  const dateStr = date.toISOString().split('T')[0];
  return times.find(t => (t as any).Date === dateStr || t.date === dateStr) || null;
}

export function getRamadanDay(date: Date): number {
  const startDate = new Date(RAMADAN_START.getFullYear(), RAMADAN_START.getMonth(), RAMADAN_START.getDate());
  const currentDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.floor((currentDate.getTime() - startDate.getTime()) / dayMs) + 1;
}

export function isRamadanDate(date: Date): boolean {
  return date >= RAMADAN_START && date <= RAMADAN_END;
}

// Default Astana coords
export const DEFAULT_LAT = '51.133333';
export const DEFAULT_LNG = '71.433333';

// Legacy helper used by CreateEventModal
export function getIftarTime(date: Date): string {
  // Approximate iftar time for Astana during Ramadan 2026
  const day = getRamadanDay(date);
  if (day < 1 || day > 30) return '18:00';
  const baseMinutes = 17 * 60 + 42; // Day 1: 17:42
  const minutes = baseMinutes + (day - 1) * 2;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}
