import {describe,expect,it} from "vitest";
import {customerViewForMenuAction} from "../../../desktop/src/lib/useNativeMenuActions";
describe("native destination routing",()=>{
 it.each([['view:axiom-bot','axiom-bot'],['view:airflow-automation','airflow-automation'],['view:plugins-skills','plugins-skills']])('routes %s to its existing workspace', (action,view)=>{expect(customerViewForMenuAction(action)).toBe(view);});
 it.each([null,{},'view:execute','view:settings','constructor'])('ignores unrecognized payload %s', value=>{expect(customerViewForMenuAction(value)).toBeNull();});
 it.each([['open_settings','settings'],['view:agent','agent'],['view:repository-workspace','repository-workspace'],['view:deployment-requests','deployment-requests'],['view:docs','docs']])('retains existing route %s',(action,view)=>{expect(customerViewForMenuAction(action)).toBe(view);});
});
