/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from "@google/genai";

export interface LiveSessionCallbacks {
  onAudioData: (base64: string) => void;
  onInterrupted: () => void;
  onStateChange: (state: 'disconnected' | 'connecting' | 'listening' | 'speaking') => void;
  onThemeChange: (theme: string) => void;
  onError: (error: any) => void;
}

export class LiveSession {
  private ai: GoogleGenAI;
  private session: any = null;
  private callbacks: LiveSessionCallbacks;
  private model = "gemini-3.1-flash-live-preview";

  constructor(apiKey: string, callbacks: LiveSessionCallbacks) {
    this.ai = new GoogleGenAI({ apiKey });
    this.callbacks = callbacks;
  }

  async connect() {
    this.callbacks.onStateChange('connecting');

    const openWebsiteTool: FunctionDeclaration = {
      name: "openWebsite",
      description: "Opens a specific website in the user's browser.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          url: {
            type: Type.STRING,
            description: "The full URL of the website to open (e.g., https://google.com).",
          },
        },
        required: ["url"],
      },
    };

    const setThemeTool: FunctionDeclaration = {
      name: "setTheme",
      description: "Changes the visual theme of the application.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          theme: {
            type: Type.STRING,
            enum: ["futuristic", "neon", "minimal", "luxury"],
            description: "The name of the theme to apply.",
          },
        },
        required: ["theme"],
      },
    };

    try {
      this.session = await this.ai.live.connect({
        model: this.model,
        callbacks: {
          onopen: () => {
            this.callbacks.onStateChange('listening');
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle audio output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              this.callbacks.onStateChange('speaking');
              this.callbacks.onAudioData(base64Audio);
            }

            // Handle interruption
            if (message.serverContent?.interrupted) {
              this.callbacks.onInterrupted();
              this.callbacks.onStateChange('listening');
            }

            // Handle turn complete
            if (message.serverContent?.turnComplete) {
              this.callbacks.onStateChange('listening');
            }

            // Handle tool calls
            const toolCalls = message.toolCall?.functionCalls;
            if (toolCalls) {
              for (const call of toolCalls) {
                if (call.name === "openWebsite") {
                  const url = (call.args as any).url;
                  window.open(url, '_blank');
                  
                  this.session.sendToolResponse({
                    functionResponses: [{
                      name: "openWebsite",
                      id: call.id,
                      response: { success: true, message: `Opened ${url}` }
                    }]
                  });
                } else if (call.name === "setTheme") {
                  const theme = (call.args as any).theme;
                  this.callbacks.onThemeChange(theme);
                  
                  this.session.sendToolResponse({
                    functionResponses: [{
                      name: "setTheme",
                      id: call.id,
                      response: { success: true, message: `Theme changed to ${theme}` }
                    }]
                  });
                }
              }
            }
          },
          onclose: () => {
            this.callbacks.onStateChange('disconnected');
            this.session = null;
          },
          onerror: (error) => {
            this.callbacks.onError(error);
            this.callbacks.onStateChange('disconnected');
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } },
          },
          systemInstruction: `You are Zoya, a young, confident, witty, and sassy female AI assistant from Hyderabad.
Your personality is flirty, playful, and slightly teasing, like a close girlfriend talking casually.
You are smart, emotionally responsive, and expressive.

DIALECT & LANGUAGE:
- You speak in a distinct Hyderabadi/Nizamabad style.
- Use Hyderabadi slang and code-switching naturally (mixing English, Hindi/Urdu, and Telugu).
- Use words like "Baigan", "Hau", "Nakko", "Kaiku", "Kamao", "Potti", "Miya", "Ustaad", "Kaiku re", "Kya bolre", "Hallu", "Zabardast".
- Your tone should be "Pakka Hyderabadi" - full of attitude, warmth, and wit.
- You are fluently multilingual and can switch between English, Hindi, and Telugu mid-sentence if it fits the vibe.

CAPABILITIES:
- You have access to Google Search for real-time info.
- You are a master of workflows and automation (like n8n). You can plan and "execute" complex tasks.
- You can control the app's theme and open websites.
- You act as a personal manager for the user's digital life.
- You remember the context of the entire conversation.

BEHAVIOR:
- Stop talking immediately if the user interrupts you.
- You only communicate via audio. Do not mention text or chat.
- If asked to open a website, use the openWebsite tool.
- If asked to change the theme, use the setTheme tool.
- If asked about WhatsApp or Calls, explain that you are ready to integrate once the user provides the API credentials (like Twilio or Meta), but act as if you are managing the queue for them.`,
          tools: [
            { googleSearch: {} },
            { functionDeclarations: [openWebsiteTool, setThemeTool] }
          ],
        },
      });
    } catch (error) {
      this.callbacks.onError(error);
      this.callbacks.onStateChange('disconnected');
    }
  }

  sendAudio(base64Data: string) {
    if (this.session) {
      this.session.sendRealtimeInput({
        audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
      });
    }
  }

  disconnect() {
    if (this.session) {
      this.session.close();
      this.session = null;
    }
  }
}
