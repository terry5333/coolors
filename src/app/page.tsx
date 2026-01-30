"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, User } from "firebase/auth";
import { getFirebaseAuth } from "../lib/firebase";
import { addOneColor, createPalette, regenUnlocked, PaletteColor } from "../lib/palette";
import { guessColorName } from "../lib/colorName";
import { listPalettes, removePalette, savePalette, SavedPalette } from "../lib/firestore";

const DEFAULT_SIZE = 5;
const MAX = 10;

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function hexNoHash(hex: string) {
  return hex.replace("#", "").toUpperCase();
}

function textColorFor(hex: string) {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.62 ? "#0b1220" : "#ffffff";
}

export default function Page() {
  const [colors, setColors] = useState<PaletteColor[]>(() => createPalette(DEFAULT_SIZE));
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

  function addSlot() {
    setColors((prev) => {
      if (prev.length >= MAX) return prev;
      return addOneColor(prev);
    });
    if (colors.length >= MAX) showToast(`最多 ${MAX} 格`);
  }

  function mustAuth() {
    const a = getFirebaseAuth();
    if (!a) throw new Error("Auth is not available on server side.");
    return a;
  }

  async function doGoogleLogin() {
    const a = mustAuth();
    const provider = new GoogleAuthProvider();
    await signInWithPopup(a, provider);
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
    const want = Math.min(Math.max((p.colors ?? []).length, 1), MAX);
    const next: PaletteColor[] = (p.colors ?? []).slice(0, want).map((hex) => ({
      id: Math.random().toString(16).slice(2) + Date.now().toString(16),
      hex: hex.toUpperCase(),
      locked: false
    }));
    while (next.length < want) next.push(...createPalette(1));
    setColors(next.slice(0, want));
    showToast("已載入該組配色");
  }

  // Space generate (avoid when typing)
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
    const a = getFirebaseAuth();
    if (!a) return;
    const unsub = onAuthStateChanged(a, async (u) => {
      setUser(u);
      if (u) await refreshSaved(u);
      else setSaved([]);
    });
    return () => unsub();
  }, []);

  return (
    <div>
      {/* Top bar */}
      <div className="topbar">
        <div className="brand">
          <div className="brand-badge" />
          <div>COOLORS LITE</div>
        </div>

        <div className="topbar-right">
          <span className="pill mono">{copyLine}</span>

          <button
            className="top-btn"
            onClick={async () => {
              const ok = await copyText(copyLine);
              showToast(ok ? "已複製整組 palette" : "複製失敗");
            }}
            title="Copy palette (no #)"
          >
            Copy
          </button>

          {!user ? (
            <button className="top-btn" onClick={doGoogleLogin}>
              Google 登入
            </button>
          ) : (
            <>
              <span className="pill">{user.displayName ?? "User"}</span>
              <button
                className="top-btn"
                onClick={async () => {
                  const a = mustAuth();
                  await signOut(a);
                  showToast("已登出");
                }}
              >
                登出
              </button>
            </>
          )}
        </div>
      </div>

      <div className="coolors-wrap">
        <div className="hint">
          Press the <span className="mono">spacebar</span> to generate color palettes!（鎖住的不會被替換）
        </div>

        {/* 左側 + 按鈕（像 Coolors） */}
        <button
          onClick={addSlot}
          title={colors.length >= MAX ? `最多 ${MAX} 格` : "新增一格"}
          style={{
            position: "fixed",
            left: 18,
            top: 120,
            width: 44,
            height: 44,
            borderRadius: 999,
            border: "1px solid rgba(0,0,0,.12)",
            background: "#fff",
            boxShadow: "0 6px 18px rgba(0,0,0,.10)",
            zIndex: 9998,
            cursor: colors.length >= MAX ? "not-allowed" : "pointer",
            opacity: colors.length >= MAX ? 0.55 : 1,
            fontSize: 22,
            lineHeight: "44px"
          }}
        >
          +
        </button>

        {/* Full height columns */}
        <div className="palette">
          {colors.map((c) => {
            const text = textColorFor(c.hex);
            const name = guessColorName(c.hex);
            const isDarkText = text !== "#ffffff";

            return (
              <div key={c.id} className="col" style={{ background: c.hex }}>
                <div className="col-inner">
                  {/* Mid tools */}
                  <div className="mid-tools">
                    <div
                      className={`icon-btn ${isDarkText ? "" : "dark"}`}
                      title={c.locked ? "Unlock" : "Lock"}
                      onClick={() => toggleLock(c.id)}
                    >
                      {c.locked ? "🔒" : "🔓"}
                    </div>

                    <div
                      className={`icon-btn ${isDarkText ? "" : "dark"}`}
                      title="Copy HEX"
                      onClick={async () => {
                        const ok = await copyText(c.hex);
                        showToast(ok ? `已複製 ${c.hex}` : "複製失敗");
                      }}
                    >
                      ⧉
                    </div>

                    <div
                      className={`icon-btn ${isDarkText ? "" : "dark"}`}
                      title="Copy without #"
                      onClick={async () => {
                        const ok = await copyText(hexNoHash(c.hex));
                        showToast(ok ? `已複製 ${hexNoHash(c.hex)}` : "複製失敗");
                      }}
                    >
                      #
                    </div>
                  </div>

                  {/* Bottom label */}
                  <div className="bottom" style={{ color: text }}>
                    <div className="hex mono">{hexNoHash(c.hex)}</div>
                    <div className="name">{name}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Save panel */}
        <div style={{ padding: "12px 18px", borderTop: "1px solid rgba(0,0,0,.08)", background: "#fff" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input
              className="form-control"
              style={{ maxWidth: 420 }}
              placeholder={user ? "命名後儲存這批（例如：Exam UI）" : "登入後才能儲存"}
              value={savingName}
              onChange={(e) => setSavingName(e.target.value)}
              disabled={!user}
            />
            <button className="btn btn-light" onClick={onSavePalette} disabled={!user}>
              Save
            </button>

            {user && (
              <button
                className="btn btn-outline-secondary"
                onClick={async () => {
                  await refreshSaved(user);
                  showToast("已刷新收藏");
                }}
              >
                Refresh
              </button>
            )}

            <span style={{ marginLeft: "auto", fontSize: 12, opacity: 0.65 }}>
              格數：{colors.length}/{MAX}
            </span>
          </div>

          {/* Saved palettes list */}
          {user && saved.length > 0 && (
            <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
              {saved.slice(0, 8).map((p) => (
                <div
                  key={p.id}
                  style={{
                    border: "1px solid rgba(0,0,0,.10)",
                    borderRadius: 12,
