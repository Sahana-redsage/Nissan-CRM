import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env';

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

interface VehicleData {
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear?: number;
  totalMileage: number;
  lastServiceDate?: Date;
}

interface CustomerDetails {
  customerName?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: number;
  vehicleNumber?: string;
  totalMileage?: number;
  lastServiceDate?: string;
  phoneNumber?: string;
  email?: string;
}

interface ServiceInsights {
  priority_items: Array<{
    item: string;
    reason: string;
    urgency: 'high' | 'medium' | 'low';
    estimated_cost: string;
  }>;
  recommended_services: Array<{
    item: string;
    reason: string;
    urgency: 'high' | 'medium' | 'low';
    estimated_cost: string;
  }>;
  optional_checks: Array<{
    item: string;
    reason: string;
    urgency: 'high' | 'medium' | 'low';
    estimated_cost: string;
  }>;
  summary: string;
}

export const llmService = {
  constructPrompt(vehicleData: VehicleData, pdfTexts: string[]): string {
    const combinedPdfText = pdfTexts.join('\n---\n').substring(0, 3000); // Limit PDF text to 3000 chars

    return `Analyze this vehicle's service history and provide maintenance recommendations in JSON format.

VEHICLE: ${vehicleData.vehicleMake} ${vehicleData.vehicleModel} (${vehicleData.vehicleYear || 'N/A'})
MILEAGE: ${vehicleData.totalMileage} km
LAST SERVICE: ${vehicleData.lastServiceDate ? vehicleData.lastServiceDate.toISOString().split('T')[0] : 'Unknown'}

SERVICE HISTORY:
${combinedPdfText}

Return ONLY valid JSON (NO markdown blocks, NO explanatory text):
{
  "priority_items": [{"item": "Service Name", "reason": "Brief reason", "urgency": "high", "estimated_cost": "₹X,000 - ₹Y,000"}],
  "recommended_services": [{"item": "Service Name", "reason": "Brief reason", "urgency": "medium", "estimated_cost": "₹X,000 - ₹Y,000"}],
  "optional_checks": [{"item": "Service Name", "reason": "Brief reason", "urgency": "low", "estimated_cost": "₹X00 - ₹Y,000"}],
  "summary": "One sentence summary"
}

Keep each section to 2-3 items max. Be concise. Use ₹ for costs.`;
  },

  async generateServiceInsights(
    vehicleData: VehicleData,
    pdfTexts: string[]
  ): Promise<{ insights: ServiceInsights; rawResponse: string }> {
    const prompt = this.constructPrompt(vehicleData, pdfTexts);

    // Use Gemini 2.5 Flash for fast, cost-effective generation
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        topK: 64,
        maxOutputTokens: 8192,
      },
    });

    const result = await model.generateContent(prompt);
    const response = result.response;

    // Log finish reason to debug why generation stopped
    console.log('=== GENERATION METADATA ===');
    console.log('Finish Reason:', response.candidates?.[0]?.finishReason);
    console.log('Safety Ratings:', JSON.stringify(response.candidates?.[0]?.safetyRatings, null, 2));
    console.log('=== END METADATA ===');

    let rawResponse = response.text();

    // Log the raw response for debugging
    console.log('=== RAW LLM RESPONSE ===');
    console.log(rawResponse);
    console.log('Response length:', rawResponse.length, 'characters');
    console.log('=== END RAW RESPONSE ===');

    // Clean up response - remove markdown code blocks if present
    rawResponse = rawResponse
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    // Parse the JSON response
    let insights: ServiceInsights;
    try {
      insights = JSON.parse(rawResponse) as ServiceInsights;
    } catch (error) {
      // If parsing fails, try to extract JSON from the response
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          insights = JSON.parse(jsonMatch[0]) as ServiceInsights;
        } catch (parseError) {
          console.error('Failed to parse extracted JSON:', jsonMatch[0]);
          throw new Error(`Failed to parse AI response as JSON. Response: ${rawResponse.substring(0, 200)}...`);
        }
      } else {
        console.error('No JSON found in response:', rawResponse);
        throw new Error(`Failed to parse AI response as JSON. Response: ${rawResponse.substring(0, 200)}...`);
      }
    }

    return { insights, rawResponse };
  },

  async extractCustomerDetails(pdfText: string): Promise<CustomerDetails> {
    const prompt = `Extract customer and vehicle details from this service document. Return ONLY valid JSON (NO markdown blocks, NO explanatory text):

SERVICE DOCUMENT:
${pdfText.substring(0, 2000)}

Return this exact JSON structure:
{
  "customerName": "Full name or null",
  "vehicleMake": "Make or null",
  "vehicleModel": "Model or null", 
  "vehicleYear": number or null,
  "vehicleNumber": "Registration number or null",
  "totalMileage": number or null,
  "lastServiceDate": "YYYY-MM-DD or null",
  "phoneNumber": "Phone or null",
  "email": "Email or null"
}

If a field is not found, use null. Extract only what's clearly stated in the document.`;

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.3,
        topP: 0.95,
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
      return JSON.parse(rawResponse) as CustomerDetails;
    } catch (error) {
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as CustomerDetails;
      }
      console.error('Failed to parse customer details:', rawResponse);
      return {};
    }
  },
};
