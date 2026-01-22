"use client";

import { useEffect, useRef } from "react";

interface ArticleContentProps {
  content: string;
  onProgress?: (scrollPercent: number) => void;
  onComplete?: () => void;
}

export default function ArticleContent({
  content,
  onProgress,
  onComplete,
}: ArticleContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastReportedPercent = useRef(0);
  const hasCompleted = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const containerTop = container.offsetTop;
      const containerHeight = container.offsetHeight;
      const windowHeight = window.innerHeight;

      // Calculate how much of the article has been scrolled
      const scrolledAmount = scrollTop + windowHeight - containerTop;
      const scrollPercent = Math.min(100, Math.max(0, (scrolledAmount / containerHeight) * 100));

      // Report progress every 10%
      if (scrollPercent - lastReportedPercent.current >= 10) {
        lastReportedPercent.current = Math.floor(scrollPercent / 10) * 10;
        onProgress?.(lastReportedPercent.current);
      }

      // Mark as complete when user has scrolled past 90%
      if (scrollPercent >= 90 && !hasCompleted.current) {
        hasCompleted.current = true;
        onComplete?.();
      }
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll(); // Check initial position

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [onProgress, onComplete]);

  return (
    <div
      ref={containerRef}
      className="prose prose-lg max-w-none
        prose-headings:text-dark prose-headings:font-bold
        prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl
        prose-p:text-gray-700 prose-p:leading-relaxed
        prose-a:text-accent prose-a:no-underline hover:prose-a:underline
        prose-strong:text-dark
        prose-ul:text-gray-700 prose-ol:text-gray-700
        prose-li:marker:text-accent
        prose-blockquote:border-accent prose-blockquote:text-gray-600
        prose-code:text-accent prose-code:bg-accent/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
        prose-pre:bg-gray-900 prose-pre:text-gray-100
        prose-img:rounded-xl prose-img:shadow-md"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
