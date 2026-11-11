const cacheName = 'home-fitness-' + self.registration.scope + '-__RELEASE__';
const shell = [
  './', './index.html', './app.mjs', './model.mjs', './db.mjs', './style.css',
  './manifest.webmanifest', './icon-192.png', './icon-512.png',
  ...['push','incline','row','deadbug','crunch','squat','hinge','warm'].map(name=>'./art/'+name+'.jpg')
];
self.addEventListener('install', event=>{
  event.waitUntil(caches.open(cacheName).then(cache=>cache.addAll(shell)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('home-fitness-'+self.registration.scope+'-') && key!==cacheName).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', event=>{
  if(event.request.method!=='GET' || !event.request.url.startsWith(self.registration.scope)) return;
  if(event.request.mode==='navigate') {
    event.respondWith(fetch(event.request).catch(()=>caches.open(cacheName).then(cache=>cache.match('./index.html'))));
  } else {
    event.respondWith(caches.open(cacheName).then(cache=>cache.match(event.request)).then(response=>response??fetch(event.request)));
  }
});
