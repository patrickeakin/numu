import { Page, Route } from '@playwright/test';
import testArtists from '../fixtures/test-artists.json';

export class SpotifyMock {
  static async setupRoutes(page: Page): Promise<void> {
    // Mock user info endpoint
    await page.route('**/api.spotify.com/v1/me', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test_user_123',
          display_name: 'Test User',
          email: 'test@example.com'
        })
      });
    });

    // Mock followed artists endpoint
    await page.route('**/api.spotify.com/v1/me/following**', async (route: Route) => {
      const url = new URL(route.request().url());
      const limit = parseInt(url.searchParams.get('limit') || '50');
      
      const mockResponse = {
        artists: {
          items: testArtists.slice(0, limit),
          next: testArtists.length > limit ? 'https://api.spotify.com/v1/me/following?after=test&limit=50' : null,
          total: testArtists.length,
          limit: limit,
          offset: 0
        }
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse)
      });
    });
  }

  static async setupAuthError(page: Page): Promise<void> {
    await page.route('**/api.spotify.com/v1/**', async (route: Route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            status: 401,
            message: 'The access token expired'
          }
        })
      });
    });
  }

  static async setupRateLimit(page: Page): Promise<void> {
    await page.route('**/api.spotify.com/v1/**', async (route: Route) => {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        headers: {
          'retry-after': '5'
        },
        body: JSON.stringify({
          error: {
            status: 429,
            message: 'API rate limit exceeded'
          }
        })
      });
    });
  }

  static async setupNetworkError(page: Page): Promise<void> {
    await page.route('**/api.spotify.com/v1/**', async (route: Route) => {
      await route.abort('failed');
    });
  }
}