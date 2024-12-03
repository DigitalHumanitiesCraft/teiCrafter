import { Preferences } from '@capacitor/preferences';

export interface ConversionHistoryItem {
  id: string;
  timestamp: number;
  imageDataUrl: string;
  teiXml: string;
}

export class StorageService {
  private static readonly HISTORY_KEY = 'conversion_history';

  static async saveConversion(imageDataUrl: string, teiXml: string): Promise<void> {
    try {
      // Get existing history
      const history = await this.getHistory();
      
      // Create new history item
      const newItem: ConversionHistoryItem = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        imageDataUrl,
        teiXml
      };

      // Add to history (at the beginning)
      history.unshift(newItem);

      // Keep only last 50 items
      const trimmedHistory = history.slice(0, 50);

      // Save back to storage
      await Preferences.set({
        key: this.HISTORY_KEY,
        value: JSON.stringify(trimmedHistory)
      });
    } catch (error) {
      console.error('Failed to save conversion:', error);
      throw error;
    }
  }

  static async getHistory(): Promise<ConversionHistoryItem[]> {
    try {
      const { value } = await Preferences.get({ key: this.HISTORY_KEY });
      return value ? JSON.parse(value) : [];
    } catch (error) {
      console.error('Failed to get history:', error);
      return [];
    }
  }

  static async deleteHistoryItem(id: string): Promise<void> {
    try {
      const history = await this.getHistory();
      const updatedHistory = history.filter(item => item.id !== id);
      await Preferences.set({
        key: this.HISTORY_KEY,
        value: JSON.stringify(updatedHistory)
      });
    } catch (error) {
      console.error('Failed to delete history item:', error);
      throw error;
    }
  }

  static async clearHistory(): Promise<void> {
    try {
      await Preferences.remove({ key: this.HISTORY_KEY });
    } catch (error) {
      console.error('Failed to clear history:', error);
      throw error;
    }
  }
}