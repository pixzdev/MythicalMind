# MythicalMind

Ruang kerja produktivitas untuk membuat dan mengelola **rundown** — acara, rapat, seminar, wedding, hingga rencana harian — dengan asisten AI multi-provider dan ekspor PDF siap cetak. Seluruh antarmuka berbahasa Indonesia dengan identitas visual *Aurora Night*.

## Fitur Utama

- **Rundown Studio** — pusat utama aplikasi: 13 template kurasi (pernikahan, seminar, rapat, townhall, webinar, podcast, lomba, pentas seni, retret, hari produktif, belajar ujian, dan lainnya), editor spreadsheet-style dengan *commit-on-blur*, pengurutan segmen, strip timeline berwarna, dan perhitungan waktu dinding otomatis (cukup isi durasi — jam mulai terhitung, timeline tidak pernah bergeser).
- **Ekspor PDF** — dokumen A4 siap cetak dengan kop merek, ringkasan meta, tabel segmen tujuh kolom, dan nomor halaman. Dihasilkan di sisi klien via jsPDF + AutoTable.
- **Asisten AI** — percakapan streaming dengan markdown, *syntax highlighting*, dan telemetri live. Bisa dipakai untuk *brainstorming* maupun membuat rundown dari deskripsi singkat (dengan pratinjau yang bisa diedit sebelum disimpan).
- **Multi-provider OpenAI-compatible** — hubungkan provider mana pun (OpenAI, Groq, Together, OpenRouter, LM Studio, server lokal, dll.) lewat baseURL + API key. Discovery model otomatis, uji koneksi, fallback provider aktif.
- **Generasi di latar belakang** — proses streaming berjalan di server (bukan di browser): pindah halaman, chat tetap berjalan; beberapa generasi berjalan paralel dan terisolasi; refresh halaman tidak memutus proses; ada satu tombol Stop per generasi.
- **Beranda produktivitas** — sapaan kontekstual, fokus hari ini, acara mendatang, statistik, dan aksi cepat.
- **Command palette (Cmd/Ctrl+K)** — navigasi, aksi rundown, dan pencarian sisi-server.

## Privasi

Semua data (rundown, percakapan, provider) disimpan lokal di SQLite. API key tidak pernah dikirim ke klien — hanya petunjuk tersamarkan (`sk-…abcd`) yang ditampilkan.

## Teknologi

Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · shadcn/ui · Prisma + SQLite · TanStack Query · Zustand · jsPDF · Sonner

## Memulai

Prasyarat: Node.js 20+ (atau Bun 1.1+).

```bash
# 1. Pasang dependensi
bun install        # atau: npm install

# 2. Siapkan environment
cp .env.example .env

# 3. Buat database SQLite + client Prisma
bunx prisma db push

# 4. Jalankan dev server
bun run dev        # atau: npm run dev
```

Buka `http://localhost:3000`. Database baru akan kosong — mulai dengan "Rundown baru" dari template, atau hubungkan provider AI di halaman Provider untuk memakai asisten.

### Skrip

| Perintah | Fungsi |
| --- | --- |
| `bun run dev` | Dev server di port 3000 |
| `bun run build` | Build produksi (standalone) |
| `bun run start` | Jalankan hasil build |
| `bun run lint` | ESLint |
| `bun run db:push` | Sinkronkan skema Prisma ke SQLite |
| `node scripts/reset-workspace.mjs` | Kosongkan semua data (kembali ke kondisi awal) |
| `bun scripts/mock-provider/server.mjs 4148` | Server SSE tiruan (OpenAI-compatible) untuk uji coba tanpa provider sungguhan |
| `node scripts/e2e-acceptance.mjs` | Skrip penerimaan end-to-end (butuh mock provider) |

## Arsitektur Singkat

```
UI (React, subscriber murni)
  └─ RuntimeClient — pool EventSource (SSE), notifikasi batched
       └─ HTTP/SSE
            └─ GenerationManager (singleton server) — antrean maks. 6 generasi,
               AbortController per run, persistensi batched ter-throttle,
               pemulihan proses yatim saat boot
                 └─ Adapter Layer — registry provider, adapter universal
                    OpenAI-compatible (parser SSE native, mapping reasoning,
                    retry adaptif, katalog error → pesan ramah)
                      └─ Prisma/SQLite
```

Prinsip utama: **UI hanyalah pelanggan**. Semua generasi dimiliki proses server yang hidup melintasi navigasi klien; endpoint SSE memutar ulang snapshot + delta live sehingga klien bebas terputus/tersambung ulang. Waktu rundown diturunkan dari `startTime + durasi` — tidak ada jam yang disimpan manual, sehingga timeline tidak bisa bergeser.

## Struktur Direktori

```
prisma/                  Skema database (Rundown, Segment, Provider, Model,
                         Conversation, Message, Generation, Agent, ActivityEvent, Setting)
src/app/api/             22+ route: rundowns, segments, ai/rundown, conversations,
                         generate, generations (+SSE/stop), providers, models, agents,
                         activity, settings, search, export, data
src/components/rundown/  Dashboard, wizard (template + AI), library, editor
src/components/chat/     Asisten AI: composer, daftar pesan, streaming, markdown
src/lib/rundown/         Template, perhitungan waktu (id-ID), generator AI, PDF
src/lib/providers/       Adapter OpenAI-compatible, registry, katalog error
src/lib/runtime/         GenerationManager (server) + RuntimeClient (klien)
scripts/                 Mock provider, e2e, reset workspace
```
