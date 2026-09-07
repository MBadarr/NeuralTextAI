"use client";

import { FeaturePage } from "@/components/FeaturePage";
import { Icon } from "@/components/Icon";
import { Overview } from "@/components/Overview";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { useWorkspaceStore } from "@/lib/workspace-store";

export default function Home() {
  const { active, query, selectPage } = useWorkspaceStore();

  return (
    <main className="flex min-h-screen bg-[#f8f8fc] text-[#15142b]">
      <Sidebar />
      <section className="min-w-0 flex-1">
        <Topbar />
        {active === "Overview" ? (
          <Overview query={query} onNavigate={selectPage} />
        ) : (
          <div className="mx-auto max-w-375 p-4.5 sm:p-7 lg:p-10.5">
            <div className="mb-7.5 flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[.08em] text-[#7357ef]">
                  ● NeuralText workspace
                </p>
                <h1 className="text-2xl font-bold lg:text-[29px]">{active}</h1>
                <p className="mt-2 text-[13px] text-[#85859b]">
                  Use this workspace to manage your NLP workflow.
                </p>
              </div>
              <button
                type="button"
                className="flex items-center gap-2 rounded-lg bg-[#7357ef] px-4 py-3 text-xs font-bold text-white"
              >
                <Icon name="spark" size={16} /> New {active.toLowerCase()}
              </button>
            </div>
            <FeaturePage active={active} />
          </div>
        )}
      </section>
    </main>
  );
}
