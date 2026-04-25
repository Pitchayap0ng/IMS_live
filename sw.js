const cacheName = 'ims-v6'; // เปลี่ยนเลข version เพื่อให้ Browser อัปเดต Cache ใหม่
const assets = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    'https://cdn.tailwindcss.com',
    'https://cdn.jsdelivr.net/npm/sweetalert2@11',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

// ติดตั้งและเก็บไฟล์ลงในเครื่อง (Cache)
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(cacheName).then(cache => {
            console.log('Caching assets...');
            return cache.addAll(assets);
        })
    );
});

// ดึงไฟล์จาก Cache มาใช้ทันทีแม้ไม่มีเน็ต
self.addEventListener('fetch', e => {
    e.respondWith(
        caches.match(e.request).then(res => {
            return res || fetch(e.request).catch(() => {
                // ถ้าดึงไฟล์ไม่ได้และไม่มีใน Cache (เช่น ไม่มีเน็ตจริงๆ) ให้ส่งค่าว่างกลับไป
                return null;
            });
        })
    );
});

// ลบ Cache เก่าทิ้งเมื่อมีการอัปเดตเวอร์ชัน
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(k => k !== cacheName).map(k => caches.delete(k))
        ))
    );
});