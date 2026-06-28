import { Outlet } from "react-router-dom";
import { Sidebar } from "@/app/sidebar";

export function AppShell() {
  return (
    <div className="flex h-full bg-surface-subtle">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
