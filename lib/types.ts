// Type definitions matching iOS app models

export interface FormGuide {
  id: string;
  title: string;
  steps: StepDetail[];
  overview?: string;
  estimatedTime?: string;
  difficulty: DifficultyLevel;
}

export interface StepDetail {
  id: string;
  title: string;
  description: string;
  link?: string;
  tips?: string[];
  warnings?: string[];
  examples?: string[];
  notes?: string;
  requiredDocuments?: string[];
}

export enum DifficultyLevel {
  Easy = "Easy",
  Moderate = "Moderate",
  Complex = "Complex",
}

export interface TimelineStage {
  id: string;
  name: string;
  description: string;
  stageType: "uscis" | "nvc" | "embassy";
  earliestDate: Date;
  latestDate: Date;
  isCompleted: boolean;
  isCurrent: boolean;
  dataSource?: string;
  dataSourceLabel?: string;
}

export interface CaseTimeline {
  formType: string;
  processingPath: string;
  country?: string;
  priorityDate: Date;
  stages: TimelineStage[];
}

// MARK: - System Stats Models

export interface SystemDailyStats {
  date: string; // YYYY-MM-DD
  approvalsCount: number;
  approvalsCountYesterday?: number;
  priorityDateMovement?: number;
  activeCasesProcessed?: number;
  updatedAt: any; // Firestore Timestamp
}

export interface SystemMonthlyStats {
  month: string; // YYYY-MM
  approvalsTotal: number;
  approvalsLastMonth?: number;
  dailyAverage: number;
  bestDay?: string; // YYYY-MM-DD
  bestDayCount?: number;
  updatedAt: any; // Firestore Timestamp
}

export interface SystemCoverage {
  scopeId: string;
  coverageRatio: number; // 0-1
  sourceDescription: string;
  updatedAt: any; // Firestore Timestamp
}

export interface TrendPoint {
  date: string; // YYYY-MM-DD
  count: number;
}

export interface ETATrendPoint {
  date: string; // YYYY-MM-DD
  etaDays: number;
}

export interface TrendsData {
  scopeId: string;
  approvalsPerDayPoints: TrendPoint[];
  etaPoints?: ETATrendPoint[];
  updatedAt: any; // Firestore Timestamp
}

export interface PDStats {
  scopeId: string;
  latestApprovedPD?: string;
  lastApprovedPD?: string;
  pacePdsPerDay?: number;
  avgTimeDays?: number;
  backlog?: number;
  updatedAt: any; // Firestore Timestamp
}

export interface RFEStats {
  scopeId: string;
  cohortSize: number;
  rfeCount: number;
  rfeRate: number; // 0-1
  updatedAt: any; // Firestore Timestamp
}

export interface CalendarApprovals {
  month: string; // YYYY-MM
  days: { [key: string]: number }; // { "YYYY-MM-DD": count }
  updatedAt: any; // Firestore Timestamp
}

// Scope Builder Helper
export type ScopeBuilder =
  | { type: "all" }
  | { type: "petitionType"; value: string }
  | { type: "petitionTypeAndCenter"; petitionType: string; center: string }
  | { type: "full"; petitionType: string; center: string; country: string };

export function buildScopeId(scope: ScopeBuilder): string {
  switch (scope.type) {
    case "all":
      return "all";
    case "petitionType":
      return `petitionType:${scope.value}`;
    case "petitionTypeAndCenter":
      return `petitionType:${scope.petitionType}|center:${scope.center}`;
    case "full":
      return `petitionType:${scope.petitionType}|center:${scope.center}|country:${scope.country}`;
  }
}

export function scopeFromProfile(
  petitionType?: string,
  serviceCenter?: string,
  beneficiaryCountry?: string
): ScopeBuilder {
  if (!petitionType) {
    return { type: "all" };
  }
  if (!serviceCenter) {
    return { type: "petitionType", value: petitionType };
  }
  if (!beneficiaryCountry) {
    return { type: "petitionTypeAndCenter", petitionType, center: serviceCenter };
  }
  return { type: "full", petitionType, center: serviceCenter, country: beneficiaryCountry };
}

// MARK: - Additional Stats Types

export interface ApprovalData {
  date: string; // YYYY-MM-DD
  approvals: number;
}

export interface ServiceCenterStats {
  name: string;
  avgDays: number;
  latestPD: string;
  status: "improving" | "delays" | "steady";
  count: number;
  daysSinceLastApproval?: number;
}

export interface BacklogByCenterEntry {
  name: string;
  approvals30d: number;
  estimatedBacklog: number;
  medianDays: number;
}

export interface ProcessingTimeDistribution {
  range: string; // e.g., "300-350"
  count: number;
  average: number;
  median: number;
  min: number;
  max: number;
}

export interface WeeklyApprovalData {
  date: string;
  i130: number;
  i129f: number;
}

export interface ApprovalTrendSummary {
  total: number;
  average: number;
  peak: { date: string; count: number };
  trend: "increasing" | "decreasing" | "stable";
  last7DaysDelta: number;
}

export interface I130ApprovalData {
  id: string;
  formType: string;
  beneficiaryCountry: string;
  priorityDate: any; // Firestore Timestamp
  approvalDate: any; // Firestore Timestamp
  serviceCenter?: string;
  notes?: string;
  createdAt?: any; // Firestore Timestamp
}

export interface I129FApprovalData {
  id: string;
  formType: string;
  beneficiaryCountry: string;
  petitionerCountry: string;
  usEmbassy?: string;
  noa1Date: any; // Firestore Timestamp
  noa2Date?: any; // Firestore Timestamp
  rfeDate?: any; // Firestore Timestamp
  rfeResponseDate?: any; // Firestore Timestamp
  notes?: string;
  createdAt?: any; // Firestore Timestamp
}

// MARK: - Predictive Analytics Types

export interface ApprovalOdds {
  approved: number; // 0-100
  rfe: number; // 0-100
  denied: number; // 0-100
  sampleSize: number;
  confidence: "high" | "medium" | "low";
  approvalByServiceCenter?: Array<{
    serviceCenter: string;
    approved: number;
    rfe: number;
    denied: number;
    sampleSize: number;
  }>;
  approvalByCountry?: Array<{
    country: string;
    approved: number;
    rfe: number;
    denied: number;
    sampleSize: number;
  }>;
}

export interface TimelineEstimate {
  earliest: Date;
  latest: Date;
  median: Date;
  confidence: "high" | "medium" | "low";
  method: string;
}

export interface QueuePosition {
  positionRank: number;
  totalTracked: number;
  percentile: number; // 0-100
  casesAhead: number;
  currentProcessingPD?: Date;
  isInRange: boolean;
}

export interface NeighborComparison {
  totalNeighbors: number;
  approvedCount: number;
  processingCount: number;
  rfeCount: number;
  distribution: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
}


