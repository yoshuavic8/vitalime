# Vitalime — Personal Health

Jurnal kesehatan pribadi **offline-first** untuk iPhone, dipasang sebagai PWA lewat Safari
(tanpa App Store, tanpa Apple Developer Program, tanpa server). Semua data tersimpan di perangkat
(IndexedDB).

Fitur: jurnal makanan + foto, makro & target harian, impor Apple Health (Shortcuts/JSON/CSV),
aktivitas, program & sesi latihan beban, progres tubuh, laporan mingguan, analisis foto via AI
(manual hand-off), backup/restore terenkripsi, ekspor CSV.

## Menjalankan di komputer

```bash
npm install
npm run dev        # http://localhost:5173 (juga terbuka di jaringan lokal)
npm test           # unit test penyimpanan, impor, backup
npm run build      # typecheck + build produksi ke dist/
npm run preview    # menyajikan dist/ untuk dicoba
npm run icons      # membuat ulang ikon & splash dari scripts/generate-icons.mjs
```

> Service worker (mode offline & instal) hanya aktif di **HTTPS** atau `localhost`. Membuka
> `http://192.168.x.x:5173` dari iPhone cukup untuk melihat UI, tetapi untuk instal sebagai
> aplikasi gunakan hosting HTTPS di bawah.

## Hosting gratis (pilih salah satu)

### GitHub Pages (sudah disiapkan)

1. Buat repository di GitHub (boleh private bila akun mendukung Pages untuk private; kalau tidak,
   public — kode tidak berisi data atau API key).
2. Push proyek ini ke branch `main`.
3. Di GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Workflow `.github/workflows/deploy.yml` otomatis menjalankan test, build dengan
   `BASE_PATH=/<nama-repo>/`, lalu deploy. Alamatnya:
   `https://<username>.github.io/<nama-repo>/`.

### Cloudflare Pages / Netlify / Vercel

- Build command: `npm run build`
- Output directory: `dist`
- Tidak perlu `BASE_PATH` (aplikasi berada di root domain).

## Instal di iPhone

1. Buka alamat HTTPS aplikasi di **Safari** (bukan Chrome / in-app browser).
2. Tekan tombol **Share** → **Add to Home Screen** → **Add**.
3. Buka Vitalime dari ikon di Home Screen. Setelah sekali dibuka, aplikasi berjalan offline.
4. Pembaruan: bila ada versi baru, muncul banner "Versi baru tersedia" → tekan **Perbarui**.

## Penting: backup

iOS dapat menghapus data situs web yang lama tidak dibuka, dan menghapus ikon dari Home Screen
juga menghapus datanya. Data **tidak** disinkronkan ke iCloud secara otomatis.

- Buka **Pengaturan → Backup & restore → Buat backup**, lalu pilih **Save to Files → iCloud Drive**.
- Lakukan minimal seminggu sekali (aplikasi mengingatkan di Home).
- Aktifkan enkripsi passphrase bila file disimpan di tempat bersama. Passphrase yang hilang tidak
  bisa dipulihkan.

## Apple Health

PWA **tidak bisa** membaca HealthKit. Data masuk lewat Apple Shortcuts atau file JSON/CSV — lihat
panduan di **Activity → Impor Apple Health**. Setiap impor ditampilkan dulu (preview), duplikat
dilewati otomatis, dan impor bisa dibatalkan.

## AI (manual hand-off)

Tidak ada API key di aplikasi. Untuk estimasi foto makanan, aplikasi menyiapkan foto + prompt,
kamu membagikannya sendiri ke aplikasi AI (mis. Grok), lalu menempelkan jawaban JSON kembali.
Hasil AI selalu berstatus **draft** sampai kamu konfirmasi.

## Struktur

```
src/
  db/          Dexie schema, tipe, dan repository (UI tidak menyentuh IndexedDB langsung)
  lib/         tanggal, format, gambar, CSV, impor Health, backup, AI hand-off
  services/    ringkasan harian & laporan mingguan
  components/  komponen UI bersama
  pages/       layar aplikasi
  __tests__/   unit test (Vitest + fake-indexeddb)
scripts/generate-icons.mjs   ikon, favicon, splash screen
docs/IMPLEMENTATION_STATUS.md status fase & keputusan teknis
```
