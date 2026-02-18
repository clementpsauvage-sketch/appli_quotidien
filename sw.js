const CACHE_NAME = 'zenith-v32';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './db.js',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
  // Ajoute ici tes icônes ou sons si tu en as
];

// Installation : Mise en cache des fichiers essentiels
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(ASSETS);
        })
    );
});

// Activation : Nettoyage des anciens caches
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
        return Promise.all(
            keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        );
        })
    );
});

// Stratégie : Network First, falling back to cache
// On privilégie le réseau pour avoir les dernières modifs, sinon on pioche dans le cache
self.addEventListener('fetch', (e) => {
    e.respondWith(
        fetch(e.request).catch(() => caches.match(e.request))
    );
});