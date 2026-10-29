/** @vitest-environment jsdom */
import{createElement}from"react";import{cleanup,fireEvent,render,screen}from"@testing-library/react";import{afterEach,expect,it,vi}from"vitest";import{AgentModelSelector}from"../../../desktop/src/components/AgentModelSelector";
afterEach(cleanup);
const options=[{key:"one",provider:"vercel_gateway",modelId:"xai/grok-4",label:"Grok",vendor:"xAI"},{key:"two",provider:"vercel_gateway",modelId:"openai/gpt-4o",label:"GPT",vendor:"OpenAI"}];
it("renders searchable native grouped choices and sends only an explicit selection",()=>{const change=vi.fn();render(createElement(AgentModelSelector,{options,value:"one",onChange:change,disabled:false}));expect(screen.getByRole("group",{name:"xAI"})).toBeTruthy();fireEvent.change(screen.getByRole("searchbox",{name:"Search Agent models"}),{target:{value:"openai"}});expect(screen.getByRole("option",{name:"GPT"})).toBeTruthy();expect(change).not.toHaveBeenCalled();fireEvent.change(screen.getByRole("combobox",{name:"Agent model"}),{target:{value:"two"}});expect(change).toHaveBeenCalledWith("two");});
it("disables selection while readiness is unverified",()=>{render(createElement(AgentModelSelector,{options,value:"one",onChange:vi.fn(),disabled:true}));expect((screen.getByRole("combobox",{name:"Agent model"})as HTMLSelectElement).disabled).toBe(true);});

it("labels unavailable approved choices and ignores an attempted disabled selection",()=>{
  const change=vi.fn();const blocked={...options[0],unavailableReason:"Output budget unverified"};
  render(createElement(AgentModelSelector,{options:[blocked,options[1]],value:"two",onChange:change,disabled:false}));
  expect((screen.getByRole("option",{name:"Grok · Unavailable"})as HTMLOptionElement).disabled).toBe(true);
  fireEvent.change(screen.getByRole("combobox",{name:"Agent model"}),{target:{value:"one"}});
  expect(change).not.toHaveBeenCalled();
});
