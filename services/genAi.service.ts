import { GoogleGenAI } from "@google/genai";
import logger from "../utils/logger";



class GenAi {

    private ai: GoogleGenAI;

    constructor() {
        this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }


   async generateChatTitle(text: string) {
    try {
        console.log(text);
        const prompt = `
            Create a concise title with ONLY 4 to 5 words.
            - No punctuation.
            - No quotes.
            - No explanations.
            - Output ONLY the title text.
            
            Text: ${text}
        `;
    
        const response = await this.ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
    
        // The SDK returns a Content object, use `.text()` not `.text`
        const title = response.text;
        if(title){
            return title.trim();
        }
        return null;
    } catch (error) {
        logger.error(error);
        throw error;
    }
}

}


export default new GenAi();
