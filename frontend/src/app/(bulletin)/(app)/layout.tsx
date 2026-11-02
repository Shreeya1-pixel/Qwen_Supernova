import { MobileNav, Sidebar } from "@/components/dash/sidebar";
import { TopBar } from "@/components/dash/top-bar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dash flex">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <TopBar />
        <MobileNav />
        <main className="px-4 py-4 lg:px-6 lg:py-5">{children}</main>
      </div>
    </div>
  );
}
