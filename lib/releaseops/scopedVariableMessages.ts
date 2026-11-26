/** Client-safe text for scoped variable validation (no Node APIs). */
export const MAX_VARIABLE_VALUE = 4096;
export type VariableInputError =
  | "key_invalid" | "value_too_long" | "value_has_control_characters"
  | "looks_like_secret_key" | "looks_like_secret_value" | "scope_invalid" | "description_too_long";

export const VARIABLE_ERROR_TEXT: Record<VariableInputError, string> = {
  key_invalid: "Use an uppercase name with letters, digits and underscores, starting with a letter (for example API_BASE_URL).",
  value_too_long: `Values are limited to ${MAX_VARIABLE_VALUE} characters.`,
  value_has_control_characters: "Values cannot contain control characters.",
  looks_like_secret_key: "This name looks like a secret. Store secrets as scoped credentials instead.",
  looks_like_secret_value: "This value looks like a credential. Store it as a scoped credential instead.",
  scope_invalid: "Choose the workspace or an existing environment.",
  description_too_long: "Descriptions are limited to 500 characters.",
};
