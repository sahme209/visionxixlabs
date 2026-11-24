/** @vitest-environment jsdom */
import {createElement, type ComponentProps} from "react";
import {act,cleanup,fireEvent,render,screen,within} from "@testing-library/react";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {CinematicAxiomDemo} from "../CinematicAxiomDemo";
import ApprovalWorkflowPage from "@/app/docs/approval-workflow/page";
beforeEach(()=>{vi.useFakeTimers();});
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();});
function mount(){render(createElement(CinematicAxiomDemo));}
function advance(ms=30000){act(()=>vi.advanceTimersByTime(ms));}
it("keeps the linked approval documentation distinct from verified ECS execution and recovery", () => {
  const { container } = render(createElement(ApprovalWorkflowPage));
  const execution = container.querySelector("#execution")!;
  expect(execution.textContent).toContain("separately configured tenant-owned workflow");
  expect(execution.textContent).toContain("does not verify ECS execution, service health or rollback");
  const recovery = screen.getByText("Is every rollback universal?").parentElement!;
  expect(recovery.textContent).toContain("Automatic ECS rollback is not verified");
  expect(container.textContent).not.toContain("restores the prior definition if stabilization fails");
  expect(container.textContent).not.toContain("automatic rollback applies to the released ECS workflow");
  expect(screen.getByText(/The Agent cannot approve its own request/)).toBeDefined();
  expect(screen.getByText(/An authorized independent human reviewer must approve the exact persisted proposal\. Approval permission is distinct from execution permission\./)).toBeDefined();
  expect(screen.getByText(/Separate requester execution is a local preview and is not production-activated\./)).toBeDefined();
});

it("links every story to working approval documentation without promising a retired full walkthrough", () => {
  mount();
  for (const label of ["Code & review", "Agent & approval", "Terraform & cloud"]) {
    fireEvent.click(screen.getByRole("button", { name: label }));
    expect(screen.getByRole("link", { name: "Read approval workflow" }).getAttribute("href")).toBe("/docs/approval-workflow");
    expect(screen.queryByRole("link", { name: "Read the full walkthrough" })).toBeNull();
    expect(screen.getAllByRole("link").some(link => link.getAttribute("href")?.startsWith("/demo/"))).toBe(false);
  }
});

it("links the expanded public tour’s selected story to its exact guide section", () => {
  render(createElement<NonNullable<ComponentProps<typeof CinematicAxiomDemo>>>(CinematicAxiomDemo, {showStoryPreviews: true, showDemoLink: false}));
  for (const [name, label, href] of [
    ["Code & review", "Read the local repository guide", "/docs/source-modes#local-files"],
    ["Agent & approval", "Read the approval decision guide", "/docs/approval-workflow#decision"],
    ["Terraform & cloud", "Read Terraform availability", "/docs/releaseops#availability"],
  ]) {
    fireEvent.click(screen.getByRole("button", {name: new RegExp(name)}));
    expect(screen.getByRole("link", {name: label}).getAttribute("href")).toBe(href);
  }
});

it("describes check environment and output limits without promising credential isolation", () => {
  mount(); fireEvent.click(screen.getByRole("button", { name: "Step 3: Review the bounded check." }));
  expect(screen.getByText(/local files and stored credentials can still be read with your user permissions/)).toBeDefined();
  expect(screen.getByText(/5-minute timeout and separate 1 MB limits for standard output and error output/)).toBeDefined();
  expect(screen.queryByText(/removes credentials/)).toBeNull();
});


