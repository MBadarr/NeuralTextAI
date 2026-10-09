import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/components/ThemeProvider";
import Workspace from "@/components/Workspace";
import { useWorkspaceStore } from "@/lib/workspace-store";

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: { user: { name: "Test User" } } }),
  },
}));
vi.mock("@/lib/api", () => ({
  getDocuments: async () => [],
  getInsights: async () => ({ total_documents: 0 }),
  getModels: async () => [],
}));

beforeEach(() => {
  useWorkspaceStore.setState({
    active: "Overview",
    query: "",
    mobileOpen: false,
  });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
});
afterEach(cleanup);

describe("dashboard theme", () => {
  it("keeps dark mode through navigation and restores it after remount", async () => {
    const first = render(
      <ThemeProvider initialTheme="light">
        <Workspace />
      </ThemeProvider>,
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Color theme: light. Change color theme",
      }),
    );
    expect(document.documentElement.dataset.theme).toBe("dark");
    fireEvent.click(screen.getByRole("button", { name: /^Documents$/ }));
    await screen.findByRole("heading", { name: "Documents", level: 1 });
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.cookie).toContain("neuraltext-theme=dark");
    first.unmount();
    render(
      <ThemeProvider initialTheme="dark">
        <Workspace />
      </ThemeProvider>,
    );
    expect(document.documentElement.dataset.theme).toBe("dark");
    fireEvent.click(
      screen.getByRole("button", {
        name: "Color theme: dark. Change color theme",
      }),
    );
    expect(document.documentElement.dataset.theme).toBe("light");
    await waitFor(() =>
      expect(document.cookie).toContain("neuraltext-theme=system"),
    );
  });

  it("follows OS theme changes in system mode", () => {
    const media = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: () => media,
    });
    render(
      <ThemeProvider initialTheme="system">
        <Workspace />
      </ThemeProvider>,
    );
    expect(document.documentElement.dataset.theme).toBe("light");
    media.matches = true;
    media.addEventListener.mock.calls[0][1]();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
