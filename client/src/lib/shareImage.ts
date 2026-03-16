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

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function buildShareImage({
  photoDataUrl,
  temperature,
  duration,
  streak,
  locationName,
  locationId,
  score,
}: {
  photoDataUrl: string;
  temperature: number;
  duration: number;
  streak?: number;
  locationName?: string | null;
  locationId?: string | null;
  score?: number;
}): Promise<string> {
  const [photo, logo] = await Promise.all([
    loadImage(photoDataUrl),
    loadImage("/icons/icon-192.png").catch(() => null),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = photo.width;
  canvas.height = photo.height;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(photo, 0, 0);

  const w = canvas.width;
  const h = canvas.height;
  const sc = w / 1080;
  const pad = 44 * sc;

  // Bottom gradient scrim so text is always readable
  const scrim = ctx.createLinearGradient(0, h * 0.55, 0, h);
  scrim.addColorStop(0, "rgba(0,0,0,0)");
  scrim.addColorStop(1, "rgba(0,0,0,0.70)");
  ctx.fillStyle = scrim;
  ctx.fillRect(0, h * 0.55, w, h * 0.45);

  // Stat line — bottom left: location · streak · time · temp · score
  const parts: string[] = [];
  const loc =
    locationId === "home" ? "📍 Home" : locationName ? `📍 ${locationName}` : null;
  if (loc) parts.push(loc);
  if (streak && streak > 0) parts.push(`${streak}d 🔥`);
  parts.push(`${temperature}°F`);
  parts.push(formatTime(duration));
  if (score !== undefined) parts.push(`Score ${score.toFixed(1)}`);
  const line = parts.join("  ·  ");

  setShadow(ctx, 14 * sc);
  ctx.font = `bold ${20 * sc}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(line, pad, h - 36 * sc);

  // Logo + wordmark — bottom right
  const logoSize = 48 * sc;
  const wordmark = "ColdStreak";
  setShadow(ctx, 8 * sc, 0.6);
  ctx.font = `bold ${18 * sc}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  const wordmarkY = h - 36 * sc;

  if (logo) {
    const wordmarkW = ctx.measureText(wordmark).width;
    const gap = 10 * sc;
    const logoX = w - pad - wordmarkW - gap - logoSize;
    const logoY = wordmarkY - logoSize / 2;

    // Circular clip for logo
    ctx.save();
    clearShadow(ctx);
    ctx.beginPath();
    ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
    ctx.restore();

    setShadow(ctx, 8 * sc, 0.6);
    ctx.font = `bold ${18 * sc}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(wordmark, w - pad, wordmarkY);
  } else {
    ctx.fillText(`ColdStreak ❄️`, w - pad, wordmarkY);
  }

  clearShadow(ctx);

  return canvas.toDataURL("image/jpeg", 0.93);
}
