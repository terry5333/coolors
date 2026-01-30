"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User
} from "firebase/auth";
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

function IconSearch() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M10.5 18a7.5 7.5 0 1 1 5.303-12.803A7.5 7.5 0 0 1 10.5 18Zm0-2a5.5 5.5 0 1 0-3.889-1.611A5.5 5.5 0 0 0 10.5 16ZM20.293 21.707l-4.2-4.2 1.414-1.414 4.2 4.2-1.414 1.414Z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M9 3h6l1 2h5v2h-2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7H3V5h5l1-2Zm8 4H7v14h10V7Zm-7 3h2v8h-2v-8Zm4 0h2v8h-2v-8Z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M8 7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-8a3 3 0 0 1-3-3V7Zm3-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-8ZM2 9a3 3 0 0 1 3-3h1v2H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1h2v1a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V9Z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconLock({ locked }: { locked: boolean }) {
  return locked ? (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M17 10V8a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1Zm-8 0V8a3 3 0 0 1 6 0v2H9Z"
        fill="currentColor"
      />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M17 10V8a5 5 0 0 0-10 0h2a3 3 0 0 1 6 0v2H8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function Page() {
  const [colors, setColors] = useState<PaletteColor[]>(() => createPalette(DEFAULT_SIZE));
  const [toast, setToast] = useState<string | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [saved, setSaved] = useState<SavedPalette[]>([]);
  const [savingName, setSavingName] = useState<string>("");

  // Drawer open/close
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState("");

  const toastTimer = useRef<number | null>(null);

  const paletteHexes = useMemo(() => colors.map((c) => c.hex), [colors]);
  const copyLine = useMemo(() => paletteHexes.join("-").replaceAll("#", ""), [paletteHexes]);

  const filteredSaved = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return saved;
    return saved.filter((p) => (p.name ?? "").toLowerCase().includes(q));
  }, [saved, search]);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1300);
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

  // Space + ESC
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      const isForm = tag === "input" || tag === "textarea" || tag === "select";
      if (!isForm && e.code === "Space") {
        e.preventDefault();
        generate();
      }
      if (e.code === "Escape") setDrawerOpen(false);
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
      if (u) {
        await refreshSaved(u);
      } else {
        setSaved([]);
        setDrawerOpen(false);
      }
    });
    return () => unsub();
  }, []);

  // Drawer lock scroll
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  return (
    <div>
      {/* 全部 UI 在這裡：更乾淨 + 動畫更多 */}
      <style jsx global>{`
        :root{
          --topbar-h: 56px;
          --text: #0b1220;
          --muted: rgba(11,18,32,.60);
          --line: rgba(15,23,42,.10);
          --card: rgba(255,255,255,.72);
          --shadow: 0 16px 40px rgba(2,6,23,.10);
          --shadow2: 0 10px 24px rgba(2,6,23,.12);
          --radius: 14px;
        }

        html, body { height: 100%; }
        body{
          margin: 0;
          color: var(--text);
          font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans TC", Arial;
          background:
            radial-gradient(1000px 500px at 10% -10%, rgba(181,214,178,.35), transparent 55%),
            radial-gradient(900px 450px at 90% 0%, rgba(255,250,204,.35), transparent 55%),
            #fbfbfd;
        }

        .mono{
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono","Courier New", monospace;
        }

        /* Topbar */
        .topbar{
          height: var(--topbar-h);
          display:flex;align-items:center;justify-content:space-between;
          padding: 0 16px;
          position: sticky; top: 0; z-index: 50;
          border-bottom: 1px solid var(--line);
          background: rgba(255,255,255,.75);
          backdrop-filter: blur(10px);
        }
        .brand{display:flex;align-items:center;gap:10px;font-weight:900;letter-spacing:.5px;}
        .brand-badge{
          width: 34px; height: 34px; border-radius: 12px;
          background: linear-gradient(135deg, #B5D6B2, #FFFACC);
          border: 1px solid var(--line);
          box-shadow: 0 10px 22px rgba(2,6,23,.10);
        }

        .topbar-right{display:flex;align-items:center;gap:10px;}

        .pill{
          padding: 7px 10px;
          border-radius: 999px;
          border: 1px solid var(--line);
          background: rgba(255,255,255,.65);
          font-size: 12px;
        }

        .top-btn{
          border: 1px solid var(--line);
          background: rgba(255,255,255,.70);
          padding: 8px 10px;
          border-radius: 12px;
          font-size: 14px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: transform .14s ease, box-shadow .14s ease, background .14s ease;
          box-shadow: 0 8px 18px rgba(2,6,23,.06);
        }
        .top-btn:hover{transform: translateY(-1px); box-shadow: var(--shadow2); background: rgba(255,255,255,.92);}
        .top-btn:active{transform: translateY(0) scale(.97);}

        .heart-btn{min-width: 44px; justify-content: center;}
        .heart-btn.active{color:#ff2d6f; border-color: rgba(255,45,111,.25);}

        /* Layout */
        .coolors-wrap{
          height: calc(100vh - var(--topbar-h));
          display:flex;
          flex-direction:column;
        }
        .hint{
          padding: 10px 16px;
          color: var(--muted);
          font-size: 14px;
        }

        /* Palette columns */
        .palette{
          flex: 1;
          display:flex;
          width: 100%;
          min-height: 0;
          border-top: 1px solid transparent;
        }
        .col{
          flex: 1;
          position: relative;
          overflow: hidden;
        }
        .col::after{
          content:"";
          position:absolute;
          inset:0;
          background: linear-gradient(to bottom, rgba(0,0,0,.10), transparent 40%, rgba(0,0,0,.10));
          opacity: 0;
          transition: opacity .18s ease;
          pointer-events:none;
        }
        .col:hover::after{opacity: 1;}

        /* Mid lock button (only) */
        .mid-tools{
          position:absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          opacity: 0;
          pointer-events: none;
          transition: opacity .18s ease, transform .18s ease;
        }
        .col:hover .mid-tools{
          opacity: 1;
          pointer-events: auto;
          transform: translateY(-50%) scale(1.02);
        }
        .icon-btn{
          width: 42px; height: 42px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,.38);
          background: rgba(255,255,255,.22);
          backdrop-filter: blur(8px);
          display:grid;
          place-items:center;
          cursor:pointer;
          transition: transform .14s ease, background .14s ease;
        }
        .icon-btn:hover{transform: translateY(-1px); background: rgba(255,255,255,.30);}
        .icon-btn:active{transform: scale(.97);}
        .icon-btn.dark{
          border: 1px solid rgba(0,0,0,.18);
          background: rgba(0,0,0,.16);
          color: #fff;
        }
        .icon-btn.dark:hover{background: rgba(0,0,0,.22);}

        /* Bottom label */
        .bottom{
          position:absolute;
          left: 0; right: 0; bottom: 0;
          padding: 18px 18px 22px;
          display:flex;
          flex-direction:column;
          gap: 6px;
          align-items:center;
          transition: transform .18s ease;
          user-select: none;
        }
        .col:hover .bottom{transform: translateY(-2px);}
        .hex{
          font-weight: 900;
          letter-spacing: 1px;
          font-size: clamp(28px, 2.4vw, 44px);
          cursor: pointer;
          transition: transform .14s ease, opacity .14s ease;
        }
        .hex:hover{transform: translateY(-1px); opacity: .95;}
        .name{font-size: 12px; opacity: .70;}

        /* Floating + */
        .plus-btn{
          position: fixed;
          left: 16px;
          top: 120px;
          width: 48px; height: 48px;
          border-radius: 999px;
          border: 1px solid var(--line);
          background: rgba(255,255,255,.80);
          backdrop-filter: blur(10px);
          box-shadow: var(--shadow);
          z-index: 49;
          cursor: pointer;
          font-size: 22px;
          transition: transform .14s ease, box-shadow .14s ease, opacity .14s ease;
        }
        .plus-btn:hover{transform: translateY(-1px); box-shadow: var(--shadow2);}
        .plus-btn:active{transform: scale(.97);}
        .plus-btn.disabled{opacity:.55; cursor:not-allowed;}

        /* Toast */
        .toast{
          position: fixed;
          left: 50%;
          bottom: 18px;
          transform: translateX(-50%);
          padding: 10px 14px;
          border-radius: 999px;
          background: rgba(0,0,0,.78);
          color: #fff;
          font-size: 13px;
          z-index: 9999;
          animation: toastIn .18s ease;
        }
        @keyframes toastIn{
          from{opacity:0; transform: translateX(-50%) translateY(6px);}
          to{opacity:1; transform: translateX(-50%) translateY(0);}
        }

        /* Drawer */
        .drawer-backdrop{
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,.18);
          opacity: 0;
          pointer-events: none;
          transition: opacity .18s ease;
          z-index: 9997;
        }
        .drawer-backdrop.show{
          opacity: 1;
          pointer-events: auto;
        }
        .drawer{
          position: fixed;
          top: 0; right: 0;
          height: 100vh;
          width: 360px;
          max-width: 92vw;
          background: rgba(255,255,255,.86);
          backdrop-filter: blur(14px);
          border-left: 1px solid var(--line);
          box-shadow: -16px 0 42px rgba(2,6,23,.14);
          transform: translateX(100%);
          transition: transform .22s cubic-bezier(.4,0,.2,1);
          z-index: 9998;
          display:flex;
          flex-direction:column;
        }
        .drawer.show{transform: translateX(0);}

        .drawer-header{
          padding: 14px 14px;
          border-bottom: 1px solid var(--line);
          display:flex;
          align-items:center;
          justify-content: space-between;
          gap: 10px;
        }
        .drawer-title{
          font-weight: 800;
          font-size: 14px;
          display:flex;
          align-items:center;
          gap: 8px;
        }
        .drawer-search{
          width: 160px;
          display:flex;
          align-items:center;
          gap: 8px;
          border: 1px solid var(--line);
          background: rgba(255,255,255,.78);
          border-radius: 12px;
          padding: 8px 10px;
          transition: box-shadow .14s ease;
        }
        .drawer-search:focus-within{box-shadow: 0 0 0 4px rgba(2,6,23,.06);}
        .drawer-search input{
          border: none;
          outline: none;
          background: transparent;
          width: 100%;
          font-size: 13px;
          color: var(--text);
        }

        .drawer-list{
          padding: 12px;
          overflow-y: auto;
          display:flex;
          flex-direction:column;
          gap: 10px;
        }

        .palette-item{
          border-radius: 14px;
          padding: 10px;
          background: rgba(255,255,255,.70);
          border: 1px solid var(--line);
          cursor: pointer;
          transition: transform .15s ease, box-shadow .15s ease, background .15s ease;
          position: relative;
        }
        .palette-item:hover{
          transform: translateY(-2px);
          box-shadow: var(--shadow2);
          background: rgba(255,255,255,.92);
        }

        .palette-preview{
          display:flex;
          height: 26px;
          border-radius: 10px;
          overflow: hidden;
          margin-bottom: 8px;
          border: 1px solid rgba(2,6,23,.08);
        }
        .palette-preview > div{flex:1;}

        .palette-name{
          font-size: 13px;
          font-weight: 700;
        }

        .item-actions{
          position:absolute;
          top: 10px; right: 10px;
          display:flex;
          gap: 8px;
          opacity: 0;
          transform: translateY(-2px);
          transition: opacity .14s ease, transform .14s ease;
        }
        .palette-item:hover .item-actions{
          opacity: 1;
          transform: translateY(0);
        }
        .mini-btn{
          width: 34px; height: 34px;
          border-radius: 12px;
          border: 1px solid var(--line);
          background: rgba(255,255,255,.86);
          display:grid;
          place-items:center;
          cursor:pointer;
          transition: transform .12s ease, background .12s ease;
        }
        .mini-btn:hover{background: rgba(255,255,255,1); transform: translateY(-1px);}
        .mini-btn:active{transform: scale(.97);}

        .drawer-footer{
          padding: 12px;
          border-top: 1px solid var(--line);
          background: rgba(255,255,255,.72);
        }
        .save-row{
          display:flex;
          gap: 10px;
          align-items:center;
        }
        .save-input{
          flex: 1;
          padding: 10px 12px;
          border-radius: 14px;
          border: 1px solid var(--line);
          background: rgba(255,255,255,.82);
          outline: none;
          transition: box-shadow .14s ease;
        }
        .save-input:focus{box-shadow: 0 0 0 4px rgba(2,6,23,.06);}
        .save-btn{
          padding: 10px 12px;
          border-radius: 14px;
          border: 1px solid var(--line);
          background: rgba(255,255,255,.90);
          font-weight: 800;
          cursor: pointer;
          transition: transform .12s ease, box-shadow .12s ease;
        }
        .save-btn:hover{transform: translateY(-1px); box-shadow: 0 10px 22px rgba(2,6,23,.10);}
        .save-btn:active{transform: scale(.98);}

        @media (max-width: 860px){
          .palette{flex-direction:column;}
          .mid-tools{
            top: 14px;
            left: 14px;
            transform: none;
            opacity: 1;
            pointer-events: auto;
          }
          .col:hover .mid-tools{transform:none;}
          .bottom{align-items:flex-start;}
        }
      `}</style>

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
            title="Copy palette"
          >
            <IconCopy />
            Copy
          </button>

          <button
            className={`top-btn heart-btn ${drawerOpen ? "active" : ""}`}
            onClick={async () => {
              if (!user) {
                showToast("請先 Google 登入");
                return;
              }
              const next = !drawerOpen;
              setDrawerOpen(next);
              if (next && user) await refreshSaved(user);
            }}
            title="Saved palettes"
          >
            {drawerOpen ? "♥" : "♡"}
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
          Press the <span className="mono">spacebar</span> to generate palettes. Click HEX to copy. (ESC closes drawer)
        </div>

        {/* + button */}
        <button
          className={`plus-btn ${colors.length >= MAX ? "disabled" : ""}`}
          onClick={addSlot}
          title={colors.length >= MAX ? `最多 ${MAX} 格` : "新增一格"}
        >
          +
        </button>

        {/* Palette columns */}
        <div className="palette">
          {colors.map((c) => {
            const text = textColorFor(c.hex);
            const isDarkText = text !== "#ffffff";
            const name = guessColorName(c.hex);

            return (
              <div key={c.id} className="col" style={{ background: c.hex }}>
                {/* Only lock button in the middle */}
                <div className="mid-tools">
                  <button
                    className={`icon-btn ${isDarkText ? "" : "dark"}`}
                    onClick={() => toggleLock(c.id)}
                    title={c.locked ? "Unlock" : "Lock"}
                    aria-label={c.locked ? "Unlock" : "Lock"}
                  >
                    <IconLock locked={c.locked} />
                  </button>
                </div>

                {/* Bottom */}
                <div className="bottom" style={{ color: text }}>
                  <div
                    className="hex mono"
                    onClick={async () => {
                      const ok = await copyText(hexNoHash(c.hex));
                      showToast(ok ? `已複製 ${hexNoHash(c.hex)}` : "複製失敗");
                    }}
                    title="Click to copy"
                  >
                    {hexNoHash(c.hex)}
                  </div>
                  <div className="name">{name}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Drawer backdrop */}
      <div
        className={`drawer-backdrop ${drawerOpen ? "show" : ""}`}
        onClick={() => setDrawerOpen(false)}
      />

      {/* Drawer */}
      <div className={`drawer ${drawerOpen ? "show" : ""}`}>
        <div className="drawer-header">
          <div className="drawer-title">All palettes ▾</div>
          <div className="drawer-search">
            <IconSearch />
            <input
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="drawer-list">
          {filteredSaved.length === 0 ? (
            <div style={{ fontSize: 13, opacity: 0.65 }}>
              {saved.length === 0 ? "No saved palettes yet." : "No results."}
            </div>
          ) : (
            filteredSaved.map((p) => (
              <div
                key={p.id}
                className="palette-item"
                onClick={() => {
                  onLoadPalette(p);
                  setDrawerOpen(false);
                }}
              >
                {/* hover actions */}
                <div className="item-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="mini-btn"
                    title="Copy"
                    onClick={async () => {
                      const line = (p.colors ?? []).join("-").replaceAll("#", "");
                      const ok = await copyText(line);
                      showToast(ok ? "已複製該組" : "複製失敗");
                    }}
                  >
                    <IconCopy />
                  </button>
                  <button
                    className="mini-btn"
                    title="Delete"
                    onClick={async () => {
                      await onDeletePalette(p.id);
                    }}
                  >
                    <IconTrash />
                  </button>
                </div>

                <div className="palette-preview">
                  {(p.colors ?? []).slice(0, 5).map((hx, i) => (
                    <div key={i} style={{ background: hx }} />
                  ))}
                </div>
                <div className="palette-name">{p.name}</div>
              </div>
            ))
          )}
        </div>

        <div className="drawer-footer">
          <div className="save-row">
            <input
              className="save-input"
              placeholder="Name & save current palette"
              value={savingName}
              onChange={(e) => setSavingName(e.target.value)}
              disabled={!user}
            />
            <button className="save-btn" onClick={onSavePalette} disabled={!user}>
              Save
            </button>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.65 }}>
            格數：{colors.length}/{MAX}
          </div>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
