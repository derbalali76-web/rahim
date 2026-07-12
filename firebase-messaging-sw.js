/* firebase-messaging-sw.js — يعرض الإشعار والتطبيق مغلق (عرض تلقائي عبر حقل notification) */
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAe-DQ5w2J67dSR92-5AlNaam_5RFbS2YM",
  authDomain: "rahim-9351e.firebaseapp.com",
  projectId: "rahim-9351e",
  storageBucket: "rahim-9351e.firebasestorage.app",
  messagingSenderId: "22636624437",
  appId: "1:22636624437:web:139f717f880cb31f19cf7c"
});

/* تهيئة المراسلة: بوجود حقل notification يعرض المتصفّح الإشعار تلقائياً عند إغلاق التطبيق،
   ولا نُعرّف onBackgroundMessage حتى لا يحدث تكرار. */
firebase.messaging();

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: 'window' }).then((list) => {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    if (clients.openWindow) return clients.openWindow('./');
  }));
});
