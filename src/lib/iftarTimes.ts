// Iftar and Suhoor times for Astana, Kazakhstan during Ramadan 2026
// Source: muftyat.kz official times

export interface DayTimes {
  suhoor: string;
  iftar: string;
}

// Astana base times (official from muftyat.kz)
export const ASTANA_TIMES: Record<string, DayTimes> = {
  '2026-02-17': { suhoor: '05:53', iftar: '17:38' },
  '2026-02-18': { suhoor: '05:51', iftar: '17:40' },
  '2026-02-19': { suhoor: '05:49', iftar: '17:42' },
  '2026-02-20': { suhoor: '05:47', iftar: '17:44' },
  '2026-02-21': { suhoor: '05:45', iftar: '17:46' },
  '2026-02-22': { suhoor: '05:43', iftar: '17:48' },
  '2026-02-23': { suhoor: '05:41', iftar: '17:50' },
  '2026-02-24': { suhoor: '05:39', iftar: '17:52' },
  '2026-02-25': { suhoor: '05:37', iftar: '17:54' },
  '2026-02-26': { suhoor: '05:35', iftar: '17:56' },
  '2026-02-27': { suhoor: '05:33', iftar: '17:58' },
  '2026-02-28': { suhoor: '05:31', iftar: '18:00' },
  '2026-03-01': { suhoor: '05:29', iftar: '18:02' },
  '2026-03-02': { suhoor: '05:27', iftar: '18:04' },
  '2026-03-03': { suhoor: '05:25', iftar: '18:06' },
  '2026-03-04': { suhoor: '05:23', iftar: '18:08' },
  '2026-03-05': { suhoor: '05:21', iftar: '18:10' },
  '2026-03-06': { suhoor: '05:19', iftar: '18:12' },
  '2026-03-07': { suhoor: '05:17', iftar: '18:14' },
  '2026-03-08': { suhoor: '05:15', iftar: '18:16' },
  '2026-03-09': { suhoor: '05:13', iftar: '18:18' },
  '2026-03-10': { suhoor: '05:11', iftar: '18:20' },
  '2026-03-11': { suhoor: '05:09', iftar: '18:22' },
  '2026-03-12': { suhoor: '05:07', iftar: '18:24' },
  '2026-03-13': { suhoor: '05:05', iftar: '18:26' },
  '2026-03-14': { suhoor: '05:03', iftar: '18:28' },
  '2026-03-15': { suhoor: '05:01', iftar: '18:30' },
  '2026-03-16': { suhoor: '04:59', iftar: '18:32' },
  '2026-03-17': { suhoor: '04:57', iftar: '18:34' },
  '2026-03-18': { suhoor: '04:55', iftar: '18:36' },
};

// City offsets from Astana in minutes (based on longitude difference)
// Negative = earlier (east of Astana), Positive = later (west of Astana)
// All cities now use UTC+5 after Kazakhstan timezone unification (2024)
export interface CityInfo {
  id: string;
  name: string;
  nameKz: string;
  offset: number; // minutes offset from Astana for both suhoor and iftar
}

export const CITIES: CityInfo[] = [
  { id: 'astana',    name: 'Астана',     nameKz: 'Астана',     offset: 0 },
  { id: 'almaty',    name: 'Алматы',     nameKz: 'Алматы',     offset: -22 },
  { id: 'shymkent',  name: 'Шымкент',    nameKz: 'Шымкент',    offset: +7 },
  { id: 'aktobe',    name: 'Актобе',     nameKz: 'Ақтөбе',     offset: +57 },
  { id: 'aktau',     name: 'Актау',      nameKz: 'Ақтау',      offset: +81 },
  { id: 'atyrau',    name: 'Атырау',     nameKz: 'Атырау',     offset: +78 },
  { id: 'karaganda', name: 'Караганда',  nameKz: 'Қарағанды',  offset: -7 },
  { id: 'kostanay',  name: 'Костанай',   nameKz: 'Қостанай',   offset: +31 },
  { id: 'pavlodar',  name: 'Павлодар',   nameKz: 'Павлодар',   offset: -22 },
  { id: 'semey',     name: 'Семей',      nameKz: 'Семей',      offset: -35 },
  { id: 'oral',      name: 'Уральск',    nameKz: 'Орал',       offset: +80 },
  { id: 'oskemen',   name: 'Усть-Каменогорск', nameKz: 'Өскемен', offset: -45 },
];

// Ramadan 2026 dates
export const RAMADAN_START = new Date('2026-02-17');
export const RAMADAN_END = new Date('2026-03-18');

function applyOffset(time: string, offsetMinutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const totalMinutes = h * 60 + m + offsetMinutes;
  const newH = Math.floor(((totalMinutes % 1440) + 1440) % 1440 / 60);
  const newM = ((totalMinutes % 60) + 60) % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

export function getCityById(cityId: string): CityInfo | undefined {
  return CITIES.find(c => c.id === cityId);
}

export function getDayTimes(date: Date, cityId: string = 'astana'): DayTimes {
  const dateStr = date.toISOString().split('T')[0];
  const baseTimes = ASTANA_TIMES[dateStr];
  if (!baseTimes) return { suhoor: '05:00', iftar: '18:00' };

  const city = getCityById(cityId);
  if (!city || city.offset === 0) return baseTimes;

  return {
    suhoor: applyOffset(baseTimes.suhoor, city.offset),
    iftar: applyOffset(baseTimes.iftar, city.offset),
  };
}

export function getIftarTime(date: Date, cityId: string = 'astana'): string {
  return getDayTimes(date, cityId).iftar;
}

export function getSuhoorTime(date: Date, cityId: string = 'astana'): string {
  return getDayTimes(date, cityId).suhoor;
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

// Legacy export for backward compatibility
export const IFTAR_TIMES_ASTANA: Record<string, string> = Object.fromEntries(
  Object.entries(ASTANA_TIMES).map(([k, v]) => [k, v.iftar])
);
