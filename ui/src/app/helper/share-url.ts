export interface WebsharkViewState {
  capture?: string;
  frame?: number;
  filter?: string;
  view?: string;
  stream?: string;
  follow?: string;
  embed?: boolean;
}

export function parseViewState(search: string): WebsharkViewState {
  const raw = search.startsWith('?') ? search.slice(1) : search;
  const q = new URLSearchParams(raw);
  const state: WebsharkViewState = {};
  const capture = q.get('capture');
  if (capture) {
    state.capture = capture;
  }
  const frame = q.get('frame');
  if (frame) {
    const n = parseInt(frame, 10);
    if (!Number.isNaN(n)) {
      state.frame = n;
    }
  }
  const filter = q.get('filter');
  if (filter) {
    state.filter = filter;
  }
  const view = q.get('view');
  if (view) {
    state.view = view;
  }
  const stream = q.get('stream');
  if (stream) {
    state.stream = stream;
  }
  const follow = q.get('follow');
  if (follow) {
    state.follow = follow;
  }
  const embed = q.get('embed');
  if (embed === '1' || embed === 'true') {
    state.embed = true;
  }
  return state;
}

export function serializeViewState(state: WebsharkViewState): string {
  const q = new URLSearchParams();
  if (state.capture) {
    q.set('capture', state.capture);
  }
  if (state.frame != null && !Number.isNaN(state.frame)) {
    q.set('frame', String(state.frame));
  }
  if (state.filter) {
    q.set('filter', state.filter);
  }
  if (state.view) {
    q.set('view', state.view);
  }
  if (state.stream) {
    q.set('stream', state.stream);
  }
  if (state.follow) {
    q.set('follow', state.follow);
  }
  if (state.embed) {
    q.set('embed', '1');
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

export function applyViewStateToUrl(state: WebsharkViewState, loc: { pathname: string; search?: string } = window.location, hist: History = window.history): string {
  const qs = serializeViewState(state);
  const path = loc.pathname || '/';
  const url = qs ? `${path}${qs}` : path;
  hist.replaceState(null, '', url);
  return url;
}

export function rtpStreamToken(rtp: { saddr: string; sport: number; daddr: string; dport: number; ssrc: number | string }): string {
  const ssrc = typeof rtp.ssrc === 'number'
    ? rtp.ssrc.toString(16)
    : String(rtp.ssrc).replace(/^0x/i, '');
  return [rtp.saddr, rtp.sport, rtp.daddr, rtp.dport, ssrc].join('_');
}

export function iframeEmbedSnippet(origin: string, state: WebsharkViewState): string {
  const src = `${origin.replace(/\/$/, '')}/webshark/${serializeViewState({ ...state, embed: true })}`;
  return `<iframe src="${src}" style="width:100%;height:100%;border:0" allow="fullscreen"></iframe>`;
}
