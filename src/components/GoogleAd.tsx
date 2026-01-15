"use client";

import { useEffect } from "react";

declare global {
  interface Window { adsbygoogle?: unknown[] }
}

type Props = {
  client: string;
  slot: string;
  layout?: string;
  format?: string;
  responsive?: boolean;
  className?: string;
};

export default function GoogleAd({ client, slot, layout, format = "auto", responsive = true, className }: Props) {
  useEffect(() => {
    try {
      // ensure script loaded
      if (typeof window !== "undefined") {
        if (!window.adsbygoogle) window.adsbygoogle = [];
        window.adsbygoogle.push({});
      }
    } catch {}
  }, [client, slot]);

  return (
    <ins
      className={`adsbygoogle block ${className ?? ""}`.trim()}
      style={{ display: "block" }}
      data-ad-client={client}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive={responsive ? "true" : "false"}
      data-ad-layout={layout}
    />
  );
}
