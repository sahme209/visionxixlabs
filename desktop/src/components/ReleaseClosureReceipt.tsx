import { useRef, useState } from "react";
import type { ReleaseClosureEvidence } from "../../../lib/tauri/releaseClosureEvidence";
import { desktopClient } from "../lib/desktopClient";

interface ReleaseClosureReceiptProps {
  requestId: string;
  version: number;
  ownsView: () => boolean;
}

export function ReleaseClosureReceipt({ requestId, version, ownsView }: ReleaseClosureReceiptProps) {
  const [receipt, setReceipt] = useState<ReleaseClosureEvidence>();
  const [status, setStatus] = useState<"ready" | "loading" | "unavailable">("ready");
  const pending = useRef(false);

  async function readReceipt() {
    if (pending.current || !ownsView()) return;
    pending.current = true;
    setStatus("loading");
    const result = await desktopClient.releaseClosureEvidence(requestId, version);
    pending.current = false;
    if (!ownsView()) return;
    if (result.ok) {
      setReceipt(result.data);
      setStatus("ready");
    } else {
      setStatus("unavailable");
    }
  }

  return (
    <div className="mt-2 text-zinc-200">
      <button type="button" className="btn-secondary" aria-disabled={status === "loading"} onClick={() => void readReceipt()}>
        {receipt ? "Refresh closure evidence" : "Read closure evidence"}
      </button>
      <div role="status" className="leading-5">
        {status === "loading" && "Reading recorded closure evidence…"}
        {status === "unavailable" && "Recorded closure evidence could not be retrieved for this release version."}
        {status === "ready" && receipt && (
          <dl className="mt-2 space-y-2">
            <div>
              <dt className="font-medium">Evidence reference</dt>
              <dd className="whitespace-pre-wrap break-all">{receipt.reference}</dd>
            </div>
            <div>
              <dt className="font-medium">Reported outcome</dt>
              <dd className="whitespace-pre-wrap break-words">{receipt.summary}</dd>
            </div>
          </dl>
        )}
      </div>
    </div>
  );
}
