import { Request, Response } from 'express';
import prisma from '../config/database';
import { sentimentService } from '../services/sentimentService';
import { advancedAnalytics } from '../services/advancedAnalytics';

interface SurveySubmitRequest {
  preferredLanguage: string;
  visitReasons: string[];
  rating: number;
  comments?: string;
  waitTimeRating?: number;
  communicationRating?: number;
  npsScore?: number;
  firstTimeCompletion: boolean;
  returnReasons?: string[];
  contactAgreement: boolean;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  vehicleNumber?: string;
}

export const surveyController = {
  async submitSurvey(req: Request, res: Response) {
    try {
      const {
        preferredLanguage,
        visitReasons,
        rating,
        comments,
        waitTimeRating,
        communicationRating,
        npsScore,
        firstTimeCompletion,
        returnReasons,
        contactAgreement,
        customerName,
        customerEmail,
        customerPhone,
        vehicleNumber,
      } = req.body as SurveySubmitRequest;

      // Validate required fields
      if (!preferredLanguage || !visitReasons || !Array.isArray(visitReasons) || rating === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: preferredLanguage, visitReasons, rating',
        });
      }

      if (rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          message: 'Rating must be between 1 and 5',
        });
      }

      // Get client IP address
      const ipAddress = req.ip || req.socket.remoteAddress || null;

      // Try to find existing customer by vehicle number
      let customerId: number | null = null;
      if (vehicleNumber) {
        const existingCustomer = await prisma.customer.findUnique({
          where: { vehicleNumber },
        });
        customerId = existingCustomer?.id || null;
      }

      // Analyze sentiment and emotion using AI
      let sentimentScore: number | null = null;
      let emotionAnalysis: any = null;

      try {
        const analysis = await sentimentService.analyzeEmotion(
          rating,
          comments || '',
          visitReasons,
          firstTimeCompletion,
          returnReasons
        );
        sentimentScore = analysis.sentimentScore;
        emotionAnalysis = analysis.emotionAnalysis;
      } catch (error) {
        console.error('Failed to analyze sentiment:', error);
        // Continue without sentiment analysis if it fails
      }

      // Create survey response
      const surveyResponse = await prisma.surveyResponse.create({
        data: {
          customerId,
          preferredLanguage,
          visitReasons,
          rating,
          comments: comments || null,
          waitTimeRating: waitTimeRating || null,
          communicationRating: communicationRating || null,
          npsScore: npsScore !== undefined ? npsScore : null,
          firstTimeCompletion,
          returnReasons: returnReasons ? returnReasons : undefined,
          contactAgreement,
          customerName: customerName || null,
          customerEmail: customerEmail || null,
          customerPhone: customerPhone || null,
          vehicleNumber: vehicleNumber || null,
          sentimentScore,
          emotionAnalysis: emotionAnalysis ? emotionAnalysis : undefined,
          ipAddress,
        },
      });

      res.status(201).json({
        success: true,
        data: {
          id: surveyResponse.id,
          submittedAt: surveyResponse.submittedAt,
        },
        message: 'Survey submitted successfully',
      });
    } catch (error) {
      console.error('Error submitting survey:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to submit survey',
      });
    }
  },

  async getAnalytics(req: Request, res: Response) {
    try {
      const { startDate, endDate, limit = 100 } = req.query;

      // Build date filter
      const dateFilter: any = {};
      if (startDate) {
        dateFilter.gte = new Date(startDate as string);
      }
      if (endDate) {
        dateFilter.lte = new Date(endDate as string);
      }

      const whereClause = Object.keys(dateFilter).length > 0 ? { submittedAt: dateFilter } : {};

      // Fetch survey responses
      const surveyResponses = await prisma.surveyResponse.findMany({
        where: whereClause,
        orderBy: { submittedAt: 'desc' },
        take: Number(limit),
        include: {
          customer: {
            select: {
              customerName: true,
              vehicleMake: true,
              vehicleModel: true,
            },
          },
        },
      });

      // Calculate overall statistics
      const totalResponses = surveyResponses.length;
      const averageRating =
        totalResponses > 0
          ? surveyResponses.reduce((sum, r) => sum + r.rating, 0) / totalResponses
          : 0;

      // Rating distribution
      const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      surveyResponses.forEach((r) => {
        ratingDistribution[r.rating] = (ratingDistribution[r.rating] || 0) + 1;
      });

      // Sentiment analysis
      const sentimentScores = surveyResponses
        .filter((r) => r.sentimentScore !== null)
        .map((r) => r.sentimentScore as number);
      const averageSentiment =
        sentimentScores.length > 0
          ? sentimentScores.reduce((sum, score) => sum + score, 0) / sentimentScores.length
          : null;

      // Emotion distribution
      const emotionDistribution: Record<string, number> = {};
      surveyResponses.forEach((r) => {
        if (r.emotionAnalysis && typeof r.emotionAnalysis === 'object') {
          const emotion = (r.emotionAnalysis as any).primary_emotion;
          if (emotion) {
            emotionDistribution[emotion] = (emotionDistribution[emotion] || 0) + 1;
          }
        }
      });

      // First time completion rate
      const firstTimeCompletionCount = surveyResponses.filter((r) => r.firstTimeCompletion).length;
      const firstTimeCompletionRate =
        totalResponses > 0 ? (firstTimeCompletionCount / totalResponses) * 100 : 0;

      // Return reasons analysis
      const returnReasons: Record<string, number> = {};
      surveyResponses.forEach((r) => {
        if (r.returnReasons && Array.isArray(r.returnReasons)) {
          (r.returnReasons as string[]).forEach((reason) => {
            returnReasons[reason] = (returnReasons[reason] || 0) + 1;
          });
        }
      });

      // Visit reasons analysis
      const visitReasons: Record<string, number> = {};
      surveyResponses.forEach((r) => {
        if (r.visitReasons && Array.isArray(r.visitReasons)) {
          (r.visitReasons as string[]).forEach((reason) => {
            visitReasons[reason] = (visitReasons[reason] || 0) + 1;
          });
        }
      });

      // Contact agreement rate
      const contactAgreementCount = surveyResponses.filter((r) => r.contactAgreement).length;
      const contactAgreementRate =
        totalResponses > 0 ? (contactAgreementCount / totalResponses) * 100 : 0;

      // Language preferences
      const languagePreferences: Record<string, number> = {};
      surveyResponses.forEach((r) => {
        languagePreferences[r.preferredLanguage] =
          (languagePreferences[r.preferredLanguage] || 0) + 1;
      });

      // Response trend (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const trendData = await prisma.surveyResponse.groupBy({
        by: ['submittedAt'],
        where: {
          submittedAt: {
            gte: thirtyDaysAgo,
          },
        },
        _count: true,
      });

      // Group by date
      const dailyResponses: Record<string, number> = {};
      trendData.forEach((item) => {
        const date = item.submittedAt.toISOString().split('T')[0];
        dailyResponses[date] = (dailyResponses[date] || 0) + item._count;
      });

      // NPS Score (Net Promoter Score)
      // Promoters: 5 stars, Passives: 3-4 stars, Detractors: 1-2 stars
      const promoters = surveyResponses.filter((r) => r.rating === 5).length;
      const detractors = surveyResponses.filter((r) => r.rating <= 2).length;
      const npsScore =
        totalResponses > 0 ? ((promoters - detractors) / totalResponses) * 100 : 0;

      // User experience meter (0-100)
      // Calculated from: rating (50%), first-time completion (30%), sentiment (20%)
      const userExperienceMeter =
        (averageRating / 5) * 50 + firstTimeCompletionRate * 0.3 + (averageSentiment || 0) * 100 * 0.2;

      res.json({
        success: true,
        data: {
          overview: {
            totalResponses,
            averageRating: parseFloat(averageRating.toFixed(2)),
            averageSentiment: averageSentiment ? parseFloat(averageSentiment.toFixed(2)) : null,
            firstTimeCompletionRate: parseFloat(firstTimeCompletionRate.toFixed(2)),
            contactAgreementRate: parseFloat(contactAgreementRate.toFixed(2)),
            npsScore: parseFloat(npsScore.toFixed(2)),
            userExperienceMeter: parseFloat(userExperienceMeter.toFixed(2)),
          },
          distributions: {
            ratingDistribution,
            emotionDistribution,
            languagePreferences,
          },
          insights: {
            visitReasons: Object.entries(visitReasons)
              .map(([reason, count]) => ({ reason, count }))
              .sort((a, b) => b.count - a.count),
            returnReasons: Object.entries(returnReasons)
              .map(([reason, count]) => ({ reason, count }))
              .sort((a, b) => b.count - a.count),
          },
          trends: {
            dailyResponses: Object.entries(dailyResponses)
              .map(([date, count]) => ({ date, count }))
              .sort((a, b) => a.date.localeCompare(b.date)),
          },
          recentResponses: surveyResponses.slice(0, 10).map((r) => ({
            id: r.id,
            rating: r.rating,
            comments: r.comments,
            emotion: r.emotionAnalysis
              ? (r.emotionAnalysis as any).primary_emotion
              : null,
            submittedAt: r.submittedAt,
            customerName: r.customerName || r.customer?.customerName || 'Anonymous',
            firstTimeCompletion: r.firstTimeCompletion,
          })),
        },
      });
    } catch (error) {
      console.error('Error fetching survey analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch analytics',
      });
    }
  },

  async getIntentAnalysis(req: Request, res: Response) {
    try {
      const surveyResponses = await prisma.surveyResponse.findMany({
        select: {
          rating: true,
          comments: true,
          visitReasons: true,
          firstTimeCompletion: true,
          returnReasons: true,
          waitTimeRating: true,
          communicationRating: true,
          npsScore: true,
        },
      });

      // Rule-based intent categorization
      const intentCategoryCount: Record<string, number> = {};
      const actionableItems = new Map<string, number>();
      let urgentIssuesCount = 0;

      surveyResponses.forEach((response) => {
        const visitReasons = response.visitReasons as string[];
        const returnReasons = (response.returnReasons as string[]) || [];

        // Determine primary intent category based on rating and completion
        let intentCategory = 'general_feedback';
        let urgencyLevel = 'low';

        // Service Quality Issues
        if (!response.firstTimeCompletion) {
          intentCategory = 'service_quality';
          urgencyLevel = 'high';
          urgentIssuesCount++;

          // Add return reasons as actionable items
          returnReasons.forEach(reason => {
            actionableItems.set(reason, (actionableItems.get(reason) || 0) + 1);
          });
        }
        // Wait Time Issues
        else if (response.waitTimeRating && response.waitTimeRating <= 2) {
          intentCategory = 'convenience';
          urgencyLevel = response.waitTimeRating === 1 ? 'high' : 'medium';
          actionableItems.set('Reduce wait times', (actionableItems.get('Reduce wait times') || 0) + 1);
          if (urgencyLevel === 'high') urgentIssuesCount++;
        }
        // Communication Issues
        else if (response.communicationRating && response.communicationRating <= 2) {
          intentCategory = 'staff_behavior';
          urgencyLevel = 'medium';
          actionableItems.set('Improve customer communication', (actionableItems.get('Improve customer communication') || 0) + 1);
        }
        // Price Concerns (inferred from comments or low rating with specific services)
        else if (response.rating <= 2 && (
          visitReasons.includes('Warranty service') ||
          visitReasons.includes('Accident repair') ||
          (response.comments && response.comments.toLowerCase().includes('price'))
        )) {
          intentCategory = 'pricing';
          urgencyLevel = 'medium';
          actionableItems.set('Review pricing strategy', (actionableItems.get('Review pricing strategy') || 0) + 1);
        }
        // Technical Issues (specific service types with low rating)
        else if (response.rating <= 3 && (
          visitReasons.includes('Engine problem') ||
          visitReasons.includes('Transmission issue') ||
          visitReasons.includes('Electrical problem')
        )) {
          intentCategory = 'technical_issue';
          urgencyLevel = 'high';
          urgentIssuesCount++;
          actionableItems.set('Improve technical diagnostics', (actionableItems.get('Improve technical diagnostics') || 0) + 1);
        }
        // Facility Concerns
        else if (response.comments && (
          response.comments.toLowerCase().includes('facility') ||
          response.comments.toLowerCase().includes('waiting area') ||
          response.comments.toLowerCase().includes('clean')
        )) {
          intentCategory = 'facility';
          urgencyLevel = 'low';
          actionableItems.set('Improve facility cleanliness', (actionableItems.get('Improve facility cleanliness') || 0) + 1);
        }
        // Positive feedback
        else if (response.rating >= 4 && response.npsScore && response.npsScore >= 9) {
          intentCategory = 'general_feedback';
          urgencyLevel = 'low';
          actionableItems.set('Maintain current service quality', (actionableItems.get('Maintain current service quality') || 0) + 1);
        }

        // Increment category count
        intentCategoryCount[intentCategory] = (intentCategoryCount[intentCategory] || 0) + 1;
      });

      const topActionableItems = Array.from(actionableItems.entries())
        .map(([item, count]) => ({ item, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      res.json({
        success: true,
        data: {
          intentCategories: Object.entries(intentCategoryCount)
            .map(([category, count]) => ({
              category,
              count,
              percentage: (count / surveyResponses.length) * 100,
            }))
            .sort((a, b) => b.count - a.count),
          urgentIssuesCount,
          topActionableItems,
          totalAnalyzed: surveyResponses.length,
        },
      });
    } catch (error) {
      console.error('Error fetching intent analysis:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch intent analysis',
      });
    }
  },

  async getAdvancedAnalytics(req: Request, res: Response) {
    try {
      // Get all survey responses
      const responses = await prisma.surveyResponse.findMany({
        select: {
          rating: true,
          waitTimeRating: true,
          communicationRating: true,
          npsScore: true,
          firstTimeCompletion: true,
          visitReasons: true,
          sentimentScore: true,
          submittedAt: true,
        },
      });

      // Calculate CX Score
      const cxScore = advancedAnalytics.calculateCXScore(responses);

      // Get Service Type Matrix
      const serviceTypeMatrix = await advancedAnalytics.getServiceTypeMatrix();

      // Get Predictive Insights
      const predictiveInsights = await advancedAnalytics.getPredictiveInsights();

      // Get NPS Analysis
      const npsAnalysis = await advancedAnalytics.getNPSAnalysis();

      // Get Experience Metrics
      const experienceMetrics = await advancedAnalytics.getExperienceMetrics();

      res.json({
        success: true,
        data: {
          cxScore,
          serviceTypeMatrix,
          predictiveInsights,
          npsAnalysis,
          experienceMetrics,
        },
      });
    } catch (error) {
      console.error('Error fetching advanced analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch advanced analytics',
      });
    }
  },
};
