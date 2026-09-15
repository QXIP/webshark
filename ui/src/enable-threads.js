console.log('INITED::enable-threads.js');
if(typeof window === 'undefined') {
  self.addEventListener("install", () => self.skipWaiting());
  self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

  async function handleFetch(request) {
    if(request.cache === "only-if-cached" && request.mode !== "same-origin") {
      return;
    }

    if(request.mode === "no-cors") { // We need to set `credentials` to "omit" for no-cors requests, per this comment: https://bugs.chromium.org/p/chromium/issues/detail?id=1309901#c7
      request = new Request(request.url, {
        cache: request.cache,
        credentials: "omit",
        headers: request.headers,
        integrity: request.integrity,
        destination: request.destination,
        keepalive: request.keepalive,
        method: request.method,
        mode: request.mode,
        redirect: request.redirect,
        referrer: request.referrer,
        referrerPolicy: request.referrerPolicy,
        signal: request.signal,
      });
    }

    let r = await fetch(request).catch(e => console.error(e));

    if(r.status === 0) {
      return r;
    }

    const headers = new Headers(r.headers);
    headers.set("Cross-Origin-Embedder-Policy", "credentialless"); // or: require-corp
    headers.set("Cross-Origin-Opener-Policy", "same-origin");

    return new Response(r.body, { status: r.status, statusText: r.statusText, headers });
  }

  self.addEventListener("fetch", function(e) {
    e.respondWith(handleFetch(e.request)); // respondWith must be executed synchonously (but can be passed a Promise)
  });

} else {
  (async function() {
    if(window.crossOriginIsolated !== false) return;
    const host = (window.location && window.location.hostname) || '';
    const https = window.location && window.location.protocol === 'https:';
    const trustworthy = host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || https;
    if (!trustworthy) return;
    const src = window.document.currentScript && window.document.currentScript.src;
    if (!src || !navigator.serviceWorker || typeof navigator.serviceWorker.register !== 'function') {
      return;
    }

    let registration = await navigator.serviceWorker.register(src).catch(e => console.error("COOP/COEP Service Worker failed to register:", e));
    if(registration) {
      console.log("COOP/COEP Service Worker registered", registration.scope);

      registration.addEventListener("updatefound", () => {
        console.log("Reloading page to make use of updated COOP/COEP Service Worker.");
        window.location.reload();
      });

      // If the registration is active, but it's not controlling the page
      if(registration.active && !navigator.serviceWorker.controller) {
        console.log("Reloading page to make use of COOP/COEP Service Worker.");
        window.location.reload();
      }
    }
  })();
}

// Code to deregister:
// let registrations = await navigator.serviceWorker.getRegistrations();
// for(let registration of registrations) {
//   await registration.unregister();
// }
