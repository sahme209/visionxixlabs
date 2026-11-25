/** @vitest-environment jsdom */
import {useState,createElement as h} from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {FocusedReleaseWorkspace,type ReleaseWorkspaceItem} from '../../../desktop/src/components/FocusedReleaseWorkspace';
afterEach(cleanup);
const items:ReleaseWorkspaceItem[]=[{id:'a',title:'Release Alpha',environment:'Production',status:'submitted',nextStep:'Review exact controls',attention:true,busy:false},{id:'b',title:'Release Beta',environment:'Staging',status:'draft',nextStep:'Complete scope',attention:false,busy:true}];
function Draft({name}:{name:string}){const [value,setValue]=useState('');return h('label',null,name+' note',h('input',{value,onChange:(e:React.ChangeEvent<HTMLInputElement>)=>setValue(e.target.value)}))}
it('opens only the selected inspector, retains opened drafts, and exposes attention and ongoing work in navigation',()=>{
 const mounted=vi.fn();function Panel({name}:{name:string}){mounted(name);return h(Draft,{name})}
 const view=render(h(FocusedReleaseWorkspace,{items,children:item=>h(Panel,{name:item.title})}));
 const first=screen.getByRole('button',{name:/Release Alpha/}),second=screen.getByRole('button',{name:/Release Beta/});
 expect(first.getAttribute('aria-current')).toBe('true');expect(second.textContent).toContain('Working');expect(first.textContent).toContain('Needs attention');
 expect(mounted).not.toHaveBeenCalledWith('Release Beta');
 expect(document.getElementById(second.getAttribute('aria-controls')!)).toHaveProperty('hidden',true);
 fireEvent.change(screen.getByLabelText('Release Alpha note'),{target:{value:'unsaved exact review'}});
 fireEvent.click(second);
 expect(mounted).toHaveBeenCalledWith('Release Beta');
 expect(view.container.querySelector('section:not([hidden])')?.textContent).toContain('Release Beta note');
 expect((screen.getByLabelText('Release Alpha note') as HTMLInputElement).value).toBe('unsaved exact review');
 fireEvent.click(first);expect((screen.getByLabelText('Release Alpha note') as HTMLInputElement).value).toBe('unsaved exact review');
});
it('keeps selection attached to the release ID when reordered and requires a choice when removed',()=>{
 const view=render(h(FocusedReleaseWorkspace,{items,children:item=>h(Draft,{name:item.title})}));
 fireEvent.click(screen.getByRole('button',{name:/Release Beta/}));
 view.rerender(h(FocusedReleaseWorkspace,{items:[...items].reverse(),children:item=>h(Draft,{name:item.title})}));
 expect(screen.getByRole('button',{name:/Release Beta/}).getAttribute('aria-current')).toBe('true');
 view.rerender(h(FocusedReleaseWorkspace,{items:[],children:item=>h(Draft,{name:item.title})}));
 expect(screen.queryByRole('navigation',{name:'Select a release'})).toBeNull();
 view.rerender(h(FocusedReleaseWorkspace,{items:[items[0]],children:item=>h(Draft,{name:item.title})}));
 const replacement=screen.getByRole('button',{name:/Release Alpha/});
 expect(replacement.hasAttribute('aria-current')).toBe(false);
 expect(replacement.tabIndex).toBe(0);
 expect(view.container.querySelector('section:not([hidden])')).toBeNull();
 expect(screen.getByRole('status').textContent).toContain('The selected release is no longer in the loaded directory.');
 fireEvent.click(replacement);
 expect(replacement.getAttribute('aria-current')).toBe('true');
 expect(within(view.container.querySelector('section:not([hidden])')!).getByLabelText('Release Alpha note')).toBeTruthy();
});
it('gives each visible workspace its navigation label without creating execution or approval controls',()=>{
 const view=render(h(FocusedReleaseWorkspace,{items,children:item=>h('p',null,item.title+' context')}));
 const button=screen.getByRole('button',{name:/Release Alpha/});const panel=view.container.querySelector('section:not([hidden])');
 expect(panel?.getAttribute('id')).toBe(button.getAttribute('aria-controls'));expect(panel?.getAttribute('aria-labelledby')).toBe(button.id);
 expect(within(screen.getByRole('navigation',{name:'Select a release'})).getAllByRole('button')).toHaveLength(2);
});

