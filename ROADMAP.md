# Gece Meclisi Yol Haritası

## Sonraki teknik adımlar

1. Bellek içi `StateStore` için Redis uygulaması ve yatay ölçeklemede Socket.IO Redis adapter
2. Match ve MatchPlayer kayıtlarının maç sonunda transaction ile kalıcılaştırılması
3. Oda geçmişi, oyuncu istatistikleri ve profil başarımları
4. Docker tabanlı production image, ters proxy ve otomatik TLS
5. Entegrasyon, Socket.IO çoklu istemci ve uçtan uca tarayıcı testleri
6. Moderasyon araçları, kullanıcı engelleme ve gelişmiş sohbet denetimi

## Yeni oyunlar

`GameEngine` arayüzü ve `GameRegistry` korunarak farklı sosyal/masa oyunları ayrı paketler halinde eklenebilir. Yeni oyunlar ortak kullanıcı, oda, yeniden bağlanma ve güvenli sohbet altyapısını kullanır.

## İlk sürüm kapsamı dışında

- Sesli sohbet ve video görüşme
- Genel eşleştirme
- Turnuva sistemi
- Market ve ücretli üyelik
- Yapay zekâ oyuncuları

Bu özellikler çekirdek oda veya oyun motoruna gömülmeyecek; ayrı servis ve modüller olarak tasarlanacaktır.
