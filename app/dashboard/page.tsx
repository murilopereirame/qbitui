import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { TorrentTable } from "@/components/torrents/TorrentTable";
import { AddTorrentModal } from "@/components/torrents/AddTorrentModal";

export default function DashboardPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-hidden">
          <TorrentTable />
        </main>
      </div>
      <AddTorrentModal />
    </div>
  );
}
