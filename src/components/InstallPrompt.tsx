"use client";

import { useEffect, useState } from "react";

// Minimal A2HS helper for Chromium-based browsers
// Shows a floating button when `beforeinstallprompt` fires
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState<boolean>(false);
  const [installing, setInstalling] = useState<boolean>(false);

  useEffect(() => {
    const onBeforeInstall = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferred(e);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  // Hide after installed
  useEffect(() => {
    const handler = () => setVisible(false);
    window.addEventListener("appinstalled", handler);
    return () => window.removeEventListener("appinstalled", handler);
  }, []);

  if (!visible) return null;

  const handleClick: () => Promise<void> = async () => {
    if (!deferred) return;
    try {
      setInstalling(true);
      await deferred.prompt();
      // Some browsers return a userChoice promise
      await deferred.userChoice?.catch(() => {});
      setDeferred(null);
      setVisible(false);
    } catch {
      // ignore
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="fixed bottom-4 inset-x-0 flex justify-center z-50 px-4">
      <button
        onClick={handleClick}
        className="px-4 py-2 h-11 rounded-full shadow-sm hover:shadow bg-blue-600 hover:bg-blue-700 text-white text-sm ring-1 ring-blue-700/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-400 disabled:opacity-70 disabled:cursor-not-allowed"
        aria-label="Install App"
        disabled={installing}
      >
        {installing ? "Memasang…" : "Pasang Aplikasi"}
      </button>
    </div>
  );
}
