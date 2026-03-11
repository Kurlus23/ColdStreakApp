function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function setShadow(ctx: CanvasRenderingContext2D, blur: number, alpha = 0.9) {
  ctx.shadowColor = `rgba(0,0,0,${alpha})`;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

function clearShadow(ctx: CanvasRenderingContext2D) {
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
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
        setShadow(ctx, 12 * sc);
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
        setShadow(ctx, 14 * sc);
        ctx.font = `bold ${26 * sc}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(col.value, x, statCenterY);

        // Label
        setShadow(ctx, 10 * sc, 0.75);
        ctx.font = `${11 * sc}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        ctx.fillStyle = "rgba(148,200,255,0.85)";
        ctx.textBaseline = "top";
        ctx.fillText(col.label, x, statCenterY + 4 * sc);
      });

      // ColdStreak watermark — bottom right, subtle
      setShadow(ctx, 8 * sc, 0.6);
      ctx.font = `bold ${13 * sc}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText("ColdStreak ❄️", w - pad, h - 18 * sc);

      clearShadow(ctx);

      resolve(canvas.toDataURL("image/jpeg", 0.93));
    };
    img.onerror = reject;
    img.src = photoDataUrl;
  });
}
