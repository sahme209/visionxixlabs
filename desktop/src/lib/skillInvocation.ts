import { parseSkillInvocation } from "../../../lib/axiom/agentRuntime/skillCatalog";
/** Explicit composer edit only: the service independently verifies installation and tools. */
export function selectSkillInvocation(message: string, skillId: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skillId)) return message;
  const body = parseSkillInvocation(message)
    ? message.replace(/^\s*\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\s|$)/i, "") : message;
  return `/${skillId} ${body}`;
}
