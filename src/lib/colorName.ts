function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return [r, g, b];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d === 0) h = 0;
  else if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = Math.round(h * 60);
  if (h < 0) h += 360;

  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return [h, Math.round(s * 100), Math.round(l * 100)];
}

export function guessColorName(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "Unknown";

  const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);

  // 灰階判斷：飽和度低
  if (s <= 12) {
    if (l >= 85) return "White-ish";
    if (l <= 15) return "Black-ish";
    if (l >= 60) return "Light Gray";
    if (l >= 35) return "Gray";
    return "Dark Gray";
  }

  // Hue 分段
  const hue = ((h % 360) + 360) % 360;
  let base = "Color";
  if (hue < 15 || hue >= 345) base = "Red";
  else if (hue < 45) base = "Orange";
  else if (hue < 70) base = "Yellow";
  else if (hue < 160) base = "Green";
  else if (hue < 200) base = "Cyan";
  else if (hue < 255) base = "Blue";
  else if (hue < 290) base = "Purple";
  else if (hue < 345) base = "Pink";

  // 明暗
  const lightness = clamp(l, 0, 100);
  const prefix =
    lightness >= 72 ? "Light" :
    lightness <= 30 ? "Dark" :
    "";

  // 低飽和但不是灰：比較像「Muted」
  const muted = s < 35 ? "Muted " : "";

  return `${prefix ? prefix + " " : ""}${muted}${base}`.trim();
}
