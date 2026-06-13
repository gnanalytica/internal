import { AskView } from "@/components/ask-view";
import { isAiConfigured } from "@/lib/ai";

export default function AskPage() {
  return <AskView enabled={isAiConfigured()} />;
}
