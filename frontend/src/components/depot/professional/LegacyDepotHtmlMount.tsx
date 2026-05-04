"use client";

import { useEffect, useRef, useState } from "react";

const LEGACY_HTML_PATH = "/legacy/fidelis-chart-updated.html";
const LEGACY_ATTR = "data-legacy-depot";

export function LegacyDepotHtmlMount() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const addedHeadNodes: HTMLElement[] = [];
    const addedBodyScripts: HTMLScriptElement[] = [];

    const cleanup = () => {
      const mount = mountRef.current;
      if (mount) mount.innerHTML = "";
      addedBodyScripts.forEach((node) => node.parentNode?.removeChild(node));
      addedHeadNodes.forEach((node) => node.parentNode?.removeChild(node));
      document.body.classList.remove("light-theme");
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };

    const loadLegacyHtml = async () => {
      try {
        const bust = `?v=${Date.now()}`;
        const response = await fetch(LEGACY_HTML_PATH + bust, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Failed to load legacy depot HTML (${response.status})`);
        }

        const html = await response.text();
        if (cancelled) return;

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const mount = mountRef.current;
        if (!mount) return;

        doc.head.querySelectorAll('link[rel="preconnect"], link[rel="stylesheet"], style').forEach((node) => {
          const clone = node.cloneNode(true) as HTMLElement;
          clone.setAttribute(LEGACY_ATTR, "true");

          if (clone.tagName.toLowerCase() === "link") {
            const href = clone.getAttribute("href");
            if (href && document.head.querySelector(`link[href="${href}"]`)) return;
          }

          document.head.appendChild(clone);
          addedHeadNodes.push(clone);
        });

        mount.innerHTML = doc.body.innerHTML;

        mount.querySelectorAll("script").forEach((script) => script.parentNode?.removeChild(script));

        doc.body.querySelectorAll("script").forEach((oldScript) => {
          const newScript = document.createElement("script");
          newScript.setAttribute(LEGACY_ATTR, "true");

          const src = oldScript.getAttribute("src");
          if (src) {
            newScript.src = src;
          } else {
            newScript.textContent = oldScript.textContent;
          }

          document.body.appendChild(newScript);
          addedBodyScripts.push(newScript);
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load legacy depot UI");
      }
    };

    loadLegacyHtml();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#eef3fb] p-6 text-[#0f1c33]">
        <div className="rounded-2xl border border-red-200 bg-white px-6 py-5 shadow-sm">
          <p className="text-sm font-semibold text-red-600">Unable to load the legacy depot UI.</p>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  return <div ref={mountRef} className="min-h-screen" />;
}
