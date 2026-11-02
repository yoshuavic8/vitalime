# Personal Health OS --- Roadmap

> **Tujuan:** aplikasi kesehatan dan kebugaran pribadi untuk iPhone,
> berorientasi offline-first, tanpa akun pengguna, tanpa database
> server, dan tanpa kewajiban signing ulang setiap 7 hari.
>
> **Platform target:** iPhone 14, iOS 27 (versi perangkat sebagaimana
> diinformasikan pengguna).
>
> **Dokumen:** Product & Technical Roadmap v1.0

------------------------------------------------------------------------

## 1. Ringkasan Produk

Personal Health OS adalah jurnal kesehatan pribadi yang menggabungkan:

1.  **Nutrition Journal** --- pencatatan makanan, foto makanan, kalori,
    protein, karbohidrat, dan lemak.
2.  **Apple Health Activity** --- memasukkan data aktivitas dan olahraga
    dari Apple Health.
3.  **Workout Program** --- program weight training, jadwal latihan,
    pencatatan set/repetisi/beban, dan progres.
4.  **Body Progress** --- berat badan, lingkar pinggang, dan tren
    perubahan tubuh.
5.  **AI Food Analysis & Coach** --- bantuan analisis foto makanan dan
    ringkasan pola melalui Grok, jika tersedia jalur API yang sesuai.
6.  **Dashboard & Reports** --- ringkasan harian, mingguan, dan bulanan.

Prinsip utama: **aplikasi inti harus tetap berfungsi tanpa internet**.
AI merupakan fitur tambahan yang memerlukan koneksi.

## 2. Keputusan Produk dan Batasan Penting

### 2.1 PWA sebagai aplikasi utama

PWA dipilih karena: - Dapat ditambahkan ke Home Screen iPhone. - Tidak
membutuhkan proses signing IPA setiap 7 hari. - Dapat berjalan offline
setelah asset aplikasi berhasil di-cache. - Dapat menyimpan data lokal
menggunakan IndexedDB. - Tidak memerlukan backend/database server untuk
fungsi inti.

PWA tetap memerlukan satu kali proses hosting melalui HTTPS untuk
instalasi awal, Service Worker, dan pembaruan versi aplikasi. Hosting
statis gratis dapat digunakan. Setelah terpasang dan cache tersedia,
pencatatan harian dapat dilakukan offline.

### 2.2 IndexedDB, bukan SQLite

Gunakan **IndexedDB dengan Dexie.js** sebagai database utama.

Alasannya: - Native tersedia di browser iOS. - Mendukung penyimpanan
objek dan Blob (foto). - Mendukung transaksi dan indeks. - Cocok untuk
aplikasi offline-first. - Tidak membutuhkan SQLite WASM atau OPFS pada
MVP.

Abstraksi repository/data-access harus dibuat agar mesin penyimpanan
dapat diganti kelak tanpa menulis ulang seluruh UI.

### 2.3 Apple Health bukan API yang bisa dibaca PWA secara langsung

PWA di Safari tidak memperoleh akses langsung ke HealthKit. Apple
mensyaratkan aplikasi iOS dengan HealthKit capability/entitlement dan
izin pengguna untuk membaca jenis data kesehatan yang dipilih.

Implikasinya: - PWA tidak boleh mengklaim sinkronisasi Apple Health
otomatis. - MVP menggunakan impor data. - Integrasi lebih praktis dapat
dieksplorasi melalui Apple Shortcuts yang mengambil data Health yang
tersedia dan mengekspornya sebagai JSON/CSV untuk diimpor ke PWA. -
Sinkronisasi HealthKit langsung membutuhkan komponen native iOS
(misalnya SwiftUI/HealthKit atau native wrapper). Komponen tersebut
memiliki proses signing Apple tersendiri dan tidak menghilangkan batas 7
hari pada Personal Team gratis.

**Prioritas:** bangun PWA terlebih dahulu; jangan menunda seluruh produk
karena integrasi HealthKit.

### 2.4 Cursor subscription dan Grok API adalah dua hal berbeda

Cursor Premium/berlangganan dan akses Grok melalui produk Cursor tidak
otomatis berarti aplikasi buatan sendiri dapat memakai kuota tersebut
sebagai API eksternal.

