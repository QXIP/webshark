export type CaptureChangeKind = 'init' | 'append' | 'full' | 'none';

export function captureChangeKind(prevSize: number, nextSize: number): CaptureChangeKind {
  if (prevSize < 0) {
    return 'init';
  }
  if (nextSize < prevSize) {
    return 'full';
  }
  if (nextSize > prevSize) {
    return 'append';
  }
  return 'none';
}

export function isNearBottom(scrollHeight: number, scrollTop: number, clientHeight: number, threshold = 120): boolean {
  return (scrollHeight - scrollTop - clientHeight) <= threshold;
}

export function framesSkip(existingCount: number): number {
  return Math.max(0, existingCount);
}

export function filterNewFrames(existingIds: number[], frames: Array<{ c: Array<string | number> }>): Array<{ c: Array<string | number> }> {
  const last = existingIds.length ? Math.max(...existingIds) : 0;
  return frames.filter((f) => Number(f.c[0]) > last);
}

export function mapFrameRow(frame: { c: any[]; bg?: string; fg?: string }): any {
  const [id, time, source, description, protocol, length, info] = frame.c;
  const { bg, fg } = frame;
  return { id, time, source, description, protocol, length, info, bg, fg };
}

export function packetListRow(event: any): any | null {
  if (!event) {
    return null;
  }
  const row = event.row?.item || event.row;
  return row && typeof row === 'object' ? row : null;
}

export function packetFrameId(row: any): number {
  const n = Number(row?.id);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function frameTreeFromSharkd(tree: any): any[] {
  const convert = (node: any): any => {
    if (!node) {
      return null;
    }
    return {
      name: node.l,
      description: node.f,
      highlight: node.h,
      children: Array.isArray(node.n) ? node.n.map(convert).filter(Boolean) : undefined
    };
  };
  return Array.isArray(tree) ? tree.map(convert).filter(Boolean) : [];
}

export function isFrameList(data: any): data is Array<{ c: any[] }> {
  return Array.isArray(data);
}

export function sharkdErrorMessage(data: any): string {
  if (!data) {
    return 'No response from sharkd';
  }
  if (typeof data === 'string') {
    return data;
  }
  return data.errstr
    || (typeof data.error === 'string' ? data.error : data.error?.message)
    || data.message
    || 'Failed to load capture';
}

export function asFileList(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}
