// /film — the MythicalMind HackFest demo video web app: cinematic player,
// production info, and a real MP4 download. The video is the hero; this
// page is deliberately quiet.
import type { Metadata } from "next";
import { FilmPlayer } from "./player";

export const metadata: Metadata = {
  title: "MythicalMind — Official AI HackFest 2026 Demo Film",
  description:
    "Film demo resmi MythicalMind untuk IDwebhost AI HackFest 2026 — dari konteks berantakan menjadi rundown yang bisa diekspor ke PDF.",
};

export default function FilmPage() {
  return (
    <div className="min-h-dvh bg-[#04060d] text-[#e8edf7]">
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(1100px 700px at 18% 10%, rgba(139,92,246,0.16), transparent 60%), radial-gradient(900px 620px at 85% 20%, rgba(34,211,238,0.07), transparent 62%), radial-gradient(1200px 800px at 60% 100%, rgba(139,92,246,0.10), transparent 65%)",
        }}
      />
      <main className="relative mx-auto max-w-[1180px] px-6 py-10 md:py-14">
        <header className="mb-8 md:mb-10">
          <div className="flex flex-wrap items-center gap-2.5 text-[12px] font-medium tracking-[0.14em] text-[#8f99b0] uppercase">
            <span className="rounded-full border border-[#8b5cf6]/30 bg-[#8b5cf6]/10 px-3 py-1 text-[#c4b5fd]">
              AI HackFest 2026
            </span>
            <span>Productivity & Personal AI</span>
          </div>
          <h1 className="mt-4 text-[30px] font-semibold leading-tight tracking-tight md:text-[38px]">
            MythicalMind — Official Demo Film
          </h1>
          <p className="mt-2.5 max-w-[720px] text-[14.5px] leading-relaxed text-[#8f99b0]">
            Dari konteks yang berantakan menjadi rencana yang bisa dieksekusi: agent menyusun, mendeteksi
            benturan, menata ulang, dan mengekspor rundown ke PDF — semuanya dalam demo nyata.
          </p>
        </header>

        <FilmPlayer />

        <section className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            { k: "Durasi", v: "7 menit 32 detik" },
            { k: "Format", v: "1920 × 1080 · 30fps · H.264/AAC" },
            { k: "Bahasa", v: "Indonesia · tanpa narasi" },
          ].map((item) => (
            <div key={item.k} className="rounded-xl border border-white/10 bg-white/[0.026] p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8f99b0]">{item.k}</div>
              <div className="mt-1.5 text-[14px] font-medium text-[#e8edf7]">{item.v}</div>
            </div>
          ))}
        </section>

        <footer className="mt-12 border-t border-white/[0.075] pt-6 text-[12.5px] text-[#8f99b0]">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span>MythicalMind · Turn intention into a plan.</span>
            <span className="text-white/20">·</span>
            <span>Powered by AI Hosting — IDwebhost</span>
          </div>
          <div className="mt-2 text-[11.5px] text-[#8f99b0]/70">
            Musik & efek suara: Mixkit License (bebas royalti) · Seluruh cuplikan produk diambil dari aplikasi
            MythicalMind yang berjalan nyata.
          </div>
        </footer>
      </main>
    </div>
  );
}
