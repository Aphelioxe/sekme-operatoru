# Sekme Operatörü

Chrome için **Manifest V3** tabanlı, bağımlılıksız bir sekme operatörü. Tüm pencerelerdeki
açık sekmeleri tek listede toplar; aramanı, filtrelemeni, aralarında geçiş yapmanı ve
gereksiz yükü azaltmanı sağlar. Hiçbir veri dışarı gönderilmez; her şey tarayıcının içinde
çalışır.

## Özellikler

- Tüm pencerelerdeki sekmeleri listeler, pencereye göre gruplar
- Başlık ve adres üzerinden anlık arama (birden fazla kelime desteklenir)
- **Tümü / Bu pencere / Ses / Sabit** filtreleri
- Sekmeye tıklayınca o pencereye geçer ve sekmeyi etkinleştirir
- Satırdaki `×`, orta tık veya `Del` ile sekme kapatma
- Aynı adresi açan yinelenen sekmeleri tek tıkla temizleme
- Görünen sekmelerin bağlantılarını panoya kopyalama
- Sabitlenmiş, ses çalan ve **uykuda** sekmeler için rozetler
- **Tek sekme veya bu penceredeki uygun sekmeleri askıya alma** (bellekten boşaltma)
- Koyu/açık tema desteği
- `Ctrl+Shift+K` (macOS: `Cmd+Shift+K`) ile açma

## İndirme

Hazır paket: [Releases](https://github.com/Aphelioxe/sekme-operatoru/releases) sayfasından
`sekme-operatoru-2.0.0.zip` dosyasını indir, bir klasöre çıkar ve aşağıdaki adımları izle.

## Kurulum

1. Chrome'da `chrome://extensions` adresini aç.
2. Sağ üstteki **Geliştirici modu**nu aç.
3. **Paketlenmemiş öğe yükle** düğmesine tıkla.
4. İndirdiğin `sekme-operatoru` klasörünü seç (içinde `manifest.json` bulunmalı)
5. Araç çubuğundaki uzantı simgesine tıkla. Simgeyi görmek için bulmacaya tıklayıp
   **Sekme Operatörü**nü sabitleyebilirsin.

> Daha önce eklentiyi doğrudan `Projeler` klasöründen yüklediysen, `chrome://extensions`
> sayfasında eski kaydı **Kaldır** ile silip yeni klasörden yeniden yükle. Chrome, taşınan
> klasörü otomatik takip etmez.

Kurulumdan sonra kodda değişiklik yaparsan `chrome://extensions` sayfasındaki
**Yenile** düğmesine basman yeterli.

## Kullanım

| Kısayol | İşlev |
| --- | --- |
| `↑` / `↓` | Listede seçimi hareket ettirir |
| `Enter` | Seçili sekmeye geçer |
| `Del` | Seçili sekmeyi kapatır |
| `Esc` | Aramayı temizler; arama boşsa filtreyi sıfırlar; o da boşsa pencereyi kapatır |
| Orta tık | Sekmeyi kapatır |
| `Ctrl+Shift+K` | Sekme Operatörü'nü açar (tarayıcı genelinde) |

`Del` tuşu, arama kutusunda imleç metnin ortasındayken normal silme işlemi yapar; imleç
metnin sonundaysa seçili sekmeyi kapatır. Yanlışlıkla kapatılan sekmeler `Ctrl+Shift+T` ile
geri getirilebilir.

Alt çubuktaki **Yinelenenleri kapat** düğmesi aynı adresi açan fazladan sekmeleri kapatır;
sabitlenmiş veya o an etkin olan kopyayı korur. **Bağlantıları kopyala** ise arama/filtre
sonucunda eşleşen tüm sekmelerin adreslerini satır satır panoya yazar.

## Bellek kullanımı

Bu eklenti özellikle düşük RAM'li makineler için sade tutuldu:

- **Arka plan servis çalışanı yok.** Popup kapandığı anda eklentinin tüm kodu bellekten
  kalkar; sürekli çalışan bir süreç bırakmaz.
- **Yoklama (polling) yok.** `setInterval` veya sürekli sekme taraması kullanılmaz.
- Arama, yazma bitince kısa bir gecikmeyle bir kez çalışır.
- Liste ilk açılışta en fazla 120 satır oluşturur; gerisi **Daha fazla göster** ile gelir.
- Satır olayları tek bir dinleyiciyle yönetilir; her sekme için ayrı dinleyici eklenmez.
- Favicon'lar tembel yüklenir; harici ağ isteği, çerçeve veya kütüphane yoktur.

**Askıya al** işlemi, sekmeyi Chrome'un bellekten boşaltma mekanizmasıyla uyutur. Sekme
sekmede görünmeye devam eder ve tıklanınca yeniden yüklenir. Bu işlem:

- Yalnızca **etkin olmayan**, ses çalmayan, sabitlenmemiş ve izin verilen sekmelere uygulanır.
- Form bilgilerini, kaydedilmemiş metinleri veya oynatma durumunu kaybettirebilir.
- Otomatik değildir; yalnızca sen tıkladığında çalışır.

Tek bir sekmeyi uyutmak için satırın üzerine gelip ay simgesine tıkla. Bu penceredeki tüm
uygun sekmeler için üstteki **Askıya al** düğmesini iki kez onayla.

## Dosya yapısı

```text
sekme-operatoru/
├─ manifest.json    Uzantı tanımı, izinler ve kısayol
├─ popup.html       Popup arayüzü
├─ popup.css        Açık/koyu tema ve stiller
├─ popup.js         Sekme listeleme, arama, filtreler ve eylemler
├─ icons/           Araç çubuğu simgeleri (16/32/48/128 px)
└─ README.md
```

Ayrıca yine Chrome için hazırlanmış
[konser-modu](https://github.com/Aphelioxe/konser-modu) eklentisi bulunur; iki eklenti
birbirinden bağımsızdır.

## İzinler

Tek izin `tabs`:

- Sekmelerin başlığını ve adresini okuyabilmek
- Bir sekmeyi etkinleştirmek, kapatmak veya bellekten boşaltmak
- Sekmenin bulunduğu pencereyi öne getirmek

Bu izin Chrome kurulumunda "tüm sekmelerdeki bilgileri oku" uyarısını gösterir; sekme
operatörü için zorunludur. Uzantının ağ erişimi, uzak sunucusu, analitiği veya kalıcı
depolaması yoktur.
