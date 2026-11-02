# Implementation Status — Vitalime

Terakhir diperbarui: 2 November 2026 · versi aplikasi 0.1.0 · skema DB v1 (`personal-health-os`)

Legenda: ✅ selesai & diuji di browser desktop (emulasi iPhone) · 🧪 punya unit test ·
📱 wajib diuji di iPhone sungguhan · ⏳ tertunda

## Keputusan teknis (berbeda dari roadmap)

| Roadmap | Implementasi | Alasan |
|---|---|---|
| Next.js | Vite + React 19 + TypeScript | Aplikasi 100% statis dan offline; Next.js tidak memberi manfaat tanpa server, dan membuat service worker lebih rumit. |
| shadcn/ui | Komponen sendiri di `src/components/ui.tsx` (Tailwind v4) | Tema hitam/lime khusus, bundle lebih kecil, tanpa dependensi Radix. |
| Router berbasis path | `HashRouter` | Bekerja di hosting statis apa pun (GitHub Pages sub-path) tanpa aturan rewrite; tetap aman offline. |
| — | Tabel tambahan `healthMetrics` | Sampel harian Health (langkah, active/resting energy, jarak) bukan "aktivitas"; dipisah agar tidak terhitung ganda. |
| Workbox kustom | `vite-plugin-pwa` (generateSW, `registerType: prompt`) | Precache semua aset; pengguna memilih kapan memperbarui agar sesi latihan tidak terputus. |
| AI | Jalur A (manual hand-off) saja | Tidak ada API key di frontend; langganan Cursor/Grok bukan API. Jalur B butuh backend proxy + billing. |

Aturan aktivitas energi: bila Health punya total `active_energy` harian, angka itu dipakai; energi
dari workout hanya dipakai bila total harian tidak ada (`resolveEnergy`, 🧪). Resting energy
selalu ditampilkan terpisah dan tidak pernah dijumlahkan ke target.

## Phase 0 — Technical Validation

- ✅ Build PWA: manifest, ikon (192/512/maskable/apple-touch), splash iPhone, service worker precache.
- ✅ IndexedDB via Dexie, Blob foto + thumbnail, `navigator.storage.persist()`.
- ✅ Backup/restore (🧪 round-trip terenkripsi, merge, tolak skema lebih baru).
- 📱 Install ke Home Screen, offline launch, kuota storage, file picker JSON/CSV di Safari iOS.
- 📱 Riset aksi **Find Health Samples** di Shortcuts pada versi iOS yang dipakai.
- ✅ Keputusan AI: manual hand-off (lihat di atas).

## Phase 1 — Foundation & Dashboard

- ✅ Dexie + versioning (`schemaMeta`, `SCHEMA_VERSION`), repository layer (`src/db/repo/*`).
- ✅ Dashboard: sisa kalori, makro, active/resting energy, langkah, latihan hari ini, berat terakhir, pengingat backup, kartu instal.
- ✅ Settings: profil, target (berversi per tanggal, mode tetap / + active energy), backup, CSV, penyimpanan foto, privasi AI, reset (ketik "HAPUS").
- ✅ Indikator offline, banner pembaruan.
- 📱 Uji instal & pemakaian di iPhone.

## Phase 2 — Nutrition Journal

- ✅ CRUD makanan, kategori makan, porsi + unit, kalori & makro, duplikasi entri.
- ✅ Kamera / galeri (`<input capture>`), kompresi 1600 px + thumbnail 360 px.
- ✅ Template/favorit, pencarian riwayat, ringkasan harian, navigasi per hari.
- ✅ Hapus foto asli lama (thumbnail tetap) untuk menghemat ruang.
- 📱 Kamera, orientasi foto HEIC → JPEG, dan ukuran storage di iPhone.

## Phase 3 — Body Progress

- ✅ Berat, pinggang, ukuran opsional, foto progres opsional.
- ✅ Grafik 7/30/90 hari/semua + rata-rata bergerak 7 hari kalender (🧪).
- ✅ Catatan harian (tersimpan otomatis), ekspor CSV pengukuran.

## Phase 4 — Activity & Apple Health Import

- ✅ CRUD aktivitas manual.
- ✅ Format JSON & CSV, alias tipe HealthKit, konversi unit (kJ, m, mi, lb).
- ✅ Preview sebelum impor, fingerprint anti-duplikasi (🧪 termasuk JSON vs CSV), batalkan impor (🧪).
- ✅ Sumber & unit asli disimpan; active dan resting energy terpisah.
- ✅ Panduan Shortcuts di layar impor, contoh JSON/CSV.
- 📱 Prototipe Shortcut nyata — **belum** diuji; tidak ada klaim HealthKit sync.

