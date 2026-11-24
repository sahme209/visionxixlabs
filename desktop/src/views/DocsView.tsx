import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {useSearchShortcut} from "../lib/useSearchShortcut";
import { DESKTOP_PRODUCT_NAME, DESKTOP_VERSION } from "../lib/desktopMetadata";
import { BookOpen, ChevronRight, Copy, FileText, Folder, Link2, Search, ShieldCheck, Sparkles } from "lucide-react";
import { DocumentationWorkflowMap } from "./DocumentationWorkflowMap";
import { ExternalLink, ViewShell } from "../components/Primitives";
import { releaseIntakeExample } from "../../../lib/docs/releaseIntakeExample";
import { GOVERNED_JOURNEY, GOVERNED_JOURNEY_AVAILABILITY, governedJourneyStageAnchor, type GovernedJourneyDestination } from "../../../lib/desktop/governedJourney";

interface DocLink {
  id: string;
  title: string;
  body: string;
  href: string;
}

const DOCS: ReadonlyArray<{ section: string; currentGuide?: boolean; links: DocLink[] }> = [
  {
    section: "Getting started",
    links: [
      { id: "overview", title: "Product documentation", body: "Installed application overview and operating model.", href: "https://visionxixlabs.com/docs" },
      { id: "getting-started", title: "Getting started", body: "Install, authenticate, and create the first deployment request.", href: "https://visionxixlabs.com/docs/getting-started" },
    ],
  },
  {
    section: "Deployments",
    currentGuide: true,
    links: [
      { id: "approvals", title: "Approval workflow", body: "Human gates and separation of duties.", href: "https://visionxixlabs.com/docs/approval-workflow" },
      { id: "readiness", title: "Deployment readiness", body: "Record validation evidence, uncertainty and approval gates.", href: "https://visionxixlabs.com/docs/releaseops/readiness" },
      { id: "rollback", title: "AWS ECS rollback", body: "Recovery and rollback evidence for the released AWS ECS workflow.", href: "https://visionxixlabs.com/docs/rollback" },
    ],
  },
  {
    section: "Operations",
    links: [
      { id: "batch-providers", title: "Batch providers", body: "Read-only Prefect, Dagster and Argo guidance and availability.", href: "https://visionxixlabs.com/docs/batch-providers" },
    ],
  },
  {
    section: "Integrations",
    links: [
      { id: "integration-setup", title: "Integration setup", body: "Operator setup and workspace consent boundaries.", href: "https://visionxixlabs.com/docs/integration-setup" },
    ],
  },
  {
    section: "Reference",
    links: [
      { id: "permissions", title: "Permissions model", body: "Approval, merge, execution, and environment authority boundaries.", href: "https://visionxixlabs.com/docs/permissions-model" },
      { id: "glossary", title: "Glossary", body: "Deployment and governance terminology.", href: "https://visionxixlabs.com/docs/glossary" },
    ],
  },
  {
    section: "Troubleshooting",
    links: [
      { id: "troubleshooting", title: "Troubleshooting",  body: "Common errors + remediations.",        href: "https://visionxixlabs.com/docs/troubleshooting" },
      { id: "surfaces", title: "Surfaces",         body: "Where each piece of data is rendered.", href: "https://visionxixlabs.com/docs/surfaces" },
    ],
  },
];

const releaseGuide = "https://visionxixlabs.com/docs/releaseops";
const deploymentGuidePage = "https://visionxixlabs.com/docs/getting-started";
const deploymentGuide = `${deploymentGuidePage}#workflow`;
const exampleMetadata = releaseIntakeExample;
const exampleRows = exampleMetadata.split("\n");
const exampleLineNumbers = exampleRows.map((_, index) => String(index + 1).padStart(2, "0")).join("\n");

const outline = [
  {id: "release-governance-overview", title: "Overview", source: releaseGuide},
  {id: "release-lifecycle", title: "Release lifecycle", source: `${releaseGuide}#lifecycle`},
  {id: "prepare-release", title: "Prepare a governed release", source: deploymentGuide},
  {id: "example-plan-metadata", title: "Example plan metadata", source: `${deploymentGuidePage}#example-plan-metadata`},
];

