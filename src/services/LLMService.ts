import type { QmdSettings } from '../types/settings';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMProvider {
  chat(messages: Message[]): Promise<string>;
}

export class OpenAIProvider implements LLMProvider {
  constructor(
    private apiKey: string,
    private model: string
  ) {}

  async chat(messages: Message[]): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }
}

export class AnthropicProvider implements LLMProvider {
  constructor(
    private apiKey: string,
    private model: string
  ) {}

  async chat(messages: Message[]): Promise<string> {
    const systemMessage = messages.find(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 2048,
        system: systemMessage?.content,
        messages: conversationMessages.map(m => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${error}`);
    }

    const data = await response.json();
    return data.content[0].text;
  }
}

export class GeminiProvider implements LLMProvider {
  constructor(
    private apiKey: string,
    private model: string
  ) {}

  async chat(messages: Message[]): Promise<string> {
    const systemMessage = messages.find(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    const contents = conversationMessages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const requestBody: Record<string, unknown> = { contents };
    
    if (systemMessage) {
      requestBody.systemInstruction = {
        parts: [{ text: systemMessage.content }],
      };
    }

    requestBody.generationConfig = {
      maxOutputTokens: 2048,
      temperature: 0.7,
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${error}`);
    }

    const data = await response.json();
    
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('Gemini returned no response');
    }

    return data.candidates[0].content.parts[0].text;
  }
}

export class OllamaProvider implements LLMProvider {
  constructor(
    private baseUrl: string,
    private model: string
  ) {}

  async chat(messages: Message[]): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${error}`);
    }

    const data = await response.json();
    return data.message.content;
  }
}

export function createLLMProvider(settings: QmdSettings): LLMProvider | null {
  switch (settings.llmProvider) {
    case 'openai': {
      if (!settings.openaiApiKey) return null;
      const model = settings.useOpenaiCustomModel && settings.openaiCustomModel 
        ? settings.openaiCustomModel 
        : settings.openaiModel;
      return new OpenAIProvider(settings.openaiApiKey, model);
    }
    case 'anthropic': {
      if (!settings.anthropicApiKey) return null;
      const model = settings.useAnthropicCustomModel && settings.anthropicCustomModel
        ? settings.anthropicCustomModel
        : settings.anthropicModel;
      return new AnthropicProvider(settings.anthropicApiKey, model);
    }
    case 'gemini': {
      if (!settings.geminiApiKey) return null;
      const model = settings.useGeminiCustomModel && settings.geminiCustomModel
        ? settings.geminiCustomModel
        : settings.geminiModel;
      return new GeminiProvider(settings.geminiApiKey, model);
    }
    case 'ollama':
      return new OllamaProvider(settings.ollamaUrl, settings.ollamaModel);
    default:
      return null;
  }
}
