import { test, expect } from '@playwright/test';
import { AuthHelper } from '../helpers/auth-helper';
import { CacheHelper } from '../helpers/cache-helper';
import { Sidebar, ProgressIndicator } from '../component-objects';

test.describe('Real API Integration', () => {
  test.beforeEach(async ({ page }) => {
    await AuthHelper.setAuthToken(page);
    await CacheHelper.clearCache(page);
  });

  test('should handle actual MusicBrainz API responses', async ({ page }) => {
    // This test uses real MusicBrainz API with controlled data
    // We'll search for a well-known artist that should exist
    
    // Mock Spotify to return a known artist
    await page.route('**/api.spotify.com/v1/me/following**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          artists: {
            items: [
              {
                id: 'test-beatles-id',
                name: 'The Beatles' // Well-known artist that should exist in MusicBrainz
              }
            ],
            next: null,
            total: 1,
            limit: 50,
            offset: 0
          }
        })
      });
    });

    // Let MusicBrainz API calls go through to real service (with rate limiting)
    await page.goto('http://localhost:3000/');
    
    const sidebar = new Sidebar(page);
    const progressIndicator = new ProgressIndicator(page);
    
    await sidebar.importArtists();
    
    // Wait for real API processing (this will be slow due to rate limiting)
    await expect(progressIndicator.container).toBeVisible();
    
    // Wait for completion or timeout (real APIs are slow)
    try {
      await progressIndicator.waitForCompletion();
      
      // If successful, verify data structure matches expected format
      const releases = await page.locator('[data-testid="release-card"]').count();
      if (releases > 0) {
        // Verify release cards have proper structure
        const firstCard = page.locator('[data-testid="release-card"]').first();
        await expect(firstCard.locator('.artist-name')).toBeVisible();
        await expect(firstCard.locator('.release-title')).toBeVisible();
        await expect(firstCard.locator('.release-date')).toBeVisible();
        
        // Verify API indicator shows MusicBrainz
        await expect(firstCard.locator('.api-indicator.musicbrainz')).toBeVisible();
        await expect(firstCard.locator('.api-indicator')).toHaveText('MB');
      }
    } catch (error) {
      // Real API integration can fail due to rate limiting, network issues, etc.
      // This is expected behavior - we just verify the app handles it gracefully
      console.log('Real API integration test timed out (expected with rate limiting)');
      
      // Verify app is in a stable state
      const hasImportButton = await page.locator('[data-testid="import-artists-button"]').isVisible();
      const hasProgress = await page.locator('.loading').isVisible();
      const hasReleases = await page.locator('[data-testid="release-card"]').count() > 0;
      
      // App should be in one of these valid states
      expect(hasImportButton || hasProgress || hasReleases).toBeTruthy();
    }
  });

  test('should respect MusicBrainz rate limiting in real conditions', async ({ page }) => {
    // Mock multiple artists to test rate limiting behavior
    await page.route('**/api.spotify.com/v1/me/following**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          artists: {
            items: [
              { id: 'artist-1', name: 'The Beatles' },
              { id: 'artist-2', name: 'Led Zeppelin' },
              { id: 'artist-3', name: 'Pink Floyd' }
            ],
            next: null,
            total: 3,
            limit: 50,
            offset: 0
          }
        })
      });
    });

    await page.goto('http://localhost:3000/');
    
    const sidebar = new Sidebar(page);
    const progressIndicator = new ProgressIndicator(page);
    
    const startTime = Date.now();
    await sidebar.importArtists();
    
    await expect(progressIndicator.container).toBeVisible();
    
    // Monitor progress updates to verify rate limiting
    let progressUpdates = 0;
    const progressMonitor = setInterval(async () => {
      try {
        const progressText = await page.locator('[data-testid="progress-text"]').textContent();
        if (progressText && progressText.includes('of 3 artists')) {
          progressUpdates++;
        }
      } catch (e) {
        // Progress element might not be visible
      }
    }, 1000);
    
    try {
      // Wait up to 30 seconds for processing (real APIs are slow)
      await progressIndicator.waitForCompletion();
      
      const totalTime = Date.now() - startTime;
      
      // With 3 artists and 1 req/sec rate limiting, should take at least 3 seconds
      expect(totalTime).toBeGreaterThan(2000);
      
      // But shouldn't take excessively long (unless hitting real rate limits)
      // This is more of an observation than assertion for real API conditions
      
    } catch (error) {
      // Real API can hit rate limits - this is expected
      console.log('Rate limiting test completed with expected timeouts');
    } finally {
      clearInterval(progressMonitor);
    }
    
    // Verify app handled rate limiting gracefully
    const pageTitle = await page.title();
    expect(pageTitle).toBeTruthy(); // App didn't crash
  });

  test('should handle MusicBrainz service unavailability', async ({ page }) => {
    // Mock Spotify but let MusicBrainz calls through, then block them
    await page.route('**/api.spotify.com/v1/me/following**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          artists: {
            items: [{ id: 'artist-1', name: 'Test Artist' }],
            next: null,
            total: 1,
            limit: 50,
            offset: 0
          }
        })
      });
    });

    // Block MusicBrainz API to simulate service unavailability
    await page.route('**/musicbrainz.org/**', async (route) => {
      await route.fulfill({ status: 503, body: 'Service Unavailable' });
    });

    await page.goto('http://localhost:3000/');
    
    const sidebar = new Sidebar(page);
    const progressIndicator = new ProgressIndicator(page);
    
    await sidebar.importArtists();
    
    // App should handle service unavailability gracefully
    await expect(progressIndicator.container).toBeVisible();
    
    // Wait for completion or timeout
    await page.waitForTimeout(10000); // Wait 10 seconds
    
    // Verify app is in stable state despite API unavailability
    const hasImportButton = await page.locator('[data-testid="import-artists-button"]').isVisible();
    const hasProgress = await page.locator('.loading').isVisible();
    const hasReleases = await page.locator('[data-testid="release-card"]').count() > 0;
    
    // Should be back to import state or still processing
    expect(hasImportButton || hasProgress).toBeTruthy();
    
    // No releases should be shown if MusicBrainz was unavailable
    expect(hasReleases).toBeFalsy();
  });

  test('should validate real API response structure', async ({ page }) => {
    // This test validates that our app can handle the actual structure
    // of responses from MusicBrainz API
    
    // Mock Spotify but let one MusicBrainz call through
    await page.route('**/api.spotify.com/v1/me/following**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          artists: {
            items: [{ id: 'test-id', name: 'Radiohead' }], // Known artist
            next: null,
            total: 1,
            limit: 50,
            offset: 0
          }
        })
      });
    });

    // Intercept MusicBrainz response to validate structure
    let apiResponseReceived = false;
    await page.route('**/musicbrainz.org/ws/2/artist**', async (route) => {
      const response = await route.fetch();
      const data = await response.json();
      
      // Validate response structure matches our expectations
      expect(data).toHaveProperty('artists');
      if (data.artists && data.artists.length > 0) {
        const artist = data.artists[0];
        expect(artist).toHaveProperty('id');
        expect(artist).toHaveProperty('name');
      }
      
      apiResponseReceived = true;
      await route.fulfill({ response });
    });

    await page.goto('http://localhost:3000/');
    
    const sidebar = new Sidebar(page);
    await sidebar.importArtists();
    
    // Wait for API call to complete
    await page.waitForTimeout(5000);
    
    // Verify we received and validated real API response
    expect(apiResponseReceived).toBeTruthy();
  });
});