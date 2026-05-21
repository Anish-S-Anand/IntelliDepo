"use client";

import { useState, useEffect, useRef } from "react";

interface LazyVideoFeedProps {
  src: string;
  alt: string;
  className?: string;
}

export default function LazyVideoFeed({ src, alt, className }: LazyVideoFeedProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            // Delay loading by 500ms to prioritize other content
            setTimeout(() => setShouldLoad(true), 500);
          }
        });
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className={className}>
      {shouldLoad ? (
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-contain"
          loading="lazy"
        />
      ) : (
        <div className="h-full w-full flex items-center justify-center bg-[#0F1A30]">
          <div className="text-[#8A9BBF] text-[12px]">
            {isVisible ? "Loading video..." : "Scroll to load video"}
          </div>
        </div>
      )}
    </div>
  );
}