Sebelum mengembangkan integrasi otomatis: - Pastikan tersedia API key
resmi dari provider. - Pastikan penggunaan API dan billing-nya. - Jangan
mengambil atau mengotomasi sesi login/cookie Cursor atau Grok. - Jangan
menaruh API key di JavaScript frontend/PWA.

Jika pengguna hanya memiliki langganan Cursor tanpa API key/billing API
eksternal, MVP tetap dapat berjalan dengan workflow **manual AI
handoff**: ekspor foto dan prompt dari aplikasi, kirim melalui fitur
Share ke aplikasi Grok yang tersedia, lalu masukkan hasil analisis
kembali ke jurnal.

Jika kemudian tersedia API key resmi dan billing, tambahkan
backend/proxy tipis untuk menjaga key. Backend tersebut hanya menjadi
perantara AI, bukan database utama. Foto hanya dikirim setelah pengguna
menekan tombol analisis dan memberi persetujuan.

------------------------------------------------------------------------

## 3. Sasaran Pengguna dan Prinsip UX

**Pengguna:** satu orang, satu iPhone, tanpa akun dan tanpa sinkronisasi
multi-device.

Prinsip UX: - Input makanan maksimal beberapa langkah. - Foto makanan
dapat disimpan dahulu tanpa internet. - Estimasi AI selalu berstatus
*draft* sampai dikonfirmasi. - Angka nutrisi dapat diedit manual. -
Aktivitas impor tidak boleh menggandakan data. - Semua tanggal dan waktu
mengikuti zona waktu perangkat. - Dashboard menampilkan sumber data dan
waktu pembaruan. - Pengguna dapat mengekspor seluruh data kapan saja.

## 4. Modul Fungsional

### 4.1 Home Dashboard

Menampilkan: - Tanggal hari ini. - Total kalori makanan. - Target kalori
harian dan sisa target. - Protein, karbohidrat, lemak. -
Aktivitas/olahraga hari ini. - Ringkasan latihan beban. - Berat badan
terbaru. - Tombol cepat: Tambah Makanan, Foto Makanan, Tambah Aktivitas,
Catat Berat, Mulai Workout. - Status offline/online dan status impor
Health terakhir.

Jangan menggabungkan kalori makanan dengan kalori aktivitas menjadi satu
angka tanpa label. Tampilkan secara terpisah: - **Energy intake:**
kalori dari makanan/minuman. - **Active energy:** energi aktif dari
Apple Health. - **Resting energy:** jika tersedia dari Apple Health. -
**Total energy expenditure:** hanya dihitung jika sumber dan rumusnya
jelas.

Hindari mengurangkan kalori olahraga dari target makanan secara otomatis
sebelum pengguna memilih metode target (misalnya target tetap atau
target yang disesuaikan aktivitas).

### 4.2 Nutrition / Food Journal

Fitur: - Tambah entri makanan berdasarkan waktu makan: sarapan, makan
siang, makan malam, snack, minuman. - Nama makanan dan deskripsi. -
Porsi dan satuan: gram, ml, buah, potong, sendok, porsi. - Kalori,
protein, karbohidrat, lemak. - Foto satu atau beberapa foto. - Catatan:
cara memasak, saus/minyak, bahan tambahan. - Edit, hapus, duplikasi
entri. - Simpan makanan favorit/template makanan. - Cari dan gunakan
kembali makanan yang pernah dicatat. - Rekap harian dan mingguan.

**Foto makanan:** - Simpan Blob di IndexedDB. - Buat thumbnail
terkompresi untuk tampilan daftar. - Simpan foto asli/versi resolusi
cukup jika kapasitas memungkinkan. - Foto tidak dikirim ke AI secara
otomatis. - Sediakan aksi eksplisit "Analisis dengan AI". - Tampilkan
indikator ukuran penyimpanan dan alat untuk menghapus foto lama.

**AI food analysis (opsional):** Input yang dikirim: - Foto makanan yang
dipilih. - Waktu makan. - Deskripsi tambahan pengguna. - Instruksi untuk
mengestimasi jenis makanan, komponen, ukuran porsi, dan rentang
kalori/makro.

Output terstruktur: - Identifikasi makanan. - Komponen makanan. -
Estimasi porsi dan asumsi. - Estimasi kalori. - Protein, karbohidrat,
lemak. - Tingkat keyakinan/kualitas estimasi. - Pertanyaan klarifikasi
jika porsi tidak dapat diperkirakan.