const readerSteps: Record<(typeof GOVERNED_JOURNEY)[number]["id"], string> = {
  scope: "Confirm the repository, branch, local folder and saved files. Repository access grants no cloud permissions.",
  code: "Review diffs, apply approved local edits and consent to checks. Keep failed or stale results visible.",
  govern: "Review the target, artifact, evidence and recovery plan. Required human approvals gate execution.",
  schedule: "Check DAGs, dependencies and targets through authorized Airflow access. Scheduling grants no deployment approval.",
  recover: "Check execution and validation evidence before closure. Preserve failures and verify rollback separately.",
};

interface GuideSection {
  id: string;
  title: string;
  source: string;
  excerpt?: string;
}

function journeySection(stage: (typeof GOVERNED_JOURNEY)[number]): GuideSection {
  const id = governedJourneyStageAnchor(stage);
  return {id, title: stage.title, source: `${deploymentGuidePage}#${id}`, excerpt: stage.detail};
}

const readerSections: readonly GuideSection[] = [...outline.slice(1), ...GOVERNED_JOURNEY.map(journeySection)];

export function DocsView({ onNavigate, onAskAboutPage, active = true }: {
  onNavigate: (view: GovernedJourneyDestination) => void;
  onAskAboutPage?: (draft: string) => void;
  active?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [showWorkflow, setShowWorkflow] = useState(false);
  const workflowButton = useRef<HTMLButtonElement>(null);
  const restoreWorkflowFocus = useRef(false);
  const searchField = useRef<HTMLInputElement>(null);
  const [section, setSection] = useState<GuideSection>(outline[0]);
  const [copyStatus, setCopyStatus] = useState<{source: "guide" | "example"; result: "copied" | "failed"}>();
  const copyRequest = useRef(0);
  const returnFocus = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (!active || !returnFocus.current) return;
    const control = returnFocus.current;
    returnFocus.current = null;
    control.focus({preventScroll: true});
  }, [active]);

  useLayoutEffect(() => {
    if (showWorkflow || !restoreWorkflowFocus.current) return;
    restoreWorkflowFocus.current = false;
    workflowButton.current?.focus();
  }, [showWorkflow]);

  useSearchShortcut(searchField, active && !showWorkflow);

  useEffect(() => () => {copyRequest.current++;}, []);
  const query = search.trim().toLowerCase();
  const readerMatches = query ? readerSections.filter(item =>
    item.title.toLowerCase().includes(query) || item.excerpt?.toLowerCase().includes(query)) : [];
  const guideMatches = "release governance governed deployments deployment scope approval validation evidence rollback".includes(query);
  const groups = DOCS.map(group => ({
    ...group,
    currentGuide: group.currentGuide && (guideMatches || readerMatches.length > 0),
    links: group.links.filter(link => [link.title, link.body, group.section].some(text => text.toLowerCase().includes(query))),
  })).filter(group => group.currentGuide || group.links.length);

  function focusLocation(id: string) {
    const location = document.getElementById(id);
    if (!location) return;
    location.focus({ preventScroll: true });
    location.scrollIntoView?.({ block: "start" });
  }

  function selectSection(next: GuideSection) {
    copyRequest.current++;
    setCopyStatus(undefined);
    setSection(next);
  }

  function jumpTo(next: GuideSection) {
    selectSection(next);
    focusLocation(next.id);
  }

  async function copyText(source: "guide" | "example") {
    const request = ++copyRequest.current;
    setCopyStatus(undefined);
    try {
      await navigator.clipboard.writeText(source === "guide" ? section.source : exampleMetadata);
      if (request === copyRequest.current) setCopyStatus({source, result: "copied"});
    } catch {
      if (request === copyRequest.current) setCopyStatus({source, result: "failed"});
    }
  }

  function askAboutSection(control: HTMLButtonElement) {
    const question = section.id === outline[0].id
      ? "Explain the Release governance guide, including where I can review scope, approval authority, validation evidence, and rollback."
      : `Explain “${section.title}” in the Release governance guide.`;
    const context = section.excerpt ? `\n\nGuide excerpt: ${section.excerpt}` : "";
    if (!onAskAboutPage) return;
    returnFocus.current = control;
    onAskAboutPage(`${question}\n\nSource: ${section.source}${context}`);
  }

  return <ViewShell wide className="studio-documentation">
    <header className="studio-docs-heading">
      <div><h1>Documentation</h1><p>Operational knowledge, guides, and governed workflows.</p></div>
      {!showWorkflow && <div className="studio-docs-actions">
        <button ref={workflowButton} data-help-id="documentation.workflow.open" type="button" className="btn-secondary" onClick={() => setShowWorkflow(true)}>Workflow map</button>
        <button type="button" className="btn-secondary" onClick={() => searchField.current?.focus()}><BookOpen size={16} aria-hidden />Browse guides</button>
        {onAskAboutPage && <button type="button" className="btn-primary" onClick={event => askAboutSection(event.currentTarget)}><Sparkles size={16} aria-hidden />Ask about this page</button>}
      </div>}
    </header>
    {showWorkflow && <DocumentationWorkflowMap onBack={() => {
      restoreWorkflowFocus.current = true;
      setShowWorkflow(false);
    }}/>}
    <div className="studio-docs-layout" style={showWorkflow ? {display: "none"} : undefined}>
      <nav className="studio-docs-nav" aria-label="Documentation guides">
        <label className="studio-docs-search">
          <Search size={15} aria-hidden />
          <input ref={searchField} type="search" aria-label="Search documentation" aria-keyshortcuts="/" placeholder="Search documentation…" value={search} onChange={event => setSearch(event.target.value)} />
          <kbd aria-hidden="true">/</kbd>
        </label>
        <p className="studio-docs-eyebrow">Guides</p>
        {groups.map(group => <div className="studio-docs-guide-group" key={group.section}>
          <h2><Folder size={15} aria-hidden />{group.section}</h2>
          <ul>
            {group.currentGuide && <li>
              <button className="studio-docs-guide current" type="button" aria-current="page" onClick={() => jumpTo(outline[0])}>
                <FileText size={15} aria-hidden />Release governance
              </button>
              {readerMatches.length > 0 && <ul className="studio-docs-reader-matches">
                {readerMatches.map(item => <li key={item.id}>
                  <button className="studio-docs-guide" type="button" aria-controls={item.id}
                    aria-current={item.id === section.id ? "location" : undefined} onClick={() => jumpTo(item)}>
                    <ChevronRight size={14} aria-hidden />{item.title}
                  </button>
                </li>)}
              </ul>}
            </li>}
            {group.links.map(link => <li key={link.id}>
              <ExternalLink href={link.href} data-help-id={`documentation.web.${link.id}`} className="studio-docs-guide" aria-description={link.body}>
                <FileText size={15} aria-hidden />{link.title}
              </ExternalLink>
            </li>)}
          </ul>
        </div>)}
        {!groups.length && <p className="studio-docs-status" role="status">No matching guides.</p>}
      </nav>
      <nav className="studio-docs-outline-nav" aria-label="On this page">
        <h2>On this page</h2>
        <div className="studio-docs-outline-links">
          {outline.map(item => <button key={item.id} type="button" aria-controls={item.id} onClick={() => jumpTo(item)}
            aria-current={item.id === section.id || item.id === "prepare-release" && section.id.startsWith("guide-stage-") ? "location" : undefined}>{item.title}</button>)}
          <button type="button" aria-controls="studio-docs-related" onClick={() => focusLocation("studio-docs-related")}>Related guides</button>
        </div>
      </nav>
      <article className="studio-docs-article" aria-labelledby="release-governance-title">
        <div className="studio-docs-reader-tools">
          <div className="studio-docs-reader-toolbar">
            <p className="studio-docs-eyebrow">Deployment guide</p>
            <button type="button" aria-label="Copy guide link" aria-describedby="studio-docs-selected-section" title="Copy guide link"
              onClick={() => void copyText("guide")}><Link2 size={16} aria-hidden /></button>
          </div>
          {copyStatus?.source === "guide" && copyStatus.result === "copied" && <p className="studio-docs-status" role="status">Guide link copied.</p>}
          {copyStatus?.source === "guide" && copyStatus.result === "failed" && <div className="studio-docs-copy-fallback">
            <p role="status">Clipboard unavailable. Select the link to copy it manually.</p>
            <input type="text" readOnly value={section.source} onFocus={event => event.target.select()} aria-label="Guide link" />
          </div>}
        </div>
        <div id="release-governance-overview" tabIndex={-1}>
          <h2 id="release-governance-title">Release governance</h2>
          <p className="studio-docs-edition">Included with {DESKTOP_PRODUCT_NAME} Desktop {DESKTOP_VERSION}</p>
          <p className="studio-docs-intro">Move from repository scope to a reviewed deployment with validation evidence and a recovery plan.</p>
          <aside className="studio-docs-callout">
            <h3><ShieldCheck size={16} aria-hidden />Check the installed version and stated availability</h3>
            <p>{GOVERNED_JOURNEY_AVAILABILITY}</p>
          </aside>
        </div>
        <section id="release-lifecycle" tabIndex={-1} aria-labelledby="release-lifecycle-title" className="studio-docs-section">
          <h3 id="release-lifecycle-title">Release lifecycle</h3>
          <ol className="studio-docs-lifecycle">
            {GOVERNED_JOURNEY.map((stage, index) => <li key={stage.id}>
              {index > 0 && <ChevronRight size={14} aria-hidden />}
              <button type="button" aria-controls={governedJourneyStageAnchor(stage)} aria-current={section.id === governedJourneyStageAnchor(stage) ? "location" : undefined}
                onClick={() => jumpTo(journeySection(stage))}>{["Scope", "Prepare", "Review", "Schedule", "Verify"][index]}</button>
            </li>)}
          </ol>
        </section>
        <section id="prepare-release" tabIndex={-1} aria-labelledby="prepare-release-title" className="studio-docs-section">
          <h3 id="prepare-release-title">Prepare a governed release</h3>
          <ol className="studio-docs-steps">
            {GOVERNED_JOURNEY.map((stage, index) => <li key={stage.id} id={governedJourneyStageAnchor(stage)} tabIndex={-1}>
              <span aria-hidden="true" className="studio-docs-step-number">{index + 1}</span>
              <div className="studio-docs-step-content">
                <h4>{stage.title}</h4>
                <p>{readerSteps[stage.id]}</p>
                <button type="button" data-help-id={`documentation.journey.${stage.id}`} onClick={event => {
                  selectSection(journeySection(stage));
                  returnFocus.current = event.currentTarget;
                  onNavigate(stage.destination);
                }}>{stage.cta}<ChevronRight size={14} aria-hidden /></button>
              </div>
            </li>)}
          </ol>
        </section>
        <section id="example-plan-metadata" tabIndex={-1} aria-labelledby="example-plan-metadata-title" className="studio-docs-section">
          <h3 id="example-plan-metadata-title">Example plan metadata</h3>
          <div className="studio-docs-example-toolbar">
            <p>Illustrative release intake excerpt</p>
            <button type="button" aria-label="Copy example metadata" onClick={() => void copyText("example")}>Copy <Copy size={14} aria-hidden /></button>
          </div>
          {copyStatus?.source === "example" && <p className="studio-docs-status" role="status">
            {copyStatus.result === "copied" ? "Example metadata copied." : "Clipboard unavailable. Select the example to copy it manually."}
          </p>}
          {copyStatus?.source === "example" && copyStatus.result === "failed"
            ? <textarea className="studio-docs-example-code" readOnly value={exampleMetadata} rows={exampleRows.length}
                onFocus={event => event.target.select()} aria-label="Example metadata" />
            : <pre className="studio-docs-example-code">
                <span className="studio-docs-example-lines" aria-hidden="true">{exampleLineNumbers}</span>
                <code>{exampleMetadata}</code>
              </pre>}
        </section>
      </article>
      <aside className="studio-docs-outline">
        <section className="studio-docs-source">
          <h2>Page details</h2>
          <dl className="studio-docs-source-facts">
            <div><dt>Section</dt><dd id="studio-docs-selected-section">{section.title}</dd></div>
          </dl>
          <ExternalLink href={section.source}>Guide source <ChevronRight size={14} aria-hidden /></ExternalLink>
        </section>
        <section id="studio-docs-related" className="studio-docs-source studio-docs-related" aria-labelledby="studio-docs-related-title" tabIndex={-1}>
          <h2 id="studio-docs-related-title">Related guides</h2>
          {[
            ["Independent approvals", "Human gates and separation of duties.", "https://visionxixlabs.com/docs/approval-workflow"],
            ["Rollback and recovery", "Recovery and rollback evidence.", "https://visionxixlabs.com/docs/rollback"],
            ["Validation and evidence", "Record readiness and uncertainty.", "https://visionxixlabs.com/docs/releaseops/readiness"],
          ].map(([title, summary, href]) => <ExternalLink key={href} href={href} aria-label={title}>
            <FileText size={15} aria-hidden />
            <span>{title}<small>{summary}</small></span>
            <ChevronRight size={14} aria-hidden />
          </ExternalLink>)}
        </section>
      </aside>
    </div>
  </ViewShell>;
}
