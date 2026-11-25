import { ArrowLeft, ArrowRight, Box, Search, X } from "lucide-react";
import { useEffectEvent, useId, useImperativeHandle, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { useSearchShortcut } from "../lib/useSearchShortcut";

export interface ReleaseWorkspaceItem {
  id: string;
  title: string;
  status: string;
  version?: number;
  environment?: string | null;
  updatedAt?: string;
  prReview?: string;
  requesterName?: string | null;
  nextStep: string;
  attention: boolean;
  busy: boolean;
}

const releasePageSize = 6;
const releaseAge = new Intl.RelativeTimeFormat(undefined, {style: "long"});

function updatedLabel(updated: Date, observedAt?: Date) {
  const minutes = Math.floor(((observedAt?.getTime() ?? NaN) - updated.getTime()) / 60_000);
  if (minutes >= 0 && minutes < 60) return minutes === 0 ? "Just now" : releaseAge.format(-minutes, "minute");
  if (minutes >= 60 && minutes < 24 * 60) return releaseAge.format(-Math.floor(minutes / 60), "hour");
  return updated.toLocaleDateString(undefined, {month: "short", day: "numeric"}) + " " +
    updated.toLocaleTimeString(undefined, {hour: "numeric", minute: "2-digit"});
}

const filters = [
  { id: "all", label: "All releases" },
  { id: "draft", label: "Drafts" },
  { id: "submitted", label: "Submitted" },
  { id: "closed", label: "Closed" },
] as const;

function focusReleaseDetails(panelId: string) {
  const panel = document.getElementById(panelId);
  // Focusing a tall panel can scroll to its middle and hide the release heading.
  panel?.focus({ preventScroll: true });
  panel?.scrollIntoView?.({ block: "start", inline: "nearest" });
}

/** Keep opened request panels mounted through filtering and selection changes. */
export function FocusedReleaseWorkspace({ items, children, directoryContext, requestedRelease, requestedReleaseAvailable, focusRequestedRow = true, preserveDirectoryContext = false, renderSelectedActivity, searchShortcutActive = true, retainDisplayedRelease, observedAt }: {
  items: ReleaseWorkspaceItem[];
  searchShortcutActive?: boolean;
  children: (item: ReleaseWorkspaceItem, closeButton: ReactNode, isOpen: boolean) => ReactNode;
  directoryContext?: ReactNode;
  renderSelectedActivity?: (item: ReleaseWorkspaceItem) => ReactNode;
  requestedRelease?: { id: string };
  requestedReleaseAvailable?: boolean;
  focusRequestedRow?: boolean;
  preserveDirectoryContext?: boolean;
  retainDisplayedRelease?: Ref<() => void>;
  observedAt?: Date;
}) {
  const prefix = useId();
  const [selected, setSelected] = useState<Pick<ReleaseWorkspaceItem, "id" | "version">>();
  const [detailsClosed, setDetailsClosed] = useState(false);
  const [status, setStatus] = useState<(typeof filters)[number]["id"]>("all");
  const [search, setSearch] = useState("");
  const [environment, setEnvironment] = useState("");
  const [page, setPage] = useState<number>();
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const [openedPanels, setOpenedPanels] = useState(() => new Set<string>());
  const requestFocus = useRef<string | null>(null);
  const panelFocus = useRef<string | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  useSearchShortcut(searchInput, searchShortcutActive && items.length > 0);

  useLayoutEffect(() => {
    setSelected(undefined);
  }, [requestedRelease]);
  const revealRequestedRelease = useEffectEvent((id: string) => {
    if (preserveDirectoryContext) return;
    requestFocus.current = focusRequestedRow ? id : null;
    setDetailsClosed(false);
    setSearch("");
    setEnvironment("");
    setStatus("all");
    setPage(undefined);
  });
  useLayoutEffect(() => {
    requestFocus.current = null;
    if (requestedRelease && requestedReleaseAvailable) revealRequestedRelease(requestedRelease.id);
  }, [requestedRelease, requestedReleaseAvailable, focusRequestedRow]);
  useLayoutEffect(() => {
    if (requestFocus.current === null) return;
    const row = buttons.current.get(requestFocus.current);
    if (!row) return;
    requestFocus.current = null;
    row.focus();
  });
  useLayoutEffect(() => {
    const id = panelFocus.current;
    if (!id) return;
    panelFocus.current = null;
    const panelId = buttons.current.get(id)?.getAttribute("aria-controls");
    if (panelId) focusReleaseDetails(panelId);
  });

  function closeDetails(id: string) {
    setDetailsClosed(true);
    (buttons.current.get(id) ?? searchInput.current)?.focus();
  }

  const query = search.trim().toLowerCase();
  const environments = [...new Set(items.flatMap(item => item.environment ? [item.environment] : []))].sort((left, right) => left.localeCompare(right));
  const matching = items.flatMap((item, index) => {
    if (status !== "all" && item.status !== status) return [];
    if (environment && item.environment !== environment) return [];
    if (query && ![item.title, item.id, item.environment].some(value => value?.toLowerCase().includes(query))) return [];
    return [{ item, index }];
  });
  const selectedRow = selected && items.find(item => item.id === selected.id);
  const selectionUnverified = selected !== undefined && (!selectedRow || selectedRow.version !== selected.version);
  const selection = selectionUnverified ? undefined
    : selectedRow?.id ?? (requestedReleaseAvailable ? requestedRelease?.id : undefined);
  const selectionIndex = matching.findIndex(({ item }) => item.id === selection);
  const pageCount = Math.ceil(matching.length / releasePageSize);
  const lastPage = Math.max(0, pageCount - 1);
  const currentPage = Math.min(page ?? Math.floor(Math.max(0, selectionIndex) / releasePageSize), lastPage);
  const start = currentPage * releasePageSize;
  const visibleItems = matching.slice(start, start + releasePageSize);
  const end = start + visibleItems.length;
  const range = start + 1 === end ? String(end) : `${start + 1}–${end}`;
  const loadedCount = `${items.length} loaded release${items.length === 1 ? "" : "s"}`;
  const rangeTotal = matching.length === items.length ? loadedCount
    : `${matching.length} ${matching.length === 1 ? "match" : "matches"} in ${loadedCount}`;
  const firstPageButton = Math.max(0, Math.min(currentPage - 1, pageCount - 3));
  const active = selection ?? (requestedRelease || selectionUnverified ? undefined : visibleItems[0]?.item.id);
  const visibleActive = visibleItems.some(({ item }) => item.id === active) ? active : undefined;
  const openPanel = detailsClosed ? undefined : visibleActive;

  const tabbableRelease = visibleActive ?? visibleItems[0]?.item.id;

  useLayoutEffect(() => {
    if (openPanel) setOpenedPanels(opened => opened.has(openPanel) ? opened : new Set(opened).add(openPanel));
  }, [openPanel]);

  useLayoutEffect(() => {
    if (page !== undefined && page > lastPage) setPage(lastPage);
  }, [page, lastPage]);

  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !visibleItems.length) return;
    const next = event.key === "Home" ? 0 : event.key === "End" ? visibleItems.length - 1 :
      event.key === "ArrowDown" || event.key === "ArrowRight" ? (index + 1) % visibleItems.length :
      event.key === "ArrowUp" || event.key === "ArrowLeft" ? (index - 1 + visibleItems.length) % visibleItems.length : undefined;
    if (next === undefined) return;
    event.preventDefault();
    const {id, version} = visibleItems[next].item;
    setSelected({id, version});
    setPage(undefined);
    buttons.current.get(id)?.focus();
  }

  const selectedItem = items.find(item => item.id === visibleActive);
  useImperativeHandle(retainDisplayedRelease, () => () => {
    if (requestedRelease || !openPanel || !selectedItem) return;
    setSelected(previous => previous ?? {id: selectedItem.id, version: selectedItem.version});
  }, [requestedRelease, openPanel, selectedItem]);


  return <div hidden={items.length === 0} className={items.length ? "release-focus-layout" : "hidden"}>
    <div className="release-focus-directory">
      {directoryContext}
      <div className="release-focus-filters" role="group" aria-label="Release state">
        {filters.map(filter => <button type="button" key={filter.id} aria-pressed={filter.id === status} onClick={() => { setStatus(filter.id); setPage(0); }}>
          {filter.label}{filter.id === "all" && <span>{items.length}</span>}
        </button>)}
      </div>
      <div className="release-focus-toolbar">
        <label className="release-focus-search">
          <Search size={15} aria-hidden />
          <input ref={searchInput} type="search" value={search} aria-label="Search loaded releases" aria-keyshortcuts={searchShortcutActive ? "/" : undefined} placeholder="Search releases…" onChange={event => { setSearch(event.target.value); setPage(0); }} />
          {searchShortcutActive && <kbd aria-hidden="true">/</kbd>}
        </label>
        {environments.length > 0 && <select aria-label="Filter loaded releases by environment" value={environment} onChange={event => { setEnvironment(event.target.value); setPage(0); }}>
          <option value="">Environment</option>
          {environments.map(target => <option key={target} value={target}>{target}</option>)}
        </select>}
      </div>
      <nav className="release-focus-list" aria-label="Select a release">
        <div className="release-focus-grid release-focus-list-heading" aria-hidden="true">
          <span>Release</span><span>Target</span><span>Status</span><span>PR review</span><span>Requester</span><span>Updated</span>
        </div>
        {visibleItems.map(({ item, index }, visibleIndex) => {
          const updated = item.updatedAt ? new Date(item.updatedAt) : null;
          const requester = item.requesterName?.trim();
          const initials = requester?.split(/\s+/u).slice(0, 2).map(part => Array.from(part)[0]).join("").toUpperCase();
          return <button key={item.id}
            ref={node => { if (node) buttons.current.set(item.id, node); else buttons.current.delete(item.id); }}
            onKeyDown={event => navigate(event, visibleIndex)}
            type="button" id={`${prefix}-item-${index}`} aria-controls={`${prefix}-panel-${index}`}
            aria-current={visibleActive === item.id ? "true" : undefined}
            tabIndex={tabbableRelease === item.id ? 0 : -1}
            aria-expanded={visibleActive === item.id && !detailsClosed}
            onClick={() => {
              panelFocus.current = item.id;
              setSelected({id: item.id, version: item.version});
              setPage(undefined);
              setDetailsClosed(false);
              if (visibleActive === item.id && !detailsClosed) {
                panelFocus.current = null;
                focusReleaseDetails(`${prefix}-panel-${index}`);
              }
            }}
            className={`release-focus-grid release-focus-item ${visibleActive === item.id ? "is-selected" : ""}`}>
            <span className="release-focus-item-title"><Box size={17} aria-hidden /><span>{item.title}{item.version !== undefined && <> <small>Version {item.version}</small></>}</span></span>
            <span><span className="release-focus-item-environment">{item.environment || "Unspecified"}</span></span>
            <span className="release-focus-item-state">
              <span className="capitalize">{item.status.replaceAll("_", " ")}{item.busy ? " · Working" : ""}</span>
              <small>{item.nextStep}</small>
              {item.attention && <small className="release-focus-attention">Needs attention</small>}
            </span>
            <span className="release-focus-item-review"><span className="sr-only">PR review: </span>{item.prReview ?? "Unavailable"}</span>
            <span className="release-focus-item-requester" title={requester ?? "Requester unavailable"}>
              <span className="sr-only">Requester: {requester || "Unavailable"}</span>
              <span className={requester ? "release-focus-requester-avatar" : "release-focus-requester-unavailable"} aria-hidden="true">
                {initials || "—"}
              </span>
            </span>
            <span className="release-focus-item-updated">{updated && Number.isFinite(updated.getTime())
              ? <time dateTime={updated.toISOString()} title={updated.toLocaleString()}>
                <span aria-hidden="true">{updatedLabel(updated, observedAt)}</span>
                <span className="sr-only">Updated {updated.toLocaleString()}</span>
              </time>
              : "Unavailable"}</span>
          </button>;
        })}
      </nav>
      {visibleItems.length === 0 ? <p role="status" className="release-focus-empty">No loaded releases match.</p>
        : <div className="release-focus-pagination">
          <p aria-live="polite">Showing {range} of {rangeTotal}</p>
          {pageCount > 1 && <nav aria-label="Release pages">
            <button type="button" aria-label="Previous release page" aria-disabled={currentPage === 0}
              onClick={() => { if (currentPage > 0) setPage(currentPage - 1); }}><ArrowLeft size={14} aria-hidden="true" /></button>
            {Array.from({ length: Math.min(3, pageCount) }, (_, offset) => firstPageButton + offset).map(index =>
              <button key={index} type="button" aria-label={`Release page ${index + 1} of ${pageCount}`}
                aria-current={index === currentPage ? "page" : undefined} onClick={() => setPage(index)}>{index + 1}</button>)}
            <button type="button" aria-label="Next release page" aria-disabled={currentPage === lastPage}
              onClick={() => { if (currentPage < lastPage) setPage(currentPage + 1); }}><ArrowRight size={14} aria-hidden="true" /></button>
          </nav>}
        </div>}
      {selectedItem && renderSelectedActivity?.(selectedItem)}
    </div>
    <div className="release-focus-detail">
      {selectionUnverified && <p role="status" className="release-focus-empty">
        {selectedRow ? "The selected release version changed. Choose a release to review its current version."
          : "The selected release is no longer in the loaded directory. Choose a release to continue."}
      </p>}
      {items.map((item, index) => <section key={item.id} id={`${prefix}-panel-${index}`}
        aria-labelledby={`${prefix}-item-${index}`} hidden={openPanel !== item.id}
        tabIndex={-1} onKeyDown={event => {
          if (event.key !== "Escape" || event.defaultPrevented || event.nativeEvent.isComposing ||
            event.nativeEvent.keyCode === 229 || (event.target instanceof Element &&
              event.target.closest('input, select, textarea, [contenteditable], [role="dialog"], [role="alertdialog"]'))) return;
          event.preventDefault();
          closeDetails(item.id);
        }}>
        {(openPanel === item.id || openedPanels.has(item.id)) && children(item, <button type="button" className="release-focus-close" aria-label="Close release details" onClick={() => closeDetails(item.id)}>
          <X aria-hidden="true" size={15}/>
        </button>, openPanel === item.id)}
      </section>)}
    </div>
  </div>;
}
