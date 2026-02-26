"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { HERO_IMAGES } from "@/lib/images";

export default function RFEResponsePage() {
  const { user } = useAuth();
  const [hasRFE, setHasRFE] = useState(false);
  const [rfeDueDate, setRfeDueDate] = useState<Date | null>(null);
  const [coverLetter, setCoverLetter] = useState("");
  const [exhibitList, setExhibitList] = useState<string[]>([]);
  const [newExhibit, setNewExhibit] = useState("");
  const [showCoverLetterSheet, setShowCoverLetterSheet] = useState(false);
  const [showExhibitListSheet, setShowExhibitListSheet] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user) loadRFEData();
  }, [user]);

  const loadRFEData = async () => {
    if (!user) return;
    try {
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setHasRFE(data.hasRFE || false);
        if (data.rfeDueDate) setRfeDueDate(data.rfeDueDate.toDate());
        else setRfeDueDate(null);
        setCoverLetter(data.rfeCoverLetter || "");
        setExhibitList(data.rfeExhibitList || []);
      }
    } catch (error) {
      console.error("Error loading RFE data:", error);
    }
  };

  const saveRFEData = useCallback(
    async (overrides?: { hasRFE?: boolean; rfeDueDate?: Date | null; rfeCoverLetter?: string; rfeExhibitList?: string[] }) => {
      if (!user) return;
      try {
        const docRef = doc(db, "users", user.uid);
        await setDoc(
          docRef,
          {
            hasRFE: overrides?.hasRFE ?? hasRFE,
            rfeDueDate: overrides?.rfeDueDate !== undefined ? overrides.rfeDueDate : rfeDueDate,
            rfeCoverLetter: overrides?.rfeCoverLetter ?? coverLetter,
            rfeExhibitList: overrides?.rfeExhibitList ?? exhibitList,
          },
          { merge: true }
        );
      } catch (error) {
        console.error("Error saving RFE data:", error);
      }
    },
    [user, hasRFE, rfeDueDate, coverLetter, exhibitList]
  );

  const daysLeft = rfeDueDate
    ? Math.max(0, Math.ceil((rfeDueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const stepsDone =
    (rfeDueDate ? 1 : 0) +
    (exhibitList.length > 0 ? 1 : 0) +
    (coverLetter.trim().length > 0 ? 1 : 0);

  const addExhibit = (item?: string) => {
    const toAdd = (item ?? newExhibit).trim();
    if (!toAdd) return;
    const nextList = [...exhibitList, toAdd];
    setExhibitList(nextList);
    setNewExhibit("");
    saveRFEData({ rfeExhibitList: nextList });
  };

  const removeExhibit = (index: number) => {
    const nextList = exhibitList.filter((_, i) => i !== index);
    setExhibitList(nextList);
    saveRFEData({ rfeExhibitList: nextList });
  };

  const defaultCoverLetter = `[Your Name]
[Your Address]

USCIS
Re: RFE/NOID Response for Case ${user ? "[Receipt Number]" : "[Your Receipt Number]"}

Dear Officer,

This letter accompanies the response to the Request for Evidence (RFE) / Notice of Intent to Deny (NOID).

Please find enclosed the following exhibits:

${exhibitList.map((item, idx) => `Exhibit ${String.fromCharCode(65 + idx)} – ${item}`).join("\n")}

We believe the evidence provided addresses all concerns raised in the RFE/NOID notice.

Thank you for your consideration.

Respectfully,

[Your Name]
[Date]`;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Hero Header */}
      <div className="surface-dark relative overflow-hidden bg-[var(--hero-dark)] border-b-2 border-[var(--uscis-blue)]">
        <div className="absolute inset-0 w-full">
          <Image src={HERO_IMAGES.handsDocuments} alt="" fill className="object-cover object-center opacity-20 w-full" sizes="100vw" />
          <div className="absolute inset-0 bg-[var(--hero-dark)]/70" />
        </div>
        <div className="h-0.5 bg-gradient-to-r from-[var(--uscis-blue)] via-[var(--uscis-blue-light)] to-[var(--uscis-blue)]" aria-hidden="true" />
        <div className="relative w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-6 w-full min-w-0">
          <h1 className="text-2xl font-bold text-white">RFE/NOID Response</h1>
          <p className="text-sm text-white/90 mt-1">
            Draft response + exhibit list + cover letter
          </p>
        </div>
      </div>
      <div className="w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-8 w-full min-w-0">
        <div className="uscis-card mb-6">
          <div className="p-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-4">
              <p className="text-sm font-medium text-[var(--text-primary)] mb-1">How to use</p>
              <ol className="text-sm text-[var(--text-secondary)] space-y-0.5 list-decimal list-inside">
                <li>Check the box if you received an RFE/NOID and set your deadline</li>
                <li>Add exhibits (or click suggestions below)</li>
                <li>Draft your cover letter and export when ready</li>
              </ol>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg mb-6">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-sm text-[var(--text-primary)]">
                  Responses must be submitted by the deadline. This tool is for preparation only and does not constitute legal advice.
                </p>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 bg-[var(--bg-surface-alt)] rounded-lg">
                <p className="text-2xl font-bold text-[var(--text-primary)]">
                  {daysLeft !== null ? daysLeft : "—"}
                </p>
                <p className="text-xs text-[var(--text-secondary)] mt-1">Days Left</p>
                {daysLeft !== null && daysLeft <= 7 && (
                  <p className="text-[10px] font-medium text-orange-600 dark:text-orange-400 mt-0.5">Deadline soon</p>
                )}
              </div>
              <div className="text-center p-4 bg-[var(--bg-surface-alt)] rounded-lg">
                <p className="text-2xl font-bold text-[var(--text-primary)]">{exhibitList.length}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-1">Exhibits</p>
              </div>
              <div className="text-center p-4 bg-[var(--bg-surface-alt)] rounded-lg">
                <p className="text-2xl font-bold text-[var(--text-primary)]">{stepsDone}/3</p>
                <p className="text-xs text-[var(--text-secondary)] mt-1">Steps Done</p>
              </div>
            </div>

            {/* RFE Status Toggle */}
            <div className="uscis-card mb-6">
              <div className="p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasRFE}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setHasRFE(v);
                      saveRFEData({ hasRFE: v });
                    }}
                    className="w-5 h-5 rounded border-gray-300 text-gray-800 dark:text-gray-200 focus:ring-blue-500"
                  />
                  <div>
                    <p className="font-semibold text-[var(--text-primary)]">
                      I have received an RFE or NOID from USCIS
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                      Enable tracking for your response deadline and document preparation
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* RFE Due Date */}
            {hasRFE && (
              <div className="uscis-card mb-6">
                <div className="p-4">
                  <h3 className="font-semibold text-[var(--text-primary)] mb-3">Response Deadline</h3>
                  <input
                    type="date"
                    value={rfeDueDate ? rfeDueDate.toISOString().split("T")[0] : ""}
                    onChange={(e) => {
                      const date = e.target.value ? new Date(e.target.value) : null;
                      setRfeDueDate(date);
                      saveRFEData({ rfeDueDate: date });
                    }}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-[var(--bg-surface)] text-[var(--text-primary)]"
                  />
                  {rfeDueDate && (
                    <p className="text-xs text-[var(--text-secondary)] mt-2">
                      Days Left: {daysLeft}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="uscis-card mb-6">
              <div className="p-4">
                <h3 className="font-semibold text-[var(--text-primary)] mb-3">Response Preparation Tools</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button
                    onClick={() => {
                      if (!coverLetter) {
                        setCoverLetter(defaultCoverLetter);
                      }
                      setShowCoverLetterSheet(true);
                    }}
                    className="uscis-button uscis-button-secondary !text-white"
                  >
                    Cover Letter Template
                  </button>
                  <button
                    onClick={() => setShowExhibitListSheet(true)}
                    className="uscis-button uscis-button-secondary !text-white"
                  >
                    Exhibit Index
                  </button>
                  <button
                    onClick={async () => {
                      const content = `${coverLetter || defaultCoverLetter}\n\nEXHIBIT LIST:\n${exhibitList.map((item, idx) => `Exhibit ${String.fromCharCode(65 + idx)} – ${item}`).join("\n")}`;
                      await navigator.clipboard.writeText(content);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="uscis-button uscis-button-secondary !text-white relative"
                  >
                    {copied ? "Copied!" : "Export Draft"}
                  </button>
                </div>
              </div>
            </div>

            {/* Cover Letter Sheet */}
            {showCoverLetterSheet && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-[var(--bg-surface)] rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-base sm:text-lg font-semibold text-[var(--text-primary)]">Cover Letter</h3>
                      <button
                        onClick={() => setShowCoverLetterSheet(false)}
                        className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      >
                        ✕
                      </button>
                    </div>
                    <textarea
                      value={coverLetter || defaultCoverLetter}
                      onChange={(e) => setCoverLetter(e.target.value)}
                      className="w-full h-64 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-[var(--bg-surface-alt)] text-[var(--text-primary)] font-mono text-sm"
                      placeholder="Enter your cover letter..."
                    />
                    <div className="flex gap-3 mt-4">
                      <button
                        onClick={async () => {
                          const text = coverLetter || defaultCoverLetter;
                          setCoverLetter(text);
                          await saveRFEData({ rfeCoverLetter: text });
                          setShowCoverLetterSheet(false);
                        }}
                        className="uscis-button flex-1"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setShowCoverLetterSheet(false)}
                        className="uscis-button uscis-button-secondary flex-1"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Exhibit List Sheet */}
            {showExhibitListSheet && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-[var(--bg-surface)] rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-base sm:text-lg font-semibold text-[var(--text-primary)]">Exhibit List</h3>
                      <button
                        onClick={() => setShowExhibitListSheet(false)}
                        className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="flex gap-2 mb-4">
                      <input
                        type="text"
                        value={newExhibit}
                        onChange={(e) => setNewExhibit(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") addExhibit();
                        }}
                        placeholder="Add exhibit..."
                        className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-[var(--bg-surface-alt)] text-[var(--text-primary)]"
                      />
                      <button onClick={() => addExhibit()} className="uscis-button">
                        Add
                      </button>
                    </div>
                    <div className="space-y-2 mb-4">
                      {exhibitList.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-[var(--bg-surface-alt)] rounded-lg">
                          <span className="text-[var(--text-primary)]">
                            <strong>Exhibit {String.fromCharCode(65 + idx)}:</strong> {item}
                          </span>
                          <button
                            onClick={() => removeExhibit(idx)}
                            className="text-red-600 hover:text-red-700"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          saveRFEData({ rfeExhibitList: exhibitList });
                          setShowExhibitListSheet(false);
                        }}
                        className="uscis-button flex-1"
                      >
                        Done
                      </button>
                      <button
                        onClick={() => setShowExhibitListSheet(false)}
                        className="uscis-button uscis-button-secondary flex-1"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Checklist */}
            <div className="uscis-card mb-6">
              <div className="p-4">
                <h3 className="font-semibold text-[var(--text-primary)] mb-3">Quick Checklist</h3>
                <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <li className="flex items-start gap-2">
                    <span className={rfeDueDate ? "text-green-600" : "text-[var(--text-tertiary)]"}>
                      {rfeDueDate ? "✓" : "○"}
                    </span>
                    <span>Set response deadline</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className={exhibitList.length > 0 ? "text-green-600" : "text-[var(--text-tertiary)]"}>
                      {exhibitList.length > 0 ? "✓" : "○"}
                    </span>
                    <span>Add exhibits</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className={coverLetter.trim().length > 0 ? "text-green-600" : "text-[var(--text-tertiary)]"}>
                      {coverLetter.trim().length > 0 ? "✓" : "○"}
                    </span>
                    <span>Draft cover letter</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Evidence Suggestions - click to add */}
            <div className="uscis-card mb-6">
              <div className="p-4">
                <h3 className="font-semibold text-[var(--text-primary)] mb-2">Common Evidence Categories</h3>
                <p className="text-xs text-[var(--text-secondary)] mb-3">Click any item to add it to your exhibit list</p>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)] mb-2">Identity</p>
                    <ul className="text-xs text-[var(--text-secondary)] space-y-1">
                      {["Passport", "Birth Certificate", "Driver's License"].map((item) => (
                        <li
                          key={item}
                          onClick={() => {
                            addExhibit(item);
                            setShowExhibitListSheet(true);
                          }}
                          className="flex items-center gap-2 cursor-pointer hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)] rounded px-2 py-1 -mx-2 transition-colors"
                        >
                          <span className="text-[var(--text-tertiary)]">+</span> {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)] mb-2">Relationship</p>
                    <ul className="text-xs text-[var(--text-secondary)] space-y-1">
                      {["Marriage Certificate", "Joint Bank Statements", "Photos Together"].map((item) => (
                        <li
                          key={item}
                          onClick={() => {
                            addExhibit(item);
                            setShowExhibitListSheet(true);
                          }}
                          className="flex items-center gap-2 cursor-pointer hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)] rounded px-2 py-1 -mx-2 transition-colors"
                        >
                          <span className="text-[var(--text-tertiary)]">+</span> {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)] mb-2">Financial</p>
                    <ul className="text-xs text-[var(--text-secondary)] space-y-1">
                      {["Tax Returns", "Pay Stubs", "Employment Letter"].map((item) => (
                        <li
                          key={item}
                          onClick={() => {
                            addExhibit(item);
                            setShowExhibitListSheet(true);
                          }}
                          className="flex items-center gap-2 cursor-pointer hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)] rounded px-2 py-1 -mx-2 transition-colors"
                        >
                          <span className="text-[var(--text-tertiary)]">+</span> {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>

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

