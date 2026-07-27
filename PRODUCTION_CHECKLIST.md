# Production Checklist

## Repository

- [ ] Temiz checkout üzerinde kök dizinde `npm ci` başarılı.
- [ ] Tek kök `package-lock.json` workspace yapısıyla uyumlu.
- [ ] `.gitignore` env, build, log, key ve sertifika dosyalarını dışlıyor.
- [ ] GitHub Actions production kontrolleri yeşil.

## Secrets

- [ ] Kaynak ağacında gerçek secret, token, parola veya bağlantı bilgisi yok.
- [ ] `.env` Git’e ekli değil; yalnızca `.env.example` paylaşılıyor.
- [ ] Git geçmişi ayrıca secret scanner ile kontrol edildi.
- [ ] Production `JWT_SECRET` en az 32 karakter, rastgele ve benzersiz.

## Dependencies

- [ ] Tam `npm audit` sonucu incelendi.
- [ ] `npm audit --omit=dev` production bağımlılıklarında kabul edilebilir sonuç veriyor.
- [ ] Node.js sürümü `>=20.19.0`.

## TypeScript

- [ ] `npm run typecheck -w client` başarılı.
- [ ] `npm run typecheck -w server` başarılı.
- [ ] Socket payload, acknowledgement, room ve game state tipleri doğrulandı.

## Tests

- [ ] `npm run test -w client` başarılı.
- [ ] `npm run test -w server` başarılı.
- [ ] Testler devre dışı, `skip` veya yalnız çalıştırılan `only` içermiyor.

## Frontend Build

- [ ] `npm run build -w client` temiz kurulumdan sonra başarılı.
- [ ] Production bundle secret, token, private role veya debug log içermiyor.

## Backend Build

- [ ] `npm run build -w server` temiz kurulumdan sonra başarılı.
- [ ] `npm run start -w server` derlenmiş `dist/index.js` dosyasını çalıştırıyor.

## Prisma

- [ ] `npm run prisma:format -w server` başarılı.
- [ ] `npm run prisma:validate -w server` başarılı.
- [ ] `npm run prisma:generate -w server` başarılı.
- [ ] Unique constraint ve ilişki/liste sorgusu indexleri doğrulandı.

## Database Migration

- [ ] `npm run prisma:migrate:deploy -w server` Neon production branch üzerinde başarılı.
- [ ] Migration öncesi Neon branch/restore noktası oluşturuldu.
- [ ] Migration veri silmiyor veya kolon düşürmüyor.
- [ ] Seed ilk kurulumda yalnızca bir kez çalıştırıldı.

## Environment Variables

