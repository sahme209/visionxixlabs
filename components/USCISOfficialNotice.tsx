"use client";

import { InformationCircleIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

interface USCISOfficialNoticeProps {
  type?: "fbi-privacy" | "form-warning" | "general";
  className?: string;
}

/**
 * USCIS-style official notices (FBI Privacy Notice, Form Warnings, etc.)
 * Matches official USCIS.gov notice styling
 */
export default function USCISOfficialNotice({
  type = "general",
  className = "",
}: USCISOfficialNoticeProps) {
  const notices = {
    "fbi-privacy": {
      title: "FBI Privacy Notice",
      content: (
        <>
          <p className="mb-3">
            The immigration agency may use your biometrics to obtain criminal history records from the FBI, for identity verification, eligibility determination, immigration documents (e.g., green card, work permit), or other purposes authorized by law.
          </p>
          <p className="mb-3">
            You may obtain a copy of your own FBI record using the procedures outlined at 28 CFR 16.30-16.34. For more information, please visit:{" "}
            <Link
              href="https://www.fbi.gov/how-we-can-help-you/more-fbi-services-and-information/compact-council/guiding-principles-noncriminal-justice-applicants-privacy-rights"
              target="_blank"
              rel="noopener noreferrer"
              className="uscis-link"
            >
              www.fbi.gov/how-we-can-help-you/more-fbi-services-and-information/compact-council/guiding-principles-noncriminal-justice-applicants-privacy-rights
            </Link>
          </p>
          <p>
            For information regarding how the FBI will use your fingerprints, please visit{" "}
            <Link
              href="https://www.fbi.gov/how-we-can-help-you/more-fbi-services-and-information/compact-council/privacy-act-statement"
              target="_blank"
              rel="noopener noreferrer"
              className="uscis-link"
            >
              www.fbi.gov/how-we-can-help-you/more-fbi-services-and-information/compact-council/privacy-act-statement
            </Link>
          </p>
        </>
      ),
    },
    "form-warning": {
      title: "Important Form Information",
      content: (
        <>
          <p className="mb-3">
            <strong>Warning:</strong> Many unofficial sites offer immigration forms and may charge fees or provide outdated versions. Do not pay for government forms.
          </p>
          <p>
            Using outdated forms can delay or reject your case. Always download forms directly from the official government forms site:{" "}
            <Link href="https://www.uscis.gov/forms/all-forms" target="_blank" rel="noopener noreferrer" className="uscis-link font-semibold">
              official forms
            </Link>
            .
          </p>
        </>
      ),
    },
    general: {
      title: "Official Notice",
      content: (
        <p>
          Always verify information with the official government immigration site and consult a qualified immigration attorney for legal advice specific to your case.
        </p>
      ),
    },
  };

  const notice = notices[type];

  return (
    <div className={`bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 dark:border-blue-600 p-4 rounded-r ${className}`}>
      <div className="flex items-start gap-3">
        <InformationCircleIcon className="w-5 h-5 text-gray-800 dark:text-gray-200 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {notice.title}
          </h3>
          <div className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed">
            {notice.content}
          </div>
        </div>
      </div>
    </div>
  );
}
