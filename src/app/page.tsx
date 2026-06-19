import { CornGame } from "@/components/CornGame";
import { devAllowReplay } from "@/lib/config";
import { turnstileSiteKey } from "@/lib/turnstile";

export default function HomePage() {
  return (
    <CornGame turnstileSiteKey={turnstileSiteKey()} devReplayEnabled={devAllowReplay()} />
  );
}