- [ ] Render’da `NODE_ENV`, `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `CLIENT_URL`, `CORS_ORIGIN`, `COOKIE_SECURE`, `COOKIE_SAME_SITE` tanımlı.
- [ ] Render tarafından sağlanan `PORT` çalışma zamanında mevcut.
- [ ] Vercel’de `VITE_API_URL` ve `VITE_SOCKET_URL` doğru backend origin’ini gösteriyor.
- [ ] Eksik zorunlu değişkende server anlaşılır hata ile başlamayı reddediyor.

## Authentication

- [ ] Kayıt, giriş, yanlış şifre, çıkış ve `/api/auth/me` test edildi.
- [ ] Geçerli, geçersiz ve süresi dolmuş cookie test edildi.
- [ ] Parola hash’i ve JWT hiçbir API yanıtında dönmüyor.
- [ ] Development auth bypass veya debug route yok.

## Cookies

- [ ] Cookie `HttpOnly`, `Secure`, `SameSite=None` ve `Path=/` kullanıyor.
- [ ] Logout cookie’yi aynı kapsam seçenekleriyle temizliyor.
- [ ] Login yanıtı gerçek tarayıcıda cookie oluşturuyor.

## CORS

- [ ] `CLIENT_URL` kesin HTTPS production origin’i.
- [ ] `CORS_ORIGIN` açık allowlist; wildcard yok.
- [ ] İzinli origin credentials başlığı alıyor, izinsiz origin 403 alıyor.
- [ ] Origin’siz health/server-to-server isteği kontrollü biçimde çalışıyor.

## Socket.IO

- [ ] API ve Socket.IO aynı Render HTTP server’ına bağlı.
- [ ] Polling ve WebSocket transport’ları çalışıyor.
- [ ] WebSocket upgrade `allowRequest` ile origin allowlist’ine tabi.
- [ ] İstemci singleton socket kullanıyor ve listener’ları unmount’ta temizliyor.
- [ ] Aynı oda join isteği single-flight ile tek çağrıya indirgeniyor.

## Room System

- [ ] Oda oluşturma, kodla katılma, kapasite ve oyun başlamış oda kontrolleri başarılı.
- [ ] Oda şifresi public state’e gönderilmiyor.
- [ ] Yalnızca oda sahibi ayar, kick, transfer ve start işlemi yapabiliyor.
- [ ] Son oyuncu ayrıldığında boş oda ve timer temizleniyor.
- [ ] Rol toplamı oyuncu sayısına eşit olmadan oyun başlamıyor.

## Role Privacy

- [ ] Public room/game state oyun bittikten sonra dahi `role`, `privateRole`, `socketId`, token veya dahili kullanıcı kimliği içermiyor.
- [ ] `game:private-role` yalnızca ilgili socket’e gidiyor.
- [ ] Oda sahibi diğer oyuncuların rolünü göremiyor.

## Game Engine

- [ ] Gece, tartışma, oylama, sonuç ve bitiş fazları backend tarafından ilerletiliyor.
- [ ] Faz deadline’ı sonrasında gelen eylem server tarafından reddediliyor.
- [ ] Faz çözüm kilidi aynı timer’ın iki kez sonuç üretmesini önlüyor.
- [ ] Doktor, Vampir, ölü oyuncu, yanlış faz, tekrar action ve oy değiştirme kuralları test edildi.
- [ ] Vampir parite zaferi en az bir tam gece–gündüz oylama döngüsünden sonra kontrol ediliyor.

## Chat Privacy

- [ ] Vampir mesajı yalnızca yaşayan Vampirlere, ölü mesajı yalnızca ölülere gidiyor.
- [ ] Ölü oyuncu yaşayan sohbetine; yaşayan oyuncu ölü sohbetine yazamıyor.
- [ ] Mesaj boyutu sınırlı, HTML temizleniyor ve temizleme sonrası boş mesaj reddediliyor.

## Reconnect

- [ ] Geçerli reconnect aynı oyuncuyu ve yalnızca kendi private state’ini geri getiriyor.
- [ ] Geçersiz veya başka oyuncuya ait token reddediliyor.
- [ ] Reconnect duplicate player oluşturmuyor ve eski socket’i kapatıyor.
- [ ] UI connecting/reconnecting/offline durumunu gösteriyor ve eylemleri kilitliyor.

## Rate Limit

- [ ] Genel REST, login ve register rate limitleri etkin.
- [ ] Genel Socket ve sohbet limitleri etkin.
- [ ] Oda oluşturma/katılma, gece eylemi ve oy verme event bazlı sınırlı.

## Logging

- [ ] Her HTTP yanıtında sunucu üretimli `X-Request-Id` var.
- [ ] Password, JWT, cookie, reconnect token ve database URL maskeleniyor.
- [ ] Production yanıtta stack trace veya dahili hata ayrıntısı yok.
- [ ] 401, 403, 429 ve 5xx oranları izleniyor.

## Health Check

- [ ] `/health` PostgreSQL `SELECT 1` ile 200/503 dönüyor.
- [ ] `/ready` trafik hazır olma durumunu 200/503 ile gösteriyor.
- [ ] Yanıtlar secret veya stack trace içermiyor.

## Graceful Shutdown

- [ ] `SIGTERM` ve `SIGINT` yeni bağlantıları durduruyor.
- [ ] HTTP/Socket server, timer’lar ve Prisma bağlantısı kontrollü kapanıyor.
- [ ] Shutdown timeout’u sonsuza kadar beklemeyi önlüyor.

## Vercel

- [ ] Root Directory `client`, framework Vite, output `dist`.
- [ ] `client/vercel.json` deep-link isteklerini `index.html` dosyasına yönlendiriyor.
- [ ] Production ve Preview environment kapsamları doğrulandı.

## Render

- [ ] `render.yaml` build/start komutları kök workspace lockfile’ını kullanıyor.
- [ ] Health check path `/health`.
- [ ] Ücretli, tek instance kullanılıyor; Free spin-down production için kullanılmıyor.
- [ ] Migration deployment zincirinde başarıyla uygulanıyor.

## Neon

- [ ] `DATABASE_URL` pooled, `DIRECT_URL` direct SSL bağlantısı.
- [ ] Connection, storage ve compute alarm eşikleri tanımlı.
- [ ] Restore/branch özelliği kullanılan planda doğrulandı.

## HTTPS

- [ ] Frontend ve backend yalnızca HTTPS.
- [ ] Mixed-content isteği yok.
- [ ] Secure cookie HTTPS üzerinde oluşuyor.

## Domain

- [ ] Vercel frontend ve Render backend domainleri doğrulandı.
- [ ] Özel ana domain ve `api` alt domain DNS/TLS planı hazır.
- [ ] Domain değişince CORS ve bütün public URL env değerleri güncellendi.

## Mobile Test

- [ ] 360 px genişlikte lobi, rol ekranı, oyun eylemleri, sohbet ve modal kullanılabilir.
- [ ] Dokunma hedefleri, yatay taşma ve sanal klavye davranışı kontrol edildi.

## Multi-user Test

- [ ] En az iki ayrı tarayıcı profili/cihaz aynı odaya katılıyor.
- [ ] Hazır durumu, faz, sayaç, eleme, sohbet ve sonuç state’i eşzamanlı.
- [ ] Refresh/reconnect ve bağlantı kesilip geri gelme senaryosu başarılı.

## Backup

- [ ] Migration öncesi Neon branch prosedürü belgelendi.
- [ ] Düzenli `pg_dump` veya planın eşdeğer yedeği etkin.
- [ ] Geri yükleme production dışı branch üzerinde test edildi.

## Monitoring

- [ ] Render service/health, Neon database ve Vercel deployment alarmları etkin.
- [ ] Loglarda secret bulunmadığı periyodik kontrol ediliyor.
- [ ] Uptime ve hata oranı panosu hazır.

## Rollback Plan

- [ ] Vercel önceki deployment’ı production’a promote etme adımı test edildi.
- [ ] Render önceki çalışan commit’i yeniden deploy etme adımı test edildi.
- [ ] Migration rollback yerine geriye uyumlu ileri-düzeltme migration planı hazır.
- [ ] Aktif oyun state’inin restart sırasında kaybolacağı operasyon ekibi tarafından kabul edildi.