## Phase 5 — Weight Training

- ✅ Library ~90 latihan (gym mesin, barbell, dumbbell, bodyweight, kardio, mobilitas) dengan instruksi & cue Bahasa Indonesia.
- ✅ Sprite atlas 8 frame + animasi vektor di library, sesi, dan halaman detail.
- ✅ Template program gym/rumah: pemula mesin, hipertrofi (FB/UL/PPL/bro split), kekuatan 5×5, glutes, calisthenics, HIIT, kardio zona 2, mobilitas.
- ✅ Sesi: set/reps/kg/RPE tersimpan per ketikan, beban otomatis diteruskan ke set berikutnya, rest timer + bunyi, tambah/kurangi set, latihan tambahan.
- ✅ Riwayat per latihan, PB berat, estimasi 1RM, volume.
- ✅ Saran progresi (🧪) — hanya saran, tidak pernah diterapkan otomatis; tertahan bila ada nyeri.
- ✅ Minggu deload (±60% beban, separuh set), catatan nyeri & level energi.
- 📱 Rest timer saat layar terkunci (iOS menghentikan JS di background; timer dihitung dari timestamp sehingga benar saat kembali, tetapi bunyi tidak akan berbunyi saat terkunci).

## Phase 6 — AI Food Analysis (Jalur A)

- ✅ Foto dari Home ("Foto AI") langsung membuka sheet analisis setelah kamera.
- ✅ Persetujuan eksplisit; prompt JSON untuk makanan Indonesia (komponen + gram + minyak).
- ✅ iPhone: Share foto+prompt ke Grok. Desktop: salin prompt ke chat Cursor. Bukan API Cursor (langganan ≠ endpoint).
- ✅ Tempel JSON, validasi (🧪), komponen dimatch ke database makanan lokal bila namanya dikenal.
- ✅ Hasil selalu **draft** → konfirmasi / koreksi; label model disimpan.
- ⏳ Jalur B (API resmi) — sengaja tidak dibuat; butuh backend + kunci API.

## Phase 7 — Weekly Insight & Reports

- ✅ Kalori & makro harian, konsistensi pencatatan, aktivitas, latihan, tren berat.
- ✅ Ekspor Markdown, salin teks, prompt AI weekly review (teks saja, tanpa foto).
- ✅ Ekspor CSV (makanan, aktivitas, pengukuran, latihan) di Settings.
- ⏳ Ekspor PDF — gunakan Share → Print → simpan PDF dari Markdown/teks sebagai gantinya.

## Phase 8 — Hardening & Release

- ✅ Unit test: `npm test` (Vitest + fake-indexeddb, 14 test).
- ✅ Audit API key: tidak ada key/secret di source; service worker tidak meng-cache API eksternal.
- ✅ Audit data AI: hanya foto/teks yang dipilih pengguna, lewat share sheet milik iOS.
- ✅ Dokumentasi instalasi & update (README), workflow GitHub Pages.
- 📱 Pemakaian offline beberapa hari, data besar/banyak foto, migrasi skema v2 (belum ada v2).
- ⏳ Code-splitting (bundle JS ±545 kB / 167 kB gzip — dapat diterima karena di-cache offline).

## Bug yang sudah diperbaiki

- Input set latihan tidak tersimpan (iOS tidak selalu memicu `blur`) → simpan per ketikan.
- Tombol kembali keluar dari aplikasi bila halaman dibuka langsung → fallback `useGoBack`.
- Target kalori "—" sebelum target disimpan → target default ditandai jelas.
- Garis target grafik mingguan terpotong → skala grafik diberi ruang 20% di atas target.
- Restore merge dari backup tanpa foto menghapus foto lokal → foto lokal dipertahankan.

## Checklist uji di iPhone (sebelum dipakai harian)

1. Instal dari Safari, buka dari Home Screen, aktifkan mode pesawat, tutup & buka lagi.
2. Catat makanan dengan foto kamera; tutup paksa aplikasi; pastikan entri & foto masih ada.
3. Backup → Save to Files; hapus data (Reset); restore dari Files.
4. Impor JSON dari Shortcut sungguhan dua kali; pastikan tidak ada duplikat.
5. Jalankan satu sesi latihan penuh dengan layar terkunci di antara set.
6. AI hand-off: bagikan ke aplikasi Grok, salin JSON, tempel kembali.
