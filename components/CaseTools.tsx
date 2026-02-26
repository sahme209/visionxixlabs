"use client";

import Link from "next/link";
import Image from "next/image";
import { HERO_IMAGES, SECTION_IMAGES } from "@/lib/images";
import GradientIconBadge, { BadgeColor } from "@/components/GradientIconBadge";
import {
  BoltIcon,
  MapIcon,
  ChartBarIcon,
  BuildingOfficeIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
  ClipboardDocumentListIcon,
  BriefcaseIcon,
} from "@heroicons/react/24/solid";

interface ToolItem {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeColor: BadgeColor;
  path: string;
}

const tools: ToolItem[] = [
  { id: "expedite", title: "Expedite Request", description: "Request expedited processing for urgent cases", icon: BoltIcon, badgeColor: "amber", path: "/tools/expedite" },
  { id: "action-plan", title: "Action Plan", description: "Personalized next steps based on your case stage", icon: MapIcon, badgeColor: "emerald", path: "/tools/action-plan" },
  { id: "case-progress", title: "Case Progress", description: "Track your case progress and milestones", icon: ChartBarIcon, badgeColor: "blue", path: "/tools/case-progress" },
  { id: "queue-position", title: "Queue Position", description: "See your position in the processing queue", icon: BuildingOfficeIcon, badgeColor: "indigo", path: "/tools/queue-position" },
  { id: "rfe-response", title: "RFE/NOID Response", description: "Draft response templates and exhibit lists", icon: DocumentTextIcon, badgeColor: "orange", path: "/tools/rfe-response" },
  { id: "document-pack", title: "Document Pack Organizer", description: "Scan, label, and organize your documents", icon: DocumentTextIcon, badgeColor: "teal", path: "/tools/document-pack" },
  { id: "timeline-alerts", title: "Timeline Alerts", description: "Smart notifications and calendar sync", icon: CalendarDaysIcon, badgeColor: "sky", path: "/tools/timeline-alerts" },
  { id: "evidence-checklist", title: "Evidence Checklist", description: "Form-specific checklists with progress tracking", icon: ClipboardDocumentListIcon, badgeColor: "violet", path: "/tools/evidence-checklist" },
];

const TOOL_IMAGES: Record<string, string> = {
  "Expedite Request": HERO_IMAGES.handsDocuments,
  "Action Plan": HERO_IMAGES.familyTravel,
  "RFE/NOID Response": HERO_IMAGES.handsDocuments,
  "Document Pack Organizer": HERO_IMAGES.documents,
  "Timeline Alerts": HERO_IMAGES.calendar,
  "Evidence Checklist Builder": HERO_IMAGES.checklist,
  "Queue Position": SECTION_IMAGES.office,
  "Case Progress": SECTION_IMAGES.documents,
};

export default function CaseTools() {
  return (
    <div className="uscis-card relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.04]">
        <Image src={HERO_IMAGES.documents} alt="" fill className="object-cover" sizes="800px" />
      </div>
      <div className="relative uscis-card-header">
        <div className="flex items-center gap-3">
          <GradientIconBadge icon={BriefcaseIcon} color="blue" size="md" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Case Tools</h3>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Professional tools to help manage your immigration case
            </p>
          </div>
        </div>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.map((tool) => (
              <Link
                key={tool.id}
                href={tool.path}
                className="group relative rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 hover:border-[var(--uscis-blue)]/50 hover:shadow-lg transition-all duration-200 overflow-hidden"
              >
                {TOOL_IMAGES[tool.title] && (
                  <div className="absolute inset-0 opacity-[0.05]">
                    <Image src={TOOL_IMAGES[tool.title]} alt="" fill className="object-cover" sizes="400px" />
                  </div>
                )}
                <div className="relative flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 group-hover:scale-110 transition-transform duration-200">
                      <GradientIconBadge icon={tool.icon} color={tool.badgeColor} size="xs" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-[var(--text-primary)] mb-1.5 text-base">
                        {tool.title}
                      </h3>
                      <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                        {tool.description}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

