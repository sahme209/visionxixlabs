import { describe, it, expect } from "vitest";
import { isAirflowDeploymentUrl } from "../../../desktop/src/lib/airflowConnectionUrl";
import { readFileSync } from "node:fs";
describe("Airflow native connect form",()=>{
 it.each(["https://airflow.example.com","https://airflow.example.com/","https://fixture.astronomer.run/dj0fo7dy"," https://fixture.astronomer.run/dj0fo7dy/ "])("enables supported endpoint %s",url=>expect(isAirflowDeploymentUrl(url)).toBe(true));
 it.each(["http://airflow.example.com","https://user:pass@airflow.example.com","https://airflow.example.com/api/v2","https://airflow.example.com/home","https://airflow.example.com/a/../b","https://airflow.example.com/%2fb","https://airflow.example.com/a?next=b","https://airflow.example.com/a#b", "https://airflow.example.com/a/b"])("rejects unsupported endpoint %s",url=>expect(isAirflowDeploymentUrl(url)).toBe(false));
 it("connect eligibility uses the tested deployment validator",()=>{
  const source=readFileSync(new URL('../../../desktop/src/views/AirflowAutomationView.tsx',import.meta.url),'utf8');
  expect(source).toContain('const canConnect = isAirflowDeploymentUrl(baseUrl)');
  expect(source).toContain('Airflow HTTPS deployment URL');
 });
});
