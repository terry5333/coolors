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

export default function Page() {
  const [colors, setColors] = useState<PaletteColor[]>(() => createPalette(DEFAULT_SIZE));
  const [toast, setToast] = useState<string | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [saved, setSaved] = useState<SavedPalette[]>([]);
  const [savingName, setSavingName] = useState<string>("");

  // ❤️ Drawer open/close
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Search UI (先做 UI；你要功能我也能補)
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
      if (e.code === "Escape") {
        setDrawerOpen(false);
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
      if (u) {
        await refreshSaved(u);
      } else {
        setSaved([]);
        setDrawerOpen(false);
      }
    });
    return () => unsub();
  }, []);

  // Drawer open 時，鎖住 body scroll（像產品）
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
      {/* Inline CSS: 讓你只覆蓋 page.tsx 也能直接變好看 + 有動畫 */}
      <style jsx global>{`
        :root{
          --topbar-h: 56px;
        }
        .topbar{
          height: var(--topbar-h);
          display:flex;align-items:center;justify-content:space-between;
          padding:0 18px;
          border-bottom:1px solid rgba(0,0,0,.08);
          background:#fff;
          position:sticky;top:0;z-index:20;
        }
        .brand{display:flex;align-items:center;gap:10px;font-weight:800;letter-spacing:.2px;}
        .brand-badge{
          width:32px;height:32px;border-radius:10px;
          background:linear-gradient(135deg,#B5D6B2,#FFFACC);
          border:1px solid rgba(0,0,0,.10);
        }
        .topbar-right{display:flex;align-items:center;gap:10px;}
        .top-btn{
          border:1px solid rgba(0,0,0,.10);
          background:#fff;
          padding:8px 10px;border-radius:10px;
          font-size:14px;
          transition: transform .15s ease, background .15s ease, border-color .15s ease;
        }
        .top-btn:hover{background:rgba(0,0,0,.03);}
        .top-btn:active{transform:scale(.96);}
        .pill{
          padding:6px 10px;border-radius:999px;
          background:rgba(0,0,0,.05);
          border:1px solid rgba(0,0,0,.08);
          font-size:12px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono","Courier New", monospace;
        }
        .heart-btn{transition: transform .15s ease, background .15s ease, border-color .15s ease; min-width:44px;}
        .heart-btn.active{color:#ff3b6b;border-color:rgba(255,59,107,.35);background:rgba(255,59,107,.06);}
        .heart-btn:active{transform:scale(.88);}

        .coolors-wrap{height:calc(100vh - var(--topbar-h));display:flex;flex-direction:column;background:#fff;}
        .hint{padding:10px 18px;font-size:14px;color:rgba(0,0,0,.65);}

        .palette{flex:1;display:flex;width:100%;min-height:0;}
        .col{flex:1;position:relative;display:flex;flex-direction:column;}
        .col-inner{flex:1;position:relative;display:flex;flex-direction:column;}

        .mid-tools{
          position:absolute;left:16px;top:50%;transform:translateY(-50%);
          display:flex;flex-direction:column;gap:10px;
          opacity:0; pointer-events:none;
          transition: opacity .18s ease, transform .18s ease;
        }
        .col:hover .mid-tools{opacity:1;pointer-events:auto; transform: translateY(-50%) scale(1.02);}

        .icon-btn{
          width:38px;height:38px;border-radius:999px;
          border:1px solid rgba(255,255,255,.35);
          background:rgba(255,255,255,.22);
          backdrop-filter: blur(6px);
          display:grid;place-items:center;
          font-size:16px;cursor:pointer;user-select:none;
          transition: transform .15s ease, background .15s ease;
        }
        .icon-btn:hover{background:rgba(255,255,255,.30);transform: translateY(-1px);}
        .icon-btn:active{transform: scale(.95);}
        .icon-btn.dark{
          border:1px solid rgba(0,0,0,.22);
          background:rgba(0,0,0,.14);
          color:#fff;
        }
        .icon-btn.dark:hover{background:rgba(0,0,0,.22);}

        .bottom{
          padding:18px 16px 22px;
          display:flex;align-items:flex-end;justify-content:center;
          gap:8px;flex-direction:column;
          transition: transform .18s ease;
        }
        .col:hover .bottom{transform: translateY(-2px);}
        .hex{
          font-weight:800;
          font-size: clamp(28px, 2.2vw, 44px);
          letter-spacing: 1px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono","Courier New", monospace;
        }
        .name{font-size:12px;opacity:.70;}

        @media (max-width: 860px){
          .palette{flex-direction:column;}
          .mid-tools{flex-direction:row;left:16px;top:16px;transform:none;opacity:1;pointer-events:auto;}
          .col:hover .mid-tools{transform:none;}
          .bottom{align-items:flex-start;}
        }

        .toast{
          position:fixed;left:50%;bottom:18px;transform:translateX(-50%);
          padding:10px 14px;border-radius:999px;
          background:rgba(0,0,0,.78);color:#fff;font-size:13px;
          z-index:9999;
        }

        /* Floating + */
        .plus-btn{
          position:fixed;left:18px;top:120px;
          width:44px;height:44px;border-radius:999px;
          border:1px solid rgba(0,0,0,.12);
          background:#fff;
          box-shadow:0 6px 18px rgba(0,0,0,.10);
          z-index:9998;
          font-size:22px;line-height:44px;
          cursor:pointer;
          transition: transform .15s ease, box-shadow .15s ease, opacity .15s ease;
        }
        .plus-btn:hover{transform: translateY(-1px); box-shadow:0 10px 22px rgba(0,0,0,.12);}
        .plus-btn:active{transform: scale(.96);}
        .plus-btn.disabled{cursor:not-allowed; opacity:.55;}

        /* ===== Drawer (像你圖一) ===== */
        .drawer-backdrop{
          position:fixed; inset:0;
          background: rgba(0,0,0,.18);
          backdrop-filter: blur(2px);
          opacity:0; pointer-events:none;
          transition: opacity .18s ease;
          z-index:9997;
        }
        .drawer-backdrop.show{
          opacity:1; pointer-events:auto;
        }
        .drawer{
          position:fixed; top:0; right:0;
          height:100vh; width:360px; max-width:90vw;
          background:#fff;
          box-shadow:-12px 0 32px rgba(0,0,0,.12);
          transform: translateX(100%);
          transition: transform .22s cubic-bezier(.4,0,.2,1);
          z-index:9998;
          display:flex; flex-direction:column;
        }
        .drawer.show{transform: translateX(0);}

        .drawer-header{
          padding:14px 16px;
          border-bottom:1px solid rgba(0,0,0,.08);
          display:flex; align-items:center; justify-content:space-between; gap:10px;
        }
        .drawer-title{
          font-weight:700; font-size:14px;
          display:flex; align-items:center; gap:6px;
        }
        .drawer-search{
          width: 140px;
          padding:6px 10px;
          border-radius:10px;
          border:1px solid rgba(0,0,0,.12);
          font-size:13px;
          outline:none;
          transition: box-shadow .15s ease, border-color .15s ease;
        }
        .drawer-search:focus{
          border-color: rgba(0,0,0,.22);
          box-shadow: 0 0 0 3px rgba(0,0,0,.06);
        }

        .drawer-list{
          padding:12px;
          overflow-y:auto;
          display:flex;
          flex-direction:column;
          gap:10px;
        }
        .palette-item{
          border-radius:12px;
          padding:10px;
          background:#f7f7f8;
          cursor:pointer;
          transition: transform .15s ease, box-shadow .15s ease, background .15s ease;
          position: relative;
        }
        .palette-item:hover{
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0,0,0,.12);
          background:#f5f5f7;
        }
        .palette-preview{
          display:flex;
          height:26px;
          border-radius:8px;
          overflow:hidden;
          margin-bottom:6px;
        }
        .palette-preview > div{flex:1;}
        .palette-name{font-size:13px;font-weight:600;}

        .item-actions{
          position:absolute;
          top:8px; right:8px;
          display:flex; gap:6px;
          opacity:0; transform: translateY(-2px);
          transition: opacity .15s ease, transform .15s ease;
        }
        .palette-item:hover .item-actions{
          opacity:1; transform: translateY(0);
        }
        .mini-btn{
          width:30px;height:30px;border-radius:10px;
          border:1px solid rgba(0,0,0,.10);
          background:#fff;
          display:grid;place-items:center;
          font-size:14px;
          transition: transform .12s ease, background .12s ease;
        }
        .mini-btn:hover{background:rgba(0,0,0,.04); transform: translateY(-1px);}
        .mini-btn:active{transform: scale(.96);}

        .drawer-footer{
          padding:12px;
          border-top:1px solid rgba(0,0,0,.08);
          background:#fff;
        }
        .save-row{
          display:flex; gap:10px; align-items:center; flex-wrap:wrap;
        }
        .save-input{
          flex:1;
          min-width: 180px;
          padding:10px 12px;
          border-radius:12px;
          border:1px solid rgba(0,0,0,.12);
          font-size:14px;
          outline:none;
          transition: box-shadow .15s ease, border-color .15s ease;
        }
        .save-input:focus{
          border-color: rgba(0,0,0,.22);
          box-shadow: 0 0 0 3px rgba(0,0,0,.06);
        }
        .save-btn{
          padding:10px 12px;
          border-radius:12px;
          border:1px solid rgba(0,0,0,.10);
          background:#fff;
          font-weight:600;
          transition: transform .12s ease, background .12s ease;
        }
        .save-btn:hover{background:rgba(0,0,0,.03);transform: translateY(-1px);}
        .save-btn:active{transform: scale(.97);}
      `}</style>

      {/* Top bar */}
      <div className="topbar">
        <div className="brand">
          <div className="brand-badge" />
          <div>COOLORS LITE</div>
        </div>

        <div className="topbar-right">
          <span className="pill">{copyLine}</span>

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

          {/* ❤️ Drawer toggle */}
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
              <span className="pill" style={{ fontFamily: "inherit" }}>
                {user.displayName ?? "User"}
              </span>
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

        {/* 左側 + 按鈕 */}
        <button
          onClick={addSlot}
          title={colors.length >= MAX ? `最多 ${MAX} 格` : "新增一格"}
          className={`plus-btn ${colors.length >= MAX ? "disabled" : ""}`}
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
                    <div className="hex">{hexNoHash(c.hex)}</div>
                    <div className="name">{name}</div>
                  </div>
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
          <input
            className="drawer-search"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="drawer-list">
          {filteredSaved.length === 0 ? (
            <div style={{ fontSize: 13, opacity: 0.6 }}>
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
                    ⧉
                  </button>
                  <button
                    className="mini-btn"
                    title="Delete"
                    onClick={async () => {
                      await onDeletePalette(p.id);
                    }}
                  >
                    🗑
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

        {/* Save footer */}
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
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.6 }}>
            格數：{colors.length}/{MAX} · ESC 可關閉
          </div>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
