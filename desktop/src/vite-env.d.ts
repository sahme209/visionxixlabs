/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "microsoft_store" for the Microsoft Store (MSIX) build; unset for direct downloads. */
  readonly VITE_V19_DISTRIBUTION?: string;
}
