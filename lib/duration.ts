// lib/duration.ts
export const formatDuration = (seconds?: number | null) => {
  if (seconds == null) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
               : `${m}:${String(s).padStart(2,'0')}`;
};

export const parseDuration = (text: string): number | null => {
  if (!text) return null;
  const parts = text.split(":").map(Number);
  if (parts.some(isNaN)) return null;
  return parts.length === 2 ? parts[0]*60 + parts[1] : parts[0]*3600 + parts[1]*60 + parts[2];
};

