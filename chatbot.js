import readline from 'node:readline/promises';
import Groq from 'groq-sdk';
import { tavily } from '@tavily/core';

// Initialize Tavily + Groq
const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function generate(userMessage) {
    


const messages = [
  {
    role: 'system',
    content: `You are a smart product recommendation assistant who helps users find the best products based on their needs.
   Your job is to:
  - Understand the user's preferences (budget, features, brand, use-case)
  - Ask follow-up questions if the user request is unclear
  - Recommend 2–4 products with short, clear explanations
  - Provide pros, cons, and typical price (if available)
  - Use real-time data from the internet when needed

   You have access to the following tool:
   1. searchWeb({query}: {query: string}) // Search the latest information and realtime product data on the internet.

   Always respond politely, professionally, and concisely.
   Default output style:
  - For recommendations: use clean bullet points (no long paragraphs).
  - For greetings and quick slot-collection: use short lines/questions (not bullets).

    Current date and time: ${new Date().toUTCString()}`
  },

  // --- Add this assistant starter message so the bot responds exactly how you want on "hi"
  {
    role: 'assistant',
    content: `Hello! ProductPilot here. Tell me what you need, and I’ll recommend the best options!
    What type of product are you looking for (e.g., phone, laptop, headphones, home appliance)?
    Do you have a budget range or a specific price limit in mind?
    Any particular features, brands, or use-case requirements that are important to you?`
  }

  // ...other messages or conversation history
];

    

    
        messages.push({
            role: 'user',
            content: userMessage,
        });

        while (true) {
            const completions = await groq.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                temperature: 0,
                messages: messages,
                tools: [
                    {
                        type: 'function',
                        function: {
                            name: 'webSearch',
                            description: 'Search the latest information and realtime data on the internet.',
                            parameters: {
                                type: 'object',
                                properties: {
                                    query: {
                                        type: 'string',
                                        description: 'The search query to perform search on.',
                                    },
                                },
                                required: ['query'],
                            },
                        },
                    },
                ],
                tool_choice: 'auto',
            });

            messages.push(completions.choices[0].message);

            const toolCalls = completions.choices[0].message.tool_calls;

            if (!toolCalls) {
                return completions.choices[0].message.content;
            }

            for (const tool of toolCalls) {
                const functionName = tool.function.name;
                const functionParams = tool.function.arguments;

                if (functionName === 'webSearch') {
                    const toolResult = await webSearch(JSON.parse(functionParams));

                    messages.push({
                        tool_call_id: tool.id,
                        role: 'tool',
                        name: functionName,
                        content: toolResult,
                    });
                }
            }
        }

       
       
    }




async function webSearch({ query }) {
    console.log('Calling web search...');

    const response = await tvly.search(query);

    const finalResult = response.results.map((result) => result.content).join('\n\n');

    return finalResult;
}
