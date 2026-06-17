import { CornGame } from "@/components/CornGame";
import { turnstileSiteKey } from "@/lib/turnstile";

export default function HomePage() {
  return <CornGame turnstileSiteKey={turnstileSiteKey()} />;
}