it("keeps review deliberate and never contacts a service from a sample decision",()=>{
 const fetch=vi.fn();vi.stubGlobal("fetch",fetch);mount();
 fireEvent.click(screen.getByRole("button",{name:"Step 3: Review the bounded check."}));advance();
 expect(screen.queryByText("Sample decision recorded")).toBeNull();
 fireEvent.click(screen.getByRole("button",{name:"Simulate approval"}));
 expect(screen.getByText("Sample decision recorded")).toBeDefined();expect(fetch).not.toHaveBeenCalled();
});
it("uses direct selection without player buttons or automatic step changes",()=>{
 const view=render(createElement(CinematicAxiomDemo));
 expect(screen.queryByRole("button",{name:/^(Play|Pause|Replay) story$/})).toBeNull();
 fireEvent.click(screen.getByRole("button",{name:/Step 2:/}));const before=view.container.textContent;advance();
 expect(view.container.textContent).toBe(before);
 expect(screen.getByRole("heading",{name:"Make a small, reviewable edit."})).toBeDefined();
 view.unmount();advance();expect(vi.getTimerCount()).toBe(0);
});
it("supports direct keyboard steps without overriding dropdown keys",()=>{
 mount();const steps=screen.getByRole("group",{name:"Story steps"});
 fireEvent.keyDown(steps,{key:"ArrowRight"});
 expect(screen.getByRole("heading",{name:"Make a small, reviewable edit."})).toBeDefined();
 fireEvent.keyDown(screen.getByLabelText("Branch"),{key:"End"});
 expect(screen.getByRole("heading",{name:"Make a small, reviewable edit."})).toBeDefined();
 fireEvent.keyDown(steps,{key:"Home"});expect(screen.getByRole("heading",{name:"Choose the working context."})).toBeDefined();
});
it("keeps sample rejection separate from subsequent stories and final outcomes",()=>{
 mount();fireEvent.click(screen.getByRole("button",{name:/Step 3: Review the bounded check/}));
 fireEvent.click(screen.getByRole("button",{name:"Reject sample"}));
 expect(screen.getByText("Sample rejected · no action taken")).toBeDefined();
 fireEvent.click(screen.getByRole("button",{name:"Agent & approval"}));
 expect(screen.queryByText("Sample rejected · no action taken")).toBeNull();
 fireEvent.click(screen.getByRole("button",{name:"Step 4: Keep the outcome honest."}));advance();
 expect(screen.getByRole("heading",{name:"Keep the outcome honest."})).toBeDefined();
});
it("invalidates sample approval when selected context changes", () => {
  mount(); fireEvent.click(screen.getByRole("button", { name: "Step 3: Review the bounded check." }));
  fireEvent.click(screen.getByRole("button", { name: "Simulate approval" }));
  fireEvent.change(screen.getByLabelText("Branch"), { target: { value: "review/retry-policy" } });
  expect(screen.queryByText("Sample decision recorded")).toBeNull();
  expect(screen.getByRole("heading", { name: "Choose the working context." })).toBeDefined();
});

it("keeps Terraform authority unavailable and never offers apply or fabricated cloud success", () => {
  mount(); fireEvent.click(screen.getByRole("button", { name: "Terraform & cloud" }));
  fireEvent.click(screen.getByRole("button", { name: "Step 3: Keep the release on hold." }));
  expect(screen.getByText("Cloud end-to-end acceptance is unverified.")).toBeDefined();
  expect(screen.queryByRole("button", { name: /apply|approve|Simulate approval/i })).toBeNull();
  expect(screen.getByText("Current target authority unavailable")).toBeDefined();
});

it("grounds the scripted frame in customer navigation without exposing operational controls", () => {
  mount();
  const navigation = screen.getByRole("complementary", { name: "Navigation illustrated from the desktop application" });
  expect(navigation.textContent).toContain("No connected account.");
  expect(navigation.querySelectorAll("button, a, input")).toHaveLength(0);
  expect(screen.getByText("V19 · Repositories")).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Agent & approval" }));
  expect(screen.getByText("V19 · Agent")).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Terraform & cloud" }));
  expect(screen.getByText("V19 · Deployments")).toBeDefined();
  expect(screen.getByText("Scripted preview")).toBeDefined();
});

it("announces the current story step after deliberate navigation and story changes", () => {
  mount();
  const status = screen.getByRole("status", { name: "Current story step" });
  expect(status.getAttribute("aria-live")).toBe("polite");
  expect(status.getAttribute("aria-atomic")).toBe("true");
  expect(status.textContent).toContain("Choose the working context.");
  fireEvent.click(screen.getByRole("button", { name: /Step 2:/ }));
  expect(status.textContent).toContain("Step 2 of");
  expect(status.textContent).toContain("Make a small, reviewable edit.");
  fireEvent.click(screen.getByRole("button", { name: "Agent & approval" }));
  expect(status.textContent).toContain("Step 1 of");
  expect(status.textContent).toContain(screen.getAllByRole("heading", { level: 2 })[0].textContent!);
});

