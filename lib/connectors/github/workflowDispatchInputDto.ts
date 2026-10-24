export interface WorkflowDispatchInput {
  name: string;
  type: "string" | "boolean" | "number" | "choice" | "environment";
  required: boolean;
  description: string;
  options?: string[];
  defaultValue?: string;
}
