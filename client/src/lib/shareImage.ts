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

      // Bottom gradient scrim so text is always readable
      const scrim = ctx.createLinearGradient(0, h * 0.6, 0, h);
      scrim.addColorStop(0, "rgba(0,0,0,0)");
      scrim.addColorStop(1, "rgba(0,0,0,0.65)");
      ctx.fillStyle = scrim;
      ctx.fillRect(0, h * 0.6, w, h * 0.4);

      // Build stat line: 📍 Location · 5d 🔥 · 6:30 · 43°F
      const parts: string[] = [];
      const loc =
        locationId === "home" ? "📍 Home" : locationName ? `📍 ${locationName}` : null;
      if (loc) parts.push(loc);
      if (streak && streak > 0) parts.push(`${streak}d 🔥`);
      parts.push(formatTime(duration));
      parts.push(`${temperature}°F`);

      const line = parts.join("  ·  ");

      // Score badge — top-left corner
      if (score !== undefined) {
        const scoreText = `Score ${score.toFixed(1)}`;
        const badgePad = 20 * sc;
        const badgeH = 44 * sc;
        ctx.font = `bold ${22 * sc}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        const textW = ctx.measureText(scoreText).width;
        const badgeW = textW + badgePad * 2;
        const badgeX = pad;
        const badgeY = pad;

        // Badge background
        ctx.save();
        ctx.globalAlpha = 0.82;
        ctx.fillStyle = "#06b6d4";
        const r = badgeH / 2;
        ctx.beginPath();
        ctx.moveTo(badgeX + r, badgeY);
        ctx.lineTo(badgeX + badgeW - r, badgeY);
        ctx.quadraticCurveTo(badgeX + badgeW, badgeY, badgeX + badgeW, badgeY + r);
        ctx.lineTo(badgeX + badgeW, badgeY + badgeH - r);
        ctx.quadraticCurveTo(badgeX + badgeW, badgeY + badgeH, badgeX + badgeW - r, badgeY + badgeH);
        ctx.lineTo(badgeX + r, badgeY + badgeH);
        ctx.quadraticCurveTo(badgeX, badgeY + badgeH, badgeX, badgeY + badgeH - r);
        ctx.lineTo(badgeX, badgeY + r);
        ctx.quadraticCurveTo(badgeX, badgeY, badgeX + r, badgeY);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Score text
        setShadow(ctx, 6 * sc, 0.5);
        ctx.font = `bold ${22 * sc}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(scoreText, badgeX + badgePad, badgeY + badgeH / 2);
        clearShadow(ctx);
      }

      // Stat line — bottom left
      setShadow(ctx, 14 * sc);
      ctx.font = `bold ${20 * sc}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(line, pad, h - 36 * sc);

      // Watermark — bottom right
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
