// Ported from iOS: QueuePositionEngine.swift
// Exact same calculations and formulas

export interface QueuePositionResult {
  position: number | null;
  positionRange: { min: number; max: number } | null;
  daysRemaining: number;
  status: "current" | "waiting";
  confidence: "high" | "medium" | "low";
  context: string;
  lastUpdated: Date;
}

export class QueuePositionEngine {
  // MARK: - Configuration (exact from iOS)
  static readonly AVERAGE_DAILY_PROCESSING_RATE = 1.35; // ~1.2-1.5 calendar days of PDs processed per calendar day
  static readonly MINIMUM_QUEUE_POSITION = 50;
  static readonly MAXIMUM_QUEUE_POSITION = 50000;

  /**
   * Calculate approximate queue position for a user's priority date
   * Ported from iOS QueuePositionEngine.calculateQueuePosition
   */
  static calculateQueuePosition(
    userPriorityDate: Date,
    currentLatestPD: Date | null,
    formType: string,
    processingPath: string
  ): QueuePositionResult | null {
    // Only calculate for I-130 Consular and I-129F (where PD tracking is meaningful)
    if (!this.shouldCalculateFor(formType, processingPath)) {
      return null;
    }

    if (!currentLatestPD) {
      return null;
    }

    // Calculate days between user's PD and current latest PD
    const daysBetween = Math.floor(
      (userPriorityDate.getTime() - currentLatestPD.getTime()) / (1000 * 60 * 60 * 24)
    );

    // If user's PD is already current or past, show special status
    if (daysBetween <= 0) {
      return {
        position: null,
        positionRange: null,
        daysRemaining: 0,
        status: "current",
        confidence: "high",
        context:
          "Your priority date is current. Your case is in the active processing queue.",
        lastUpdated: new Date(),
      };
    }

    // Calculate approximate queue position
    // Formula: days between × average daily processing rate
    // This gives us an estimate of how many "days worth" of cases are ahead
    const rawPosition = daysBetween * this.AVERAGE_DAILY_PROCESSING_RATE;

    // Round to nearest 50 for authenticity (exact numbers feel fake)
    const roundedPosition = Math.round(rawPosition / 50.0) * 50.0;

    // Clamp to reasonable range
    const clampedPosition = Math.max(
      this.MINIMUM_QUEUE_POSITION,
      Math.min(this.MAXIMUM_QUEUE_POSITION, roundedPosition)
    );

    // Calculate position range for uncertainty framing (±10%)
    const positionVariance = Math.floor(clampedPosition * 0.1);
    const minPosition = Math.max(
      this.MINIMUM_QUEUE_POSITION,
      clampedPosition - positionVariance
    );
    const maxPosition = Math.min(
      this.MAXIMUM_QUEUE_POSITION,
      clampedPosition + positionVariance
    );

    // Determine confidence based on how far out the PD is
    let confidence: "high" | "medium" | "low";
    if (daysBetween <= 30) {
      confidence = "high";
    } else if (daysBetween <= 90) {
      confidence = "medium";
    } else {
      confidence = "low";
    }

    // Generate authentic context message
    const context = this.generateContextMessage(
      clampedPosition,
      daysBetween,
      formType,
      confidence
    );

    return {
      position: clampedPosition,
      positionRange: { min: minPosition, max: maxPosition },
      daysRemaining: daysBetween,
      status: "waiting",
      confidence,
      context,
      lastUpdated: new Date(),
    };
  }

  /**
   * Check if queue position should be calculated for this form/path combination
   */
  static shouldCalculateFor(formType: string, processingPath: string): boolean {
    const formUpper = formType.toUpperCase().trim();
    const pathUpper = processingPath.toUpperCase().trim();

    // Calculate for I-130 Consular and I-129F (both use PD tracking)
    return (
      (formUpper === "I-130" && pathUpper === "CONSULAR") ||
      formUpper === "I-129F"
    );
  }

  /**
   * Generate authentic, psychologically impactful context message
   */
  private static generateContextMessage(
    position: number,
    daysRemaining: number,
    formType: string,
    confidence: "high" | "medium" | "low"
  ): string {
    // Use uncertainty framing based on confidence
    let uncertaintyPhrase: string;
    switch (confidence) {
      case "high":
        uncertaintyPhrase = "approximately";
        break;
      case "medium":
        uncertaintyPhrase = "roughly";
        break;
      case "low":
        uncertaintyPhrase = "estimated";
        break;
    }

    // Format position with proper number formatting
    const formattedPosition = this.formatNumber(position);

    // Generate context based on position magnitude
    if (position < 500) {
      return `You're ${uncertaintyPhrase} #${formattedPosition} in the processing queue. Your case is getting close—we'll update this daily as processing advances.`;
    } else if (position < 2000) {
      return `You're ${uncertaintyPhrase} #${formattedPosition} in the processing queue. Based on current pace, your case should be reviewed within the next few months.`;
    } else if (position < 10000) {
      return `You're ${uncertaintyPhrase} #${formattedPosition} in the processing queue. Processing times vary, but we update this estimate daily from official data.`;
    } else {
      return `You're ${uncertaintyPhrase} #${formattedPosition} in the processing queue. This estimate is based on current processing patterns and updates daily.`;
    }
  }

  /**
   * Format number with commas for readability
   */
  private static formatNumber(number: number): string {
    return number.toLocaleString("en-US");
  }
}