it('navigates releases by keyboard without losing drafts or introducing action controls',()=>{
 const view=render(h(FocusedReleaseWorkspace,{items,children:item=>h(Draft,{name:item.title})}));
 const first=screen.getByRole('button',{name:/Release Alpha/}),second=screen.getByRole('button',{name:/Release Beta/});
 fireEvent.change(screen.getByLabelText('Release Alpha note'),{target:{value:'keep this draft'}});
 expect(first.tabIndex).toBe(0);expect(second.tabIndex).toBe(-1);
 first.focus();fireEvent.keyDown(first,{key:'ArrowDown'});
 expect(document.activeElement).toBe(second);expect(second.getAttribute('aria-current')).toBe('true');
 expect(first.tabIndex).toBe(-1);expect(second.tabIndex).toBe(0);
 fireEvent.keyDown(second,{key:'Home'});expect(document.activeElement).toBe(first);
 fireEvent.keyDown(first,{key:'End'});expect(document.activeElement).toBe(second);
 fireEvent.keyDown(second,{key:'ArrowRight'});expect(document.activeElement).toBe(first);
 expect((screen.getByLabelText('Release Alpha note') as HTMLInputElement).value).toBe('keep this draft');
 expect(view.container.querySelectorAll('section:not([hidden])')).toHaveLength(1);
 expect(within(screen.getByRole('navigation',{name:'Select a release'})).getAllByRole('button')).toHaveLength(2);
});
it('leaves modified browser shortcuts and ordinary typing alone',()=>{
 render(h(FocusedReleaseWorkspace,{items,children:item=>h(Draft,{name:item.title})}));
 const first=screen.getByRole('button',{name:/Release Alpha/});first.focus();
 fireEvent.keyDown(first,{key:'ArrowRight',metaKey:true});fireEvent.keyDown(first,{key:'b'});
 expect(document.activeElement).toBe(first);expect(first.getAttribute('aria-current')).toBe('true');
});

it.each(['ArrowDown','ArrowRight','ArrowUp','ArrowLeft','Home','End'].flatMap(key=>[{key,isComposing:true},{key,keyCode:229}]))('keeps release selection, draft and focus for a composing navigation key (%j)',signal=>{
 const view=render(h(FocusedReleaseWorkspace,{items,children:item=>h(Draft,{name:item.title})}));
 const selected=screen.getByRole('button',{name:signal.key==='Home'?/Release Beta/:/Release Alpha/});
 fireEvent.click(selected);const name=signal.key==='Home'?'Release Beta note':'Release Alpha note';
 const input=screen.getByLabelText(name);fireEvent.change(input,{target:{value:'未確定 release draft'}});selected.focus();
 const event=new KeyboardEvent('keydown',{bubbles:true,cancelable:true,...signal});fireEvent(selected,event);
 expect(event.defaultPrevented).toBe(false);expect(document.activeElement).toBe(selected);expect(selected.getAttribute('aria-current')).toBe('true');
 expect(screen.getByLabelText(name)).toBe(input);expect(input).toHaveProperty('value','未確定 release draft');
 expect(view.container.querySelector('section:not([hidden])')?.getAttribute('aria-labelledby')).toBe(selected.id);
});

it('filters loaded requests and keeps the exact selected draft mounted', () => {
 const view=render(h(FocusedReleaseWorkspace,{items,children:item=>h(Draft,{name:item.title})}));
 fireEvent.click(screen.getByRole('button',{name:/Release Alpha/}));
 const draft=screen.getByLabelText('Release Alpha note');
 fireEvent.change(draft,{target:{value:'Exact review text'}});
 const search=screen.getByRole('searchbox',{name:'Search loaded releases'});
 fireEvent.change(search,{target:{value:'beta'}});
 expect(screen.queryByRole('button',{name:/Release Alpha/})).toBeNull();
 expect(view.container.querySelector('section:not([hidden])')).toBeNull();
 const beta=screen.getByRole('button',{name:/Release Beta/});
 expect(beta.tabIndex).toBe(0);expect(beta.hasAttribute('aria-current')).toBe(false);
 expect(draft).toHaveProperty('value','Exact review text');
 fireEvent.change(search,{target:{value:''}});
 expect(screen.getByRole('button',{name:/Release Alpha/}).getAttribute('aria-current')).toBe('true');
 fireEvent.click(screen.getByRole('button',{name:'Drafts'}));
 expect(screen.queryByRole('button',{name:/Release Alpha/})).toBeNull();
 expect(screen.getByRole('button',{name:/Release Beta/})).toBeTruthy();
});

