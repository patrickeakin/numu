import { Page } from '@playwright/test';

export class AuthHelper {
  static async setAuthToken(page: Page, token: string = 'mock_access_token_123'): Promise<void> {
    await page.addInitScript((token) => {
      localStorage.setItem('spotify_access_token', token);
    }, token);
  }

  static async clearAuth(page: Page): Promise<void> {
    await page.addInitScript(() => {
      localStorage.removeItem('spotify_access_token');
    });
  }

  static async getAuthToken(page: Page): Promise<string | null> {
    return await page.evaluate(() => {
      return localStorage.getItem('spotify_access_token');
    });
  }

  static async simulateOAuthCallback(page: Page, token: string = 'mock_access_token_123'): Promise<void> {
    // Simulate successful OAuth callback by setting the hash
    await page.goto(`http://localhost:3000/#access_token=${token}&token_type=Bearer&expires_in=3600`);
  }

  static async waitForAuthentication(page: Page): Promise<void> {
    // Wait for the import button to appear (indicates successful auth)
    await page.waitForSelector('[data-testid="import-artists-button"]', { timeout: 10000 });
  }
}