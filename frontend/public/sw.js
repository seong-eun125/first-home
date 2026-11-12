/* FIRST HOME 서비스워커 (설치형 웹앱용)
 * - 화면·데이터는 캐시하지 않아 항상 최신 버전을 받습니다(테스트 기간에 수정이 바로 반영되도록).
 * - 인터넷이 끊겼을 때만 안내 화면(offline.html)을 보여 줍니다.
 */
const OFFLINE = '/offline.html'
const CACHE = 'firsthome-offline-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.add(OFFLINE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return // API·이미지 등은 브라우저 기본 동작
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE)))
})
