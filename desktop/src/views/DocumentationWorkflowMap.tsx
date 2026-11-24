import { useId, useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import { ExternalLink } from "../components/Primitives";
import { documentationWorkflows, workflowSteps } from "./documentationWorkflow";
import "./DocumentationWorkflowMap.css";

const column = 230;
const row = 112;
const cardHeight = 60;
const cardWidth = 174;
const offset = 20;
// Leave room for the lane heading and a two-line branch label above the first card.
const top = 76;

function position(step: (typeof workflowSteps)[number]) {
  return {x: step.group * column + offset, y: step.row * row + top};
}

// Return paths stay in the inspector so their loops cannot obscure forward routes.
function connectionsFor(steps: typeof workflowSteps) {
  return steps.flatMap(from => {
    const forward = from.next.filter(transition => !transition.returnPath);
    return forward.flatMap(({id, when}) => {
      const to = steps.find(step => step.id === id);
      if (!to) return [];
      const a = position(from);
      const b = position(to);
      const centerA = a.y + cardHeight / 2;
      const centerB = b.y + cardHeight / 2;
      const up = a.y > b.y;
      const edge = {
        id: `${from.id}-${to.id}`,
        from: from.id,
        to: to.id,
        label: forward.length > 1 ? {text: when, left: b.x, top: up ? b.y + cardHeight + 5 : b.y - 32} : undefined,
      };
      if (from.group === to.group) {
        if (Math.abs(from.row - to.row) === 1) {
          return [{
            ...edge,
            parts: [{left: a.x + cardWidth / 2, top: Math.min(a.y, b.y) + cardHeight, width: 1, height: row - cardHeight}],
            direction: up ? "up" : "down",
          }];
        }
        // Skip intervening cards through the right gutter of the same lane.
        const right = a.x + cardWidth;
        const gutter = right + 16;
        return [{
          ...edge,
          parts: [
            {left: right, top: centerA, width: gutter - right, height: 1},
            {left: gutter, top: Math.min(centerA, centerB), width: 1, height: Math.abs(centerA - centerB) + 1},
            {left: right, top: centerB, width: gutter - right, height: 1},
          ],
          direction: "left",
        }];
      }
      const start = a.x + cardWidth;
      const bend = (start + b.x) / 2 + Math.sign(b.y - a.y) * 10;
      return [{
        ...edge,
        parts: [
          {left: start, top: centerA, width: bend - start, height: 1},
          {left: bend, top: Math.min(centerA, centerB), width: 1, height: Math.abs(centerA - centerB) + 1},
          {left: bend, top: centerB, width: b.x - bend, height: 1},
        ],
        direction: "right",
      }];
    });
  });
}

export function DocumentationWorkflowMap({onBack}: {onBack: () => void}) {
  const prefix = useId();
  const title = useRef<HTMLHeadingElement>(null);
  const [workflow, setWorkflow] = useState<(typeof documentationWorkflows)[number]>(documentationWorkflows[0]);

  useLayoutEffect(() => { title.current?.focus(); }, []);

  return <section className="studio-flow" aria-labelledby={prefix + "-title"}>
    <header className="studio-flow-header">
      <div>
        <h2 id={prefix + "-title"} ref={title} tabIndex={-1}>{workflow.title}</h2>
        <p>{workflow.description}</p>
      </div>
      <button data-help-id="documentation.workflow.back" type="button" className="btn-secondary" onClick={onBack}>Back to guides</button>
    </header>
    <nav data-help-id="documentation.workflow.families" className="studio-flow-families" aria-label="Workflow maps">
      {documentationWorkflows.map(item => <button type="button" className="btn-secondary" key={item.id}
        aria-pressed={item.id === workflow.id} onClick={() => setWorkflow(item)}>{item.label}</button>)}
    </nav>
    <WorkflowCanvas key={workflow.id} workflow={workflow} onBack={onBack}/>
  </section>;
}

function WorkflowCanvas({workflow, onBack}: {workflow: (typeof documentationWorkflows)[number]; onBack: () => void}) {
  const prefix = useId();
  const canvas = useRef<HTMLDivElement>(null);
  const inspector = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [showStepList, setShowStepList] = useState(false);
  const canvasOffset = useRef<{left: number; top: number} | null>(null);
  const [manualZoom, setManualZoom] = useState(100);
  const pan = useRef<{id: number; x: number; y: number; left: number; top: number} | null>(null);
  const [fitOverview, setFitOverview] = useState(false);
  const [fitZoom, setFitZoom] = useState(100);
  const pendingGroupFocus = useRef<number | null>(null);
  const [selected, setSelected] = useState<string>();
  const {groups, steps} = workflow;
  const boardWidth = groups.length * column;
  const zoom = fitOverview ? fitZoom : manualZoom;
  const step = steps.find(item => item.id === selected);
  const visibleConnections = connectionsFor(steps);

  useLayoutEffect(() => {
    if (!selected) return;
    const viewport = canvas.current;
    const card = viewport?.querySelector<HTMLButtonElement>('.studio-flow-step[aria-pressed="true"]');
    if (viewport && card) {
      const view = viewport.getBoundingClientRect();
      const target = card.getBoundingClientRect();
      const left = view.left + viewport.clientLeft;
      const top = view.top + viewport.clientTop;
      const right = left + viewport.clientWidth;
      const bottom = top + viewport.clientHeight;
      // Follow the selected card inside the canvas without moving its parent scroll area.
      if (target.left < left) viewport.scrollLeft += target.left - left;
      else if (target.right > right) viewport.scrollLeft += target.right - right;
      if (target.top < top) viewport.scrollTop += target.top - top;
      else if (target.bottom > bottom) viewport.scrollTop += target.bottom - bottom;
    }
    inspector.current?.focus();
  }, [selected]);

  useLayoutEffect(() => {
    const viewport = canvas.current;
    if (!fitOverview || !viewport || showStepList) return;
    const resize = () => {
      if (viewport.clientWidth > 0) {
        setFitZoom(Math.max(1, Math.min(100, Math.floor(viewport.clientWidth * 100 / boardWidth))));
      }
    };
    resize();
    viewport.scrollLeft = 0;
    const observer = new ResizeObserver(resize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [fitOverview, boardWidth, showStepList]);

  useLayoutEffect(() => {
    const viewport = canvas.current;
    if (!viewport || !canvasOffset.current) return;
    if (showStepList) {
      const activeStep = viewport.querySelector<HTMLButtonElement>('.studio-flow-step[aria-pressed="true"]');
      viewport.scrollTop = activeStep
        ? viewport.scrollTop + activeStep.getBoundingClientRect().top - viewport.getBoundingClientRect().top
        : 0;
    } else {
      viewport.scrollLeft = canvasOffset.current.left;
      viewport.scrollTop = canvasOffset.current.top;
      canvasOffset.current = null;
    }
  }, [showStepList]);

  function toggleStepList() {
    const viewport = canvas.current;
    if (viewport && !showStepList) {
      canvasOffset.current = {left: viewport.scrollLeft, top: viewport.scrollTop};
    }
    setShowStepList(!showStepList);
  }

  function focusGroup(index: number) {
    const group = canvas.current?.querySelectorAll("h3")[index];
    group?.focus({preventScroll: true});
    group?.scrollIntoView({block: "nearest", inline: "start"});
  }

  useLayoutEffect(() => {
    if (pendingGroupFocus.current !== null) {
      const index = pendingGroupFocus.current;
      pendingGroupFocus.current = null;
      focusGroup(index);
    }
  }, [fitOverview]);

  function setZoom(value: number) {
    setManualZoom(value);
    setFitOverview(false);
  }

  function startPan(event: PointerEvent<HTMLDivElement>) {
    const viewport = event.currentTarget;
    const target = event.target;
    if (showStepList || event.pointerType === "touch" || !event.isPrimary || event.button !== 0 ||
        !(target instanceof Element) || target.closest("button, a, h3") ||
        (viewport.scrollWidth <= viewport.clientWidth && viewport.scrollHeight <= viewport.clientHeight)) return;
    event.preventDefault();
    viewport.focus({preventScroll: true});
    viewport.setPointerCapture(event.pointerId);
    pan.current = {id: event.pointerId, x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop};
    viewport.dataset.panning = "true";
  }

  function movePan(event: PointerEvent<HTMLDivElement>) {
    const origin = pan.current;
    if (!origin || origin.id !== event.pointerId) return;
    event.currentTarget.scrollLeft = origin.left + origin.x - event.clientX;
    event.currentTarget.scrollTop = origin.top + origin.y - event.clientY;
  }

  function stopPan(event: PointerEvent<HTMLDivElement>) {
    if (pan.current?.id !== event.pointerId) return;
    pan.current = null;
    delete event.currentTarget.dataset.panning;
  }

  function closeDetails() {
    setSelected(undefined);
    opener.current?.focus();
  }

  return <div className="studio-flow-canvas" onKeyDown={event => {
    if (event.key === "Escape" && !event.defaultPrevented) {
      event.preventDefault();
      if (step) closeDetails();
      else onBack();
    }
  }}>
    <div className="studio-flow-toolbar">
      <nav data-help-id="documentation.workflow.groups" aria-label="Workflow groups">
        {groups.map((name, index) => <button type="button" className="btn-secondary" key={name}
          onClick={() => {
            if (fitOverview && !showStepList) {
              pendingGroupFocus.current = index;
              setZoom(100);
            } else {
              focusGroup(index);
            }
          }}>{name}</button>)}
      </nav>
      <div className="studio-flow-tools">
        <button type="button" className="btn-secondary" aria-controls={prefix + "-workflow"}
          aria-pressed={showStepList} data-help-id="documentation.workflow.step-list" onClick={toggleStepList}>Step list</button>
        {!showStepList && <div data-help-id="documentation.workflow.zoom" role="group" aria-label="Canvas zoom">
          <button type="button" className="btn-secondary" aria-pressed={fitOverview} data-help-id="documentation.workflow.fit"
            onClick={() => setFitOverview(value => !value)}>Fit overview</button>
          <button type="button" className="btn-secondary" onClick={() => setZoom(Math.max(75, zoom - 25))} disabled={zoom <= 75} aria-label="Zoom out">−</button>
          <button type="button" className="btn-secondary" onClick={() => setZoom(100)} aria-label={`Reset zoom, current zoom ${zoom}%`}>{zoom}%</button>
          <button type="button" className="btn-secondary" onClick={() => setZoom(Math.min(150, Math.max(75, zoom + 25)))} disabled={zoom === 150} aria-label="Zoom in">+</button>
        </div>}
      </div>
    </div>
    <div className="studio-flow-workspace">
      <div id={prefix + "-workflow"} data-help-id="documentation.workflow.steps" className={`studio-flow-viewport${showStepList ? " studio-flow-list" : ""}`} ref={canvas}
        tabIndex={0} role="region" aria-label={showStepList ? `${workflow.label} workflow step list` : `Scrollable ${workflow.label.toLowerCase()} workflow canvas`}
        onPointerDown={startPan} onPointerMove={movePan} onPointerUp={stopPan}
        onPointerCancel={stopPan} onLostPointerCapture={stopPan}>
        <div className="studio-flow-board" style={showStepList ? undefined : {width: boardWidth, height: top + (Math.max(...steps.map(item => item.row)) + 1) * row, zoom: zoom / 100}}>
          {groups.map((name, index) => <section key={name} aria-labelledby={`${prefix}-group-${index}`}
            className="studio-flow-lane" style={showStepList ? undefined : {left: index * column, width: column}}>
            <h3 id={`${prefix}-group-${index}`} tabIndex={-1}>{name}</h3>
            <ol>{steps.filter(item => item.group === index).sort((a, b) => a.row - b.row).map(item => <li key={item.id} style={showStepList ? undefined : {top: position(item).y, left: offset, width: cardWidth}}>
              <button type="button" className="studio-flow-step" aria-pressed={item.id === selected}
                aria-label={item.status ? `${item.title}, ${item.status}` : undefined}
                onClick={event => {
                  opener.current = event.currentTarget;
                  if (item.id === selected) inspector.current?.focus();
                  else setSelected(item.id);
                }}>
                {item.next.filter(transition => !transition.returnPath).length > 1 &&
                  <span className="studio-flow-decision" aria-hidden="true"/>}
                {item.title}{item.status && <small>{item.status}</small>}
              </button>
            </li>)}</ol>
          </section>)}
          {!showStepList && <div aria-hidden="true">
            {visibleConnections.map(edge => <div key={edge.id}
              className={selected === edge.from || selected === edge.to ? "studio-flow-route-selected" : undefined}>
              {edge.parts.map((part, index) => <div key={index} style={part}
                className={`studio-flow-edge ${index === edge.parts.length - 1 ? "studio-flow-edge-" + edge.direction : ""}`}/>)}
              {edge.label && <span className="studio-flow-branch-label"
                style={{left: edge.label.left, top: edge.label.top, width: cardWidth}}>{edge.label.text}</span>}
            </div>)}
          </div>}
        </div>
      </div>
      {step && <aside className="studio-flow-inspector" aria-labelledby={prefix + "-details"}>
        <div className="studio-flow-detail-heading">
          <h3 id={prefix + "-details"} tabIndex={-1} ref={inspector}>{step.title}</h3>
          <button data-help-id="documentation.workflow.close-details" type="button" className="btn-secondary" onClick={closeDetails}>Close details</button>
        </div>
        {step.status && <p className="studio-flow-status">{step.status}</p>}
        <p className="studio-flow-responsibility">{groups[step.group]}</p>
        <p>{step.detail}</p>
        {step.next.length > 0 && <>
          <h4>Next steps</h4>
          <ul data-help-id="documentation.workflow.next-steps">{step.next.map(({id, when}) => <li key={id}>
            <button className="btn-secondary" type="button" onClick={() => setSelected(id)}>{steps.find(item => item.id === id)?.title}<small>{when}</small></button>
          </li>)}</ul>
        </>}
        <ExternalLink data-help-id="documentation.workflow.read-guide" className="btn-secondary" href={step.guide}>Read the guide</ExternalLink>
      </aside>}
    </div>
  </div>;
}
