export type PaletteColor = {
  id: string;
  hex: string;
  locked: boolean;
};

export function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 做「比較像設計色」：飽和度、亮度範圍收斂，避免髒灰
function randomNiceHsl() {
  const h = randInt(0, 359);
  const s = randInt(55, 92);
  const l = randInt(35, 72);
  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  s = clamp(s, 0, 100) / 100;
  l = clamp(l, 0, 100) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r1 = 0, g1 = 0, b1 = 0;
  if (h < 60) [r1, g1, b1] = [c, x, 0];
  else if (h < 120) [r1, g1, b1] = [x, c, 0];
  else if (h < 180) [r1, g1, b1] = [0, c, x];
  else if (h < 240) [r1, g1, b1] = [0, x, c];
  else if (h < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];

  const r = Math.round((r1 + m) * 255);
  const g = Math.round((g1 + m) * 255);
  const b = Math.round((b1 + m) * 255);
  return [r, g, b];
}

function rgbToHex(r: number, g: number, b: number) {
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(clamp(r, 0, 255))}${toHex(clamp(g, 0, 255))}${toHex(clamp(b, 0, 255))}`.toUpperCase();
}

function hslToHex(h: number, s: number, l: number) {
  const [r, g, b] = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
}

export function createPalette(count = 5): PaletteColor[] {
  const base = randomNiceHsl();
  // 用類似 analogous 方式，讓顏色更協調
  const step = randInt(18, 34);
  const start = base.h - step * Math.floor(count / 2);

  const colors: PaletteColor[] = [];
  for (let i = 0; i < count; i++) {
    const h = start + i * step + randInt(-10, 10);
    const s = clamp(base.s + randInt(-18, 18), 45, 95);
    const l = clamp(base.l + randInt(-20, 20), 25, 80);
    colors.push({ id: uid(), hex: hslToHex(h, s, l), locked: false });
  }
  return colors;
}

export function regenUnlocked(prev: PaletteColor[]): PaletteColor[] {
  const fresh = createPalette(prev.length);
  let j = 0;
  return prev.map((p) => (p.locked ? p : { ...fresh[j++], locked: false }));
}

/** 新增一格（預設不鎖） */
export function addOneColor(prev: PaletteColor[]): PaletteColor[] {
  const one = createPalette(1)[0]!;
  return [...prev, one];
}

/** 刪除一格（如果你之後要加 - 按鈕用） */
export function removeOneColor(prev: PaletteColor[]): PaletteColor[] {
  if (prev.length <= 1) return prev;
  return prev.slice(0, -1);
}
