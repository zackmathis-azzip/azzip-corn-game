import type { Metadata } from "next";
import { CornTimeline } from "@/components/CornTimeline";

export const metadata: Metadata = {
  title: "Pick Timeline — Azzip Corn Kernel Game",
  description:
    "Replay how every kernel was picked during the Azzip Corn Kernel Game — prize flashes, pace, and sponsor reveal.",
};

export default function TimelinePage() {
  return (
    <main className="timeline-shell">
      <header className="timeline-header">
        <h1>Azzip Corn Kernel Game — Click Replay</h1>
        <p>
          Watch the cob start full and get picked clean. Prize kernels flash{" "}
          <strong>white</strong> the moment they were won, and the Azzip × Old Major logos are
          revealed underneath as kernels are cleared.
        </p>
      </header>
      <CornTimeline />
    </main>
  );
}
