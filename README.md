# Gece Meclisi

Gece Meclisi, ilk oyunu **Vampir Köylü** olan web tabanlı çok oyunculu bir oyun platformudur. React arayüzü, Express/Socket.IO sunucusu, PostgreSQL ve Prisma ile çalışır. Oda altyapısı ile oyuna özel kurallar birbirinden ayrılmıştır; yeni oyunlar `GameRegistry` üzerinden eklenebilir.

## Öne çıkan özellikler

- Kayıt, giriş, çıkış ve güvenli `httpOnly` oturum cookie’si
- Hesap açmadan misafir adıyla odaya katılım
- Altı karakterli özel oda kodu, oda şifresi, paylaşılabilir bağlantı
- Hazır durumu, oda sahibi yetkileri, oyuncu atma ve otomatik sahiplik aktarımı
- Dengeli/serbest rol dağılımı ve tamamen backend tarafında kriptografik rol karıştırma
- Vampir, Köylü ve Doktor rolleri; gece, tartışma, oylama ve kazanan akışı
- Lobi, gündüz, Vampir ve ölü sohbetleri için sunucu taraflı erişim kontrolü
- Bağlantı kopması, güvenli yeniden bağlanma token’ı ve özel state’in yeniden gönderilmesi
- Mobil, tablet ve masaüstüne uyumlu koyu oyun arayüzü
- Oyun motorundan bağımsız Vitest testleri

## Mimari

```text
gece-meclisi/
├─ client/                       React + Vite + TypeScript + Tailwind
│  └─ src/
│     ├─ games/vampire-village/ Oyuna özel sayfalar
│     ├─ components/            Ortak arayüz bileşenleri
│     ├─ context/               Kimlik doğrulama
│     ├─ hooks/                 Socket ve sayaç hook’ları
│     └─ services/              REST, Socket ve yeniden bağlanma
├─ server/                       Express + Socket.IO + TypeScript
│  ├─ prisma/                   Schema, migration ve seed
│  └─ src/
│     ├─ games/core/            GameEngine ve GameRegistry
│     ├─ games/vampire-village/ Bağımsız oyun motoru ve kurallar
│     ├─ routes/                 REST rotaları
│     ├─ socket/                 Socket olay yönlendirmesi
│     ├─ services/               Oda ve state servisleri
│     └─ middleware/             Kimlik ve güvenlik katmanı
├─ docker-compose.yml
├─ .env.example
└─ ROADMAP.md
```

Aktif oda ve maç state’i ilk sürümde `StateStore` arayüzünün bellek içi uygulamasında tutulur. Bu sınır, ileride Redis uygulamasına geçerken oyun motorunu veya Socket.IO olaylarını değiştirmemek için vardır. Kullanıcılar ve maç kayıtları için Prisma şeması hazırdır; aktif oyun sürekliliği henüz PostgreSQL’e yazılmaz.

## Gereksinimler

- Node.js 20.19 veya üzeri
- npm 10 veya üzeri
- Docker Desktop (önerilir) ya da çalışan bir PostgreSQL 16 sunucusu

## Kurulum

### 1. Bağımlılıkları yükle

```bash
npm ci
```

### 2. Ortam dosyasını hazırla

PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS/Linux:

```bash
cp .env.example .env
```

Production ortamında `JWT_SECRET` değerini en az 32 karakterlik rastgele bir değerle değiştirin. HTTPS kullanırken `COOKIE_SECURE=true` olmalıdır.

### 3. PostgreSQL’i başlat

```bash
docker compose up -d postgres
```

### 4. Prisma istemcisini ve veritabanını hazırla

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

Seed komutu `vampire-village` oyun kaydını ekler veya günceller.

## Geliştirme

Frontend ve backend’i birlikte başlat:

```bash
npm run dev
```

- Arayüz: `http://localhost:5173`
- API ve Socket.IO: `http://localhost:4000`
- Sağlık kontrolü: `http://localhost:4000/health`
- Hazır olma kontrolü: `http://localhost:4000/ready`

Yalnızca bir katmanı başlatmak için:

```bash
npm run dev -w client
npm run dev -w server
```

## Test ve üretim

Backend oyun motoru testleri:

```bash
npm test
```

İzleme modunda test:

```bash
npm run test:watch
```

Frontend ve backend production build:

```bash
npm run build
```

Build sonrasında derlenmiş backend’i çalıştır:

```bash
$env:NODE_ENV="production"
npm start
```

Linux/macOS için:

```bash
NODE_ENV=production npm start
```

Production mimarisinde frontend ayrı olarak Vercel’den, backend Render’dan sunulur.
Yerel frontend build önizlemesi için `npm run preview -w client` kullanın.

## REST API

Tüm cevaplar `{ "success": true, "data": ... }` veya `{ "success": false, "error": { "code", "message" } }` biçimindedir.

