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
      model: 'gemini-1.5-flash',
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
      model: 'gemini-1.5-flash',
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

  async summarizeInsightsForEmail(insights: ServiceInsights, customerName: string): Promise<string> {
    const prompt = `
You are writing a short, customer-facing email from an authorized vehicle service center, encouraging the customer to review their upcoming due service insights via a link in the email.

CUSTOMER: ${customerName || "Valued Customer"}
INSIGHTS: ${JSON.stringify(insights)}

Objective:
Create a concise, engaging summary that highlights the most important service insights and motivates the customer to click the link to view full details.

Instructions:
1. Start with a warm, personalized greeting using the customer's name (e.g., "Dear [Name],").
2. Write a compelling body of fewer than 50 words that:
   - Summarizes key technical findings at a high level
   - Emphasizes the most urgent or valuable service recommendation
   - Creates curiosity and value, encouraging the customer to view the detailed insights via the link
3. Use professional automotive service terminology (e.g., "Recommended periodic maintenance", "Preventive inspection findings").
4. Do NOT mention the vehicle’s specific age or make assumptions about usage.
5. End with a polite, professional sign-off (e.g., "Sincerely,<br>Your Service Team").
6. Tone: Warm, reassuring, professional, and customer-centric.
7. Output format:
   - Return a single HTML <p> element
   - Format as a complete email using <br> for line breaks (greeting <br> body <br> sign-off)
   - Do not include the actual link text or URL.
`;

    const model = genAI.getGenerativeModel({
      model: 'gemini-flash-latest',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    });

    const result = await model.generateContent(prompt);
    let emailBody = result.response.text();

    // Clean up if markdown code blocks are present
    emailBody = emailBody.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();

    return emailBody;
  },

  async generateWhatsappSummary(vehicleData: VehicleData, insights: ServiceInsights, customerName?: string, link?: string): Promise<string> {
    const prompt = `Write a professional service message for a customer.
 
CUSTOMER: ${customerName || 'Valued Customer'}
VEHICLE: ${vehicleData.vehicleMake} ${vehicleData.vehicleModel}
INSIGHTS: ${JSON.stringify(insights)}
LINK: ${link || '[Link]'}
 
*CRITICAL*: Never miss the link in the message. Give the entire link as it is.Dont miss or truncate it
 
Instructions:
1. **Greeting**: "Hello [Name] 👋". (Exactly one emoji).
2. **Intro**: State that we analyzed the service history for their [Vehicle].
3. **Recommendations**: List 2 pivotal items. Use this format: "- [Service Name]: [Reason]."
   - **NO** asterisks (*) or bolding. Keep it clean plain text.
4. **CTA**: "Please book this service at the earliest."
5. **URL**: "View report: [Link]"
   - **CRITICAL**: Output [Link] EXACTLY. Do NOT shorten.
6. **Constraint**: Keep it under 60 words, but use line breaks for readability.
 
7. Sign-off: "Sincerely, Your Service Team"`;

    // Use gemini-flash-latest as requested
    const model = genAI.getGenerativeModel({
      model: 'gemini-flash-latest',
      generationConfig: {
        temperature: 0.5,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 800,
      },
    });

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();

      console.log('=== WhatsApp Summary Response ===');
      console.log('Raw:', text);

      if (!text || !text.trim()) {
        throw new Error('Empty response from LLM');
      }

      return text.trim();
    } catch (error) {
      console.error('Error generating WhatsApp summary:', error);
      return `Hello ${customerName || 'Customer'} 👋,\n\nWe have analyzed the service history for your ${vehicleData.vehicleMake} ${vehicleData.vehicleModel}. Please review the recommended maintenance items in the full report below.\n\nReport Link: ${link}\n\nSincerely,\nYour Service Team`;
    }
  },

}