/**
 * client/src/sw.js
 * Consolidated Service Worker source for VitePWA (injectManifest strategy).
 * Handles offline capabilities, background sync, Workbox precaching, dynamic caching, and Web Push notifications.
 */

import { clientsClaim } from "workbox-core";
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import {
  StaleWhileRevalidate,
  CacheFirst,
  NetworkOnly,
  NetworkFirst,
} from "workbox-strategies";

self.skipWaiting();
clientsClaim();

// Precache static assets injected by VitePWA
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST || []);

// ---------------------------------------------------------------------------
// Custom Workbox Routing
// ---------------------------------------------------------------------------

// 1. Ensure authenticated API requests are NEVER cached
registerRoute(
  ({ url, request }) =>
    url.pathname.startsWith("/api/") || request.headers.has("Authorization"),
  new NetworkOnly(),
);

// 2. Policy data cache
registerRoute(
  /\/api\/policies(\?.*)?$/,
  new StaleWhileRevalidate({
    cacheName: "policy-data-cache",
  }),
);

// 3. Policy PDF cache
registerRoute(
  /\/api\/policies\/download\//,
  new CacheFirst({
    cacheName: "policy-pdf-cache",
  }),
);

// 4. Runtime caching for static resources (scripts, styles, images)
registerRoute(
  ({ request }) =>
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "image",
  new StaleWhileRevalidate({
    cacheName: "static-resources",
  }),
);

// 5. Offline support for navigation requests
registerRoute(
  ({ request }) => request.mode === "navigate",
  new NetworkFirst({
    cacheName: "pages-cache",
  }),
);

// ---------------------------------------------------------------------------
// Background Sync for Offline Mutations
// ---------------------------------------------------------------------------
const DB_NAME = "offline-mutations-db";
const STORE_NAME = "mutations";
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

function getQueuedMutations(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

function deleteMutation(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = (event) => reject(event.target.error);
  });
}

function updateMutationStatus(db, id, status, errorMsg) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const data = getRequest.result;
      if (data) {
        data.status = status;
        data.error = errorMsg;
        const updateRequest = store.put(data);
        updateRequest.onsuccess = () => resolve();
        updateRequest.onerror = (event) => reject(event.target.error);
      } else {
        resolve();
      }
    };
    getRequest.onerror = (event) => reject(event.target.error);
  });
}

async function notifyClients(message) {
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage(message);
  });
}

async function syncMutations() {
  let db;
  try {
    db = await openDB();
  } catch (err) {
    console.error("[Service Worker] Failed to open DB for sync:", err);
    return;
  }

  const mutations = await getQueuedMutations(db);
  if (!mutations || mutations.length === 0) {
    return;
  }

  for (const mutation of mutations) {
    if (mutation.status === "syncing" || mutation.status === "conflict") {
      continue;
    }

    try {
      await updateMutationStatus(db, mutation.id, "syncing");

      const fetchOptions = {
        method: mutation.method,
        headers: {
          ...mutation.headers,
          "Content-Type": "application/json",
        },
      };

      if (
        mutation.body &&
        mutation.method !== "GET" &&
        mutation.method !== "HEAD"
      ) {
        fetchOptions.body =
          typeof mutation.body === "string"
            ? mutation.body
            : JSON.stringify(mutation.body);
      }

      const response = await fetch(mutation.url, fetchOptions);

      if (response.ok) {
        await deleteMutation(db, mutation.id);
        await notifyClients({
          type: "SYNC_SUCCESS",
          mutationId: mutation.id,
          url: mutation.url,
        });
      } else if (response.status === 409) {
        await updateMutationStatus(
          db,
          mutation.id,
          "conflict",
          "Merge conflict during sync",
        );
        await notifyClients({
          type: "SYNC_CONFLICT",
          mutationId: mutation.id,
          url: mutation.url,
          message: "A merge conflict occurred. Please review details offline.",
        });
      } else {
        const errorText = await response
          .text()
          .catch(() => "Unknown response error");
        await updateMutationStatus(db, mutation.id, "failed", errorText);
        await notifyClients({
          type: "SYNC_FAILURE",
          mutationId: mutation.id,
          url: mutation.url,
          error: errorText,
        });
      }
    } catch (fetchErr) {
      console.error(
        "[Service Worker] Fetch failed during sync replay:",
        fetchErr,
      );
      await updateMutationStatus(db, mutation.id, "queued");
      break;
    }
  }
}

self.addEventListener("sync", (event) => {
  if (event.tag === "sync-mutations") {
    console.log("[Service Worker] Syncing local DB mutations to server");
    event.waitUntil(syncMutations());
  }
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "TRIGGER_SYNC") {
    console.log("[Service Worker] Received TRIGGER_SYNC instruction");
    event.waitUntil(syncMutations());
  }
});

// ---------------------------------------------------------------------------
// Web Push Notifications
// ---------------------------------------------------------------------------
self.addEventListener("push", (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { title: "MeetOnMemory", body: event.data.text() };
    }
  }

  const title = data.title || "MeetOnMemory Notification";
  const options = {
    body: data.body || "You have a new update.",
    icon: data.icon || "/favicon.ico",
    badge: data.badge || "/favicon.ico",
    data: {
      url: data.url || "/",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === targetUrl && "focus" in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      }),
  );
});