it('reveals and focuses an exact return even when a loaded-only filter hides it', () => {
 const children=(item:ReleaseWorkspaceItem)=>h(Draft,{name:item.title});
 const view=render(h(FocusedReleaseWorkspace,{items,children}));
 fireEvent.change(screen.getByRole('combobox',{name:'Filter loaded releases by environment'}),{target:{value:'Staging'}});
 expect(screen.queryByRole('button',{name:/Release Alpha/})).toBeNull();
 view.rerender(h(FocusedReleaseWorkspace,{items,children,requestedRelease:{id:'a'},requestedReleaseAvailable:true}));
 const alpha=screen.getByRole('button',{name:/Release Alpha/});
 expect(alpha.getAttribute('aria-current')).toBe('true');
 expect(document.activeElement).toBe(alpha);
});

it("enters the inline details, closes to the selected row, and preserves its draft on reopening", () => {
 render(h(FocusedReleaseWorkspace, {items, children: (item, closeButton) => h("div", null, closeButton, h(Draft, {name: item.title}))}));
 const row = screen.getByRole("button", {name: /Release Alpha/});
 fireEvent.click(row);
 const panel = document.getElementById(row.getAttribute("aria-controls")!)!;
 expect(document.activeElement).toBe(panel);
 const input = within(panel).getByRole("textbox");
 fireEvent.change(input, {target: {value: "Retained note"}});
 expect(fireEvent.keyDown(input, {key: "Escape"})).toBe(true);
 fireEvent.keyDown(panel, {key: "Escape"});
 expect(document.activeElement).toBe(row);
 expect(row.getAttribute("aria-current")).toBe("true");
 expect(row.getAttribute("aria-expanded")).toBe("false");
 expect(panel.hidden).toBe(true);
 fireEvent.click(row);
 expect(document.activeElement).toBe(panel);
 expect(input).toHaveProperty("value", "Retained note");
 fireEvent.click(within(panel).getByRole("button", {name: "Close release details"}));
 expect(document.activeElement).toBe(row);
});

it("focuses loaded-release search only while its shortcut is active", () => {
 const children = () => h("p", null, "Release details");
 const view = render(h(FocusedReleaseWorkspace, {items, children}));
 const row = screen.getByRole("button", {name: /Release Alpha/});
 const search = screen.getByRole("searchbox", {name: "Search loaded releases"});
 row.focus();
 expect(fireEvent.keyDown(row, {key: "/"})).toBe(false);
 expect(document.activeElement).toBe(search);
 expect(search.getAttribute("aria-keyshortcuts")).toBe("/");
 expect(fireEvent.keyDown(search, {key: "/"})).toBe(true);
 view.rerender(h(FocusedReleaseWorkspace, {items, children, searchShortcutActive: false}));
 row.focus();
 expect(fireEvent.keyDown(row, {key: "/"})).toBe(true);
 expect(document.activeElement).toBe(row);
 expect(search.hasAttribute("aria-keyshortcuts")).toBe(false);
});

const pagedItems = Array.from({length: 14}, (_, index): ReleaseWorkspaceItem => ({
  ...items[0], id: `release-${index + 1}`, title: `Release ${index + 1}`, version: index + 1,
  environment: index > 9 ? "Staging" : "Production",
}));
const draftPanel = (item: ReleaseWorkspaceItem) => h(Draft, {name: item.title});

it("pages the loaded results, searches every loaded page and retains the exact draft", () => {
  render(h(FocusedReleaseWorkspace, {items: pagedItems, children: draftPanel}));
  const directory = within(screen.getByRole("navigation", {name: "Select a release"}));
  const pageButtons = within(screen.getByRole("navigation", {name: "Release pages"}));
  expect(directory.getAllByRole("button")).toHaveLength(6);
  expect(screen.getByText("Showing 1–6 of 14 loaded releases")).toBeTruthy();
  fireEvent.click(directory.getByRole("button", {name: /^Release 1 Version/}));
  const draft = screen.getByLabelText("Release 1 note");
  fireEvent.change(draft, {target: {value: "Exact unsaved review"}});

  const next = pageButtons.getByRole("button", {name: "Next release page"});
  next.focus();
  fireEvent.click(next);
  expect(document.activeElement).toBe(next);
  expect(screen.getByText("Showing 7–12 of 14 loaded releases")).toBeTruthy();
  expect(directory.queryByRole("button", {name: /^Release 1 Version/})).toBeNull();
  fireEvent.click(next);
  expect(next.getAttribute("aria-disabled")).toBe("true");
  fireEvent.click(next);
  expect(document.activeElement).toBe(next);
  expect(screen.getByText("Showing 13–14 of 14 loaded releases")).toBeTruthy();

  const search = screen.getByRole("searchbox", {name: "Search loaded releases"});
  search.focus();
  fireEvent.change(search, {target: {value: "release-11"}});
  expect(screen.getByText("Showing 1 of 1 match in 14 loaded releases")).toBeTruthy();
  expect(directory.getByRole("button", {name: /^Release 11 Version/})).toBeTruthy();
  expect(document.activeElement).toBe(search);

  fireEvent.change(search, {target: {value: ""}});
  expect(screen.getByLabelText("Release 1 note")).toBe(draft);
  expect(draft).toHaveProperty("value", "Exact unsaved review");
  fireEvent.click(pageButtons.getByRole("button", {name: "Release page 2 of 3"}));
  fireEvent.change(screen.getByRole("combobox", {name: "Filter loaded releases by environment"}), {target: {value: "Staging"}});
  expect(screen.getByText("Showing 1–4 of 4 matches in 14 loaded releases")).toBeTruthy();
});

