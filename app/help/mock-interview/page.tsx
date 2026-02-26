"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import BackToHelpCenterLink from "@/components/BackToHelpCenterLink";
import { interviewQAPairs } from "@/lib/data/interview-prep-data";
import { InterviewQAPair } from "@/lib/types/help-center";
import { ChevronLeftIcon, ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";

export default function MockInterviewPage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [isFinished, setIsFinished] = useState(false);
  const [showSuggestedAnswer, setShowSuggestedAnswer] = useState<Record<number, boolean>>({});

  const currentQuestion = interviewQAPairs[currentIndex];
  const progress = interviewQAPairs.length > 0 ? currentIndex / interviewQAPairs.length : 0;
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === interviewQAPairs.length - 1;

  // Load saved answer for current question
  useEffect(() => {
    const saved = userAnswers[currentQuestion?.id];
    setCurrentAnswer(saved || "");
  }, [currentIndex, currentQuestion, userAnswers]);

  const handlePrevious = () => {
    if (currentIndex > 0) {
      // Save current answer
      if (currentAnswer.trim()) {
        setUserAnswers({ ...userAnswers, [currentQuestion.id]: currentAnswer });
      }
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    // Save current answer
    if (currentAnswer.trim()) {
      setUserAnswers({ ...userAnswers, [currentQuestion.id]: currentAnswer });
    }

    if (isLast) {
      setIsFinished(true);
    } else {
      setCurrentIndex(currentIndex + 1);
      // Show suggested answer for the question we just answered
      setShowSuggestedAnswer({ ...showSuggestedAnswer, [currentQuestion.id]: true });
    }
  };

  const toggleSuggestedAnswer = (questionId: number) => {
    setShowSuggestedAnswer({
      ...showSuggestedAnswer,
      [questionId]: !showSuggestedAnswer[questionId],
    });
  };

  if (isFinished) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <div className="w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-8 w-full min-w-0">
          <div className="uscis-card p-8 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
              Interview Complete!
            </h1>
            <p className="text-[var(--text-secondary)] mb-6">
              You've completed all {interviewQAPairs.length} practice questions.
            </p>
            <div className="space-y-4">
              <Link
                href="/help/interview-prep"
                className="inline-block px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors"
              >
                Return to Interview Prep
              </Link>
              <div>
                <BackToHelpCenterLink className="text-sm text-[var(--text-primary)] hover:underline" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return null;
  }

  const savedAnswer = userAnswers[currentQuestion.id];
  const showSuggested = showSuggestedAnswer[currentQuestion.id] && savedAnswer;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Progress Bar */}
      <div className="w-full h-1 bg-gray-200 dark:bg-gray-700">
        <div
          className="h-full bg-purple-600 transition-all duration-300"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div className="w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-8 w-full min-w-0">
        {/* Question Card */}
        <div className="uscis-card p-5 mb-6">
          <p className="text-xs text-[var(--text-secondary)] mb-2">
            Question {currentIndex + 1} of {interviewQAPairs.length}
          </p>
          <p className="text-sm font-semibold text-[var(--text-primary)] mb-2">
            {currentQuestion.category}
          </p>
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">
            {currentQuestion.question}
          </h2>
        </div>

        {/* Answer Input Section */}
        <div className="uscis-card p-5 mb-6">
          <h3 className="text-base font-semibold text-[var(--text-primary)] mb-2">
            Your Answer
          </h3>
          <p className="text-xs text-[var(--text-secondary)] mb-4">
            Practice your response. You can review the suggested answer after submitting.
          </p>
          <textarea
            value={currentAnswer}
            onChange={(e) => setCurrentAnswer(e.target.value)}
            placeholder="Type your answer here..."
            className="w-full min-h-[200px] p-3 text-sm text-[var(--text-primary)] bg-[var(--bg-surface)] border-[var(--border-color)] rounded-xl resize-y focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Suggested Answer Section (if user has answered) */}
        {showSuggested && (
          <div className="uscis-card p-5 mb-6">
            <button
              onClick={() => toggleSuggestedAnswer(currentQuestion.id)}
              className="w-full flex items-center justify-between text-left"
            >
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                View Suggested Answer
              </span>
              {showSuggestedAnswer[currentQuestion.id] ? (
                <ChevronUpIcon className="w-5 h-5 text-[var(--text-primary)]" />
              ) : (
                <ChevronDownIcon className="w-5 h-5 text-[var(--text-primary)]" />
              )}
            </button>
            {showSuggestedAnswer[currentQuestion.id] && (
              <div className="mt-4 pt-4 border-t border-[var(--border-color)] space-y-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)] mb-2">
                    Suggested Answer:
                  </p>
                  <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                    {currentQuestion.answer}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)] mb-2">
                    Tips:
                  </p>
                  <p className="text-sm text-[var(--text-secondary)] italic leading-relaxed">
                    {currentQuestion.tips}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleNext}
            className="w-full px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors"
          >
            {isLast ? "Finish Interview" : "Next Question"}
          </button>
          {!isFirst && (
            <button
              onClick={handlePrevious}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)] transition-colors"
            >
              <ChevronLeftIcon className="w-5 h-5" />
              Previous Question
            </button>
          )}
        </div>

        {/* Back Link */}
        <div className="mt-8 text-center">
          <Link href="/help/interview-prep" className="text-sm font-semibold text-[var(--text-primary)] hover:underline">
            ← Back to Interview Prep
          </Link>
        </div>
      </div>
    </div>
  );
}
