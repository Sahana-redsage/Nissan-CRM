import OpenAI from 'openai';
import { config } from '../config/env';

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

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

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an expert automotive service advisor.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 4096, // Plenty for JSON
    });

    const rawResponse = completion.choices[0].message.content || '{}';

    // Log the raw response for debugging
    console.log('=== RAW LLM RESPONSE ===');
    console.log(rawResponse);
    console.log('=== END RAW RESPONSE ===');

    // Parse the JSON response
    let insights: ServiceInsights;
    try {
      insights = JSON.parse(rawResponse) as ServiceInsights;
    } catch (error) {
      console.error('Failed to parse JSON:', rawResponse);
      throw new Error(`Failed to parse AI response as JSON.`);
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

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 1024,
    });

    const rawResponse = completion.choices[0].message.content || '{}';

    try {
      return JSON.parse(rawResponse) as CustomerDetails;
    } catch (error) {
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

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 1024,
    });

    let emailBody = completion.choices[0].message.content || '';

    // Clean up if markdown code blocks are present
    emailBody = emailBody.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();

    return emailBody;
  },

  async generateWhatsappSummary(vehicleData: VehicleData, insights: ServiceInsights, customerName?: string): Promise<string> {
    const prompt = `Write a short, professional WhatsApp message for a vehicle service reminder.

CUSTOMER: ${customerName || 'Valued Customer'}
VEHICLE: ${vehicleData.vehicleMake} ${vehicleData.vehicleModel}
INSIGHTS: ${JSON.stringify(insights)}

Instructions:
1. Start with "Hi [Customer Name] 👋,".
2. State clearly that we have analyzed the service history.
3. Extract exactly 2 key maintenance points from the insights.
4. List them as simple bullet points (e.g. "- Brake Pads").
5. Keep it very concise.
6. Return PLAIN TEXT.
7. Do NOT include any links or "Book now" text. (This will be added separately).`;

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 500,
      });
      return completion.choices[0].message.content?.trim() || '';
    } catch (error) {
      console.error('Error generating WhatsApp summary:', error);
      return `Hi ${customerName || 'Valued Customer'} 👋,\n\nWe analyzed your ${vehicleData.vehicleMake} ${vehicleData.vehicleModel} service history. Key updates available.`;
    }
  },

  async generateSentimentAnalysis(transcript: string): Promise<{ sentiment: string; score: number }> {
    const prompt = `Act as a Quality Assurance Specialist for a customer service team. Analyze the following call transcript between a telecaller (Agent) and a customer.

Your goal is to determine the Customer's sentiment and emotional state accurately.

Instructions:
1. **Analyze Tone & Urgency**: Look for keywords indicating frustration, gratitude, anger, confusion, happiness, or urgency.
2. **Avoid Defaulting to Neutral**: Only classify as "Neutral" if the conversation is purely transactional and devoid of any emotion. Most calls have some underlying sentiment.
3. **Determine Specific Emotion**: Identify the dominant emotion (e.g., Frustrated, Satisfied, Confused, Urgent, Grateful, Annoyed, Skeptical).
4. **Assign Sentiment Category**: Positive, Negative, Neutral, or Mixed.
5. **Assign Score**: -1.0 (Very Negative) to 1.0 (Very Positive).

TRANSCRIPT:
${transcript.substring(0, 5000)}

Return ONLY valid JSON:
{
  "sentiment": "Positive/Negative/Neutral/Mixed",
  "emotion": "Specific Emotion (e.g. Frustrated, Satisfied)",
  "score": number (-1.0 to 1.0)
}`;

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 256,
      });

      const rawResponse = completion.choices[0].message.content || '{}';
      const parsed = JSON.parse(rawResponse);

      // Combine category and emotion for the existing string field
      // e.g. "Negative (Frustrated)"
      let sentimentString = parsed.sentiment || 'Neutral';
      if (parsed.emotion && parsed.emotion !== 'None') {
        sentimentString = `${sentimentString} (${parsed.emotion})`;
      }

      return {
        sentiment: sentimentString,
        score: typeof parsed.score === 'number' ? parsed.score : 0,
      };
    } catch (error) {
      console.error('Error generating sentiment analysis:', error);
      return { sentiment: 'Neutral', score: 0 };
    }
  },

}