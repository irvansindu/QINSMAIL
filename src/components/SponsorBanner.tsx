"use client";

import { useState } from "react";
import { X, Heart } from "lucide-react";
import GoogleAd from "./GoogleAd";

export default function SponsorBanner() {
  const [visible, setVisible] = useState<boolean>(() => {
    try {
      if (typeof window !== "undefined") {
        const hidden = localStorage.getItem("hideSponsorBanner");
        return hidden !== "1";
      }
    } catch {}
    return true;
  });

  if (!visible) return null;

  return (
    <div className="w-full">
      <div className="mx-auto max-w-5xl px-3 sm:px-4">
        <div className="mt-2 mb-3 rounded-xl border border-amber-200/70 dark:border-amber-400/20 bg-amber-50/80 dark:bg-amber-400/10 backdrop-blur text-amber-800 dark:text-amber-100 text-xs sm:text-sm flex items-center justify-between gap-3 px-3 py-2">
          <div className="flex-1 flex items-center gap-2 overflow-hidden">
            <Heart size={14} className="text-amber-500 shrink-0" />
            <div className="w-full overflow-hidden">
              <GoogleAd
                client={process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "ca-pub-0000000000000000"}
                slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT || "0000000000"}
                format="auto"
                responsive
                className="w-full"
              />
            </div>
          </div>
          <button
            aria-label="Tutup banner"
            onClick={() => {
              setVisible(false);
              try { localStorage.setItem("hideSponsorBanner", "1"); } catch {}
            }}
            className="shrink-0 inline-flex items-center justify-center rounded-md p-1 text-amber-700/80 hover:text-amber-900 dark:text-amber-100/80 dark:hover:text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400/40"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
