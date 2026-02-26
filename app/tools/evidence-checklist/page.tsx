"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import FormIcon from "@/components/FormIcon";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { HERO_IMAGES } from "@/lib/images";

interface ChecklistItem {
  id: string;
  category: string;
  title: string;
  description: string;
  isRequired: boolean;
}

type FormType = "I-130" | "I-485" | "I-129F" | "I-765";

const checklistData: Record<FormType, ChecklistItem[]> = {
  "I-130": [
    { id: "i130-1", category: "Forms", title: "Form I-130, Petition for Alien Relative", description: "Completed and signed original form", isRequired: true },
    { id: "i130-2", category: "Forms", title: "Form G-1145, E-Notification", description: "Optional - for email/text notifications", isRequired: false },
    { id: "i130-3", category: "Petitioner Documents", title: "Proof of U.S. Citizenship or LPR Status", description: "Birth certificate, passport, naturalization certificate, or green card", isRequired: true },
    { id: "i130-4", category: "Petitioner Documents", title: "Proof of Identity", description: "Government-issued photo ID (driver's license or passport)", isRequired: true },
    { id: "i130-5", category: "Beneficiary Documents", title: "Beneficiary's Birth Certificate", description: "Original or certified copy with translation if not in English", isRequired: true },
    { id: "i130-6", category: "Beneficiary Documents", title: "Beneficiary's Passport", description: "Copy of biographical page", isRequired: true },
    { id: "i130-7", category: "Relationship Evidence", title: "Marriage Certificate", description: "If petitioning spouse - original or certified copy", isRequired: true },
    { id: "i130-8", category: "Relationship Evidence", title: "Proof of Bona Fide Marriage", description: "Photos, joint accounts, lease/mortgage, insurance, etc.", isRequired: true },
    { id: "i130-9", category: "Relationship Evidence", title: "Birth Certificates of Children", description: "If petitioning children - original or certified copies", isRequired: false },
    { id: "i130-10", category: "Photos", title: "Passport Photos", description: "Two identical color photos of beneficiary (2x2 inches)", isRequired: true },
    { id: "i130-11", category: "Fees", title: "Filing Fee", description: "Check or money order payable to U.S. Department of Homeland Security", isRequired: true },
    { id: "i130-12", category: "Additional", title: "Cover Letter", description: "Optional but recommended - summarizes your package", isRequired: false },
    { id: "i130-13", category: "Additional", title: "Evidence of Legal Name Change", description: "If applicable - court order or marriage certificate", isRequired: false },
  ],
  "I-485": [
    { id: "i485-1", category: "Forms", title: "Form I-485, Application to Register Permanent Residence", description: "Completed and signed original form", isRequired: true },
    { id: "i485-2", category: "Forms", title: "Form I-864, Affidavit of Support", description: "If required - completed by sponsor", isRequired: true },
    { id: "i485-3", category: "Forms", title: "Form I-693, Medical Examination", description: "Completed by civil surgeon in sealed envelope", isRequired: true },
    { id: "i485-4", category: "Forms", title: "Form G-1145, E-Notification", description: "Optional - for email/text notifications", isRequired: false },
    { id: "i485-5", category: "Identity Documents", title: "Birth Certificate", description: "Original or certified copy with translation if not in English", isRequired: true },
    { id: "i485-6", category: "Identity Documents", title: "Passport", description: "Copy of biographical page and all pages with visas/stamps", isRequired: true },
    { id: "i485-7", category: "Identity Documents", title: "Government-Issued Photo ID", description: "Driver's license or other valid ID", isRequired: true },
    { id: "i485-8", category: "Immigration Documents", title: "Proof of Lawful Entry", description: "I-94, admission stamp, or other entry document", isRequired: true },
    { id: "i485-9", category: "Immigration Documents", title: "Form I-797 Approval Notice", description: "If adjusting based on approved petition", isRequired: true },
    { id: "i485-10", category: "Photos", title: "Passport Photos", description: "Two identical color photos (2x2 inches)", isRequired: true },
    { id: "i485-11", category: "Fees", title: "Filing Fee", description: "Check or money order payable to U.S. Department of Homeland Security", isRequired: true },
    { id: "i485-12", category: "Additional", title: "Biometrics Appointment Notice", description: "Will be scheduled after filing", isRequired: false },
  ],
  "I-129F": [
    { id: "i129f-1", category: "Forms", title: "Form I-129F, Petition for Alien Fiancé(e)", description: "Completed and signed original form", isRequired: true },
    { id: "i129f-2", category: "Forms", title: "Form G-1145, E-Notification", description: "Optional - for email/text notifications", isRequired: false },
    { id: "i129f-3", category: "Petitioner Documents", title: "Proof of U.S. Citizenship", description: "Birth certificate, passport, or naturalization certificate", isRequired: true },
    { id: "i129f-4", category: "Beneficiary Documents", title: "Beneficiary's Passport", description: "Copy of biographical page", isRequired: true },
    { id: "i129f-5", category: "Beneficiary Documents", title: "Beneficiary's Birth Certificate", description: "Original or certified copy with translation if not in English", isRequired: true },
    { id: "i129f-6", category: "Relationship Evidence", title: "Evidence of Meeting in Person", description: "Photos together, travel documents, receipts, etc.", isRequired: true },
    { id: "i129f-7", category: "Relationship Evidence", title: "Evidence of Ongoing Relationship", description: "Photos, emails, chat logs, phone records, etc.", isRequired: true },
    { id: "i129f-8", category: "Relationship Evidence", title: "Proof of Intent to Marry", description: "Statements from both parties, wedding plans, etc.", isRequired: true },
    { id: "i129f-9", category: "Photos", title: "Passport Photos", description: "Two identical color photos of each person (2x2 inches)", isRequired: true },
    { id: "i129f-10", category: "Fees", title: "Filing Fee", description: "Check or money order payable to U.S. Department of Homeland Security", isRequired: true },
    { id: "i129f-11", category: "Additional", title: "Proof of Termination of Prior Marriages", description: "Divorce decrees or death certificates if applicable", isRequired: true },
    { id: "i129f-12", category: "Additional", title: "Police Clearance Certificates", description: "May be required depending on country", isRequired: false },
  ],
  "I-765": [
    { id: "i765-1", category: "Forms", title: "Form I-765, Application for Employment Authorization", description: "Completed and signed original form", isRequired: true },
    { id: "i765-2", category: "Forms", title: "Form G-1145, E-Notification", description: "Optional - for email/text notifications", isRequired: false },
    { id: "i765-3", category: "Identity Documents", title: "Passport", description: "Copy of biographical page", isRequired: true },
    { id: "i765-4", category: "Identity Documents", title: "Birth Certificate", description: "Copy with translation if not in English", isRequired: true },
    { id: "i765-5", category: "Immigration Documents", title: "I-94 Arrival/Departure Record", description: "If available", isRequired: true },
    { id: "i765-6", category: "Immigration Documents", title: "Previous EAD Card", description: "If renewing - copy of front and back", isRequired: false },
    { id: "i765-7", category: "Photos", title: "Passport Photos", description: "Two identical color photos (2x2 inches)", isRequired: true },
    { id: "i765-8", category: "Fees", title: "Filing Fee", description: "Check or money order (may be waived if filing with I-485)", isRequired: false },
  ],
};

