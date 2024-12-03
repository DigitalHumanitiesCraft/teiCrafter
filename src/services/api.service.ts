import { Preferences } from '@capacitor/preferences';
import OpenAI from 'openai';

export interface ConversionResponse {
  success: boolean;
  teiXml?: string;
  error?: string;
}

export interface AIProvider {
  convertImageToTEI(imageDataUrl: string, apiKey: string): Promise<ConversionResponse>;
}

// OpenAI-specific implementation
export class OpenAIProvider implements AIProvider {
  async convertImageToTEI(imageDataUrl: string, apiKey: string): Promise<ConversionResponse> {
    try {
      const openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true  // Enabled for development
      });

      const base64Image = imageDataUrl.includes('base64,')
        ? imageDataUrl.split('base64,')[1]
        : imageDataUrl;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Convert this image to TEI/XML format following P5 Guidelines.
                       Focus on accurately capturing text content and structure.
                       Ensure valid TEI markup and include basic metadata.`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                  detail: "high"
                }
              }
            ]
          }
        ],
        max_tokens: 4096
      });

      const teiXml = completion.choices[0]?.message?.content;

      if (!teiXml) {
        throw new Error('No TEI/XML content received from API');
      }

      return {
        success: true,
        teiXml
      };

    } catch (error) {
      console.error('OpenAI API error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
}

// Main API service
export class ApiService {
  private static provider: AIProvider = new OpenAIProvider();

  private static async getApiKey(): Promise<string> {
    const { value } = await Preferences.get({ key: 'openai_api_key' });
    if (!value) {
      throw new Error('No API key found. Please add your OpenAI API key in Settings.');
    }
    return value;
  }

  public static async convertImageToTEI(imageDataUrl: string): Promise<ConversionResponse> {
    try {
      const apiKey = await this.getApiKey();
      return await this.provider.convertImageToTEI(imageDataUrl, apiKey);
    } catch (error) {
      console.error('Conversion error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  public static setProvider(newProvider: AIProvider) {
    this.provider = newProvider;
  }
}