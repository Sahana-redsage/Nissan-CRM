import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../src/config/env';

async function listModels() {
    const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    try {
        // Note: listModels might not be directly exposed on the main instance in some SDK versions,
        // but usually accessible via client. Or we can just try a simple generation test.
        // The SDK documentation says request 'models/gemini-pro' etc.
        // Let's rely on standard model names if list is hard.

        // Instead of listing (which requires specific permission scopes sometimes), 
        // let's try to generate with a few likely candidates.
        const candidates = ['gemini-1.5-flash', 'gemini-pro', 'gemini-1.0-pro', 'gemini-1.5-pro', 'gemini-1.5-flash'];

        console.log('Testing models with API Key:', config.gemini.apiKey ? '***' : 'MISSING');

        for (const modelName of candidates) {
            console.log(`\nTesting model: ${modelName}`);
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent('Hi');
                console.log(`SUCCESS: ${modelName} works! Response: ${result.response.text()}`);
            } catch (error: any) {
                console.log(`FAILED: ${modelName}. Error: ${error.message}`);
            }
        }

    } catch (error) {
        console.error('Fatal error in script:', error);
    }
}

listModels();
