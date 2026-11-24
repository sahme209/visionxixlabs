import {useState} from "react";
import type {TicketRecord} from "../../../lib/tauri/ticketDirectoryContract";
import {DesktopDialog} from "../components/DesktopDialog";

export interface TicketFacets {
  status: string;
  application: string;
  environment: string;
}

export const emptyTicketFacets: TicketFacets = {status:"",application:"",environment:""};

export function matchesTicketFacets(record:TicketRecord, facets:TicketFacets) {
  if (facets.status && facets.status !== `${record.kind}:${record.status}`) return false;
  if (!facets.application && !facets.environment) return true;
  return record.kind === "incident" &&
    (!facets.application || record.releaseContext?.application === facets.application) &&
    (!facets.environment || record.releaseContext?.environment === facets.environment);
}

function facetOptions(records:readonly TicketRecord[]) {
  const status = new Map<string,string>();
  const application = new Set<string>();
  const environment = new Set<string>();
  for (const record of records) {
    const kind = record.kind === "incident" ? "Incident" : "Change";
    status.set(`${record.kind}:${record.status}`, `${kind} · ${record.status.replaceAll("_"," ")}`);
    if (record.kind === "incident") {
      const context = record.releaseContext;
      if (context?.application) application.add(context.application);
      if (context?.environment) environment.add(context.environment);
    }
  }
  return {
    status:[...status].sort((a,b) => a[1].localeCompare(b[1])),
    application:[...application].sort((a,b) => a.localeCompare(b)).map(value => [value,value]),
    environment:[...environment].sort((a,b) => a.localeCompare(b)).map(value => [value,value]),
  };
}

const fields = [
  {key:"status",label:"Status"},
  {key:"application",label:"Application"},
  {key:"environment",label:"Environment"},
] as const;

export function TicketFacetFilters({records, current, onApply, onClose, restoreFocus}: {
  records:readonly TicketRecord[];
  current:TicketFacets;
  onApply:(next:TicketFacets) => void;
  onClose:() => void;
  restoreFocus:() => boolean;
}) {
  const [draft,setDraft] = useState(current);
  const options = facetOptions(records);
  return <DesktopDialog label="Ticket filters" role="dialog" isolate overlayClassName="studio-ticket-filter-overlay"
    onClose={onClose} restoreFocus={restoreFocus}>
    <form className="studio-ticket-facets" onSubmit={event => {event.preventDefault();onApply(draft);}}>
      <h3>Filters</h3>
      <p>Filter the tickets loaded in Studio.</p>
      {fields.map(({key,label}) => <label key={key}>
        {label}
        <select value={draft[key]} onChange={event => setDraft(value => ({...value,[key]:event.target.value}))}>
          <option value="">Any {label.toLowerCase()}</option>
          {options[key].map(([value,name]) => <option key={value} value={value}>{name}</option>)}
          {draft[key] && !options[key].some(([value]) => value === draft[key]) &&
            <option value={draft[key]}>{label} unavailable in loaded tickets</option>}
        </select>
      </label>)}
      <div className="studio-ticket-facet-actions">
        <button type="button" className="btn-secondary" onClick={() => setDraft(emptyTicketFacets)}>Reset filters</button>
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary">Apply filters</button>
      </div>
    </form>
  </DesktopDialog>;
}