Aturan: - AI tidak boleh mengarang berat gram seolah-olah pasti. -
Tampilkan rentang atau label estimasi jika ukuran porsi tidak jelas. -
Pengguna wajib mengonfirmasi sebelum hasil menjadi entri final. - Simpan
prompt, model, waktu analisis, dan hasil untuk audit pribadi.

### 4.3 Apple Health Activity Import

Data yang ingin diimpor jika tersedia dan diizinkan: - Workouts: jenis,
waktu mulai/selesai, durasi. - Active energy burned. - Resting energy. -
Steps. - Walking/running distance. - Cycling distance. - Heart rate:
rata-rata dan maksimum bila tersedia. - Exercise minutes. - Body weight
dan body measurements jika pengguna mencatatnya di Health.

**Tahapan integrasi:**

**MVP --- Import manual** - Sediakan format JSON/CSV yang
terdokumentasi. - Sediakan halaman Import Health Data. - Tampilkan
preview, jumlah record, tanggal, jenis data, dan kemungkinan
duplikasi. - Pengguna mengonfirmasi sebelum impor.

**Tahap berikutnya --- Apple Shortcuts** - Riset aksi Shortcuts yang
tersedia di versi iOS target untuk menemukan sampel Health. - Buat
Shortcut yang meminta rentang tanggal, mengambil tipe data yang
didukung, membentuk JSON, lalu membagikannya ke PWA atau menyimpannya
sebagai file. - PWA menerima file JSON melalui file picker/share
workflow yang didukung Safari. - Catat waktu impor dan sumber data. -
Uji apakah Shortcuts dapat mengambil setiap metrik yang dibutuhkan;
jangan mengasumsikan semua tipe Health tersedia.

**Tahap lanjutan --- Native HealthKit bridge** - Buat proof-of-concept
SwiftUI kecil dengan HealthKit capability. - Minta izin baca hanya untuk
jenis data yang diperlukan. - Ekspor hasil HealthKit sebagai JSON ke PWA
melalui mekanisme lokal yang aman. - Evaluasi signing, instalasi, dan
pemeliharaan aplikasi native sebelum memutuskan apakah layak dipakai. -
Jangan menjadikan modul native sebagai syarat menjalankan PWA.

**Pencegahan duplikasi:** - Gunakan identifier HealthKit jika
tersedia. - Jika tidak tersedia, buat fingerprint dari tipe data, waktu
mulai/selesai, nilai, unit, dan sumber. - Impor ulang file yang sama
harus menghasilkan nol duplikasi.

**Perhitungan energi:** - Bedakan active energy dan resting energy. -
Jangan menjumlahkan total energy expenditure dengan active energy lagi
jika total tersebut sudah mencakupnya. - Simpan nilai asli, unit asli,
sumber, dan nilai normalisasi. - Hindari menganggap kalori olahraga
sebagai kalori makanan yang "boleh dimakan kembali" tanpa pengaturan
pengguna.

### 4.4 Weight Training Program

Modul ini bukan sekadar daftar latihan. Pengguna dapat membuat program,
mengikuti sesi, dan memantau progres.

**Program:** - Nama program. - Tujuan program. - Tanggal mulai dan
akhir. - Jumlah hari latihan per minggu. - Split latihan (Full Body,
Upper/Lower, Push/Pull/Legs, atau custom). - Hari latihan dan hari
istirahat. - Daftar exercise per sesi. - Target set, repetisi, beban,
dan waktu istirahat. - Catatan instruksi teknik.

**Exercise library:** - Nama latihan. - Kelompok otot utama dan
sekunder. - Equipment: bodyweight, dumbbell, barbell, machine, cable,
resistance band. - Pola gerakan: push, pull, squat, hinge, lunge, carry,
core. - Instruksi singkat. - Alternatif latihan. - Penanda latihan yang
perlu modifikasi.

**Workout session:** - Mulai/akhiri sesi. - Catat set per exercise. -
Beban, repetisi, RPE atau reps-in-reserve opsional. - Waktu istirahat. -
Set selesai/dilewati. - Catatan rasa sakit/ketidaknyamanan dan energi. -
Riwayat sesi.

