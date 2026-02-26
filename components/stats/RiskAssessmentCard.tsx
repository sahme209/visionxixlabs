"use client";

import { ServiceCenterStats } from "@/lib/types";

interface RiskAssessmentCardProps {
  profile: any;
  serviceCenters: ServiceCenterStats[];
  avgProcessingTime: number | null;
}

export default function RiskAssessmentCard({
  profile,
  serviceCenters,
  avgProcessingTime,
}: RiskAssessmentCardProps) {
  // Calculate case age
  const calculateCaseAge = (): number => {
    if (!profile.priorityDate) return 0;
    const pd = new Date(profile.priorityDate);
    const today = new Date();
    return Math.floor((today.getTime() - pd.getTime()) / (1000 * 60 * 60 * 24));
  };

  const caseAge = calculateCaseAge();
  const userServiceCenter = profile.serviceCenter || "California";
  const formType = profile.formType || "I-130";
  const userCountry = profile.country || "United States";

  // Find user's service center stats
  const userCenterStats = serviceCenters.find((c) => c.name === userServiceCenter);

  // Calculate risk factors
  const riskFactors: Array<{ name: string; severity: "high" | "medium" | "low"; description: string }> = [];

  // Case age risk
  if (caseAge > 500) {
    riskFactors.push({
      name: "Extended Processing",
      severity: "high",
      description: `Your case has been pending for ${caseAge} days, which is ${caseAge - 450} days longer than typical ${formType} cases`,
    });
  } else if (caseAge > 400) {
    riskFactors.push({
      name: "Slightly Delayed",
      severity: "medium",
      description: `Your ${formType} case has been pending for ${caseAge} days, which is approaching the upper range`,
    });
  }

  // Service center risk
  if (userCenterStats) {
    if (userCenterStats.status === "delays") {
      riskFactors.push({
        name: "Service Center Delays",
        severity: "high",
        description: `${userServiceCenter} is experiencing delays. Average processing time: ${userCenterStats.avgDays} days`,
      });
    } else if (userCenterStats.status === "improving") {
      riskFactors.push({
        name: "Service Center Improving",
        severity: "low",
        description: `${userServiceCenter} is processing cases faster. Average processing time: ${userCenterStats.avgDays} days`,
      });
    }
  }

  // Average processing time comparison
  if (avgProcessingTime && userCenterStats) {
    if (userCenterStats.avgDays > avgProcessingTime + 30) {
      riskFactors.push({
        name: "Above Average Processing Time",
        severity: "medium",
        description: `Your service center's average (${userCenterStats.avgDays} days) is ${userCenterStats.avgDays - avgProcessingTime} days longer than the overall average`,
      });
    }
  }

  if (riskFactors.length === 0) {
    riskFactors.push({
      name: "Normal Processing",
      severity: "low",
      description: "Your case is processing within normal timeframes. Continue monitoring your status.",
    });
  }

  const getSeverityColor = (severity: "high" | "medium" | "low") => {
    switch (severity) {
      case "high":
        return "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800";
      case "medium":
        return "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-800";
      case "low":
        return "bg-[var(--bg-surface-alt)] text-green-800 dark:text-green-300 border-green-200 dark:border-green-800";
    }
  };

  return (
    <div className="uscis-card">
      <div className="uscis-card-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Your Risk Assessment</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Personalized risk analysis based on your case
            </p>
          </div>
        </div>
      </div>
      <div className="p-6">
        <div className="space-y-3">
          {riskFactors.map((factor, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border ${getSeverityColor(factor.severity)}`}
            >
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-semibold">{factor.name}</h4>
                <span
                  className={`px-2 py-1 rounded text-xs font-semibold ${
                    factor.severity === "high"
                      ? "bg-red-200 dark:bg-red-800"
                      : factor.severity === "medium"
                      ? "bg-orange-200 dark:bg-orange-800"
                      : "bg-green-200 dark:bg-green-800"
                  }`}
                >
                  {factor.severity.toUpperCase()}
                </span>
              </div>
              <p className="text-sm">{factor.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-2">
            <svg
              className="w-5 h-5 text-gray-800 dark:text-gray-200 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm text-[var(--text-secondary)]">
              Remember: You're making progress every day. Processing times vary, but your case is
              moving forward. Stay patient, stay hopeful - you've got this.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
