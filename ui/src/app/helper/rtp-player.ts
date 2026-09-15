export const RTP_WAVE_COLORS = ['#c4a35a', '#6b6b6b', '#4a90d9', '#2e7d32', '#c62828', '#6a1b9a'];

export function rtpWaveColor(index: number): string {
  const i = Number(index);
  if (!Number.isFinite(i) || i < 0) {
    return RTP_WAVE_COLORS[0];
  }
  return RTP_WAVE_COLORS[i % RTP_WAVE_COLORS.length];
}

export function rtpStreamLabel(stream: { saddr?: string; sport?: number; daddr?: string; dport?: number; ssrc?: string | number }): string {
  const ssrc = String(stream?.ssrc ?? '').replace(/^0x/i, '');
  return `${stream?.saddr || ''}:${stream?.sport || 0} → ${stream?.daddr || ''}:${stream?.dport || 0}  ${ssrc}`;
}

export function rtpSsrcLabel(ssrc: string | number | undefined): string {
  const hex = String(ssrc ?? '').replace(/^0x/i, '');
  return hex ? `0x${hex}` : '';
}

export function rtpStreamTabLabel(index: number, ssrc?: string | number): string {
  const role = index === 0 ? 'Forward' : index === 1 ? 'Reverse' : `Stream ${index + 1}`;
  const tag = rtpSsrcLabel(ssrc);
  return tag ? `${role} ${tag}` : role;
}

export function rtpRelativeTime(t: number, origin: number): string {
  const n = Number(t) - Number(origin);
  if (!Number.isFinite(n)) {
    return '';
  }
  return (Math.round(n * 1000) / 1000).toFixed(3);
}