**Progressive overload:** - Tampilkan performa latihan sebelumnya. -
Sarankan kenaikan beban/repetisi hanya bila target sebelumnya tercapai
dengan teknik baik dan tanpa nyeri. - Jangan menaikkan beban otomatis. -
Sediakan deload/rest week sebagai opsi. - Catat personal best dan volume
latihan.

**Program awal:** Jangan hard-code satu program yang dianggap cocok
untuk semua orang. Sediakan template yang dapat diedit, misalnya: - Full
Body 2 hari/minggu. - Full Body 3 hari/minggu. - Upper/Lower 4
hari/minggu.

Setiap template harus dapat disesuaikan dengan tingkat pengalaman,
peralatan, waktu, dan batasan gerak pengguna. Sediakan peringatan untuk
menghentikan latihan bila muncul nyeri tajam atau gejala yang tidak
biasa. Aplikasi bukan pengganti penilaian profesional kesehatan.

### 4.5 Body Progress

Field: - Berat badan. - Lingkar pinggang. - Lingkar
dada/pinggul/lengan/paha opsional. - Tanggal dan waktu. - Foto progres
opsional. - Catatan kondisi.

Fitur: - Grafik tren 7/30/90 hari. - Rata-rata bergerak 7 hari untuk
berat. - Perubahan sejak tanggal awal. - Catatan yang dapat dikaitkan
dengan program latihan. - Tidak menilai keberhasilan hanya dari satu
pengukuran harian.

### 4.6 AI Coach / Weekly Review

Tujuan AI: - Merangkum pola makan. - Menemukan makanan yang sering
dicatat. - Menyoroti hari yang kurang lengkap pencatatannya. - Merangkum
asupan protein dan kalori. - Merangkum konsistensi olahraga. - Mengulas
progres latihan beban. - Membantu menyusun pertanyaan untuk konsultasi
profesional.

AI tidak boleh: - Mendiagnosis penyakit. - Mengubah target kalori atau
program latihan tanpa persetujuan. - Menganggap estimasi foto sebagai
data pasti. - Mengarang data yang tidak ada. - Menyarankan perubahan
obat atau terapi.

**Privasi:** AI hanya menerima data yang dipilih pengguna. Sediakan
ringkasan teks tanpa foto untuk review mingguan agar pengguna dapat
mengurangi data yang dibagikan.

### 4.7 Settings

-   Profil dasar dan satuan.
-   Target kalori/makro.
-   Preferensi target aktivitas.
-   Zona waktu.
-   Pengaturan AI dan persetujuan pengiriman data.
-   Import/export.
-   Pengelolaan foto dan kapasitas penyimpanan.
-   Reset data dengan konfirmasi.
-   Versi aplikasi dan status backup.

------------------------------------------------------------------------

## 5. Rancangan Data IndexedDB

Gunakan Dexie.js. Nama database awal: `personal-health-os`.

Tabel yang disarankan:

  Table                Isi utama
  -------------------- ------------------------------------------------
  `profile`            Profil dasar, satu record utama
  `goals`              Target kalori dan makro dengan tanggal berlaku
  `foodEntries`        Catatan makanan
  `foodPhotos`         Blob foto, thumbnail, metadata
  `foodTemplates`      Makanan favorit/template
  `activityEntries`    Aktivitas manual dan hasil impor
  `healthImports`      Riwayat file/sumber impor
  `bodyMeasurements`   Berat dan ukuran tubuh
  `exerciseLibrary`    Katalog latihan
  `trainingPrograms`   Program latihan
  `programDays`        Susunan hari dalam program
  `programExercises`   Exercise dalam satu hari program
  `workoutSessions`    Sesi latihan aktual
  `workoutSets`        Set, repetisi, beban, RPE
  `aiAnalyses`         Prompt, model, hasil, status konfirmasi
  `dailyNotes`         Catatan harian
  `appSettings`        Preferensi aplikasi
  `schemaMeta`         Versi database dan migrasi

### Aturan data

-   Semua record memiliki `id` unik.
-   Record penting memiliki `createdAt` dan `updatedAt`.
-   Simpan waktu dalam ISO timestamp dan tanggal lokal terpisah untuk
    agregasi harian.
-   Simpan unit secara eksplisit (`kg`, `g`, `kcal`, `km`, `min`).
-   Simpan asal data: `manual`, `apple_health_import`,
    `shortcut_import`, atau `ai_estimate`.
