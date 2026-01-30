"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, User } from "firebase/auth";
import { auth } from "../lib/firebase";
import { createPalette, regenUnlocked, PaletteColor } from "../lib/palette";
import { guessColorName } from "../lib/colorName";
import { listPalettes, removePalette, savePalette, SavedPalette } from "../lib/firestore";

const SIZE = 5;

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function bestTextColor(hex: string) {
  // 簡單亮度判斷（夠用）
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.6 ? "#111111" : "#FFFFFF";
}

export default function Page() {
  const [colors, setColors] = useState<PaletteColor[]>(() => createPalette(SIZE));
  const [toast, setToast] = useState<string | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [saved, setSaved] = useState<SavedPalette[]>([]);
  const [savingName, setSavingName] = useState<string>("");

  const toastTimer = useRef<number | null>(null);

  const paletteHexes = useMemo(() => colors.map((c) => c.hex), [colors]);
  const copyLine = useMemo(() => paletteHexes.join("-").replaceAll("#", ""), [paletteHexes]);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1400);
  }

  function generate() {
    setColors((prev) => regenUnlocked(prev));
  }

  function toggleLock(id: string) {
    setColors((prev) => prev.map((c) => (c.id === id ? { ...c, locked: !c.locked } : c)));
  }

  async function doGoogleLogin() {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  }

  async function refreshSaved(u: User) {
    const list = await listPalettes(u.uid);
    setSaved(list);
  }

  async function onSavePalette() {
    if (!user) {
      showToast("請先 Google 登入");
      return;
    }
    const name = savingName.trim();
    if (!name) {
      showToast("請輸入名稱");
      return;
    }
    await savePalette(user.uid, name, paletteHexes);
    setSavingName("");
    await refreshSaved(user);
    showToast("已儲存！");
  }

  async function onDeletePalette(id: string) {
    if (!user) return;
    await removePalette(user.uid, id);
    await refreshSaved(user);
    showToast("已刪除");
  }

  async function onLoadPalette(p: SavedPalette) {
    // 載入成目前這批（鎖頭全部先關）
    const next: PaletteColor[] = p.colors.slice(0, SIZE).map((hex) => ({
      id: Math.random().toString(16).slice(2) + Date.now().toString(16),
      hex: hex.toUpperCase(),
      locked: false
    }));
    // 不足補齊
    while (next.length < SIZE) {
      next.push(...createPalette(1));
    }
    setColors(next.slice(0, SIZE));
    showToast("已載入該組配色");
  }

  // Space 生成（避免在 input 打字時觸發）
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      const isForm = tag === "input" || tag === "textarea" || tag === "select";
      if (isForm) return;

      if (e.code === "Space") {
        e.preventDefault();
        generate();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) await refreshSaved(u);
      else setSaved([]);
    });
    return () => unsub();
  }, []);

  return (
    <div className="container py-4">
      {/* Header */}
      <div className="glass p-3 p-md-4 mb-4">
        <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-3">
          <div>
            <div className="d-flex align-items-center gap-3">
              <div
                className="rounded-circle"
                style={{
                  width: 44,
                  height: 44,
                  background: "linear-gradient(135deg, var(--c1), var(--c4))",
                  border: "1px solid rgba(255,255,255,0.18)"
                }}
              />
              <div>
                <div className="h5 mb-0">Coolors Lite</div>
                <div className="small-muted">
                  按 <span className="badge badge-soft mono">Space</span> 產生新一批（鎖住的不會被替換）
                </div>
              </div>
            </div>
          </div>

          <div className="d-flex flex-wrap gap-2 align-items-center">
            <button className="btn btn-theme" onClick={generate}>
              Generate (Space)
            </button>

            <button
              className="btn btn-ghost"
              onClick={async () => {
                const ok = await copyText(copyLine);
                showToast(ok ? "已複製：b5d6b2-..." : "複製失敗");
              }}
              title="Copy like Coolors format"
            >
              Copy Palette
            </button>

            {!user ? (
              <button className="btn btn-ghost" onClick={doGoogleLogin}>
                Google 登入
              </button>
            ) : (
              <>
                <div className="small-muted">
                  {user.displayName ?? "User"}
                </div>
                <button
                  className="btn btn-ghost"
                  onClick={async () => {
                    await signOut(auth);
                    showToast("已登出");
                  }}
                >
                  登出
                </button>
              </>
            )}
          </div>
        </div>

        {/* Save bar */}
        <div className="mt-3 d-flex flex-column flex-md-row gap-2 align-items-md-center">
          <div className="flex-grow-1">
            <input
              className="form-control"
              placeholder={user ? "幫這批配色取個名字（例如：Exam UI - Warm）" : "登入後才能儲存"}
              value={savingName}
              onChange={(e) => setSavingName(e.target.value)}
              disabled={!user}
            />
          </div>
          <button className="btn btn-theme" onClick={onSavePalette} disabled={!user}>
            儲存這批
          </button>
        </div>

        <div className="small-muted mt-2">
          目前這批（可複製）：<span className="mono">{copyLine}</span>
        </div>
      </div>

      {/* Tiles */}
      <div className="row g-3">
        {colors.map((c) => {
          const text = bestTextColor(c.hex);
          const name = guessColorName(c.hex);

          return (
            <div className="col-12 col-md-6 col-lg-4 col-xl" key={c.id}>
              <div className="color-tile" style={{ background: c.hex }}>
                <div className="tile-top">
                  <div className="d-flex flex-column gap-1">
                    <div className="badge badge-soft mono" style={{ color: text }}>
                      {c.hex}
                    </div>
                    <div className="small fw-semibold" style={{ color: text }}>
                      {name}
                    </div>
                  </div>

                  <button
                    className="btn btn-sm"
                    onClick={() => toggleLock(c.id)}
                    style={{
                      background: c.locked ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.18)",
                      border: "1px solid rgba(255,255,255,0.22)",
                      color: text
                    }}
                    title={c.locked ? "Unlock" : "Lock"}
                  >
                    {c.locked ? "🔒" : "🔓"}
                  </button>
                </div>

                <div className="tile-bottom">
                  <button
                    className="btn btn-sm"
                    onClick={async () => {
                      const ok = await copyText(c.hex);
                      showToast(ok ? "已複製色號" : "複製失敗");
                    }}
                    style={{
                      background: "rgba(0,0,0,0.25)",
                      border: "1px solid rgba(255,255,255,0.18)",
                      color: text
                    }}
                  >
                    Copy HEX
                  </button>

                  <div className="small fw-semibold mono" style={{ color: text, opacity: 0.9 }}>
                    {c.locked ? "LOCKED" : "UNLOCKED"}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Saved list */}
      <div className="glass p-3 p-md-4 mt-4">
        <div className="d-flex align-items-center justify-content-between gap-2">
          <div>
            <div className="h5 mb-1">我的收藏</div>
            <div className="small-muted">每個使用者自己的 Firestore palettes</div>
          </div>
          <button
            className="btn btn-ghost"
            onClick={async () => {
              if (!user) return showToast("請先登入");
              await refreshSaved(user);
              showToast("已刷新");
            }}
          >
            Refresh
          </button>
        </div>

        {!user ? (
          <div className="mt-3 small-muted">登入後就會看到你存的配色。</div>
        ) : saved.length === 0 ? (
          <div className="mt-3 small-muted">你還沒儲存任何配色。</div>
        ) : (
          <div className="mt-3 d-flex flex-column gap-2">
            {saved.map((p) => (
              <div key={p.id} className="glass p-3" style={{ borderRadius: 14 }}>
                <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-2">
                  <div>
                    <div className="fw-semibold">{p.name}</div>
                    <div className="small-muted mono">
                      {(p.colors ?? []).join(" - ")}
                    </div>
                    <div className="d-flex flex-wrap gap-2 mt-2">
                      {(p.colors ?? []).slice(0, 5).map((hex, idx) => (
                        <div
                          key={idx}
                          title={hex}
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 8,
                            background: hex,
                            border: "1px solid rgba(255,255,255,0.22)"
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="d-flex gap-2">
                    <button className="btn btn-theme" onClick={() => onLoadPalette(p)}>
                      載入
                    </button>
                    <button
                      className="btn btn-ghost"
                      onClick={async () => {
                        const ok = await copyText((p.colors ?? []).join("-").replaceAll("#", ""));
                        showToast(ok ? "已複製該組" : "複製失敗");
                      }}
                    >
                      複製
                    </button>
                    <button className="btn btn-ghost" onClick={() => onDeletePalette(p.id)}>
                      刪除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && (
        <div
          className="position-fixed bottom-0 start-50 translate-middle-x mb-4 px-3 py-2 glass"
          style={{ borderRadius: 999, zIndex: 9999 }}
        >
          <span className="mono">{toast}</span>
        </div>
      )}
    </div>
  );
}
