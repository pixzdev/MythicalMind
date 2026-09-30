// Rundown Studio — template library.
//
// Curated Indonesian event & daily-plan templates with real planning
// substance: checkpoints, PIC roles, and preparation notes. Instant value
// with zero providers connected; AI generation is the upgrade path.

import type { RundownCategory, SegmentInput } from "@/lib/types";

export interface RundownTemplate {
  id: string;
  name: string;
  category: RundownCategory;
  eventType: string;
  description: string;
  defaultStartTime: string;
  segments: SegmentInput[];
}

export const RUNDOWN_TEMPLATES: RundownTemplate[] = [
  {
    id: "wedding",
    name: "Pernikahan (Akad + Resepsi)",
    category: "acara",
    eventType: "wedding",
    description:
      "Satu hari penuh akad nikah dan resepsi, dari persiapan pagi hingga penutupan.",
    defaultStartTime: "07:00",
    segments: [
      { title: "Briefing akhir tim & cek venue", durationMinutes: 30, description: "Konfirmasi posisi tim dekorasi, katering, dokumentasi, dan musik.", pic: "Koordinator", notes: "Cek cadangan listrik & tenda cadangan hujan." },
      { title: "Akad nikah", durationMinutes: 45, description: "Prosesi ijab kabul dan doa.", pic: "Petugas KUA / Penghulu", notes: "Siapkan akta kelahiran & dokumen persyaratan." },
      { title: "Sesi foto keluarga", durationMinutes: 40, description: "Foto bersama kedua keluarga besar setelah akad.", pic: "Fotografer", materials: "Kamera, album, list urutan foto" },
      { title: "Jeda makan & persiapan resepsi", durationMinutes: 90, description: "Ganti dekorasi akad ke format resepsi, break tim.", pic: "Tim Dekorasi", notes: "Katering menyiapkan buffet." },
      { title: "Pembukaan resepsi & sambutan MC", durationMinutes: 10, description: "MC membuka acara, menyapa tamu.", pic: "MC" },
      { title: "Musik tambahan / penampilan", durationMinutes: 20, description: "Hiburan pembuka sebelum mempelai masuk.", pic: "Tim Musik" },
      { title: "Mars masuk mempelai", durationMinutes: 10, description: "Prosesi masuk pengantin ke pelaminan.", pic: "MC + Tim Musik", notes: "Koor posisi fotografer & videografer." },
      { title: "Sungkeman & berkat keluarga", durationMinutes: 25, description: "Sungkem kepada kedua orang tua dan doa bersama.", pic: "MC" },
      { title: "Berkat / wejakan tamu kehormatan", durationMinutes: 40, description: "Sambutan dan berkat dari tamu undangan utama.", pic: "MC", notes: "Batasi 3–5 pembicara, 5 menit per orang." },
      { title: "Ramah tamah & foto bersama tamu", durationMinutes: 90, description: "Pengantin menyambut tamu, sesi foto grup.", pic: "Fotografer + MC" },
      { title: "Makan bersama & hiburan", durationMinutes: 60, description: "Tamu menikmati buffet, musik mengiringi.", pic: "Katering + Tim Musik" },
      { title: "Penutupan & ucapan terima kasih", durationMinutes: 15, description: "MC menutup acara, pengantin berpamitan.", pic: "MC" },
      { title: "Evaluasi & pembongkaran", durationMinutes: 60, description: "Tim merapikan venue dan evaluasi singkat.", pic: "Koordinator", materials: "Checklist inventaris" },
    ],
  },
  {
    id: "seminar",
    name: "Seminar / Talkshow Setengah Hari",
    category: "acara",
    eventType: "seminar",
    description:
      "Seminar pagi dengan registrasi, pembukaan, tiga narasumber, dan sesi tanya jawab.",
    defaultStartTime: "07:30",
    segments: [
      { title: "Registrasi & konfirmasi ulang peserta", durationMinutes: 60, description: "Pembukaan meja registrasi, pembagian kit dan name tag.", pic: "Tim Registrasi", materials: "Name tag, kit, attendance sheet" },
      { title: "Cek AV & sound check", durationMinutes: 30, description: "Uji mikrofon, proyektor, dan slide semua narasumber.", pic: "Tim Teknis", notes: "Siapkan laptop backup & kabel HDMI/USB-C." },
      { title: "Pembukaan oleh MC", durationMinutes: 10, description: "Salam pembuka dan tata tertib acara.", pic: "MC" },
      { title: "Sambutan penyelenggara", durationMinutes: 15, description: "Sambutan ketua panitia dan/atau sponsor utama.", pic: "Ketua Panitia" },
      { title: "Sesi 1 — Materi utama", durationMinutes: 40, description: "Presentasi narasumber pertama.", pic: "Narasumber 1", materials: "Slide deck, clicker" },
      { title: "Sesi 2 — Perspektif praktisi", durationMinutes: 40, description: "Presentasi narasumber kedua.", pic: "Narasumber 2" },
      { title: "Ice breaking & door prize", durationMinutes: 15, description: "Permainan singkat untuk menjaga energi peserta.", pic: "MC", materials: "Hadiah door prize" },
      { title: "Sesi 3 — Studi kasus", durationMinutes: 40, description: "Presentasi narasumber ketiga dengan studi kasus.", pic: "Narasumber 3" },
      { title: "Talkshow & tanya jawab", durationMinutes: 30, description: "Moderator memandu diskusi panel dan tanya jawab peserta.", pic: "Moderator", notes: "Siapkan 3 pertanyaan cadangan untuk pemanasan." },
      { title: "Kesimpulan & penutup", durationMinutes: 15, description: "Rangkuman oleh moderator dan ucapan terima kasih.", pic: "Moderator + MC" },
      { title: "Foto bersama & networking", durationMinutes: 45, description: "Sesi foto kelompok dan perbincangan bebas peserta.", pic: "Dokumentasi" },
      { title: "Evaluasi internal panitia", durationMinutes: 30, description: "Rekap kehadiran, umpan balik, dan laporan pertanggungjawaban.", pic: "Ketua Panitia" },
    ],
  },
  {
    id: "meeting",
    name: "Rapat Kerja 1 Jam",
    category: "kerja",
    eventType: "meeting",
    description:
      "Rapat tim yang efektif: agenda jelas, keputusan terdokumentasi, follow-up tegas.",
    defaultStartTime: "09:00",
    segments: [
      { title: "Pembukaan & review agenda", durationMinutes: 5, description: "Moderator membacakan agenda dan batas waktu tiap topik.", pic: "Pemimpin rapat", notes: "Bagikan agenda H-1 agar peserta datang siap." },
      { title: "Follow-up rapat sebelumnya", durationMinutes: 10, description: "Cek status action items sebelumnya: selesai / terkendala / mundur.", pic: "Notulis", materials: "Notula rapat lalu" },
      { title: "Topik utama — diskusi & keputusan", durationMinutes: 30, description: "Satu topik utama dibahas sampai ada keputusan, bukan hanya wacana.", pic: "Pemimpin rapat", notes: "Jika tidak selesai: parkir topik, tetapkan forum lanjutan." },
      { title: "Topik sekunder & parkir isu", durationMinutes: 10, description: "Isu kecil diputus cepat; isu besar diparkir untuk rapat terpisah.", pic: "Pemimpin rapat" },
      { title: "Rekap keputusan & penugasan", durationMinutes: 5, description: "Notulis membacakan: keputusan, pemilik tugas, tenggat.", pic: "Notulis" },
    ],
  },
  {
    id: "townhall",
    name: "Townhall / Rapat Besar",
    category: "kerja",
    eventType: "townhall",
    description:
      "Rapat seluruh organisasi: arah strategi, update kinerja, dan sesi QnA terbuka.",
    defaultStartTime: "13:30",
    segments: [
      { title: "Peserta masuk & pre-roll", durationMinutes: 15, description: "Musik pembuka dan slide selamat datang.", pic: "Tim Acara", materials: "Slide, playlist" },
      { title: "Pembukaan MC & agenda", durationMinutes: 5, description: "Pengantar tujuan townhall dan aturan sesi.", pic: "MC" },
      { title: "Update kinerja periode", durationMinutes: 25, description: "Presentasi capaian, angka kunci, dan penghargaan.", pic: "Manajemen", materials: "Dashboard, slide deck" },
      { title: "Arah strategi periode berikutnya", durationMinutes: 25, description: "Visi, prioritas, dan target ke depan.", pic: "Pimpinan" },
      { title: "QnA terbuka", durationMinutes: 30, description: "Pertanyaan dikirim via form atau diangkat langsung.", pic: "Moderator", notes: "Moderator menyaring pertanyaan; jawab jujur atau jadwalkan tindak lanjut." },
      { title: "Penutup & foto bersama", durationMinutes: 10, description: "Ucapan penutup dan dokumentasi.", pic: "MC + Dokumentasi" },
    ],
  },
  {
    id: "birthday",
    name: "Ulang Tahun",
    category: "acara",
    eventType: "birthday",
    description:
      "Pesta ulang tahun 3 jam: permainan, kue, dan sesi foto yang ramah semua umur.",
    defaultStartTime: "15:00",
    segments: [
      { title: "Tamu tiba & foto di backdrop", durationMinutes: 30, description: "Checklist tamu, sesi foto bebas di area dekorasi.", pic: "Tim Foto", materials: "Backdrop, props foto" },
      { title: "Pembukaan oleh MC", durationMinutes: 10, description: "Salam, terima kasih, dan alur singkat pesta.", pic: "MC" },
      { title: "Permainan interaktif 1", durationMinutes: 20, description: "Permainan ringan yang melibatkan semua tamu.", pic: "MC", materials: "Prop permainan, hadiah kecil" },
      { title: "Permainan interaktif 2", durationMinutes: 20, description: "Variasi kedua, bisa per kelompok.", pic: "MC" },
      { title: "Tiup lilin & potong kue", durationMinutes: 20, description: "Nyanyian selamat ulang tahun dan potong kue.", pic: "MC + Tim Foto", materials: "Kue, lilin, pisau, piring" },
      { title: "Makan bersama", durationMinutes: 40, description: "Buffet atau box, bebas bergaul.", pic: "Katering" },
      { title: "Buka kado & unggah-unggah", durationMinutes: 20, description: "Membuka kado bersama, hiburan penutup.", pic: "MC" },
      { title: "Penutupan & goodie bag", durationMinutes: 20, description: "Ucapan terima kasih dan pembagian goodie bag.", pic: "Tim Acara", materials: "Goodie bag" },
    ],
  },
  {
    id: "webinar",
    name: "Webinar Online",
    category: "acara",
    eventType: "webinar",
    description:
      "Webinar 2 jam via Zoom/Meet dengan rekaman, polling, dan giveaway.",
    defaultStartTime: "09:50",
    segments: [
      { title: "Open Zoom & peserta bergabung", durationMinutes: 10, description: "Tampilkan slide tunggu, mutar musik latar.", pic: "Host", materials: "Slide tunggu, Zoom setup" },
      { title: "Cek teknis narasumber", durationMinutes: 10, description: "Cek audio, video, dan berbagi slide narasumber.", pic: "Co-host", notes: "Mute semua peserta, siapkan mode rekaman." },
      { title: "Pembukaan & perkenalan", durationMinutes: 10, description: "Host memperkenalkan tema dan narasumber.", pic: "Host" },
      { title: "Materi utama narasumber", durationMinutes: 45, description: "Presentasi inti webinar.", pic: "Narasumber", materials: "Slide deck" },
      { title: "Polling interaktif", durationMinutes: 10, description: "Polling untuk memetakan pendapat peserta.", pic: "Host", materials: "Zoom polling" },
      { title: "Sesi tanya jawab", durationMinutes: 25, description: "Pertanyaan via chat dibacakan host.", pic: "Host + Narasumber", notes: "Siapkan 3 pertanyaan cadangan." },
      { title: "Giveaway & info tindak lanjut", durationMinutes: 10, description: "Undian giveaway dan CTA (komunitas, sertifikat, materi).", pic: "Host" },
    ],
  },
  {
    id: "podcast",
    name: "Produksi Podcast / YouTube",
    category: "kerja",
    eventType: "podcast",
    description:
      "Sesi rekaman konten: briefing, 2 take utama, dan review hasil rekaman.",
    defaultStartTime: "10:00",
    segments: [
      { title: "Setup kamera, mic, & lighting", durationMinutes: 45, description: "Posisi talent, white balance, dan level audio.", pic: "Tim Produksi", materials: "Kamera, mic, lampu" },
      { title: "Briefing konten & outline", durationMinutes: 20, description: "Poin kunci episode, hook pembuka, dan CTA penutup.", pic: "Host + Editor", materials: "Outline episode" },
      { title: "Take 1 — rekaman utama", durationMinutes: 45, description: "Rekaman penuh mengikuti outline.", pic: "Talent" },
      { title: "Jeda review", durationMinutes: 15, description: "Cek kualitas audio & video, catat bagian yang perlu diulang.", pic: "Editor" },
      { title: "Take 2 — perbaikan & pick-up", durationMinutes: 30, description: "Ulangi segmen yang bermasalah, ambil variasi hook.", pic: "Talent" },
      { title: "Review hasil & backup file", durationMinutes: 20, description: "Transfer file, backup ganda, catat timestamp potongan.", pic: "Editor", notes: "Format penamaan file konsisten: TGL-EP-judul." },
      { title: "Reset studio", durationMinutes: 15, description: "Merapikan peralatan dan cek inventaris.", pic: "Tim Produksi" },
    ],
  },
  {
    id: "lomba",
    name: "Lomba / Kompetisi Siswa",
    category: "acara",
    eventType: "competition",
    description:
      "Perlombaan satu hari dengan technical meeting, sesi lomba, dan penghargaan.",
    defaultStartTime: "07:30",
    segments: [
      { title: "Registrasi peserta & kategory", durationMinutes: 45, description: "Verifikasi tim peserta dan pembagian nomor urut.", pic: "Panitia", materials: "Daftar peserta, nomor urut" },
      { title: "Technical meeting", durationMinutes: 20, description: "Penjelasan aturan, durasi, dan kriteria penilaian.", pic: "Juri" },
      { title: "Sesi lomba penyisihan", durationMinutes: 120, description: "Pelaksanaan babak penyisihan.", pic: "Pengawas", notes: "Satu pengawas per ruang, kartu waktu di tiap meja." },
      { title: "Pengumpulan & penilaian juri", durationMinutes: 60, description: "Juri menilai dengan rubrik; pengumuman semifinalis.", pic: "Juri", materials: "Rubrik penilaian" },
      { title: "Jeda makan", durationMinutes: 45, description: "Makan siang peserta dan panitia.", pic: "Logistik" },
      { title: "Sesi lomba final", durationMinutes: 90, description: "Babak final dengan presentasi/performance.", pic: "Pengawas" },
      { title: "Pengumuman pemenang & penghargaan", durationMinutes: 30, description: "Pengumuman juara 1–3, piala dan piagam.", pic: "MC", materials: "Pialah, piagam, sertifikat" },
      { title: "Dokumentasi & penutupan", durationMinutes: 30, description: "Foto pemenang dan ucapan terima kasih.", pic: "Dokumentasi" },
    ],
  },
  {
    id: "pentas-seni",
    name: "Pentas Seni Sekolah",
    category: "acara",
    eventType: "school-show",
    description:
      "Panggung seni malam hari dengan beberapa penampilan dan MC pelajar.",
    defaultStartTime: "15:30",
    segments: [
      { title: "Gladi resik penuh", durationMinutes: 90, description: "Setiap penampilan mencoba panggung sesuai urutan.", pic: "Sutradara", notes: "Latihan transisi antar penampilan maksimal 2 menit." },
      { title: "Tamu masuk", durationMinutes: 30, description: "Pintu dibuka, musik pengantar.", pic: "Tim Acara" },
      { title: "Pembukaan & doa", durationMinutes: 15, description: "Sambutan kepala sekolah dan doa bersama.", pic: "MC" },
      { title: "Penampilan blok 1 (3–4 nomor)", durationMinutes: 40, description: "Penampilan kelas/jurusan sesuai urutan.", pic: "Koordinator Blok" },
      { title: "Permainan penonton", durationMinutes: 15, description: "Interaksi ringan dengan audiens.", pic: "MC" },
      { title: "Penampilan blok 2 (3–4 nomor)", durationMinutes: 40, description: "Penampilan lanjutan.", pic: "Koordinator Blok" },
      { title: "Penampilan puncak", durationMinutes: 20, description: "Nomor utama: band, teater besar, atau paduan suara.", pic: "Sutradara" },
      { title: "Penghargaan & penutup", durationMinutes: 20, description: "Apresiasi peserta dan foto panggung.", pic: "MC" },
      { title: "Pembongkaran panggung", durationMinutes: 60, description: "Merapikan properti dan area.", pic: "Tim Panggung" },
    ],
  },
  {
    id: "retret",
    name: "Retret / Ibadah",
    category: "acara",
    eventType: "retreat",
    description:
      "Retret satu hari: ibadah bersama, sesi bina, diskusi kelompok, dan komunal.",
    defaultStartTime: "07:30",
    segments: [
      { title: "Kedatangan & pembagian kelompok", durationMinutes: 30, description: "Registrasi peserta dan pembentukan kelompok kecil.", pic: "Panitia", materials: "Name tag, daftar kelompok" },
      { title: "Ice breaking & ibadah pembuka", durationMinutes: 30, description: "Perkenalan dan doa pembuka bersama.", pic: "Pemandu" },
      { title: "Sesi bina 1 — tema utama", durationMinutes: 60, description: "Pengajaran/refleksi tema retret.", pic: "Pembicara" },
      { title: "Diskusi kelompok kecil", durationMinutes: 45, description: "Pembagian refleksi per kelompok 6–8 orang.", pic: "Koordinator Kelompok", materials: "Lembar pertanyaan pemandu" },
      { title: "Makan bersama", durationMinutes: 60, description: "Makan siang komunal.", pic: "Logistik" },
      { title: "Sesi bina 2 — penerapan", durationMinutes: 45, description: "Langkah konkret menerapkan tema.", pic: "Pembicara" },
      { title: "Ibadah penutup & komitmen", durationMinutes: 45, description: "Doa bersama dan penulisan komitmen pribadi.", pic: "Pemandu", materials: "Kartu komitmen" },
      { title: "Foto & keberangkatan", durationMinutes: 20, description: "Dokumentasi dan pulang.", pic: "Dokumentasi" },
    ],
  },
  {
    id: "harian-produktif",
    name: "Hari Produktif (Deep Work)",
    category: "harian",
    eventType: "daily",
    description:
      "Rencana hari pribadi berfokus deep work: blok kerja panjang, jeda terjadwal, dan ritual penutup.",
    defaultStartTime: "06:00",
    segments: [
      { title: "Bangun, olahraga ringan, & mandi", durationMinutes: 45, description: "Gerak badan 10–15 menit, lalu bersiap.", pic: "Saya", notes: "Taruh HP jauh dari tempat tidur." },
      { title: "Sarapan & rencana hari (top 3)", durationMinutes: 30, description: "Tentukan 3 hasil terpenting hari ini, bukan daftar panjang.", pic: "Saya", materials: "Jurnal / aplikasi catatan" },
      { title: "Blok deep work 1", durationMinutes: 90, description: "Tugas paling menantang dikerjakan pertama, tanpa notifikasi.", pic: "Saya", notes: "Mode fokus HP aktif; satu tab saja." },
      { title: "Jeda aktif", durationMinutes: 15, description: "Berdiri, jalan, rehydrasi. Bukan scroll media sosial.", pic: "Saya" },
      { title: "Blok deep work 2", durationMinutes: 90, description: "Lanjutan tugas utama atau tugas kedua.", pic: "Saya" },
      { title: "Makan siang & jeda penuh", durationMinutes: 60, description: "Makan tanpa layar bila bisa; tidur siang singkat boleh 15–20 menit.", pic: "Saya" },
      { title: "Blok tugas pendek (shallow work)", durationMinutes: 60, description: "Email, admin, rapat ringan — semua tugas kecil dikumpulkan di sini.", pic: "Saya" },
      { title: "Jeda & camilan", durationMinutes: 15, description: "Rehat singkat menjelang sore.", pic: "Saya" },
      { title: "Blok belajar / pengembangan", durationMinutes: 60, description: "Baca, kursus, atau latihan keterampilan.", pic: "Saya" },
      { title: "Waktu keluarga / sosial", durationMinutes: 90, description: "Makan malam dan waktu bersama tanpa pekerjaan.", pic: "Saya" },
      { title: "Ritual malam & shutdown", durationMinutes: 20, description: "Catat capaian, rencana besok, matikan mode kerja.", pic: "Saya", notes: "Tuliskan kalimat: 'Hari ini selesai di sini.'" },
      { title: "Persiapan tidur", durationMinutes: 30, description: "Layar mati 30 menit sebelum tidur.", pic: "Saya" },
    ],
  },
  {
    id: "belajar-ujian",
    name: "Hari Belajar Intensif (Ujian)",
    category: "studi",
    eventType: "study",
    description:
      "Hari belajar dengan blok 50/10, variasi materi, dan simulasi di akhir hari.",
    defaultStartTime: "07:30",
    segments: [
      { title: "Rencana belajar & target materi", durationMinutes: 20, description: "Tentukan bab yang harus selesai hari ini.", pic: "Saya", materials: "Silabus / daftar bab" },
      { title: "Blok belajar 1 (materi baru)", durationMinutes: 50, description: "Baca dan catat bab pertama dengan metode aktif.", pic: "Saya", notes: "Tulis pertanyaan sendiri, bukan hanya menandai." },
      { title: "Jeda 10", durationMinutes: 10, description: "Bergerak, minum air.", pic: "Saya" },
      { title: "Blok belajar 2 (latihan soal)", durationMinutes: 50, description: "Kerjakan soal terkait bab tadi, timer menyala.", pic: "Saya", materials: "Bank soal" },
      { title: "Jeda 10", durationMinutes: 10, description: "Jeda singkat.", pic: "Saya" },
      { title: "Blok belajar 3 (materi kedua)", durationMinutes: 50, description: "Bab berikutnya.", pic: "Saya" },
      { title: "Makan siang & jeda panjang", durationMinutes: 60, description: "Istirahat penuh.", pic: "Saya" },
      { title: "Blok belajar 4 (mengulang)", durationMinutes: 50, description: "Baca ulang catatan tadi, ringkas satu halaman.", pic: "Saya" },
      { title: "Simulasi ujian", durationMinutes: 60, description: "Kerjakan set soal utuh dengan batas waktu nyata.", pic: "Saya", materials: "Paket tryout" },
      { title: "Koreksi & catat kelemahan", durationMinutes: 30, description: "Tandai soal salah, buat daftar topik lemah.", pic: "Saya" },
      { title: "Review ringkas & tutup buku", durationMinutes: 20, description: "Flashcard 10 menit, lalu benar-benar berhenti.", pic: "Saya" },
    ],
  },
  {
    id: "event-mini",
    name: "Event Mini / Gathering",
    category: "acara",
    eventType: "gathering",
    description:
      "Acara komunitas 3 jam: santai, satu sesi inti, dan networking.",
    defaultStartTime: "16:00",
    segments: [
      { title: "Kedatangan & registrasi santai", durationMinutes: 30, description: "Check-in, stiker nama, musik.", pic: "Tim Acara", materials: "Stiker nama, list hadir" },
      { title: "Pembukaan & perkenalan komunitas", durationMinutes: 15, description: "MC menjelaskan tujuan gathering.", pic: "MC" },
      { title: "Sesi inti / berbagi", durationMinutes: 40, description: "Satu pembicara atau sesi berbagi pengalaman.", pic: "Pembicara" },
      { title: "Permainan / aktivitas kelompok", durationMinutes: 30, description: "Aktivitas pemecah kebekuan.", pic: "MC", materials: "Prop aktivitas" },
      { title: "Networking bebas & makan", durationMinutes: 50, description: "Sesi bergaul dengan snack.", pic: "Logistik" },
      { title: "Info komunitas & penutup", durationMinutes: 15, description: "Kegiatan berikutnya dan foto bersama.", pic: "MC" },
    ],
  },
];

export function getTemplate(id: string): RundownTemplate | undefined {
  return RUNDOWN_TEMPLATES.find((t) => t.id === id);
}

export function templateTotalMinutes(t: RundownTemplate): number {
  return t.segments.reduce((sum, s) => sum + s.durationMinutes, 0);
}