| Yöntem | Yol | Açıklama |
|---|---|---|
| `GET` | `/health` | Sunucu ve PostgreSQL sağlık kontrolü |
| `GET` | `/api/health` | Geriye uyumlu sağlık kontrolü |
| `GET` | `/ready` | PostgreSQL bağlantısını doğrulayan hazır olma kontrolü |
| `POST` | `/api/auth/register` | Kullanıcı oluşturur ve cookie ayarlar |
| `POST` | `/api/auth/login` | Oturum açar ve cookie ayarlar |
| `POST` | `/api/auth/logout` | Oturum cookie’sini temizler |
| `GET` | `/api/auth/me` | Oturum sahibinin profilini getirir |
| `GET` | `/api/games` | Aktif oyunları listeler |

## Socket.IO olayları

Her istemci isteği son parametre olarak acknowledgement callback kullanır.

Başarılı acknowledgement:

```json
{ "success": true, "data": {} }
```

Hatalı acknowledgement:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_ROLE_TOTAL",
    "message": "Rol sayısı oyuncu sayısına eşit olmalıdır."
  }
}
```

### Oda olayları

| İstemci → Sunucu | Payload | İşlev |
|---|---|---|
| `room:create` | `{ name, maxPlayers, password? }` | Oda oluşturur |
| `room:join` | `{ code, password?, reconnectToken? }` | Katılır veya yeniden bağlanır |
| `room:leave` | `{}` | Odadan ayrılır |
| `room:ready` | `{ ready }` | Hazır durumunu değiştirir |
| `room:kick` | `{ targetId }` | Oda sahibinin oyuncu atması |
| `room:update-settings` | `{ settings }` | Rol ve oyun ayarlarını günceller |
| `room:transfer-owner` | `{ targetId }` | Sahipliği aktarır |
| `room:start` | `{}` | Doğrulamalar geçerse oyunu başlatır |
| `room:rematch` | `{}` | Bitmiş maçı lobiye sıfırlar |

Sunucu yayınları: `room:state`, `room:kicked`.

### Oyun olayları

| Olay | Yön | Açıklama |
|---|---|---|
| `game:started` | Sunucu → Oda | Oyun başladı |
| `game:private-role` | Sunucu → Tek oyuncu | Yalnızca alıcının rolü ve özel state’i |
| `game:phase-changed` | Sunucu → Oda | Aşama ve bitiş zamanı |
| `game:night-action` | İstemci → Sunucu | Vampir/Doktor hedefi |
| `game:vote` | İstemci → Sunucu | Gündüz oyu |
| `game:vote-updated` | Sunucu → Oda | Bir oyun alındığını bildirir; hedefi açıklamaz |
| `game:player-eliminated` | Sunucu → Oda | Elenen oyuncu |
| `game:round-result` | Sunucu → Oda | Tur sonucu |
| `game:ended` | Sunucu → Oda | Kazanan ve rol içermeyen son genel state |
| `game:state` | Sunucu → Oda | Rol içermeyen genel oyun state’i |

### Sohbet olayları

- `chat:send`: `{ channel: "LOBBY" | "DAY" | "VAMPIRE" | "DEAD", message }`
- `chat:message`: Yetkili alıcılara temizlenmiş mesaj
- `chat:system-message`: Katılma/ayrılma gibi sistem mesajı

Mesajlar 400 karakterle sınırlıdır. Oyuncu kimliği başına 10 saniyede en fazla 6 mesaj kabul edilir. HTML etiketleri temizlenir. Vampir ve ölü sohbetleri genel oda yayınına dönüştürülmez; alıcı socket’leri sunucuda rol/canlılık state’ine göre seçilir.

Kazanan kontrolünde Vampirlerin sayı eşitliği zaferi ancak en az bir tam gece–gündüz oylama döngüsü tamamlandıktan sonra devreye girer. Böylece serbest rol dağılımı oyunu başlangıçta veya ilk gecenin sonunda aniden bitirmez.

## Güvenlik notları

- Şifreler bcrypt algoritmasıyla 12 maliyet faktöründe hashlenir.
- JWT yalnızca `httpOnly` cookie içinde tutulur; `Secure` ve `SameSite` değerleri doğrulanmış environment ayarından gelir.
- Helmet, dar CORS politikası, REST rate limit, Zod şemaları ve Prisma parametreli sorguları kullanılır.
- Oda sahibi, canlılık, rol, aşama ve oyuncu kimliği istemciden alınmaz; sunucu state’inden doğrulanır.
- Genel oyun state’i oyun bittikten sonra dahi rol içermez; rol yalnızca ilgili oyuncunun özel event’inde bulunur.
- Yeniden bağlanma token’ı oyuncu kimliğiyle birlikte kontrol edilir.

Gelecek sürüm başlıkları için [ROADMAP.md](./ROADMAP.md) dosyasına bakın.

## Production deployment

Vercel, Render, Neon ve GitHub tabanlı production kurulumu için
[DEPLOYMENT.md](./DEPLOYMENT.md) dosyasını; canlıya çıkış öncesi doğrulamalar için
[PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) dosyasını kullanın.