-   Simpan status verifikasi: `draft`, `confirmed`, `corrected`.
-   Jangan menyimpan foto sebagai Base64 jika Blob dapat digunakan.
-   Buat indeks tanggal, kategori, dan relasi yang sering dicari.
-   Gunakan transaksi saat menyimpan entri dan foto terkait.

### Contoh bentuk record (konseptual)

``` ts
type FoodEntry = {
  id: string;
  consumedAt: string;
  localDate: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack" | "drink";
  name: string;
  portionValue?: number;
  portionUnit?: string;
  caloriesKcal?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  source: "manual" | "ai_estimate";
  verification: "draft" | "confirmed" | "corrected";
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

type ActivityEntry = {
  id: string;
  activityType: string;
  startedAt: string;
  endedAt?: string;
  durationMinutes?: number;
  distanceKm?: number;
  activeEnergyKcal?: number;
  averageHeartRate?: number;
  source: "manual" | "apple_health_import" | "shortcut_import";
  externalId?: string;
  fingerprint: string;
  createdAt: string;
};

type WorkoutSet = {
  id: string;
  sessionId: string;
  exerciseId: string;
  setNumber: number;
  reps?: number;
  weightKg?: number;
  rpe?: number;
  completed: boolean;
};
```

------------------------------------------------------------------------

## 6. Arsitektur Teknis

``` text
iPhone Home Screen
        |
        v
Next.js PWA (HTTPS)
        |
        +---- UI: React + Tailwind
        |
        +---- Service Worker
        |       +---- App shell cache
        |       +---- Offline fallback
        |
        +---- Application Services
        |       +---- Nutrition service
        |       +---- Activity service
        |       +---- Training service
        |       +---- Reporting service
        |
        +---- Repository Layer
        |       +---- Dexie.js
        |               +---- IndexedDB
        |               +---- Food photo Blobs
        |
        +---- Optional integrations
                +---- JSON/CSV import
                +---- Apple Shortcuts file import
                +---- AI endpoint (only with official API access)
```

### Frontend

-   Next.js dengan pendekatan yang kompatibel dengan PWA.
-   Tailwind CSS.
-   shadcn/ui untuk komponen dasar.
-   Mobile-first; optimalkan layar iPhone.
-   Hindari ketergantungan pada server-side rendering untuk fitur inti
    offline.

### Local data

-   Dexie.js + IndexedDB.
-   Semua operasi CRUD dilakukan melalui repository.
-   Jangan akses IndexedDB langsung dari komponen UI.
-   Buat migrasi skema database yang eksplisit.

### PWA

-   Web App Manifest.
-   Service Worker.
-   Cache app shell, font, icon, dan asset lokal.
-   Tampilkan status offline.
-   Jangan cache respons AI yang berisi data pribadi secara tidak
    sengaja.
-   Sediakan mekanisme update aplikasi yang jelas.

### Hosting

-   Hosting statis HTTPS gratis untuk distribusi PWA.
-   Database tidak di-host.
-   Tidak perlu login.
-   Tidak perlu PostgreSQL.
-   Tidak perlu Prisma.
-   AI proxy hanya ditambahkan jika API resmi digunakan.

### Keamanan dan privasi

-   API key tidak boleh ada di frontend.
-   Data kesehatan tetap lokal kecuali pengguna memilih ekspor atau
    analisis AI.
-   Minta persetujuan eksplisit sebelum mengirim foto/data ke layanan
    eksternal.
-   Jangan memasukkan data sensitif ke analytics pihak ketiga.
-   Sediakan export dan delete.
-   Pertimbangkan enkripsi backup ekspor dengan passphrase.
-   Uji perilaku data saat browser kehabisan ruang atau cache
    dibersihkan.

------------------------------------------------------------------------

## 7. Roadmap Pengembangan

### Phase 0 --- Technical Validation

**Tujuan:** membuktikan batasan platform sebelum membuat banyak fitur.

Checklist: - \[ \] Uji PWA install ke Home Screen iPhone. - \[ \] Uji
Service Worker dan offline launch. - \[ \] Uji IndexedDB di Safari
iOS. - \[ \] Uji penyimpanan Blob foto. - \[ \] Uji kuota dan perilaku
storage. - \[ \] Uji backup/restore database. - \[ \] Uji penerimaan
file JSON/CSV melalui Safari. - \[ \] Riset Apple Shortcuts:
ketersediaan aksi Find Health Samples dan tipe data yang dapat
diekspor. - \[ \] Verifikasi apakah paket Cursor yang dimiliki
menyediakan API eksternal atau hanya akses produk Cursor/Grok. - \[ \]
Buat keputusan AI manual handoff atau API resmi.

