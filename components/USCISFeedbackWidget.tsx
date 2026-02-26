"use client";

import { useState } from "react";
import { HandThumbUpIcon, HandThumbDownIcon } from "@heroicons/react/24/outline";

/**
 * USCIS-style "Was this page helpful?" feedback widget
 * Matches official USCIS.gov feedback component
 */
export default function USCISFeedbackWidget() {
  const [feedback, setFeedback] = useState<"helpful" | "not-helpful" | null>(null);
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleFeedback = (value: "helpful" | "not-helpful") => {
    setFeedback(value);
  };

  const handleSubmit = () => {
    // In a real implementation, this would send to analytics/backend
    console.log("Feedback submitted:", { feedback, reason, comment });
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="border-t border-[var(--border-color)] pt-6 mt-8">
        <p className="text-sm text-[var(--text-secondary)]">
          Thank you for your feedback. Your input helps us improve our services.
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-[var(--border-color)] pt-6 mt-8">
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
        Was this page helpful?
      </h3>
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={() => handleFeedback("helpful")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md border transition-colors ${
            feedback === "helpful"
              ? "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300"
              : "bg-[var(--bg-surface)] border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--uscis-blue)]/40"
          }`}
          aria-label="Yes, this page was helpful"
        >
          <HandThumbUpIcon className="w-5 h-5" />
          <span className="text-sm font-medium">Yes</span>
        </button>
        <button
          onClick={() => handleFeedback("not-helpful")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md border transition-colors ${
            feedback === "not-helpful"
              ? "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300"
              : "bg-[var(--bg-surface)] border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--uscis-blue)]/40"
          }`}
          aria-label="No, this page was not helpful"
        >
          <HandThumbDownIcon className="w-5 h-5" />
          <span className="text-sm font-medium">No</span>
        </button>
      </div>

      {feedback === "not-helpful" && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
              This page was not helpful because the content:
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md bg-[var(--bg-surface)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)] focus:border-transparent"
            >
              <option value="">Select a reason</option>
              <option value="too-little">has too little information</option>
              <option value="too-much">has too much information</option>
              <option value="confusing">is confusing</option>
              <option value="out-of-date">is out of date</option>
              <option value="other">other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
              How can the content be improved?
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Please provide specific suggestions..."
              className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md bg-[var(--bg-surface)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)] focus:border-transparent resize-none"
            />
            <p className="text-xs text-[var(--text-tertiary)] mt-1">
              {comment.length} / 2000
            </p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">
              To protect your privacy, please do not include any personal information in your feedback.
            </p>
          </div>
          <button
            onClick={handleSubmit}
            className="uscis-button text-sm"
          >
            Submit Feedback
          </button>
        </div>
      )}

      {feedback === "helpful" && (
        <button
          onClick={handleSubmit}
          className="uscis-button text-sm"
        >
          Submit Feedback
        </button>
      )}
    </div>
  );
}
