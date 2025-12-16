import prisma from '../config/database';

interface ServiceTypeMetrics {
  serviceType: string;
  count: number;
  averageRating: number;
  averageSatisfaction: number;
  firstTimeCompletionRate: number;
  returnRate: number;
}

interface PredictiveInsight {
  serviceType: string;
  predictedRating: number;
  confidence: number;
  factors: Array<{
    factor: string;
    impact: number;
  }>;
}

export const advancedAnalytics = {
  /**
   * Calculate Customer Experience Score (CX Score)
   * Formula: Rating (30%) + First-time completion (25%) + NPS (20%) + Wait Time (15%) + Communication (10%)
   */
  calculateCXScore(responses: any[]): number {
    if (responses.length === 0) return 0;

    const avgRating = responses.reduce((sum, r) => sum + r.rating, 0) / responses.length;
    const firstTimeRate =
      responses.filter((r) => r.firstTimeCompletion).length / responses.length;

    // Calculate NPS from npsScore field
    const validNPS = responses.filter((r) => r.npsScore !== null && r.npsScore !== undefined);
    const avgNPS = validNPS.length > 0
      ? validNPS.reduce((sum, r) => sum + (r.npsScore as number), 0) / validNPS.length
      : 5; // Default to neutral if no NPS data

    const validWaitTime = responses.filter((r) => r.waitTimeRating !== null);
    const avgWaitTime = validWaitTime.length > 0
      ? validWaitTime.reduce((sum, r) => sum + (r.waitTimeRating as number), 0) / validWaitTime.length
      : 3; // Default to neutral

    const validComm = responses.filter((r) => r.communicationRating !== null);
    const avgComm = validComm.length > 0
      ? validComm.reduce((sum, r) => sum + (r.communicationRating as number), 0) / validComm.length
      : 3; // Default to neutral

    // Normalize all metrics to 0-100 scale
    const ratingScore = (avgRating / 5) * 100;
    const firstTimeScore = firstTimeRate * 100;
    const npsNormalized = (avgNPS / 10) * 100; // NPS is 0-10
    const waitTimeScore = (avgWaitTime / 5) * 100;
    const commScore = (avgComm / 5) * 100;

    // Weighted average
    const cxScore =
      ratingScore * 0.3 +
      firstTimeScore * 0.25 +
      npsNormalized * 0.2 +
      waitTimeScore * 0.15 +
      commScore * 0.1;

    return Math.round(cxScore * 100) / 100; // Round to 2 decimal places
  },

  /**
   * Service Type Performance Matrix
   * Analyzes satisfaction vs frequency for different service types
   */
  async getServiceTypeMatrix(): Promise<ServiceTypeMetrics[]> {
    const responses = await prisma.surveyResponse.findMany({
      select: {
        visitReasons: true,
        rating: true,
        firstTimeCompletion: true,
        sentimentScore: true,
      },
    });

    const serviceMetrics = new Map<string, any>();

    responses.forEach((response) => {
      const reasons = response.visitReasons as string[];

      reasons.forEach((reason) => {
        if (!serviceMetrics.has(reason)) {
          serviceMetrics.set(reason, {
            count: 0,
            totalRating: 0,
            totalSentiment: 0,
            sentimentCount: 0,
            firstTimeCompletions: 0,
            returns: 0,
          });
        }

        const metrics = serviceMetrics.get(reason);
        metrics.count++;
        metrics.totalRating += response.rating;
        if (response.sentimentScore !== null) {
          metrics.totalSentiment += response.sentimentScore;
          metrics.sentimentCount++;
        }
        if (response.firstTimeCompletion) {
          metrics.firstTimeCompletions++;
        } else {
          metrics.returns++;
        }
      });
    });

    const results: ServiceTypeMetrics[] = [];
    serviceMetrics.forEach((metrics, serviceType) => {
      results.push({
        serviceType,
        count: metrics.count,
        averageRating: metrics.totalRating / metrics.count,
        averageSatisfaction:
          metrics.sentimentCount > 0 ? metrics.totalSentiment / metrics.sentimentCount : 0,
        firstTimeCompletionRate: (metrics.firstTimeCompletions / metrics.count) * 100,
        returnRate: (metrics.returns / metrics.count) * 100,
      });
    });

    return results.sort((a, b) => b.count - a.count);
  },

  /**
   * Predictive Service Quality
   * Predicts likely customer satisfaction based on service type and patterns
   */
  async getPredictiveInsights(): Promise<PredictiveInsight[]> {
    const responses = await prisma.surveyResponse.findMany({
      select: {
        visitReasons: true,
        rating: true,
        waitTimeRating: true,
        communicationRating: true,
        firstTimeCompletion: true,
        npsScore: true,
      },
    });

    const serviceMetrics = new Map<string, any[]>();

    // Group responses by service type
    responses.forEach((response) => {
      const reasons = response.visitReasons as string[];
      reasons.forEach((reason) => {
        if (!serviceMetrics.has(reason)) {
          serviceMetrics.set(reason, []);
        }
        serviceMetrics.get(reason)!.push(response);
      });
    });

    const predictions: PredictiveInsight[] = [];

    serviceMetrics.forEach((serviceResponses, serviceType) => {
      if (serviceResponses.length < 3) return; // Need minimum data for prediction

      const avgRating =
        serviceResponses.reduce((sum, r) => sum + r.rating, 0) / serviceResponses.length;

      const validWaitTime = serviceResponses.filter((r) => r.waitTimeRating !== null);
      const avgWaitTime =
        validWaitTime.length > 0
          ? validWaitTime.reduce((sum, r) => sum + (r.waitTimeRating as number), 0) /
            validWaitTime.length
          : null;

      const validComm = serviceResponses.filter((r) => r.communicationRating !== null);
      const avgComm =
        validComm.length > 0
          ? validComm.reduce((sum, r) => sum + (r.communicationRating as number), 0) /
            validComm.length
          : null;

      const firstTimeRate =
        serviceResponses.filter((r) => r.firstTimeCompletion).length / serviceResponses.length;

      // Calculate prediction confidence based on sample size
      const confidence = Math.min(0.95, 0.5 + (serviceResponses.length / 100) * 0.45);

      // Weighted prediction incorporating all factors
      let predictedRating = avgRating;
      const factors = [];

      if (avgWaitTime !== null) {
        const waitTimeImpact = (avgWaitTime - 3) * 0.2; // -0.4 to +0.4
        predictedRating += waitTimeImpact;
        factors.push({
          factor: 'Wait Time',
          impact: Math.round(waitTimeImpact * 100) / 100,
        });
      }

      if (avgComm !== null) {
        const commImpact = (avgComm - 3) * 0.15; // -0.3 to +0.3
        predictedRating += commImpact;
        factors.push({
          factor: 'Communication',
          impact: Math.round(commImpact * 100) / 100,
        });
      }

      const firstTimeImpact = (firstTimeRate - 0.75) * 1.5; // Expected 75% baseline
      predictedRating += firstTimeImpact;
      factors.push({
        factor: 'First-Time Completion',
        impact: Math.round(firstTimeImpact * 100) / 100,
      });

      // Clamp to 1-5 range
      predictedRating = Math.max(1, Math.min(5, predictedRating));

      predictions.push({
        serviceType,
        predictedRating: Math.round(predictedRating * 100) / 100,
        confidence: Math.round(confidence * 100) / 100,
        factors: factors.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)),
      });
    });

    return predictions.sort((a, b) => b.predictedRating - a.predictedRating);
  },

  /**
   * Get comprehensive NPS analysis using actual npsScore field
   */
  async getNPSAnalysis() {
    const responses = await prisma.surveyResponse.findMany({
      where: {
        npsScore: {
          not: null,
        },
      },
      select: {
        npsScore: true,
        submittedAt: true,
      },
    });

    const promoters = responses.filter((r) => (r.npsScore as number) >= 9).length;
    const passives = responses.filter(
      (r) => (r.npsScore as number) >= 7 && (r.npsScore as number) <= 8
    ).length;
    const detractors = responses.filter((r) => (r.npsScore as number) <= 6).length;

    const npsScore =
      responses.length > 0 ? ((promoters - detractors) / responses.length) * 100 : 0;

    const avgNPS =
      responses.length > 0
        ? responses.reduce((sum, r) => sum + (r.npsScore as number), 0) / responses.length
        : 0;

    return {
      npsScore: Math.round(npsScore * 100) / 100,
      averageNPS: Math.round(avgNPS * 100) / 100,
      promoters,
      passives,
      detractors,
      totalResponses: responses.length,
      promotersPercentage: responses.length > 0 ? (promoters / responses.length) * 100 : 0,
      passivesPercentage: responses.length > 0 ? (passives / responses.length) * 100 : 0,
      detractorsPercentage: responses.length > 0 ? (detractors / responses.length) * 100 : 0,
    };
  },

  /**
   * Get wait time and communication analytics
   */
  async getExperienceMetrics() {
    const responses = await prisma.surveyResponse.findMany({
      select: {
        waitTimeRating: true,
        communicationRating: true,
        rating: true,
      },
    });

    const validWaitTime = responses.filter((r) => r.waitTimeRating !== null);
    const validComm = responses.filter((r) => r.communicationRating !== null);

    const avgWaitTime =
      validWaitTime.length > 0
        ? validWaitTime.reduce((sum, r) => sum + (r.waitTimeRating as number), 0) /
          validWaitTime.length
        : 0;

    const avgComm =
      validComm.length > 0
        ? validComm.reduce((sum, r) => sum + (r.communicationRating as number), 0) /
          validComm.length
        : 0;

    // Calculate correlation with overall rating
    const waitTimeCorrelation = this.calculateCorrelation(
      validWaitTime.map((r) => r.waitTimeRating as number),
      validWaitTime.map((r) => r.rating)
    );

    const commCorrelation = this.calculateCorrelation(
      validComm.map((r) => r.communicationRating as number),
      validComm.map((r) => r.rating)
    );

    return {
      averageWaitTimeRating: Math.round(avgWaitTime * 100) / 100,
      averageCommunicationRating: Math.round(avgComm * 100) / 100,
      waitTimeRatingCount: validWaitTime.length,
      communicationRatingCount: validComm.length,
      waitTimeCorrelationWithRating: Math.round(waitTimeCorrelation * 100) / 100,
      communicationCorrelationWithRating: Math.round(commCorrelation * 100) / 100,
    };
  },

  /**
   * Calculate Pearson correlation coefficient
   */
  calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;

    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  },
};
