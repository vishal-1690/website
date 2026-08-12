"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Click-to-copy email button.
 *
 * The address is split into user/domain and only joined at click time, so the
 * full string never appears in the rendered HTML for a scraper to lift. That is
 * a meaningfully better defence than `[at]`/`[dot]` masking, which scrapers
 * unmask with a trivial regex.
 */
export default function CopyEmail({
  user,
  domain,
}: {
  user: string;
  domain: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function copy() {
    const address = `${user}@${domain}`;
    try {
      await navigator.clipboard.writeText(address);
    } catch {
      // Clipboard can be blocked (insecure context, denied permission).
      // Fall back to letting the user's mail client take over.
      window.location.href = `mailto:${address}`;
      return;
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-live="polite"
      className="link-underline cursor-pointer text-xs text-muted transition-colors hover:text-foreground"
    >
      {copied ? "Copied ✓" : "Copy email"}
    </button>
  );
}
