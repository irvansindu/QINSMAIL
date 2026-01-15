"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  // External store reading current theme from the DOM class
  const getSnapshot = () => {
    if (typeof document === "undefined") return false;
    return document.documentElement.classList.contains("dark");
  };
  const subscribe = (callback: () => void) => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "theme") {
        const v = e.newValue;
        const next = v === "dark" ? true : v === "light" ? false : getPreferred();
        document.documentElement.classList.toggle("dark", next);
        callback();
      }
    };
    const mql = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    const onMedia = () => {
      // Only react to system change if user hasn't explicitly chosen
      const saved = localStorage.getItem("theme");
      if (!saved) {
        const next = mql?.matches ?? false;
        document.documentElement.classList.toggle("dark", next);
        callback();
      }
    };
    const onThemeChange = () => callback();
    window.addEventListener("storage", onStorage);
    mql?.addEventListener?.("change", onMedia as EventListener);
    window.addEventListener("themechange", onThemeChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      mql?.removeEventListener?.("change", onMedia as EventListener);
      window.removeEventListener("themechange", onThemeChange);
    };
  };

  const getPreferred = () => (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? true : false;

  const isDark = useSyncExternalStore(subscribe, getSnapshot, () => false);

  // Align HTML class on first mount according to saved preference or system
  useEffect(() => {
    try {
      const saved = localStorage.getItem("theme");
      const next = saved ? saved === "dark" : getPreferred();
      document.documentElement.classList.toggle("dark", next);
      // no setState here; UI reflects via external store
    } catch {}
  }, []);

  const toggle = () => {
    const next = !getSnapshot();
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
      document.documentElement.classList.toggle("dark", next);
      window.dispatchEvent(new Event("themechange"));
    } catch {}
  };

  return (
    <button
      onClick={toggle}
      className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm bg-gray-100/80 hover:bg-gray-200 dark:bg-gray-800/80 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 shadow-sm transition-colors"
      title="Ubah tema"
      aria-label="Toggle theme"
   >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
      <span className="hidden sm:inline">{isDark ? "Terang" : "Gelap"}</span>
    </button>
  );
}
