"use client";

// Cinematic video player + real MP4 download. Native controls (play/pause,
// volume, fullscreen) come from the browser player; Download is a plain
// anchor so it always downloads the actual file.
import { useRef, useState } from "react";
import { Download, Film } from "lucide-react";

const VIDEO_SRC = "/film/mythicalmind-film.mp4";

export function FilmPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#070b16] shadow-[0_40px_120px_rgba(0,0,0,0.55)]">
      <div className="flex items-center gap-3 border-b border-white/[0.075] px-5 py-3.5">
        <span className="flex size-8 items-center justify-center rounded-lg border border-[#8b5cf6]/25 bg-[#8b5cf6]/15">
          <Film className="size-4 text-[#a78bfa]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold">MythicalMind_HackFest2026.mp4</div>
          <div className="text-[11.5px] text-[#8f99b0]">1920 × 1080 · 30 fps · H.264 + AAC</div>
        </div>
        <a
          href={VIDEO_SRC}
          download="MythicalMind_HackFest2026.mp4"
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#8b5cf6] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#8b5cf6]/85"
        >
          <Download className="size-4" />
          Download MP4
        </a>
      </div>
      <div className="relative aspect-video w-full bg-black">
        <video
          ref={videoRef}
          src={VIDEO_SRC}
          controls
          preload="metadata"
          playsInline
          onLoadedMetadata={() => setReady(true)}
          className="absolute inset-0 h-full w-full"
        />
        {!ready && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="text-[12.5px] text-[#8f99b0]">Memuat video…</div>
          </div>
        )}
      </div>
    </div>
  );
}
