"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import BackToHelpCenterLink from "@/components/BackToHelpCenterLink";
import { interviewQAPairs, questionsByCategory, categories } from "@/lib/data/interview-prep-data";
import { InterviewQAPair } from "@/lib/types/help-center";
import React from "react";
import { ChevronRightIcon, CheckCircleIcon, LightBulbIcon, ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline";
import { CheckCircleIcon as CheckCircleIconSolid, ExclamationTriangleIcon, ShieldCheckIcon, UsersIcon, BookOpenIcon } from "@heroicons/react/24/solid";
import { HERO_IMAGES, SECTION_IMAGES } from "@/lib/images";

export default function InterviewPrepPage() {
  const [viewedQuestions, setViewedQuestions] = useState<Set<number>>(new Set());
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());
  const [notes, setNotes] = useState("");

  // Load from localStorage on mount
  useEffect(() => {
    const savedViewed = localStorage.getItem("interviewPrepViewedQuestions");
    const savedNotes = localStorage.getItem("interviewPrepNotes");
    
    if (savedViewed) {
      try {
        const parsed = JSON.parse(savedViewed);
        setViewedQuestions(new Set(parsed));
      } catch (e) {
        // Ignore parse errors
      }
    }
    
    if (savedNotes) {
      setNotes(savedNotes);
    }
  }, []);

  // Save viewed questions to localStorage
  const toggleQuestionViewed = (id: number) => {
    const newViewed = new Set(viewedQuestions);
    if (newViewed.has(id)) {
      newViewed.delete(id);
    } else {
      newViewed.add(id);
    }
    setViewedQuestions(newViewed);
    localStorage.setItem("interviewPrepViewedQuestions", JSON.stringify(Array.from(newViewed)));
  };

  // Toggle question expansion
  const toggleQuestionExpanded = (id: number) => {
    const newExpanded = new Set(expandedQuestions);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedQuestions(newExpanded);
  };

  // Save notes to localStorage
  useEffect(() => {
    if (notes !== undefined) {
      localStorage.setItem("interviewPrepNotes", notes);
    }
  }, [notes]);

  const readinessProgress = interviewQAPairs.length > 0 
    ? viewedQuestions.size / interviewQAPairs.length 
    : 0;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Hero Header */}
      <div className="surface-dark relative overflow-hidden bg-[var(--hero-dark)] border-b-2 border-[var(--uscis-blue)]">
        <div className="absolute inset-0 w-full">
          <Image src={HERO_IMAGES.embassy} alt="" fill className="object-cover object-center opacity-20 w-full" sizes="100vw" />
          <div className="absolute inset-0 bg-[var(--hero-dark)]/70" />
        </div>
        <div className="h-0.5 bg-gradient-to-r from-[var(--uscis-blue)] via-[var(--uscis-blue-light)] to-[var(--uscis-blue)]" aria-hidden="true" />
        <div className="relative w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-6 w-full min-w-0">
          <h1 className="text-2xl font-bold text-white mb-2">Interview Preparation</h1>
          <p className="text-sm text-white/90">Practice common questions and prepare for your USCIS interview</p>
        </div>
      </div>
      <div className="w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-8 space-y-6 w-full min-w-0">
        {/* Header Section */}
        <div className="uscis-card p-5 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.05]">
            <Image src={SECTION_IMAGES.embassy} alt="" fill className="object-cover" sizes="600px" />
          </div>
          <div className="relative">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
            Immigration Interview Preparation
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mb-4 leading-relaxed">
            Comprehensive preparation tool for USCIS interviews. Practice common questions, review required documentation, and prepare for your interview appointment. This tool covers interviews for Adjustment of Status (I-485), Consular Processing (I-130), and Fiancé Visas (I-129F).
          </p>
          <div className="flex items-start gap-2 p-2.5 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <ExclamationTriangleIcon className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs font-medium text-red-600 dark:text-red-400">
              Important: Bring all original documents and copies to your interview. Arrive 15 minutes early. Dress professionally.
            </p>
          </div>
          </div>
        </div>

        {/* Readiness Section */}
        <div className="uscis-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShieldCheckIcon className="w-4 h-4 text-[var(--text-primary)]" />
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Interview Preparation Status
              </h3>
            </div>
            <span className="text-xs font-semibold text-[var(--text-secondary)]">
              {viewedQuestions.size} / {interviewQAPairs.length} Reviewed
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
            <div
              className="bg-[var(--uscis-blue)] h-2 rounded-full transition-all duration-300"
              style={{ width: `${readinessProgress * 100}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-secondary)]">
              {Math.round(readinessProgress * 100)}% Preparation Complete
            </span>
            {readinessProgress >= 1.0 && (
              <span className="text-xs font-semibold text-green-600 dark:text-green-400 flex items-center gap-1">
                ✓ Ready for Interview
              </span>
            )}
          </div>
        </div>

        {/* Practice Mode Section */}
        <div className="uscis-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <UsersIcon className="w-4 h-4 text-[var(--text-primary)]" />
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Interview Practice Tools
            </h3>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mb-4">
            Prepare for your USCIS interview with interactive practice sessions. Review common questions, practice responses, and build confidence for your appointment.
          </p>
          <div className="space-y-3">
            <Link
              href="/help/question-review"
              className="flex items-center gap-4 p-4 bg-[var(--bg-surface)] rounded-2xl border-[var(--border-color)] hover:shadow-lg transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-[var(--bg-surface-alt)] flex items-center justify-center">
                <BookOpenIcon className="w-6 h-6 text-[var(--text-primary)]" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                  Question Review
                </h4>
                <p className="text-xs text-[var(--text-secondary)]">
                  Study common USCIS interview questions and approved responses
                </p>
              </div>
              <ChevronRightIcon className="w-4 h-4 text-[var(--text-tertiary)]" />
            </Link>
            <Link
              href="/help/mock-interview"
              className="flex items-center gap-4 p-4 bg-[var(--bg-surface)] rounded-2xl border-[var(--border-color)] hover:shadow-lg transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-[var(--bg-surface-alt)] flex items-center justify-center">
                <UsersIcon className="w-6 h-6 text-[var(--text-primary)]" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                  Practice Interview Session
                </h4>
                <p className="text-xs text-[var(--text-secondary)]">
                  Simulate a USCIS interview to practice your responses
                </p>
              </div>
              <ChevronRightIcon className="w-4 h-4 text-[var(--text-tertiary)]" />
            </Link>
          </div>
        </div>

        {/* Questions Section */}
        <div className="space-y-5">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-[var(--text-primary)] mb-2">
              Question Bank
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Tap any question to see the answer and tips
            </p>
          </div>

          {categories.map((category) => (
            <div key={category} className="uscis-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-[var(--text-primary)]">
                  {category}
                </h3>
                <span className="text-xs text-[var(--text-secondary)] px-2 py-1 bg-[var(--bg-surface-alt)] rounded-full">
                  {questionsByCategory[category]?.length || 0}
                </span>
              </div>
              <div className="space-y-2.5">
                {questionsByCategory[category]?.map((pair) => (
                  <QuestionCard
                    key={pair.id}
                    pair={pair}
                    isViewed={viewedQuestions.has(pair.id)}
                    isExpanded={expandedQuestions.has(pair.id)}
                    onToggleViewed={() => toggleQuestionViewed(pair.id)}
                    onToggleExpanded={() => toggleQuestionExpanded(pair.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Notes Section */}
        <div className="uscis-card p-5">
          <h3 className="text-base font-semibold text-[var(--text-primary)] mb-2">
            Your Notes
          </h3>
          <p className="text-xs text-[var(--text-secondary)] mb-3">
            Write down important points, personal answers, or reminders for your interview
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Write your interview notes here...&#10;&#10;• Personal answers to common questions&#10;• Documents to bring&#10;• Questions to ask&#10;• Important reminders"
            className="w-full min-h-[150px] p-2 text-sm text-[var(--text-primary)] bg-[var(--bg-surface)] border-[var(--border-color)] rounded-xl resize-y focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)]"
          />
        </div>

        {/* Back Link */}
        <div className="pt-4">
          <BackToHelpCenterLink className="text-sm font-semibold text-[var(--text-primary)] hover:underline" />
        </div>
      </div>
    </div>
  );
}

function QuestionCard({
  pair,
  isViewed,
  isExpanded,
  onToggleViewed,
  onToggleExpanded,
}: {
  pair: InterviewQAPair;
  isViewed: boolean;
  isExpanded: boolean;
  onToggleViewed: () => void;
  onToggleExpanded: () => void;
}) {
  return (
    <div
      className={`p-4 rounded-xl border transition-all ${
        isViewed
          ? "border-purple-400 dark:border-purple-600 bg-purple-50/50 dark:bg-purple-900/20"
          : "border-[var(--border-color)] bg-[var(--bg-surface)]"
      }`}
    >
      <div className="flex items-start gap-3.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleViewed();
          }}
          className="mt-0.5 flex-shrink-0"
        >
          {isViewed ? (
            <CheckCircleIconSolid className="w-6 h-6 text-[var(--text-primary)]" />
          ) : (
            <div className="w-6 h-6 rounded-full border-2 border-[var(--text-tertiary)]" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <button
            onClick={onToggleExpanded}
            className="w-full text-left"
          >
            <p className="text-sm font-medium text-[var(--text-primary)] leading-relaxed">
              {pair.question}
            </p>
          </button>
          {isExpanded && (
            <div className="mt-4 space-y-4 pt-4 border-t border-[var(--border-color)]">
              {/* Answer Section */}
              <div className="p-3 bg-[var(--bg-surface-alt)] rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <ChatBubbleLeftRightIcon className="w-3.5 h-3.5 text-[var(--text-primary)]" />
                  <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                    Answer
                  </span>
                </div>
                <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                  {pair.answer}
                </p>
              </div>
              {/* Tips Section */}
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <LightBulbIcon className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                  <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                    Tips
                  </span>
                </div>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  {pair.tips}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