**Definition of Done:** aplikasi proof-of-concept dapat dibuka offline,
menyimpan catatan dan foto, lalu memulihkan backup.

### Phase 1 --- Foundation & Dashboard

-   [ ] Inisialisasi project Next.js.
-   [ ] Setup Tailwind dan shadcn/ui.
-   [ ] Setup manifest dan Service Worker.
-   [ ] Setup Dexie dan database versioning.
-   [ ] Buat repository layer.
-   [ ] Buat halaman Dashboard.
-   [ ] Buat halaman Settings dan profil.
-   [ ] Buat status offline.
-   [ ] Buat export/import backup.
-   [ ] Uji install dan penggunaan di iPhone.

**Definition of Done:** aplikasi dapat dipakai offline untuk navigasi,
menyimpan profil dan target, serta melakukan backup/restore.

### Phase 2 --- Nutrition Journal

-   [ ] CRUD food entries.
-   [ ] Meal categories.
-   [ ] Input porsi dan unit.
-   [ ] Input kalori dan makro.
-   [ ] Kamera/pemilih foto.
-   [ ] Simpan Blob dan thumbnail.
-   [ ] Food templates/favorites.
-   [ ] Daily nutrition summary.
-   [ ] Edit dan konfirmasi estimasi.
-   [ ] Filter dan pencarian riwayat.

**Definition of Done:** pengguna dapat mencatat semua makanan dan
melihat total harian tanpa internet.

### Phase 3 --- Body Progress

-   [ ] Input berat badan.
-   [ ] Input lingkar pinggang dan ukuran opsional.
-   [ ] Grafik 7/30/90 hari.
-   [ ] Rata-rata bergerak.
-   [ ] Catatan harian.
-   [ ] Foto progres opsional.
-   [ ] Export data pengukuran.

**Definition of Done:** data tubuh dapat dicatat dan dilihat trennya.

### Phase 4 --- Activity & Apple Health Import

-   [ ] CRUD aktivitas manual.
-   [ ] Definisi format JSON import.
-   [ ] Definisi format CSV import.
-   [ ] Preview sebelum impor.
-   [ ] Fingerprint anti-duplikasi.
-   [ ] Simpan sumber data dan unit.
-   [ ] Tampilkan active energy dan resting energy secara terpisah.
-   [ ] Buat panduan export Health.
-   [ ] Prototype Shortcut jika aksi Health tersedia.
-   [ ] Uji impor beberapa kali tanpa duplikasi.

**Definition of Done:** data aktivitas dari file/Shortcut dapat masuk
dan ditampilkan dengan sumber yang jelas. Belum boleh disebut live
HealthKit sync.

### Phase 5 --- Weight Training

-   [ ] Exercise library.
-   [ ] Program templates.
-   [ ] Program builder.
-   [ ] Jadwal latihan mingguan.
-   [ ] Workout session.
-   [ ] Set/reps/weight/RPE.
-   [ ] Rest timer.
-   [ ] Riwayat exercise.
-   [ ] Progression suggestions.
-   [ ] Deload/rest week.
-   [ ] Catatan nyeri/ketidaknyamanan.
-   [ ] Statistik volume dan personal best.

**Definition of Done:** pengguna dapat membuat program, menjalankan
sesi, dan melihat perkembangan performa.

### Phase 6 --- AI Food Analysis

**Jalur A: tanpa API eksternal** - \[ \] Buat prompt template untuk
analisis foto. - \[ \] Buat export foto + prompt. - \[ \] Share ke
aplikasi AI yang tersedia. - \[ \] Buat form input hasil AI. - \[ \]
Simpan hasil sebagai draft. - \[ \] Konfirmasi manual.

**Jalur B: dengan API resmi** - \[ \] Verifikasi akses API dan
billing. - \[ \] Buat proxy endpoint minimal. - \[ \] Simpan API key di
environment server. - \[ \] Batasi ukuran dan tipe foto. - \[ \] Kirim
hanya foto yang dipilih pengguna. - \[ \] Minta output JSON
terstruktur. - \[ \] Validasi output sebelum disimpan. - \[ \] Tambahkan
usage limit dan spending cap. - \[ \] Sediakan fallback jika API gagal.

