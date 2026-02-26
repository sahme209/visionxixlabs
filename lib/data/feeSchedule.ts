/**
 * Immigration filing fees — from official government schedule.
 * Verify current amounts at the official forms site before filing.
 */

export interface FeeEntry {
  formId: string;
  formName: string;
  fee: number;
  notes?: string;
}

export const feeSchedule: FeeEntry[] = [
  { formId: "I-130", formName: "Petition for Alien Relative", fee: 675 },
  { formId: "I-485", formName: "Adjustment of Status (Green Card)", fee: 1440, notes: "Includes biometrics" },
  { formId: "I-765", formName: "Employment Authorization (EAD)", fee: 0, notes: "Free when filed with I-485" },
  { formId: "I-765", formName: "Employment Authorization (standalone)", fee: 520 },
  { formId: "I-131", formName: "Travel Document / Advance Parole", fee: 0, notes: "Free when filed with I-485" },
  { formId: "I-131", formName: "Travel Document (standalone)", fee: 660 },
  { formId: "I-129F", formName: "Fiancé(e) Visa Petition", fee: 675 },
  { formId: "I-140", formName: "Employment-Based Immigrant Petition", fee: 715 },
  { formId: "I-751", formName: "Remove Conditions on Residence", fee: 760 },
  { formId: "I-90", formName: "Renew/Replace Green Card", fee: 540 },
  { formId: "N-400", formName: "Naturalization (Citizenship)", fee: 725, notes: "Includes biometrics" },
  { formId: "I-601", formName: "Waiver of Inadmissibility", fee: 930 },
  { formId: "I-601A", formName: "Provisional Unlawful Presence Waiver", fee: 630 },
  { formId: "I-821D", formName: "DACA", fee: 495 },
];

export const feeWaiverFormId = "I-912";
export const officialFormsUrl = "https://www.uscis.gov/forms/all-forms";
