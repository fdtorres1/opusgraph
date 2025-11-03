// lib/recording.ts
export type RecordingInfo =
  | { provider: 'youtube'|'spotify'|'apple_music'|'soundcloud'|'other'; embedUrl: string; key?: string }
  | null;

export function detectRecording(url: string): RecordingInfo {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu')) {
      const id = u.searchParams.get('v') || u.pathname.split('/').filter(Boolean).pop();
      return id ? { provider: 'youtube', embedUrl: `https://www.youtube.com/embed/${id}`, key: id } : { provider: 'other', embedUrl: '' };
    }
    if (u.hostname.includes('spotify.com')) {
      return { provider: 'spotify', embedUrl: `https://open.spotify.com/embed${u.pathname}` };
    }
    if (u.hostname.includes('music.apple.com')) {
      return { provider: 'apple_music', embedUrl: `https://embed.music.apple.com${u.pathname}` };
    }
    if (u.hostname.includes('soundcloud.com')) {
      return { provider: 'soundcloud', embedUrl: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}` };
    }
    return { provider: 'other', embedUrl: '' };
  } catch {
    return null;
  }
}