**Definition of Done:** foto dapat dianalisis melalui jalur yang
benar-benar tersedia dan hasilnya dapat dikoreksi sebelum masuk jurnal.

### Phase 7 --- Weekly Insight & Reports

-   [ ] Ringkasan kalori dan makro.
-   [ ] Konsistensi pencatatan makanan.
-   [ ] Ringkasan aktivitas.
-   [ ] Ringkasan weight training.
-   [ ] Tren berat dan ukuran tubuh.
-   [ ] AI weekly review opsional.
-   [ ] Export laporan Markdown/PDF/CSV.

**Definition of Done:** pengguna dapat mengevaluasi perkembangan
mingguan berdasarkan data yang tercatat, bukan asumsi AI.

### Phase 8 --- Hardening & Release

-   [ ] Uji penggunaan offline beberapa hari.
-   [ ] Uji pemulihan backup.
-   [ ] Uji database migration.
-   [ ] Uji data besar dan banyak foto.
-   [ ] Uji tampilan iPhone portrait.
-   [ ] Uji aksesibilitas dan ukuran font.
-   [ ] Uji error handling.
-   [ ] Audit kebocoran API key.
-   [ ] Audit data yang dikirim ke AI.
-   [ ] Dokumentasi instalasi dan update PWA.
-   [ ] Buat release checklist.

------------------------------------------------------------------------

## 8. Desain UI/UX

Arah visual: - Modern, tenang, premium, personal. - Tidak terlihat
seperti aplikasi rumah sakit. - Warna dasar warm off-white atau dark
charcoal. - Aksen forest green / sage. - Tipografi mudah dibaca. -
Grafik sederhana dengan label jelas. - Gunakan foto makanan sebagai
elemen visual utama.

Navigasi bawah: 1. Home 2. Food 3. Activity 4. Training 5. Progress

AI dapat menjadi tombol aksi kontekstual di Food dan halaman Weekly
Review, bukan tab utama yang mendominasi.

Halaman utama sebaiknya memprioritaskan: - Ringkasan hari ini. - Tombol
tambah makanan. - Tombol foto makanan. - Aktivitas hari ini. - Latihan
terjadwal. - Berat terakhir.

------------------------------------------------------------------------

## 9. Aturan Perhitungan dan Kualitas Data

-   Kalori makanan adalah estimasi jika berasal dari foto.
-   Makronutrisi harus dapat dikoreksi.
-   Gunakan satuan baku dan konversi yang terdokumentasi.
-   Jangan menghitung kalori olahraga dua kali.
-   Bedakan data Apple Health, input manual, dan estimasi AI.
-   Jangan mengisi data kosong dengan tebakan.
-   Grafik harus memperlihatkan tanggal dan rentang waktu.
-   Jika data tidak lengkap, tampilkan "belum tercatat", bukan nol.
-   Jangan menyimpulkan perubahan komposisi tubuh hanya dari berat
    badan.
-   Jangan membuat rekomendasi medis atau mengubah terapi.

------------------------------------------------------------------------

## 10. Backup, Restore, dan Kepemilikan Data

Karena seluruh data tersimpan di satu perangkat, backup merupakan fitur
wajib, bukan tambahan.

Fitur: - Export seluruh database ke satu arsip JSON terstruktur. -
Export foto sebagai file terpisah atau arsip. - Opsi backup terenkripsi
dengan passphrase. - Import backup dengan preview. - Validasi versi
skema. - Pilihan merge atau replace. - Konfirmasi sebelum replace. -
Tampilkan tanggal backup terakhir. - Sediakan export CSV untuk food,
activity, measurement, dan workout.

Jangan mengandalkan IndexedDB sebagai satu-satunya tempat penyimpanan
permanen. Browser dapat menghapus data dalam kondisi tertentu, dan
pengguna dapat menghapus data website secara manual.

------------------------------------------------------------------------

