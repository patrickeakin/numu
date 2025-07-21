import { test, expect } from '@playwright/test';
import { SpotifyMock } from '../mocks/spotify-mock';
import { MusicBrainzMock } from '../mocks/musicbrainz-mock';
import { AuthHelper } from '../helpers/auth-helper';
import { CacheHelper } from '../helpers/cache-helper';
import { Sidebar, ReleaseGrid } from '../component-objects';
import testReleases from '../fixtures/test-releases.json';

test.describe('UI Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await AuthHelper.setAuthToken(page);
    await SpotifyMock.setupRoutes(page);
    await MusicBrainzMock.setupRoutes(page);
    await CacheHelper.setCompleteCache(page, testReleases);
    
    await page.goto('http://localhost:3000/');
    
    const sidebar = new Sidebar(page);
    await sidebar.importArtists();
  });

  test('should filter releases by duration', async ({ page }) => {
    const sidebar = new Sidebar(page);
    const releaseGrid = new ReleaseGrid(page);
    
    // Test last 7 days filter
    await sidebar.setDurationFilter('7');
    await releaseGrid.waitForLoading();
    
    const releases = await releaseGrid.getAllReleases();
    expect(releases.length).toBeGreaterThan(0);
    
    // Test last 30 days filter
    await sidebar.setDurationFilter('30');
    await releaseGrid.waitForLoading();
    
    const allReleases = await releaseGrid.getAllReleases();
    expect(allReleases.length).toBeGreaterThanOrEqual(releases.length);
  });

  test('should sort releases by date', async ({ page }) => {
    const sidebar = new Sidebar(page);
    const releaseGrid = new ReleaseGrid(page);
    
    // Default is by date (newest first)
    await releaseGrid.waitForLoading();
    
    const releases = await releaseGrid.getAllReleases();
    expect(releases.length).toBeGreaterThan(1);
    
    // Verify newest first order (dates should be descending)
    for (let i = 1; i < releases.length; i++) {
      const prevDate = new Date(releases[i-1].date || '1970-01-01');
      const currDate = new Date(releases[i].date || '1970-01-01');
      expect(prevDate.getTime()).toBeGreaterThanOrEqual(currDate.getTime());
    }
  });

  test('should sort releases alphabetically', async ({ page }) => {
    const sidebar = new Sidebar(page);
    const releaseGrid = new ReleaseGrid(page);
    
    // Sort alphabetically (by artist name, not title)
    await sidebar.setSortOrder('alphabetical');
    await releaseGrid.waitForLoading();
    
    const releases = await releaseGrid.getAllReleases();
    
    // Verify alphabetical order by artist name
    for (let i = 1; i < releases.length; i++) {
      expect(releases[i].artist.localeCompare(releases[i-1].artist)).toBeGreaterThanOrEqual(0);
    }
  });

  test('should combine filters and sorting', async ({ page }) => {
    const sidebar = new Sidebar(page);
    const releaseGrid = new ReleaseGrid(page);
    
    // Set duration filter and sort order
    await sidebar.setDurationFilter('7');
    await sidebar.setSortOrder('alphabetical');
    await releaseGrid.waitForLoading();
    
    const releases = await releaseGrid.getAllReleases();
    expect(releases.length).toBeGreaterThan(0);
    
    // Verify alphabetical order by artist is maintained
    for (let i = 1; i < releases.length; i++) {
      expect(releases[i].artist.localeCompare(releases[i-1].artist)).toBeGreaterThanOrEqual(0);
    }
  });

  test('should display release details correctly', async ({ page }) => {
    const releaseGrid = new ReleaseGrid(page);
    await releaseGrid.waitForLoading();
    
    const releases = await releaseGrid.getAllReleases();
    expect(releases.length).toBeGreaterThan(0);
    
    const firstRelease = releases[0];
    expect(firstRelease.title).toBeTruthy();
    expect(firstRelease.artist).toBeTruthy();
    expect(firstRelease.date).toBeTruthy();
  });

  test('should load cover art images', async ({ page }) => {
    const releaseGrid = new ReleaseGrid(page);
    await releaseGrid.waitForLoading();
    
    // Check that cover art divs are loaded
    const coverArtImages = await releaseGrid.getCoverArtImages();
    expect(coverArtImages.length).toBeGreaterThan(0);
    
    // Verify divs have background image styles
    for (const artworkDiv of coverArtImages) {
      const style = await artworkDiv.getAttribute('style');
      expect(style).toContain('background-image');
    }
  });

  test('should handle empty state', async ({ page }) => {
    // Clear cache and set up empty artist response
    await CacheHelper.clearCache(page);
    
    // Override mock to return empty artist list
    await page.route('**/api.spotify.com/v1/me/following**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          artists: {
            items: [],
            next: null,
            total: 0,
            limit: 50,
            offset: 0
          }
        })
      });
    });
    
    await page.goto('http://localhost:3000/');
    
    const sidebar = new Sidebar(page);
    
    // Try to import with no artists
    await sidebar.importArtists();
    
    // Wait for process to complete and check for any empty state
    await page.waitForTimeout(2000);
    
    // Could be various empty states - no releases, no artists, or still at import screen
    const hasNoReleases = await page.locator('.no-releases').isVisible();
    const hasImportButton = await page.locator('[data-testid="import-artists-button"]').isVisible();
    
    // Either no releases message or still showing import button (no content)
    expect(hasNoReleases || hasImportButton).toBeTruthy();
  });

  test('should maintain UI state during operations', async ({ page }) => {
    const sidebar = new Sidebar(page);
    
    // Set filters
    await sidebar.setDurationFilter('7');
    await sidebar.setSortOrder('alphabetical');
    
    // Refresh artists
    await sidebar.refreshArtists();
    
    // UI state should be preserved
    expect(await sidebar.getDurationFilter()).toBe('7');
    expect(await sidebar.getSortOrder()).toBe('alphabetical');
  });

  test('should be responsive to window resize', async ({ page }) => {
    const releaseGrid = new ReleaseGrid(page);
    await releaseGrid.waitForLoading();
    
    // Test desktop size
    await page.setViewportSize({ width: 1200, height: 800 });
    await expect(releaseGrid.container).toBeVisible();
    
    // Test tablet size
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(releaseGrid.container).toBeVisible();
    
    // Test mobile size
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(releaseGrid.container).toBeVisible();
  });
});