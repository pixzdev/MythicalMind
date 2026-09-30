// Rundown Studio — PDF export (client-side, jsPDF + AutoTable).
//
// Dynamically imported so the editor bundle stays light. Produces a clean,
// print-ready A4 rundown: brand header, event meta, summary chips, the
// segment table with derived times, and page footers.

import type { RundownDetail } from "@/lib/types";
import { computeTimeline, formatDurationIndo, formatTanggalIndo, endTimeOf } from "./time";

// Print-safe palette (light background, dark text, violet accents).
const INK = "#0b0d16";
const INK_SOFT = "#555b6e";
const BRAND = "#6d28d9";
const BRAND_SOFT = "#ede9fe";
const ROW_ALT = "#f6f4fc";
const LINE = "#e3e0ee";

interface PdfMeta {
  exportedAt?: Date;
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
     .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 48) || "rundown"
  );
}

export async function exportRundownPDF(
  rundown: RundownDetail,
  meta: PdfMeta = {}
): Promise<void> {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = autoTableModule.default;

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  const timeline = computeTimeline(rundown, rundown.segments);
  const exportedAt = meta.exportedAt ?? new Date();

  // ── Header ──────────────────────────────────────────────────────────────
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(BRAND);
  doc.text("MYTHICALMIND", margin, y + 3);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(INK_SOFT);
  doc.text("STUDIO RUNDOWN", pageWidth - margin, y + 3, { align: "right" });

  y += 11;
  doc.setDrawColor(BRAND);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageWidth - margin, y);

  y += 9;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(INK);
  const titleLines = doc.splitTextToSize(rundown.title, contentWidth - 60);
  doc.text(titleLines, margin, y + 5);
  y += titleLines.length * 7.2;

  // right-side status chip
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  const statusLabel = rundown.status === "final" ? "FINAL" : "DRAF";
  const statusW = doc.getTextWidth(statusLabel) + 8;
  doc.setFillColor(rundown.status === "final" ? BRAND : ROW_ALT);
  doc.setDrawColor(BRAND);
  doc.setLineWidth(0.3);
  doc.roundedRect(pageWidth - margin - statusW, y - 8, statusW, 6.4, 1.6, 1.6, "FD");
  doc.setTextColor(rundown.status === "final" ? "#ffffff" : INK_SOFT);
  doc.text(statusLabel, pageWidth - margin - statusW / 2, y - 3.4, { align: "center" });

  // ── Meta lines ──────────────────────────────────────────────────────────
  const metaPairs: [string, string][] = [];
  const tanggal = formatTanggalIndo(rundown.eventDate);
  if (tanggal) metaPairs.push(["Tanggal", tanggal]);
  metaPairs.push([
    "Waktu",
    `${rundown.startTime} - ${endTimeOf(rundown)} (total ${formatDurationIndo(rundown.totalMinutes)})`,
  ]);
  if (rundown.venue) metaPairs.push(["Lokasi", rundown.venue]);
  if (rundown.organizer) metaPairs.push(["Penyelenggara", rundown.organizer]);
  if (rundown.description) metaPairs.push(["Deskripsi", rundown.description]);

  doc.setFontSize(9.5);
  for (const [label, value] of metaPairs) {
    const valueLines = doc.splitTextToSize(value, contentWidth - 42);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(INK_SOFT);
    doc.text(label, margin + 1, y + 5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(INK);
    doc.text(valueLines, margin + 38, y + 5);
    y += Math.max(6, valueLines.length * 4.6);
  }

  y += 3;

  // ── Main table ──────────────────────────────────────────────────────────
  const body = timeline.map((slot) => [
    String(slot.index + 1),
    `${slot.startTime} - ${slot.endTime}`,
    formatDurationIndo(slot.durationMinutes),
    slot.segment.title,
    slot.segment.description ?? "",
    slot.segment.pic ?? "",
    slot.segment.notes ?? "",
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin, top: 18, bottom: 20 },
    head: [["No", "Waktu", "Dur", "Aktivitas", "Detail", "PIC", "Catatan"]],
    body: body.length > 0 ? body : [["-", "-", "-", "Rundown masih kosong", "", "", ""]],
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8.4,
      textColor: INK,
      lineColor: LINE,
      lineWidth: 0.2,
      cellPadding: { top: 2.2, bottom: 2.2, left: 2, right: 2 },
      valign: "top",
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: BRAND,
      textColor: "#ffffff",
      fontStyle: "bold",
      fontSize: 8.6,
      halign: "left",
    },
    alternateRowStyles: { fillColor: ROW_ALT },
    columnStyles: {
      0: { cellWidth: 9, halign: "center", textColor: INK_SOFT },
      1: { cellWidth: 26, fontStyle: "bold", fontSize: 8.2 },
      2: { cellWidth: 13, halign: "center", textColor: INK_SOFT },
      3: { cellWidth: 40, fontStyle: "bold" },
      4: { cellWidth: 50, textColor: "#3c4152", fontSize: 8 },
      5: { cellWidth: 20, fontSize: 8, textColor: "#3c4152" },
      6: { cellWidth: 24, fontSize: 8, textColor: "#3c4152" },
    },
    didParseCell: (data) => {
      // Category "harian" — highlight nothing special; keep print-clean.
      if (data.section === "head") data.cell.styles.fillColor = BRAND;
    },
  });

  // ── Footers on every page ───────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(LINE);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.8);
    doc.setTextColor(INK_SOFT);
    doc.text(
      `Dibuat dengan MythicalMind - ${exportedAt.toLocaleString("id-ID")}`,
      margin,
      pageHeight - 9.5
    );
    doc.text(`Halaman ${i} dari ${pageCount}`, pageWidth - margin, pageHeight - 9.5, {
      align: "right",
    });
  }

  const dateSuffix =
    rundown.eventDate
      ? new Date(rundown.eventDate).toISOString().slice(0, 10)
      : exportedAt.toISOString().slice(0, 10);
  doc.save(`rundown-${slugify(rundown.title)}-${dateSuffix}.pdf`);
}
