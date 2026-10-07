"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { getHealth } from "@/lib/api";
import { useWorkspaceStore } from "@/lib/workspace-store";

export function Topbar() {
  const { active, query, setQuery, toggleMobile } = useWorkspaceStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");
  const [showStatus, setShowStatus] = useState(false);
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  async function checkStatus() {
    setShowStatus(true);
    setStatus("Checking service...");
    try {
      const health = await getHealth();
      setStatus(
        `${health.trained ? "NLP ready" : "Limited model"} · ${health.model} · ${health.storage}`,
      );
    } catch (reason) {
      setStatus(
        reason instanceof Error ? reason.message : "Service unavailable.",
      );
    }
  }
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-[#e9e9f2] bg-white/95 px-3.5 backdrop-blur-md sm:h-18 sm:px-4.5 lg:px-10.5">
      <button
        type="button"
        className="block text-[#77768b] lg:hidden"
        onClick={toggleMobile}
        aria-label="Toggle navigation"
      >
        <span className="text-lg transition-transform duration-200">☰</span>
      </button>
      <div className="flex items-center gap-2.5 text-xs text-[#aaa9b8]">
        <span>Workspace</span>
        <b>/</b>
        <strong className="text-[#15142b]">{active}</strong>
      </div>
      <div className="flex items-center gap-4.25">
        <div className="hidden w-57.5 items-center gap-2 rounded-lg border border-[#ededf5] bg-[#f8f8fc] p-2.5 text-[#9a99aa] sm:flex">
          <Icon name="search" size={16} />
          <input
            ref={inputRef}
            aria-label="Search workspace documents"
            maxLength={1000}
            className="w-full bg-transparent text-[11px] outline-none"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search documents..."
          />
          <kbd className="whitespace-nowrap rounded border border-[#e6e5ed] bg-white px-1.5 py-0.5 text-[9px]">
            Ctrl K
          </kbd>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => (showStatus ? setShowStatus(false) : checkStatus())}
            aria-expanded={showStatus}
            className="text-xs text-[#7357ef]"
          >
            Service status
          </button>
          {showStatus && (
            <output className="absolute right-0 top-8 w-64 rounded-lg border border-[#ededf3] bg-white p-3 text-xs leading-6 shadow-lg">
              {status}
            </output>
          )}
        </div>
      </div>
    </header>
  );
}
