"use client";

import { useState } from "react";
import { fetchCaseStatus, healthCheck, USCISCaseStatusResponse } from "@/lib/services/uscisStatusService";
import { XMarkIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

interface USCISStatusAPIDebugProps {
  onClose: () => void;
}

export default function USCISStatusAPIDebug({ onClose }: USCISStatusAPIDebugProps) {
  const [receiptNumber, setReceiptNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [statusResult, setStatusResult] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [healthCheckResult, setHealthCheckResult] = useState<string | null>(null);

  const apiEndpoint = "https://uscis-status-api-back.vision19.workers.dev/case-status";

  const [caseStatusData, setCaseStatusData] = useState<USCISCaseStatusResponse | null>(null);

  const handleFetchStatus = async () => {
    if (!receiptNumber || receiptNumber.length !== 13) {
      setErrorMessage("Please enter a valid 13-character receipt number");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setStatusResult("");
    setCaseStatusData(null);

    try {
      const result = await fetchCaseStatus(receiptNumber);
      setCaseStatusData(result);
      
      // Also store formatted text for raw view
      let resultText = `Status Text: ${result.statusText}\n`;
      if (result.statusDetail) {
        resultText += `Status Detail: ${result.statusDetail}\n`;
      }
      if (result.lastUpdated) {
        resultText += `Last Updated: ${result.lastUpdated}\n`;
      }
      if (result.caseNumber) {
        resultText += `Case Number: ${result.caseNumber}\n`;
      }
      if (result.raw) {
        resultText += `\nRaw Response:\n${JSON.stringify(result.raw, null, 2)}`;
      }
      setStatusResult(resultText);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to fetch case status");
      setCaseStatusData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleHealthCheck = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setHealthCheckResult(null);

    try {
      const isHealthy = await healthCheck();
      setHealthCheckResult(isHealthy ? "✅ Service is healthy" : "❌ Service health check failed");
    } catch (err: any) {
      setHealthCheckResult(`❌ Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-[var(--bg-surface)] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border-2 border-[var(--uscis-blue)]/20">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[var(--uscis-blue)]/15 flex items-center justify-center">
              <svg className="w-6 h-6 text-[var(--text-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">USCIS Status API Debug</h2>
              <p className="text-sm text-[var(--text-secondary)]">Direct API access for testing</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--bg-surface-alt)] rounded-lg transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-6 h-6 text-[var(--text-secondary)]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* API Information */}
          <div className="bg-[var(--bg-surface-alt)] rounded-xl p-5 border border-[var(--border-color)]">
            <h3 className="text-base font-semibold text-[var(--text-primary)] mb-4">API Information</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-[var(--text-secondary)]">Endpoint</span>
                <code className="text-xs font-mono text-[var(--text-primary)] bg-[var(--bg-surface)] px-2 py-1 rounded">
                  {apiEndpoint}
                </code>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-[var(--text-secondary)]">Method</span>
                <code className="text-xs font-mono text-[var(--text-primary)] bg-[var(--bg-surface)] px-2 py-1 rounded">
                  GET
                </code>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-[var(--text-secondary)]">Service</span>
                <code className="text-xs font-mono text-[var(--text-primary)] bg-[var(--bg-surface)] px-2 py-1 rounded">
                  uscisStatusService
                </code>
              </div>
            </div>
          </div>

          {/* Health Check */}
          <div className="bg-[var(--bg-surface-alt)] rounded-xl p-5 border border-[var(--border-color)]">
            <h3 className="text-base font-semibold text-[var(--text-primary)] mb-4">Health Check</h3>
            <button
              onClick={handleHealthCheck}
              disabled={isLoading}
              className="w-full px-4 py-2 bg-[var(--uscis-blue)] hover:bg-[var(--uscis-blue-dark)] text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? "Checking..." : "Check Service Health"}
            </button>
            {healthCheckResult && (
              <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <p className="text-sm font-mono text-green-700 dark:text-green-300">{healthCheckResult}</p>
              </div>
            )}
          </div>

          {/* Test API */}
          <div className="bg-[var(--bg-surface-alt)] rounded-xl p-5 border border-[var(--border-color)]">
            <h3 className="text-base font-semibold text-[var(--text-primary)] mb-4">Test API</h3>
            <div className="space-y-4">
              <input
                type="text"
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value.toUpperCase().trim())}
                placeholder="Example: MSC2390123456"
                maxLength={13}
                className="w-full px-4 py-3 bg-[var(--bg-surface-alt)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)] focus:border-transparent transition-all"
              />

              <button
                onClick={handleFetchStatus}
                disabled={isLoading || receiptNumber.length !== 13}
                className="w-full px-4 py-3 bg-gradient-to-r from-[var(--uscis-blue)] to-[var(--uscis-blue-dark)] hover:from-[var(--uscis-blue-dark)] hover:to-[var(--uscis-blue)] text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Fetching...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    <span>Fetch Status</span>
                  </>
                )}
              </button>

              {errorMessage && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold text-red-700 dark:text-red-300 mb-1">Error</p>
                      <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
                    </div>
                  </div>
                </div>
              )}

              {statusResult && (
                <div className="space-y-4">
                  {/* Case Status Card */}
                  <div className="uscis-card relative">
                    <div className="absolute top-0 left-0 right-0 h-[3px] bg-[var(--uscis-blue)] rounded-t-lg hidden sm:block"></div>
                    <div className="p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <svg className="w-4 h-4 text-[var(--text-primary)]" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                        </svg>
                        <span className="text-xs font-medium text-[var(--text-primary)]">U.S. Citizenship and Immigration Services</span>
                      </div>
                      <div className="flex items-start gap-3 mb-5">
                        <button type="button" className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center text-white flex-shrink-0 cursor-pointer hover:opacity-90 active:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-white/60 focus:ring-offset-2" aria-label="Case Status Icon">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" data-slot="icon" className="w-6 h-6">
                            <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clipRule="evenodd"></path>
                          </svg>
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-semibold text-[var(--text-primary)]">USCIS Case Status</h3>
                            <span className="text-[9px] font-bold tracking-wide uppercase text-white bg-green-500 px-2 py-1 rounded-full">Official</span>
                          </div>
                          <p className="text-sm font-medium text-[var(--text-secondary)] leading-snug">
                            {caseStatusData?.statusText || "Case is still being processed by USCIS"}
                          </p>
                        </div>
                      </div>
                      <div className="border-t border-[var(--border-color)] mb-5"></div>
                      <div className="space-y-2.5 mb-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-4.5 h-4.5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                            </svg>
                          </div>
                          <span className="text-xs font-medium text-[var(--text-primary)] line-through opacity-60">Case has been submitted</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <div className="w-4.5 h-4.5 rounded-full border-2 border-[var(--border-color)] flex-shrink-0"></div>
                          <span className="text-xs text-[var(--text-secondary)]">Case is still being processed</span>
                        </div>
                      </div>
                      <Link 
                        href="/profile-setup" 
                        className="absolute bottom-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--uscis-blue)]/10 hover:bg-[var(--uscis-blue)]/20 transition-colors"
                        title="Edit case status"
                      >
                        <svg className="w-3 h-3 text-[var(--text-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                        </svg>
                        <span className="text-xs font-semibold text-[var(--text-primary)]">Edit</span>
                      </Link>
                    </div>
                  </div>
                  
                  {/* Raw Result (Collapsible) */}
                  <details className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <summary className="flex items-start gap-2 mb-2 cursor-pointer">
                      <svg className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <p className="text-sm font-semibold text-green-700 dark:text-green-300">View Raw Response</p>
                    </summary>
                    <pre className="text-xs font-mono text-green-600 dark:text-green-400 whitespace-pre-wrap break-words max-h-48 overflow-y-auto mt-2">
                      {statusResult}
                    </pre>
                  </details>
                </div>
              )}
            </div>
          </div>

          {/* Disclaimer */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-gray-800 dark:text-gray-200 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">Note</p>
                <p className="text-xs text-gray-800 dark:text-gray-200">
                  This is a developer tool for testing the USCIS Status API. Use responsibly and in accordance with USCIS terms of service.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
