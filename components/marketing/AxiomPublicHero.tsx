"use client";

import {useRef} from "react";
import {usePreviewSequence} from "./usePreviewSequence";
import Link from "next/link";
import { DesktopPreviewFrame } from "./DesktopPreviewFrame";

/** Finite product demonstration. No account, provider or operational client. */
export function AxiomPublicHero() {
  const preview=useRef<HTMLDivElement>(null);
  const motion=usePreviewSequence(preview);
  return <section className="public-home-hero" aria-labelledby="public-home-title">
    <header className="public-home-intro">
      <h1 id="public-home-title">Deploy with clarity.</h1>
      <p>Your repositories, AI assistance and releases. Connected through clear review and recorded evidence.</p>
      <div className="public-home-actions">
        <Link className="orbit-primary" href="/download">Download V19</Link>
        <Link className="orbit-secondary" href="/product">Explore V19</Link>
      </div>
    </header>
    <figure className="public-home-product">
      <div className="public-home-painting">
        <DesktopPreviewFrame view="repository-workspace">
          <div ref={preview} className="public-home-workspace" data-preview-active={motion.active} data-preview-progress={motion.fraction}>
            <div className="public-home-editor">
              <div className="public-home-file">release.ts <span>Sample proposal</span></div>
              <pre aria-label="Illustrative release request"><code style={{display:"block",clipPath:motion.fraction<1?`inset(0 0 ${(1-motion.fraction)*100}% 0)`:undefined}}>{`// A small change. A clear review.
const request = {
  repository: "acme/customer-web",
  branch: "feature/timeout",
  environment: "Test",
  change: "Update request timeout",
};

// Proposal and permission are separate.
// Review the exact scope before execution.`}</code></pre>
              <div className="public-home-editor-note">Illustrative source · no command or code runs</div>
            </div>
            <aside className="public-home-review" aria-label="Illustrative review context">
              <p className="public-home-review-title">V19</p>
              <p>Keep the change small. Show the scope and the evidence before asking for a decision.</p>
              <div className="public-home-request" style={{transform:`translateY(${(1-motion.fraction)*8}px)`}}><span>Proposed change</span><strong>Update request timeout</strong><p>Repository and branch attached. Production execution is held.</p></div>
              <div className="public-home-evidence"><span>Review context</span><p>Scope captured</p><p>Independent review required</p><p>Outcome not yet verified</p></div>
              <p className="public-home-review-foot">Scripted sample. No connected account.</p>
            </aside>
          </div>
        </DesktopPreviewFrame>
      </div>
      <figcaption>Illustrated workspace · sample data. <Link href="/demo">Explore the scripted tour</Link></figcaption>
    </figure>
    <p className="public-home-availability">Actual actions depend on the installed version, current permissions, and enabled workflow. Complete Governance enforcement and activation are not established. <Link href="/security">Assess security boundaries</Link>{" · "}<Link href="/docs/approval-workflow">Read the approval workflow</Link>.</p>
  </section>;
}
