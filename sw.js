const cacheName = 'ims-v5';
const assets = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './icon-180.png'
];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(cacheName).then(cache => cache.addAll(assets))
    );
});

self.addEventListener('fetch', e => {
    e.respondWith(
        caches.match(e.request).then(res => res || fetch(e.request).catch(() => null))
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(k => k !== cacheName).map(k => caches.delete(k))
        ))
    );
});