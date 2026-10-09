"use client";

import { useWorkspaceStore } from "@/features/workspace/store/workspace-store";
import { Button } from "@/ui/Button";
import { Icon, type IconName } from "@/ui/Icon";

const groups = [
  {
    label: "Workspace",
    items: [
      ["Overview", "grid"],
      ["Text analyzer", "scan"],
      ["Named entity recognition", "users"],
      ["Writing assistant", "file"],
      ["Predictive text", "spark"],
      ["Keyword extraction", "scan"],
      ["Readability", "file"],
      ["Sentiment analysis", "chart"],
      ["Intent analysis", "scan"],
      ["Emotion analysis", "chart"],
      ["Text summary", "file"],
      ["Plagiarism check", "search"],
      ["Documents", "file"],
      ["Entity explorer", "users"],
    ],
  },
  {
    label: "Insights",
    items: [
      ["Analytics", "chart"],
      ["Semantic search", "search"],
      ["Models & pipelines", "layers"],
    ],
  },
] as const;

export function Sidebar() {
  const {
    active,
    collapsed,
    mobileOpen,
    selectPage,
    toggleCollapsed,
    closeMobile,
  } = useWorkspaceStore();
  return (
    <>
      {mobileOpen && (
        <Button
          type="button"
          aria-label="Close navigation"
          onClick={closeMobile}
          className="fixed inset-0 z-20 bg-[#15142b]/30 backdrop-blur-[2px] lg:hidden"
        />
      )}
      <aside
        aria-label="Primary navigation"
        className={`fixed inset-y-0 left-0 z-30 flex w-[min(84vw,252px)] flex-col overflow-y-auto border-r border-workspace-border bg-workspace-surface px-[14px] py-[22px] shadow-xl transition-[transform,width] duration-300 ease-out lg:static lg:z-auto lg:translate-x-0 lg:shadow-none ${mobileOpen ? "translate-x-0" : "-translate-x-full"} ${collapsed ? "lg:w-[78px]" : "lg:w-[252px]"}`}
      >
        <div className="flex items-center justify-between gap-2.5 whitespace-nowrap px-3 pb-7.5 text-[21px] font-extrabold tracking-[-1px]">
          <div className="flex h-7.25 w-7.25 items-center justify-center rounded-[9px] bg-linear-to-br from-[#896eff] to-[#5d43d4] text-workspace-on-primary">
            <Icon name="spark" size={19} />
          </div>
          <span className={collapsed ? "lg:hidden" : ""}>
            Neural<span className="text-workspace-accent">TextAI</span>
          </span>
          <Button
            type="button"
            aria-label={collapsed ? "Expand navigation" : "Minimize navigation"}
            title={collapsed ? "Expand navigation" : "Minimize navigation"}
            onClick={toggleCollapsed}
            className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-workspace-border text-sm font-bold text-workspace-muted transition-all duration-200 hover:scale-105 hover:bg-workspace-hover hover:text-workspace-accent active:scale-95"
          >
            {collapsed ? "»" : "«"}
          </Button>
          <Button
            type="button"
            aria-label="Close navigation"
            onClick={closeMobile}
            className="ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg text-workspace-muted hover:bg-workspace-hover hover:text-workspace-accent lg:hidden"
          >
            ×
          </Button>
        </div>
        <div className="mb-6.75 flex items-center gap-2 rounded-[10px] border border-workspace-border bg-workspace-bg p-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-workspace-highlight text-xs font-extrabold text-workspace-accent">
            N
          </div>
          <div className={`min-w-0 flex-1 ${collapsed ? "lg:hidden" : ""}`}>
            <strong className="block truncate text-[11px]">
              NeuralText workspace
            </strong>
            <small className="mt-0.5 block text-[10px] text-workspace-muted">
              Personal workspace
            </small>
          </div>
        </div>
        <nav>
          {groups.map((group) => (
            <div className="mb-5" key={group.label}>
              <p
                className={`mx-3 mb-2 text-[10px] font-bold uppercase tracking-[.09em] text-workspace-muted ${collapsed ? "lg:hidden" : ""}`}
              >
                {group.label}
              </p>
              {group.items.map(([label, icon]) => (
                <Button
                  type="button"
                  key={label}
                  onClick={() => {
                    selectPage(label);
                  }}
                  className={`my-0.5 flex w-full items-center gap-[13px] rounded-lg px-3 py-2.5 text-left text-[13px] transition-all duration-200 hover:translate-x-1 hover:bg-workspace-hover hover:text-workspace-accent ${active === label ? "bg-workspace-accent-soft font-bold text-workspace-accent shadow-sm shadow-[#7357ef1a]" : "text-workspace-muted"} ${collapsed ? "lg:justify-center" : ""}`}
                >
                  <Icon name={icon as IconName} />
                  <span className={collapsed ? "lg:hidden" : ""}>{label}</span>
                </Button>
              ))}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
