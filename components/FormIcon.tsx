"use client";

/**
 * Tiny form-specific icons for USCIS immigration forms.
 * Each form gets a distinctive, recognizable image from public/form-icons/.
 */

import Image from "next/image";

export type FormId =
  | "I-130"
  | "I-485"
  | "I-129F"
  | "I-765"
  | "I-131"
  | "I-140"
  | "I-751"
  | "I-90"
  | "N-400"
  | "I-601"
  | "I-601A"
  | "I-821D"
  | "K-3"
  | "I-864"
  | "I-693"
  | string;

/** Normalize form id to canonical key (e.g. "i130", "i485") */
function toKey(id: FormId): string {
  return String(id).toLowerCase().replace(/[-\s]/g, "");
}

/** Forms with dedicated icon images in public/form-icons/ */
const FORM_ICON_KEYS = new Set([
  "i130", "i485", "i129f", "i765", "i131", "i140", "i751", "i90",
  "n400", "i601", "i601a", "i821d", "k3", "i864", "i693",
]);

interface FormIconProps {
  formId: FormId;
  className?: string;
  size?: number;
}

export default function FormIcon({ formId, className = "", size = 24 }: FormIconProps) {
  const key = toKey(formId);
  const iconName = FORM_ICON_KEYS.has(key) ? key : "default";
  const src = `/form-icons/${iconName}.svg`;

  return (
    <span
      className={`inline-flex items-center justify-center flex-shrink-0 overflow-hidden ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Image
        src={src}
        alt=""
        width={size}
        height={size}
        className="object-contain"
      />
    </span>
  );
}
