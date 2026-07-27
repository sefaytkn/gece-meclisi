# Production Deployment

Bu belge Gece Meclisi monorepo’sunun şu mimariyle yayınlanmasını anlatır:

- Frontend: Vercel
- Backend ve Socket.IO: Render Web Service
- PostgreSQL: Neon
- Kaynak ve otomatik deployment: GitHub

## 1. GitHub’a push

Git kurulu değilse önce Git’i yükleyin. Repository kökünde:

```bash
git init
git branch -M main
git add .
git commit -m "Prepare Gece Meclisi for production"
git remote add origin https://github.com/KULLANICI/REPOSITORY.git
git push -u origin main
```

Push öncesinde `git status --short` ile `.env`, `node_modules`, `dist`, log, sertifika veya anahtar dosyalarının listelenmediğini doğrulayın. GitHub Actions, push ve pull request’lerde typecheck, test, Prisma doğrulama ve build çalıştırır.

## 2. Neon PostgreSQL oluşturma

1. Neon Console’da yeni bir proje oluşturun.
2. Production branch ve veritabanını oluşturun.
3. Render uygulama trafiği için Neon’un pooled connection string’ini kopyalayın. Bu değer `DATABASE_URL` olacaktır.
4. Migration işlemleri için pooler içermeyen direct connection string’i kopyalayın. Bu değer `DIRECT_URL` olacaktır.
5. Her iki URL’de de SSL parametresinin bulunduğunu doğrulayın.

Örnek biçimler:

```text
DATABASE_URL=postgresql://USER:PASSWORD@POOLER_HOST/DATABASE?sslmode=require
DIRECT_URL=postgresql://USER:PASSWORD@DIRECT_HOST/DATABASE?sslmode=require
```

Gerçek bağlantı bilgilerini repository’ye veya belgelere yazmayın.

## 3. Render Web Service oluşturma

En güvenli yol repository kökündeki `render.yaml` Blueprint’ini kullanmaktır.

1. Render Dashboard’da **New → Blueprint** seçin.
2. GitHub repository’sini bağlayın.
3. Blueprint yolu olarak repository kökündeki `render.yaml` dosyasını kullanın.
4. Root Directory değeri `.` olmalıdır; npm workspaces lockfile’ı repository kökündedir.
5. Build command:

   ```bash
   npm ci && npm run prisma:generate -w server && npm run prisma:migrate:deploy -w server && npm run build -w server
   ```

6. Migration komutu build zincirindedir. Böylece Render'ın pre-deploy komutunu desteklemeyen Free planında da migration uygulanır. Paid plan kullanılıyorsa migration adımı istenirse build komutundan çıkarılıp aşağıdaki pre-deploy komutuna taşınabilir:

   ```bash
   npm run prisma:migrate:deploy -w server
   ```

7. Start command:

   ```bash
   npm run start -w server
   ```

8. Health check path:

   ```text
   /health
   ```

9. Otomatik deployment, GitHub kontrolleri geçtikten sonra çalışacak şekilde `checksPass` olarak ayarlanmıştır.

Production oyun trafiği için ücretli bir Render instance kullanın. Free web service boşta kaldığında kapanabilir, yeniden başlatılabilir ve sonraki bağlantıda soğuk başlatma gecikmesi oluşturabilir; bu projedeki aktif oda state'i bellekte olduğu için instance değişimi aktif oyunu sonlandırır.

### Render environment variables

Render Dashboard’da şu değerleri girin:

| Değişken | Değer |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Neon pooled connection string |
| `DIRECT_URL` | Neon direct connection string |
| `JWT_SECRET` | En az 32 karakterlik kriptografik rastgele secret |
| `CLIENT_URL` | İlk Vercel production URL’si |
| `CORS_ORIGIN` | İzin verilen frontend URL’leri, virgülle ayrılmış |
| `COOKIE_SECURE` | `true` |
| `COOKIE_SAME_SITE` | `none` |
| `COOKIE_NAME` | İsteğe bağlı; varsayılan `gece_session` |
| `RECONNECT_GRACE_MS` | İsteğe bağlı; varsayılan `60000` |

`PORT` değerini elle tanımlamayın; Render bu değeri çalışma zamanında verir.

## 4. İlk backend deployment

Frontend URL’si henüz yoksa geçici olarak planlanan Vercel proje URL’sini `CLIENT_URL` ve `CORS_ORIGIN` içine yazın. İlk deployment’tan sonra:

1. Render loglarında env doğrulamasının geçtiğini kontrol edin.
2. `https://BACKEND.onrender.com/health` adresinin HTTP 200 verdiğini doğrulayın.
3. `https://BACKEND.onrender.com/ready` adresinin PostgreSQL hazırken HTTP 200, erişilemiyorken HTTP 503 verdiğini doğrulayın.
4. Yanıtta yalnızca `success`, `status` ve `timestamp` alanları bulunmalıdır.
5. Migration başarısızsa `db push`, `migrate dev` veya reset kullanmayın; Neon/Render değişkenlerini düzeltip deployment’ı tekrar çalıştırın.

Seed idempotent bir `upsert` kullanır ancak her deployment’ta otomatik çalıştırılmaz. İlk kurulumda yalnızca bir kez, güvenli bir yönetim ortamından çalıştırın:

```bash
npm run prisma:seed -w server
```

## 5. Vercel projesi oluşturma

