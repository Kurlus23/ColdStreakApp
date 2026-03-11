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
      const sc = w / 1080;
      const pad = 44 * sc;

      // Build a single sentence: 43°F · 6:30 · 5d 🔥 · 📍 Hamlin Pond
      const parts: string[] = [
        `${temperature}°F`,
        formatTime(duration),
      ];
      if (streak && streak > 0) parts.push(`${streak}d 🔥`);
      const loc =
        locationId === "home" ? "📍 Home" : locationName ? `📍 ${locationName}` : null;
      if (loc) parts.push(loc);

      const line = parts.join("  ·  ");

      setShadow(ctx, 14 * sc);
      ctx.font = `bold ${20 * sc}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(line, pad, h - 36 * sc);

      // Watermark
      setShadow(ctx, 8 * sc, 0.6);
      ctx.font = `bold ${12 * sc}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.textAlign = "right";
      ctx.fillText("ColdStreak ❄️", w - pad, h - 36 * sc);

      clearShadow(ctx);

      resolve(canvas.toDataURL("image/jpeg", 0.93));
    };
    img.onerror = reject;
    img.src = photoDataUrl;
  });
}
