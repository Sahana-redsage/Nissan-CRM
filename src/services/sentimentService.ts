import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env';

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

interface EmotionAnalysis {
  primary_emotion: 'very_satisfied' | 'satisfied' | 'neutral' | 'dissatisfied' | 'very_dissatisfied';
  emotion_confidence: number;
  key_sentiments: Array<{
    aspect: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    intensity: number;
  }>;
  tone: 'professional' | 'casual' | 'frustrated' | 'appreciative' | 'concerned';
  summary: string;
}

interface IntentAnalysis {
  primary_intent: string;
  intent_category: 'service_quality' | 'pricing' | 'staff_behavior' | 'facility' | 'convenience' | 'technical_issue' | 'general_feedback';
  confidence: number;
  actionable_items: string[];
  urgency_level: 'high' | 'medium' | 'low';
}

export const sentimentService = {
  async analyzeEmotion(
    rating: number,
    comments: string,
    visitReasons: string[],
    firstTimeCompletion: boolean,
    returnReasons?: string[]
  ): Promise<{ emotionAnalysis: EmotionAnalysis; sentimentScore: number }> {
    const context = `
RATING: ${rating}/5 stars
VISIT REASONS: ${visitReasons.join(', ')}
FIRST TIME COMPLETION: ${firstTimeCompletion ? 'Yes' : 'No'}
${returnReasons && returnReasons.length > 0 ? `RETURN REASONS: ${returnReasons.join(', ')}` : ''}
CUSTOMER COMMENTS: ${comments || 'No comments provided'}
    `.trim();

    const prompt = `Analyze this customer feedback from a vehicle service center survey and provide emotion analysis in JSON format.

${context}

Return ONLY valid JSON (NO markdown blocks, NO explanatory text):
{
  "primary_emotion": "very_satisfied|satisfied|neutral|dissatisfied|very_dissatisfied",
  "emotion_confidence": 0.0-1.0,
  "key_sentiments": [
    {
      "aspect": "specific aspect of service",
      "sentiment": "positive|negative|neutral",
      "intensity": 0.0-1.0
    }
  ],
  "tone": "professional|casual|frustrated|appreciative|concerned",
  "summary": "Brief emotion summary in one sentence"
}

Consider the rating, whether service was completed on first visit, and the tone of comments.`;

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.5,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 2048,
      },
    });

    const result = await model.generateContent(prompt);
    let rawResponse = result.response.text();

    // Clean up response
    rawResponse = rawResponse
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    let emotionAnalysis: EmotionAnalysis;
    try {
      emotionAnalysis = JSON.parse(rawResponse) as EmotionAnalysis;
    } catch (error) {
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          emotionAnalysis = JSON.parse(jsonMatch[0]) as EmotionAnalysis;
        } catch (parseError) {
          console.error('Failed to parse emotion analysis:', rawResponse);
          throw new Error('Failed to parse emotion analysis from AI');
        }
      } else {
        throw new Error('No valid JSON found in AI response');
      }
    }

    // Calculate sentiment score based on rating, emotion, and context
    let sentimentScore = rating / 5; // Base score from rating

    // Adjust based on first time completion
    if (!firstTimeCompletion) {
      sentimentScore -= 0.2;
    }

    // Adjust based on primary emotion
    const emotionAdjustment: Record<string, number> = {
      very_satisfied: 0.1,
      satisfied: 0.05,
      neutral: 0,
      dissatisfied: -0.1,
      very_dissatisfied: -0.2,
    };
    sentimentScore += emotionAdjustment[emotionAnalysis.primary_emotion] || 0;

    // Clamp between 0 and 1
    sentimentScore = Math.max(0, Math.min(1, sentimentScore));

    return { emotionAnalysis, sentimentScore };
  },

  async analyzeIntent(
    visitReasons: string[],
    comments: string,
    rating: number,
    firstTimeCompletion: boolean
  ): Promise<IntentAnalysis> {
    const context = `
VISIT REASONS: ${visitReasons.join(', ')}
RATING: ${rating}/5 stars
FIRST TIME COMPLETION: ${firstTimeCompletion ? 'Yes' : 'No'}
CUSTOMER COMMENTS: ${comments || 'No comments provided'}
    `.trim();

    const prompt = `Analyze the customer's intent from this vehicle service center feedback and categorize their primary concern.

${context}

Return ONLY valid JSON (NO markdown blocks, NO explanatory text):
{
  "primary_intent": "Brief description of main intent",
  "intent_category": "service_quality|pricing|staff_behavior|facility|convenience|technical_issue|general_feedback",
  "confidence": 0.0-1.0,
  "actionable_items": ["Action item 1", "Action item 2"],
  "urgency_level": "high|medium|low"
}

Determine urgency based on rating and whether service was completed correctly on first visit.`;

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.4,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 1024,
      },
    });

    const result = await model.generateContent(prompt);
    let rawResponse = result.response.text();

    // Clean up response
    rawResponse = rawResponse
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    try {
      return JSON.parse(rawResponse) as IntentAnalysis;
    } catch (error) {
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as IntentAnalysis;
      }
      console.error('Failed to parse intent analysis:', rawResponse);
      throw new Error('Failed to parse intent analysis from AI');
    }
  },

  async analyzeBatch(
    responses: Array<{
      rating: number;
      comments: string;
      visitReasons: string[];
      firstTimeCompletion: boolean;
      returnReasons?: string[];
    }>
  ): Promise<{
    averageSentiment: number;
    emotionDistribution: Record<string, number>;
    commonIntents: string[];
    urgentCount: number;
  }> {
    const results = {
      averageSentiment: 0,
      emotionDistribution: {} as Record<string, number>,
      commonIntents: [] as string[],
      urgentCount: 0,
    };

    if (responses.length === 0) return results;

    let totalSentiment = 0;
    const intents = new Map<string, number>();

    for (const response of responses) {
      try {
        const { sentimentScore, emotionAnalysis } = await this.analyzeEmotion(
          response.rating,
          response.comments,
          response.visitReasons,
          response.firstTimeCompletion,
          response.returnReasons
        );

        totalSentiment += sentimentScore;

        // Count emotions
        results.emotionDistribution[emotionAnalysis.primary_emotion] =
          (results.emotionDistribution[emotionAnalysis.primary_emotion] || 0) + 1;

        // Analyze intent
        const intentAnalysis = await this.analyzeIntent(
          response.visitReasons,
          response.comments,
          response.rating,
          response.firstTimeCompletion
        );

        // Count intents
        const intentKey = intentAnalysis.intent_category;
        intents.set(intentKey, (intents.get(intentKey) || 0) + 1);

        // Count urgent issues
        if (intentAnalysis.urgency_level === 'high') {
          results.urgentCount++;
        }
      } catch (error) {
        console.error('Error analyzing response:', error);
        // Continue with other responses
      }
    }

    results.averageSentiment = totalSentiment / responses.length;

    // Get top 5 most common intents
    results.commonIntents = Array.from(intents.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([intent]) => intent);

    return results;
  },
};