export default function EvidenceChecklistPage() {
  const { user } = useAuth();
  const [selectedForm, setSelectedForm] = useState<FormType>("I-130");
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user) {
      loadChecklistProgress();
    }
  }, [user, selectedForm]);

  const loadChecklistProgress = async () => {
    if (!user) return;
    try {
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const savedProgress = data[`checklist_${selectedForm}`] || [];
        setCompletedItems(new Set(savedProgress));
      }
    } catch (error) {
      console.error("Error loading checklist progress:", error);
    }
  };

  const saveChecklistProgress = async () => {
    if (!user) return;
    try {
      const docRef = doc(db, "users", user.uid);
      await setDoc(docRef, {
        [`checklist_${selectedForm}`]: Array.from(completedItems),
      }, { merge: true });
    } catch (error) {
      console.error("Error saving checklist progress:", error);
    }
  };

  const toggleItem = (itemId: string) => {
    const newCompleted = new Set(completedItems);
    if (newCompleted.has(itemId)) {
      newCompleted.delete(itemId);
    } else {
      newCompleted.add(itemId);
    }
    setCompletedItems(newCompleted);
    saveChecklistProgress();
  };

  const items = checklistData[selectedForm] || [];
  const itemsByCategory = items.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, ChecklistItem[]>);

  // Logical order: forms first, then identity docs, relationship, photos, fees, optional last
  const categoryOrder = [
    "Forms",
    "Petitioner Documents",
    "Beneficiary Documents",
    "Identity Documents",
    "Immigration Documents",
    "Relationship Evidence",
    "Photos",
    "Fees",
    "Additional",
  ];
  const categories = Object.keys(itemsByCategory).sort(
    (a, b) => {
      const ai = categoryOrder.indexOf(a);
      const bi = categoryOrder.indexOf(b);
      if (ai >= 0 && bi >= 0) return ai - bi;
      if (ai >= 0) return -1;
      if (bi >= 0) return 1;
      return a.localeCompare(b);
    }
  );

  const requiredItems = items.filter((i) => i.isRequired);
  const completedRequired = requiredItems.filter((i) => completedItems.has(i.id)).length;
  const completedCount = items.filter((i) => completedItems.has(i.id)).length;
  const totalCount = items.length;
  const requiredCount = requiredItems.length;
  const completionPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Hero Header */}
      <div className="surface-dark relative overflow-hidden bg-[var(--hero-dark)] border-b-2 border-[var(--uscis-blue)]">
        <div className="absolute inset-0 w-full">
          <Image src={HERO_IMAGES.checklist} alt="" fill className="object-cover object-center opacity-20 w-full" sizes="100vw" />
          <div className="absolute inset-0 bg-[var(--hero-dark)]/70" />
        </div>
        <div className="h-0.5 bg-gradient-to-r from-[var(--uscis-blue)] via-[var(--uscis-blue-light)] to-[var(--uscis-blue)]" aria-hidden="true" />
        <div className="relative w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-6 w-full min-w-0">
          <h1 className="text-2xl font-bold text-white">Evidence Checklist Builder</h1>
          <p className="text-sm text-white/90 mt-1">
            Track which documents you&apos;ve gathered for your {selectedForm} application
          </p>
        </div>
      </div>
      <div className="w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-8 w-full min-w-0">
        <div className="uscis-card mb-6">
          <div className="p-6">
            {/* Form Type Selector */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
                Select Form Type
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {(["I-130", "I-485", "I-129F", "I-765"] as FormType[]).map((form) => (
                  <button
                    key={form}
                    onClick={() => setSelectedForm(form)}
                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                      selectedForm === form
                        ? "border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-gray-800 dark:text-gray-200"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                  >
                    <FormIcon formId={form} size={28} />
                    <span className="font-semibold">{form}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Progress Section */}
            <div className="uscis-card mb-6">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-[var(--text-primary)]">Progress</h3>
                  <span className="text-sm font-bold text-[var(--text-primary)]">
                    {completedRequired}/{requiredCount} required • {completedCount}/{totalCount} total
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 mb-2">
                  <div
                    className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                    style={{ width: `${completionPercent}%` }}
                  ></div>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  {requiredCount > 0 ? (completedRequired / requiredCount * 100).toFixed(0) : 0}% of required items • {completionPercent.toFixed(0)}% overall
                </p>
              </div>
            </div>

            {/* Checklist by Category */}
            <div className="space-y-6">
              {categories.map((category) => (
                <div key={category} className="uscis-card">
                  <div className="p-4">
                    <h3 className="font-semibold text-[var(--text-primary)] mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
                      {category}
                    </h3>
                    <div className="space-y-3">
                      {itemsByCategory[category].map((item) => {
                        const isCompleted = completedItems.has(item.id);
                        return (
                          <label
                            key={item.id}
                            className="flex items-start gap-3 p-3 rounded-lg hover:bg-[var(--bg-surface-alt)] transition-colors cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={isCompleted}
                              onChange={() => toggleItem(item.id)}
                              className="mt-1 w-5 h-5 rounded border-gray-300 text-gray-800 dark:text-gray-200 focus:ring-blue-500"
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className={`font-medium ${isCompleted ? "line-through text-[var(--text-secondary)]" : "text-[var(--text-primary)]"}`}>
                                  {item.title}
                                </span>
                                {item.isRequired && (
                                  <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded">
                                    Required
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-[var(--text-secondary)] mt-1">
                                {item.description}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Copy Checklist */}
            <div className="mt-6">
              <button
                onClick={async () => {
                  const completed = items.filter((item) => completedItems.has(item.id));
                  const pending = items.filter((item) => !completedItems.has(item.id));
                  const exportText = `${selectedForm} Evidence Checklist\n\n✓ Completed (${completed.length}):\n${completed.map((item) => `  • ${item.title}`).join("\n")}\n\n○ Pending (${pending.length}):\n${pending.map((item) => `  • ${item.title}`).join("\n")}`;
                  await navigator.clipboard.writeText(exportText);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="uscis-button w-full"
              >
                {copied ? "Copied to clipboard!" : "Copy Checklist"}
              </button>
            </div>

            {!user && (
              <p className="mt-4 text-xs text-[var(--text-secondary)]">
                Sign in to save your progress across devices.
              </p>
            )}

            <div className="mt-6">
              <Link href="/tools/case-tools" className="uscis-link text-sm font-semibold">
                ← Back to Case Tools
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

