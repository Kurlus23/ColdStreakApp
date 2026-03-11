function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export async function buildShareImage({
  photoDataUrl,
  temperature,
  duration,
  streak,
  locationName,
  locationId,
}: {
  photoDataUrl: string;
  temperature: number;
  duration: number;
  streak?: number;
  locationName?: string | null;
  locationId?: string | null;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;

      ctx.drawImage(img, 0, 0);

      const w = canvas.width;
      const h = canvas.height;

      // Soft gradient covering bottom ~35% — photo is fully visible above it
      const gradH = h * 0.38;
      const grad = ctx.createLinearGradient(0, h - gradH, 0, h);
      grad.addColorStop(0, "rgba(0,4,20,0)");
      grad.addColorStop(0.45, "rgba(0,4,20,0.52)");
      grad.addColorStop(1, "rgba(0,4,20,0.88)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, h - gradH, w, gradH);

      // Scale everything relative to a 1080-wide reference
      const sc = w / 1080;
      const pad = 44 * sc;

      const statCenterY = h - 52 * sc;
      const locY = statCenterY - 44 * sc;

      // Location line (cyan, above stats)
      const locText =
        locationId === "home"
          ? "📍 Home"
          : locationName
          ? `📍 ${locationName}`
          : null;
      if (locText) {
        ctx.font = `${15 * sc}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        ctx.fillStyle = "rgba(96,220,255,0.95)";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(locText, pad, locY);
      }

      // Stats columns: TEMP | TIME | STREAK
      const cols: { label: string; value: string }[] = [
        { label: "TEMP", value: `${temperature}°F` },
        { label: "TIME", value: formatTime(duration) },
      ];
      if (streak && streak > 0) {
        cols.push({ label: "STREAK", value: `${streak}d 🔥` });
      }

      const colW = (w - pad * 2) / cols.length;

      cols.forEach((col, i) => {
        const x = pad + colW * i;

        // Value
        ctx.font = `bold ${26 * sc}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(col.value, x, statCenterY);

        // Label
        ctx.font = `${11 * sc}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        ctx.fillStyle = "rgba(148,200,255,0.85)";
        ctx.textBaseline = "top";
        ctx.fillText(col.label, x, statCenterY + 4 * sc);
      });

      // ColdStreak watermark — bottom right, subtle
      ctx.font = `bold ${13 * sc}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.38)";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText("ColdStreak ❄️", w - pad, h - 18 * sc);

      resolve(canvas.toDataURL("image/jpeg", 0.93));
    };
    img.onerror = reject;
    img.src = photoDataUrl;
  });
}