## 11. Risiko dan Mitigasi

  -----------------------------------------------------------------------
  Risiko                              Mitigasi
  ----------------------------------- -----------------------------------
  PWA tidak dapat membaca HealthKit   Impor file/Shortcut; native bridge
  langsung                            hanya fase lanjutan

  Cursor subscription tidak sama      Verifikasi akses dan billing
  dengan API eksternal                sebelum integrasi

  API key bocor                       Proxy server-side atau manual AI
                                      handoff

  Foto memenuhi storage               Kompresi, thumbnail, pengelolaan
                                      foto, backup

  Data browser terhapus               Backup/restore wajib

  Data Health terduplikasi            External ID/fingerprint dan preview
                                      impor

  Estimasi AI salah                   Draft, rentang estimasi, konfirmasi
                                      pengguna

  Offline cache tidak lengkap         Offline test dan update/version
                                      strategy

  Data kesehatan terkirim tanpa sadar Persetujuan eksplisit per analisis
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 12. Prioritas MVP

Jangan membangun semua modul sekaligus.

**MVP yang harus selesai terlebih dahulu:** 1. PWA dapat di-install dan
berjalan offline. 2. IndexedDB + Dexie. 3. Food Journal dengan foto. 4.
Input kalori dan makro. 5. Dashboard harian. 6. Body Progress. 7. Backup
dan restore.

**MVP berikutnya:** 8. Activity Journal. 9. Health import. 10. Weight
Training Program.

**Fitur lanjutan:** 11. Grok photo analysis. 12. Weekly AI insight. 13.
Native HealthKit bridge bila manfaatnya sepadan dengan biaya dan
maintenance.

------------------------------------------------------------------------

## 13. Instruksi untuk AI Coding Agent

Saat mengerjakan repository:

1.  Baca dokumen roadmap ini sebelum membuat perubahan.
2.  Jangan membangun semua fase sekaligus.
3.  Kerjakan satu fase dan satu deliverable pada satu waktu.
4.  Buat `docs/IMPLEMENTATION_STATUS.md` untuk mencatat fase, fitur
    selesai, fitur tertunda, keputusan teknis, dan bug.
5.  Jangan mengubah arsitektur utama tanpa menjelaskan alasan dan
    dampaknya.
6.  Jangan menambahkan backend/database server untuk fungsi inti.
7.  Jangan menambahkan API key ke source code atau frontend.
8.  Jangan mengklaim HealthKit integration sudah aktif sebelum diuji di
    perangkat.
9.  Setiap fitur harus diuji pada Safari iOS, bukan hanya desktop
    browser.
10. Setiap fitur penyimpanan harus memiliki test untuk reload, offline,
    dan backup/restore.
11. Gunakan data contoh hanya untuk demo; jangan mencampurnya dengan
    data pengguna.
12. Pertahankan semua data pengguna saat migrasi database.
13. Perbarui status roadmap dan implementation status setelah setiap
    fase.
14. Bila ada keterbatasan iOS/PWA, jelaskan terlebih dahulu dan ajukan
    alternatif sebelum mengimplementasikan workaround yang rapuh.

## 14. Referensi Teknis

-   Apple HealthKit: https://developer.apple.com/documentation/healthkit
-   Configuring HealthKit access:
    https://developer.apple.com/documentation/Xcode/configuring-healthkit-access
-   Apple Health data privacy:
    https://support.apple.com/id-id/guide/security/sec88be990f/web
-   MDN IndexedDB:
    https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
-   Dexie.js: https://dexie.org/
-   MDN Progressive Web Apps:
    https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps
-   Cursor Pricing: https://cursor.com/pricing
-   xAI API documentation: https://docs.x.ai/

------------------------------------------------------------------------

## 15. Keputusan Akhir

**Produk:** Personal Health OS\
**Platform utama:** PWA di iPhone\
**Penyimpanan:** IndexedDB + Dexie.js\
**Foto:** Blob lokal\
**Aktivitas:** manual + Apple Health import (Shortcut/file)\
**Weight training:** program builder + workout log\
**AI:** manual handoff dahulu; API resmi opsional setelah akses dan
billing diverifikasi\
**Hosting:** static HTTPS\
**Backend:** tidak diperlukan untuk fungsi inti\
**Sinkronisasi:** tidak ada\
**Signing 7 hari:** tidak berlaku untuk PWA

> Prinsip produk: data tetap milik pengguna, aplikasi tetap berguna
> tanpa internet, dan AI hanya membantu menganalisis --- bukan menjadi
> sumber kebenaran data.
