/**
 * Phase 8: Board Slide Generator — Enterprise only.
 * Produces structured slide outline from strategic brief.
 * No PowerPoint generation.
 */

import type { StrategicBrief } from "./strategicBrief";

export type BoardSlide = {
  title: string;
  bullets: string[];
};

export type BoardDeckOutline = {
  slides: BoardSlide[];
};

export function generateBoardSlideOutline(brief: StrategicBrief): BoardDeckOutline {
  const slides: BoardSlide[] = [
    {
      title: "Executive Summary",
      bullets: brief.executiveSummary.split(". ").filter(Boolean).slice(0, 3),
    },
    {
      title: "Financial Risk & Opportunity",
      bullets: brief.financialRiskNarrative.split(". ").filter(Boolean).slice(0, 4),
    },
    {
      title: "Operational Risk",
      bullets: brief.operationalRiskNarrative.split(". ").filter(Boolean).slice(0, 4),
    },
    {
      title: "Scalability Outlook",
      bullets: brief.scalabilityOutlook.split(". ").filter(Boolean).slice(0, 3),
    },
    {
      title: "90-Day Strategic Focus",
      bullets: brief["90DayStrategicFocus"] ?? [],
    },
    {
      title: "Board-Level KPIs to Track",
      bullets: brief.boardLevelKPIsToTrack ?? [],
    },
    {
      title: "Recommended Investment Zones",
      bullets: brief.recommendedInvestmentZones ?? [],
    },
    {
      title: "Risk If Ignored",
      bullets: brief.riskIfIgnored.split(". ").filter(Boolean),
    },
  ];

  if (brief.boardSlideOutline && brief.boardSlideOutline.length > 0) {
    return {
      slides: brief.boardSlideOutline.map((title, i) => ({
        title,
        bullets: slides[i]?.bullets ?? [],
      })),
    };
  }

  return { slides };
}