it("reveals a saved release on its verified page and keeps its row focused when it moves", () => {
  const link = {id: "release-14"};
  const view = render(h(FocusedReleaseWorkspace, {items: pagedItems, children: draftPanel}));
  fireEvent.change(screen.getByRole("searchbox", {name: "Search loaded releases"}), {target: {value: "production"}});
  view.rerender(h(FocusedReleaseWorkspace, {items: pagedItems, children: draftPanel, requestedRelease: link, requestedReleaseAvailable: true}));
  const row = screen.getByRole("button", {name: /^Release 14 Version/});
  expect(document.activeElement).toBe(row);
  expect(row.getAttribute("aria-current")).toBe("true");
  expect(screen.getByText("Showing 13–14 of 14 loaded releases")).toBeTruthy();
  const reordered = [pagedItems[13], ...pagedItems.slice(0, 13)];
  view.rerender(h(FocusedReleaseWorkspace, {items: reordered, children: draftPanel, requestedRelease: link, requestedReleaseAvailable: true}));
  expect(document.activeElement).toBe(row);
  expect(screen.getByText("Showing 1–6 of 14 loaded releases")).toBeTruthy();

  view.rerender(h(FocusedReleaseWorkspace, {items: reordered, children: draftPanel, requestedRelease: link, requestedReleaseAvailable: false}));
  expect(row.hasAttribute("aria-current")).toBe(false);
  expect(view.container.querySelector("section:not([hidden])")).toBeNull();
});

it("leaves focus to the requested section when opening a deep link", () => {
  const children = () => h("p", null, "Release details");

  const view = render(h(FocusedReleaseWorkspace, {items,children}));
  const search = screen.getByRole("searchbox", {name:"Search loaded releases"});
  search.focus();
  view.rerender(h(FocusedReleaseWorkspace, {
    items,children,requestedRelease:{id:"a"},requestedReleaseAvailable:true,focusRequestedRow:false,
  }));
  expect(screen.getByRole("button",{name:/Release Alpha/}).getAttribute("aria-current")).toBe("true");
  expect(document.activeElement).toBe(search);
});

it("shows recent age at the directory snapshot and preserves the exact timestamp for assistive technology", () => {
  const observedAt = new Date("2026-11-17T10:35:00.000Z");
  const updatedAt = "2026-11-17T10:25:00.000Z";
  const future = "2026-11-17T10:36:00.000Z";
  const view = render(h(FocusedReleaseWorkspace, {
    items: [{...items[0], updatedAt}, {...items[1], updatedAt: future}],
    observedAt, children: () => null,
  }));
  const recent = within(screen.getByRole("button", {name: /Release Alpha/}));
  expect(recent.getByText("10 minutes ago").getAttribute("aria-hidden")).toBe("true");
  const exact = new Date(updatedAt).toLocaleString();
  expect(recent.getByText("Updated " + exact).closest("time")?.getAttribute("datetime")).toBe(updatedAt);
  expect(screen.getByRole("button", {name: /Release Alpha/}).getAttribute("aria-label")).toBeNull();
  const futureTime = within(screen.getByRole("button", {name: /Release Beta/})).getByText("Updated " + new Date(future).toLocaleString()).closest("time");
  expect(futureTime?.querySelector('[aria-hidden="true"]')?.textContent).not.toMatch(/ago|Just now/);
  view.rerender(h(FocusedReleaseWorkspace, {
    items: [{...items[0], updatedAt}], observedAt: new Date("2026-11-18T10:35:00.000Z"), children: () => null,
  }));
  expect(screen.queryByText("10 minutes ago")).toBeNull();
});
