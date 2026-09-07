"use client";

import { Icon } from "@/components/Icon";
import { useWorkspaceStore } from "@/lib/workspace-store";

export function Topbar() {
  const { active, query, setQuery, toggleMobile } = useWorkspaceStore();
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
            className="w-full bg-transparent text-[11px] outline-none"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search documents..."
          />
          <kbd className="whitespace-nowrap rounded border border-[#e6e5ed] bg-white px-1.5 py-0.5 text-[9px]">
            ⌘ K
          </kbd>
        </div>
        <button
          type="button"
          className="text-[#868598]"
          aria-label="Notifications"
        >
          <Icon name="bell" />
        </button>
      </div>
    </header>
  );
}