it("follows app actions from request through diff, deliberate check decision and output",()=>{
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch);mount();
 fireEvent.click(screen.getByRole('button',{name:'Prepare sample change →'}));
 expect(screen.getAllByText('retry-policy.ts').length).toBeGreaterThan(0);
 expect(document.activeElement?.getAttribute('aria-label')).toBe('Sample workflow response');
 fireEvent.click(screen.getByRole('button',{name:'Review project check →'}));
 expect(screen.queryByRole('button',{name:'Inspect sample check output →'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Reject sample'}));
 expect(screen.queryByRole('button',{name:'Inspect sample check output →'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Simulate approval'}));
 fireEvent.click(screen.getByRole('button',{name:'Inspect sample check output →'}));
 expect(screen.getByText('Bounded check output')).toBeDefined();
 fireEvent.click(screen.getByRole('button',{name:'Review branch publication →'}));
 expect(screen.getByRole('heading',{name:'Publish branch and open a pull request?'})).toBeDefined();
 expect(fetch).not.toHaveBeenCalled();
});

for (const width of [360, 1135]) it(`keeps response focus while scrolling the correct context at ${width}px`,()=>{
 const originalWidth=window.innerWidth;Object.defineProperty(window,'innerWidth',{configurable:true,value:width});
 const scroll=vi.fn();const previous=HTMLElement.prototype.scrollIntoView;HTMLElement.prototype.scrollIntoView=scroll;
 try {mount();fireEvent.click(screen.getByRole('button',{name:'Prepare sample change →'}));
 const response=screen.getByLabelText('Sample workflow response');
 expect(document.activeElement).toBe(response);
 expect(scroll).toHaveBeenCalledWith({block:'nearest',inline:'nearest'});
 expect(scroll.mock.instances.at(-1)).toBe(width>=1024?screen.getByRole('heading',{name:'Make a small, reviewable edit.'}):response);
 }finally{HTMLElement.prototype.scrollIntoView=previous;Object.defineProperty(window,'innerWidth',{configurable:true,value:originalWidth});}
});

it("moves focus from the focused button and retains a decision when the selected step stays in place", () => {
  mount();
  const second = screen.getByRole("button", {name: /Step 2:/});
  const third = screen.getByRole("button", {name: /Step 3:/});
  second.focus();
  fireEvent.keyDown(second, {key: "ArrowDown"});
  expect(document.activeElement).toBe(third);
  expect(third.getAttribute("aria-current")).toBe("step");
  const last = screen.getByRole("button", {name: /Step 5:/});
  fireEvent.keyDown(third, {key: "End"});
  expect(document.activeElement).toBe(last);
  fireEvent.click(screen.getByRole("button", {name: "Simulate approval"}));
  fireEvent.keyDown(last, {key: "End"});
  expect(screen.getByText("Sample decision recorded")).toBeTruthy();
  fireEvent.keyDown(last, {key: "Home"});
  expect(screen.queryByText("Sample decision recorded")).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole("button", {name: /Step 1:/}));
});

type CinematicAxiomDemoProps = NonNullable<Parameters<typeof CinematicAxiomDemo>[0]>;

it("moves between the current step and its response without clearing a sample decision", () => {
  render(createElement<CinematicAxiomDemoProps>(CinematicAxiomDemo, {showStoryPreviews: true}));
  const steps = within(screen.getByRole("group", {name: "Story steps"}));
  const last = steps.getByRole("button", {name: /Step 5:/});
  fireEvent.click(last);
  fireEvent.click(screen.getByRole("button", {name: "Simulate approval"}));
  fireEvent.click(screen.getByRole("button", {name: "View sample response"}));
  expect(document.activeElement).toBe(screen.getByRole("region", {name: "Sample workflow response"}));
  fireEvent.click(screen.getByRole("button", {name: "Back to selected step"}));
  expect(document.activeElement).toBe(last);
  expect(last.getAttribute("aria-current")).toBe("step");
  expect(screen.getByText("Sample decision recorded")).toBeTruthy();
});

it("allows the demo landing page to focus the tour without a link to itself",()=>{
 render(createElement<CinematicAxiomDemoProps>(CinematicAxiomDemo,{showDemoLink:false}));
 const tour=screen.getByRole("region",{name:"V19 interactive workflow stories"});
 expect(tour.id).toBe("product-tour");
 expect(tour.tabIndex).toBe(-1);
 expect(screen.queryByRole("link",{name:"Explore every safe demo"})).toBeNull();
});

it("uses source-bound stills as part of the Demo story controls only", () => {
  const view = render(createElement(CinematicAxiomDemo));
  const choices = () => within(screen.getByRole("group", {name: "Choose a workflow story"}));
  expect(choices().getByRole("button", {name: "Code & review"}).querySelector("img")).toBeNull();

  view.rerender(createElement<CinematicAxiomDemoProps>(CinematicAxiomDemo, {showStoryPreviews: true, showDemoLink: false}));
  for (const [id, name] of [
    ["workspace", /Code & review/],
    ["agent", /Agent & approval/],
    ["cloud", /Terraform & cloud/],
  ] as const) {
    const choice = choices().getByRole("button", {name});
    expect(choice.querySelector("img")?.getAttribute("src")).toBe(`/media/workflow-stories/${id}.webp`);
    expect(choice.querySelector("img")?.getAttribute("alt")).toBe("");
    fireEvent.click(choice);
    expect(choice.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("status", {name: "Current story step"}).textContent).toContain("Step 1 of");
  }
});
