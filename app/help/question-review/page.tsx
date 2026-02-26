"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { interviewQAPairs } from "@/lib/data/interview-prep-data";
import { InterviewQAPair } from "@/lib/types/help-center";
import { ChevronLeftIcon } from "@heroicons/react/24/outline";

// Shuffle array utility
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function QuestionReviewPage() {
  const [shuffledQuestions, setShuffledQuestions] = useState<InterviewQAPair[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  // Shuffle questions on mount
  useEffect(() => {
    setShuffledQuestions(shuffleArray(interviewQAPairs));
  }, []);

  const currentQuestion = shuffledQuestions[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === shuffledQuestions.length - 1;

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setShowAnswer(false);
    }
  };

  const handleNext = () => {
    if (showAnswer) {
      if (isLast) {
        // Finished
        window.location.href = "/help/interview-prep";
      } else {
        setCurrentIndex(currentIndex + 1);
        setShowAnswer(false);
      }
    } else {
      setShowAnswer(true);
    }
  };

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[var(--text-secondary)]">No questions available</p>
          <Link href="/help/interview-prep" className="text-[var(--text-primary)] mt-4 inline-block">
            ← Back to Interview Prep
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-8 w-full min-w-0">
        {/* Progress Indicator */}
        <div className="flex items-center justify-between mb-6">
          <span className="text-sm text-[var(--text-secondary)]">
            {currentIndex + 1} of {shuffledQuestions.length}
          </span>
          <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-600 transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / shuffledQuestions.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Flashcard */}
        <div className="mb-8">
          <div
            onClick={() => setShowAnswer(!showAnswer)}
            className="min-h-[400px] flex items-center justify-center p-8 bg-[var(--bg-surface)] rounded-3xl border-2 border-[var(--border-color)] cursor-pointer hover:shadow-lg transition-all"
          >
            {showAnswer ? (
              <div className="text-center space-y-4 max-w-2xl">
                <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                  Answer
                </p>
                <p className="text-xl font-medium text-[var(--text-primary)] leading-relaxed">
                  {currentQuestion.answer}
                </p>
                <div className="border-t border-[var(--border-color)] my-6" />
                <p className="text-sm text-[var(--text-secondary)] italic leading-relaxed">
                  {currentQuestion.tips}
                </p>
              </div>
            ) : (
              <div className="text-center space-y-3 max-w-2xl">
                <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                  Question
                </p>
                <p className="text-2xl font-semibold text-[var(--text-primary)] leading-relaxed">
                  {currentQuestion.question}
                </p>
                <p className="text-xs text-[var(--text-secondary)] mt-4">
                  {currentQuestion.category}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={handlePrevious}
            disabled={isFirst}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--bg-surface-alt)] transition-colors"
          >
            <ChevronLeftIcon className="w-5 h-5" />
            Previous
          </button>
          <button
            onClick={handleNext}
            className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors"
          >
            {showAnswer ? (isLast ? "Finish" : "Next") : "Show Answer"}
          </button>
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
