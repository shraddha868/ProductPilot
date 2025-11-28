// app.js
import 'dotenv/config';
import readline from 'node:readline/promises';
import Groq from 'groq-sdk';
import { tavily } from '@tavily/core';

const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

// Make sure you ran: npm install groq-sdk
// And package.json contains: "type": "module"
// And your .env contains: GROQ_API_KEY=your_api_key

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are a smart product recommendation assistant who helps users find the best products based on their needs.
Your job is to:
  - Understand the user's preferences (budget, features, brand, use-case)
  - Ask follow-up questions only when the user provides meaningful messages
  - Recommend 2–4 products with short, clear explanations
  - Provide pros, cons, and typical price (if available)
  - Use real-time data from the internet when needed (via the webSearch tool)

Default output style:
  - For recommendations: use clean bullet points (no long paragraphs).
  - For greetings and quick slot-collection: use short lines/questions (not bullets).

Current date and time: ${new Date().toUTCString()}`;

const STARTER_ASSISTANT_GREETING = `Hello! ProductPilot here. Tell me what you need, and I’ll recommend the best options!

What type of product are you looking for (e.g., phone, laptop, headphones, home appliance)?
Do you have a budget range or a specific price limit in mind?
Any particular features, brands, or use-case requirements that are important to you?`;

/**
 * Helper: limit conversation history to last N messages to avoid huge context
 */
function trimMessages(messages, keep = 18) {
  if (messages.length <= keep) return messages;
  // Keep the system message at index 0
  const sys = messages[0];
  const recent = messages.slice(-keep);
  return [sys, ...recent];
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  // initial messages array - system prompt only
  const messages = [
    {
      role: 'system',
      content: SYSTEM_PROMPT,
    },
  ];

  console.log('ProductPilot (local) — type "bye" to exit.');
  while (true) {
    const question = await rl.question('You: ');

    if (!question) {
      // user pressed enter with no text
      console.log('Assistant:', STARTER_ASSISTANT_GREETING);
      continue;
    }

    const trimmed = question.trim();

    // exit condition
    if (trimmed.toLowerCase() === 'bye') {
      console.log('Assistant: Goodbye 👋');
      break;
    }

    // If user message is too short or looks like garbage, reply with the greeting locally.
    if (trimmed.length < 3 || /^[a-z]{1,2}$/i.test(trimmed)) {
      console.log('Assistant:', STARTER_ASSISTANT_GREETING);
      // Also append assistant message to history (if you want the model to see it later)
      messages.push({ role: 'user', content: trimmed });
      messages.push({ role: 'assistant', content: STARTER_ASSISTANT_GREETING });
      // keep messages trimmed
      trimMessages(messages);
      continue;
    }

    // Add user message to history
    messages.push({ role: 'user', content: trimmed });
    // Trim history to keep the last N messages + system
    const currentMessages = trimMessages(messages, 18);

    try {
      // Request completions from Groq
      const completions = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.0,
        messages: currentMessages,
        // declare a webSearch function/tool the model can call
        tools: [
          {
            type: 'function',
            function: {
              name: 'webSearch',
              description: 'Search the latest information and realtime data on the internet.',
              parameters: {
                type: 'object',
                properties: {
                  query: { type: 'string', description: 'The search query' },
                },
                required: ['query'],
              },
            },
          },
        ],
        tool_choice: 'auto',
      });

      const choice = completions.choices?.[0];
      if (!choice) {
        console.log('Assistant: (no choice returned)');
        continue;
      }

      // Push the assistant message (could be content or a tool_call request)
      messages.push(choice.message);

      const toolCalls = choice.message.tool_calls;

      if (!toolCalls || toolCalls.length === 0) {
        // No tool calls — simple assistant content
        console.log('Assistant:', choice.message.content);
      } else {
        // If the model called tools, iterate through them and execute them
        for (const tool of toolCalls) {
          const functionName = tool.function.name;
          const functionParams = tool.function.arguments;

          if (functionName === 'webSearch') {
            let parsedParams;
            try {
              parsedParams = JSON.parse(functionParams);
            } catch (err) {
              console.error('Failed to parse tool arguments:', err);
              continue;
            }

            // call the webSearch implementation
            const toolResult = await webSearch(parsedParams);

            // push tool result to messages so the model can continue
            messages.push({
              tool_call_id: tool.id,
              role: 'tool',
              name: functionName,
              content: toolResult,
            });

            // Now ask the model to continue and produce a final answer (one more completion)
            const followUp = await groq.chat.completions.create({
              model: 'llama-3.3-70b-versatile',
              temperature: 0.0,
              messages: trimMessages(messages, 18),
            });

            const followChoice = followUp.choices?.[0];
            if (followChoice) {
              messages.push(followChoice.message);
              console.log('Assistant:', followChoice.message.content);
            } else {
              console.log('Assistant: (no follow-up from model after tool call)');
            }
          } else {
            console.log(`Unknown tool requested: ${functionName}`);
          }
        }
      }
    } catch (err) {
      console.error('Error calling model:', err);
      console.log('Assistant: Sorry — I could not get a response. Please try again.');
    }
  }

  rl.close();
}

/**
 * webSearch - placeholder implementation.
 *
 * Replace the internals of this function with whatever web search API you prefer.
 * Example integration options:
 *  - Call a custom search API you control
 *  - Use Bing Search API / SerpAPI / Google Custom Search / etc.
 *
 * For now, this placeholder returns a short string saying "web search not configured".
 */
async function webSearch({ query }) {
  console.log('webSearch called for query:', query);

  // Example: If you have SerpAPI
  // const resp = await fetch(`https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${SERPAPI_KEY}`);
  // const data = await resp.json();
  // return data.organic_results.map(r => r.snippet || r.title + ' - ' + r.link).join('\n\n');

  // Placeholder (safe): include the query and tell the model no real web search is configured.
  return `WEB_SEARCH_PLACEHOLDER: web search not configured for query: "${query}". Replace webSearch() with your API call to return real results.`;
}

// run
main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
