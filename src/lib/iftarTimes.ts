// Iftar times for Astana, Kazakhstan during Ramadan 2026
// Source: Aladhan API (Maghrib prayer times)

export const IFTAR_TIMES_ASTANA: Record<string, string> = {
  '2026-02-17': '17:33',
  '2026-02-18': '17:35',
  '2026-02-19': '17:37',
  '2026-02-20': '17:39',
  '2026-02-21': '17:40',
  '2026-02-22': '17:42',
  '2026-02-23': '17:44',
  '2026-02-24': '17:46',
  '2026-02-25': '17:47',
  '2026-02-26': '17:49',
  '2026-02-27': '17:51',
  '2026-02-28': '17:52',
  '2026-03-01': '17:54',
  '2026-03-02': '17:56',
  '2026-03-03': '17:58',
  '2026-03-04': '18:00',
  '2026-03-05': '18:01',
  '2026-03-06': '18:03',
  '2026-03-07': '18:05',
  '2026-03-08': '18:07',
  '2026-03-09': '18:08',
  '2026-03-10': '18:10',
  '2026-03-11': '18:12',
  '2026-03-12': '18:13',
  '2026-03-13': '18:15',
  '2026-03-14': '18:17',
  '2026-03-15': '18:18',
  '2026-03-16': '18:20',
  '2026-03-17': '18:22',
  '2026-03-18': '18:23',
};

// Ramadan 2026 dates
export const RAMADAN_START = new Date('2026-02-17');
export const RAMADAN_END = new Date('2026-03-18');

export function getIftarTime(date: Date): string {
  const dateStr = date.toISOString().split('T')[0];
  return IFTAR_TIMES_ASTANA[dateStr] || '18:00';
}

export function getRamadanDay(date: Date): number {
  const start = RAMADAN_START.getTime();
  const current = date.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.floor((current - start) / dayMs) + 1;
}

export function isRamadanDate(date: Date): boolean {
  return date >= RAMADAN_START && date <= RAMADAN_END;
}
