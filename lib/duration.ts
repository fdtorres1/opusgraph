// lib/duration.ts
export const formatDuration = (seconds?: number | null) => {
  if (seconds == null) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
               : `${m}:${String(s).padStart(2,'0')}`;
};

function parseColonDuration(text: string): number | null {
  const normalized = normalizeDurationText(text);
  if (!normalized) return null;

  const match = normalized.match(
    /^(\d+(?::\d+){1,2})\s*(hours?|hrs?|hr|h|minutes?|mins?|min|m|seconds?|secs?|sec|s)?$/,
  );
  if (!match) return null;

  const parts = (match[1] ?? "").split(":").map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function normalizeDurationText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\b(?:ca\.?|circa|approx\.?|approximately|about)\b/g, "")
    .replace(/\beach\b/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function durationUnitToSeconds(unit: string, value: number): number | null {
  if (!Number.isFinite(value)) return null;

  if (/^(hours?|hrs?|hr|h)$/.test(unit)) {
    return value * 3600;
  }

  if (/^(minutes?|mins?|min|m)$/.test(unit)) {
    return value * 60;
  }

  if (/^(seconds?|secs?|sec|s)$/.test(unit)) {
    return value;
  }

  return null;
}

function parseRangeDuration(text: string): number | null {
  const normalized = normalizeDurationText(text);
  if (!normalized) return null;

  const match = normalized.match(
    /^(\d+(?:\.\d+)?)\s*(?:[-–]|to)\s*(\d+(?:\.\d+)?)\s*(hours?|hrs?|hr|h|minutes?|mins?|min|m|seconds?|secs?|sec|s)\b$/,
  );
  if (!match) return null;

  const lower = Number(match[1]);
  const upper = Number(match[2]);
  const unit = match[3];

  if (!Number.isFinite(lower) || !Number.isFinite(upper) || !unit) {
    return null;
  }

  const midpoint = (lower + upper) / 2;
  const seconds = durationUnitToSeconds(unit, midpoint);
  return seconds == null ? null : Math.round(seconds);
}

function parseTickDuration(text: string): number | null {
  const normalized = normalizeDurationText(text);
  if (!normalized) return null;

  const minuteSecondMatch = normalized.match(/^(\d+(?:\.\d+)?)'\s*(\d+(?:\.\d+)?)"?$/);
  if (minuteSecondMatch) {
    const minutes = Number(minuteSecondMatch[1]);
    const seconds = Number(minuteSecondMatch[2]);
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) {
      return null;
    }

    return Math.round(minutes * 60 + seconds);
  }

  const minuteMatch = normalized.match(/^(\d+(?:\.\d+)?)'$/);
  if (minuteMatch) {
    const minutes = Number(minuteMatch[1]);
    if (!Number.isFinite(minutes)) {
      return null;
    }

    return Math.round(minutes * 60);
  }

  return null;
}

function parseUnitDuration(text: string): number | null {
  const normalized = normalizeDurationText(text);
  if (!normalized) return null;

  const unitPattern =
    /(\d+(?:\.\d+)?)\s*(hours?|hrs?|hr|h|minutes?|mins?|min|m|seconds?|secs?|sec|s)\b/g;
  let totalSeconds = 0;
  let matched = false;

  for (const match of normalized.matchAll(unitPattern)) {
    const value = Number(match[1]);
    const unit = match[2];

    if (!Number.isFinite(value) || !unit) {
      return null;
    }

    matched = true;
    const seconds = durationUnitToSeconds(unit, value);
    if (seconds == null) return null;
    totalSeconds += seconds;
  }

  if (!matched) return null;

  const separatorLength = normalized.replace(unitPattern, "").replace(/\band\b/g, "").replace(/\s+/g, "").length;
  if (separatorLength > 0) {
    return null;
  }

  return Math.round(totalSeconds);
}

function parseAlternativeDuration(text: string): number | null {
  const variants = text
    .split(/\s*[;/]\s*/g)
    .map((part) => part.trim())
    .filter(Boolean);

  if (variants.length <= 1) return null;

  for (const variant of variants) {
    const parsed =
      parseColonDuration(variant) ??
      parseRangeDuration(variant) ??
      parseUnitDuration(variant);
    if (parsed != null) {
      return parsed;
    }
  }

  return null;
}

export const parseDuration = (text: string): number | null => {
  if (!text) return null;
  return (
    parseColonDuration(text) ??
    parseTickDuration(text) ??
    parseAlternativeDuration(text) ??
    parseRangeDuration(text) ??
    parseUnitDuration(text)
  );
};