1. Vercel Dashboard’da **Add New → Project** seçin.
2. Aynı GitHub repository’sini bağlayın.
3. Root Directory değerini `client` yapın.
4. Framework Preset: `Vite`.
5. Build command: `npm run build`.
6. Output Directory: `dist`.
7. `client/vercel.json`, React Router deep-link isteklerini `index.html` dosyasına yönlendirir.

### Vercel environment variables

Production, Preview ve gerekiyorsa Development ortamlarında:

| Değişken | Değer |
|---|---|
| `VITE_API_URL` | `https://BACKEND.onrender.com` |
| `VITE_SOCKET_URL` | `https://BACKEND.onrender.com` |

Frontend’de JWT, database URL, password veya başka bir secret tanımlamayın. `VITE_` önekli her değer tarayıcıya açıktır.

## 6. Frontend URL’sini CORS’a ekleme

İlk Vercel deployment tamamlandığında:

1. Kesin production URL’sini kopyalayın.
2. Render `CLIENT_URL` değerini bu URL ile güncelleyin.
3. Render `CORS_ORIGIN` listesine aynı URL’yi ekleyin.
4. Kullanılan Vercel preview URL’leri sabitse bunları virgülle ayrılmış olarak ekleyin; wildcard kullanmayın.
5. Backend’i yeniden deploy edin.
6. Ardından frontend’i yeniden deploy ederek iki adresin birbirini kullandığını doğrulayın.

## 7. Production smoke test

İki ayrı tarayıcı profili veya cihazla:

1. `/health` HTTP 200 ve `healthy` dönüyor.
2. `/ready` HTTP 200 ve `ready` dönüyor.
3. Kayıt, giriş ve çıkış çalışıyor.
4. Login yanıtında `Secure`, `HttpOnly`, `SameSite=None` cookie oluşuyor.
5. Frontend URL’sinden izinli CORS yanıtı geliyor.
6. Bilinmeyen bir origin 403 alıyor.
7. Bilinmeyen bir origin doğrudan WebSocket upgrade isteğiyle de bağlanamıyor.
8. Özel oda oluşturuluyor ve altı karakterli kod üretilebiliyor.
9. İkinci cihaz misafir olarak katılabiliyor.
10. Hazır durumu iki tarafta eşzamanlı güncelleniyor.
11. Oyun başlıyor; her oyuncu yalnızca kendi rolünü görüyor.
12. Faz süresi dolduktan sonra gönderilen gece/oy eylemi reddediliyor.
13. Vampir ve ölü sohbetleri yetkisiz oyunculara ulaşmıyor.
14. Sayfa yenilendiğinde reconnect token ile aynı oyuncu ve özel state geri geliyor.
15. Render restart sırasında aktif odaların bellekten silineceği kabul ediliyor.

## 8. Özel domain bağlama

Önerilen nihai yapı:

```text
https://oyunadi.com       → Vercel
https://api.oyunadi.com   → Render
```

Domainler bağlandıktan sonra:

- `CLIENT_URL=https://oyunadi.com`
- `CORS_ORIGIN=https://oyunadi.com,https://www.oyunadi.com`
- `VITE_API_URL=https://api.oyunadi.com`
- `VITE_SOCKET_URL=https://api.oyunadi.com`

değerlerini güncelleyin ve iki servisi yeniden deploy edin. Aynı ana domain altındaki yapı, üçüncü taraf cookie kısıtlamalarından etkilenme riskini azaltır.

## 9. Deployment geri alma

- Vercel: Deployments ekranından çalışan önceki deployment için **Promote to Production** kullanın.
- Render: Events/Deploys ekranından çalışan commit’i seçip yeniden deploy edin.
- Veritabanı migration’ını uygulama rollback’iyle otomatik geri çevirmeyin. Geriye uyumlu migration yapın; gerekiyorsa ayrı bir ileri-düzeltme migration’ı yayınlayın.

## 10. Veritabanı yedekleme

- Neon’un branch/restore ve point-in-time recovery seçeneklerini kullanılan plana göre etkinleştirin.
- Migration öncesi bir Neon branch oluşturun.
- Düzenli mantıksal yedek için güvenli bir ortamdan `pg_dump` planlayın.
- Yedek geri yükleme prosedürünü production dışı bir branch üzerinde periyodik olarak test edin.

## 11. İzleme

- Render health check ve service alert’lerini etkinleştirin.
- Neon connection, storage ve compute metrikleri için uyarı kurun.
- Vercel deployment/availability bildirimlerini etkinleştirin.
- Loglarda secret bulunmadığını ve 401/403/429/5xx oranlarını düzenli kontrol edin.

## Bilinen production kısıtları

- Aktif oda ve maç state'i bellektedir. Render yeniden başlatılırsa aktif oyunlar kaybolur.
- Birden fazla backend instance kullanılmamalıdır. Yatay ölçekleme öncesinde Redis state store ve Socket.IO Redis adapter gerekir.
- Render Free instance production gerçek zamanlı oyun için uygun değildir; boşta kapanma, soğuk başlangıç ve beklenmeyen restart aktif oyunları kesebilir.
- Render ve Vercel'in geçici domainleri farklı site kabul edilebilir. Bazı tarayıcıların üçüncü taraf cookie politikaları oturumu etkileyebilir; özel ana domain ve `api` alt domainine erken geçiş önerilir.
