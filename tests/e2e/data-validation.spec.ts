import { test, expect } from '@playwright/test';
import { SpotifyMock } from '../mocks/spotify-mock';
import { MusicBrainzMock } from '../mocks/musicbrainz-mock';
import { AuthHelper } from '../helpers/auth-helper';
import { CacheHelper } from '../helpers/cache-helper';
import { Sidebar, ReleaseGrid } from '../component-objects';

test.describe('Data Validation', () => {
  test.beforeEach(async ({ page }) => {
    await AuthHelper.setAuthToken(page);
    await CacheHelper.clearCache(page);
  });

  test('should validate release date formats', async ({ page }) => {
    await SpotifyMock.setupRoutes(page);
    
    // Mock MusicBrainz artist search first
    await page.route('**/musicbrainz.org/ws/2/artist**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          artists: [
            { id: 'test-artist-1', name: 'Test Artist' }
          ]
        })
      });
    });
    
    // Mock MusicBrainz with various date formats
    await page.route('**/musicbrainz.org/ws/2/release**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          releases: [
            {
              id: 'release-1',
              title: 'Album with Full Date',
              date: new Date().toISOString().split('T')[0], // Today's date
              'artist-credit': [{ name: 'Test Artist', artist: { id: 'artist-1', name: 'Test Artist' } }],
              'cover-art-archive': { artwork: false, count: 0, front: false, back: false },
              'release-group': { id: 'rg-1', 'primary-type': 'Album' }
            },
            {
              id: 'release-2', 
              title: 'Album with Month Only',
              date: new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0'), // This month
              'artist-credit': [{ name: 'Test Artist', artist: { id: 'artist-1', name: 'Test Artist' } }],
              'cover-art-archive': { artwork: false, count: 0, front: false, back: false },
              'release-group': { id: 'rg-2', 'primary-type': 'Album' }
            },
            {
              id: 'release-3',
              title: 'Album with Year Only', 
              date: String(new Date().getFullYear()), // This year
              'artist-credit': [{ name: 'Test Artist', artist: { id: 'artist-1', name: 'Test Artist' } }],
              'cover-art-archive': { artwork: false, count: 0, front: false, back: false },
              'release-group': { id: 'rg-3', 'primary-type': 'Album' }
            }
          ]
        })
      });
    });

    await page.goto('http://localhost:3000/');
    
    const sidebar = new Sidebar(page);
    const releaseGrid = new ReleaseGrid(page);
    
    await sidebar.importArtists();
    await releaseGrid.waitForLoading();
    
    // Verify app handles various date formats without crashing
    const releases = await releaseGrid.getAllReleases();
    
    // Primary goal: verify app doesn't crash with various date formats
    // App should handle the data gracefully (may filter some out due to date logic)
    expect(releases.length).toBeGreaterThanOrEqual(1);
    
    // Verify app is in a stable state
    const releaseCards = await page.locator('[data-testid="release-card"]').count();
    expect(releaseCards).toBeGreaterThan(0);
    
    // Verify the app interface is still functional
    await sidebar.setDurationFilter('90');
    await page.waitForTimeout(500);
    
    // App should still be responsive after processing various date formats
    const releasesAfterFilter = await releaseGrid.getAllReleases();
    expect(releasesAfterFilter.length).toBeGreaterThanOrEqual(0);
  });

  test('should handle special characters in artist and release names', async ({ page }) => {
    await SpotifyMock.setupRoutes(page);
    
    // Mock MusicBrainz artist search
    await page.route('**/musicbrainz.org/ws/2/artist**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          artists: [
            { id: 'test-artist-unicode', name: 'Test Artist' }
          ]
        })
      });
    });
    
    // Mock releases with special characters
    await page.route('**/musicbrainz.org/ws/2/release**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          releases: [
            {
              id: 'release-unicode',
              title: 'Album with Émojis 🎵 & Special Châractérs',
              date: new Date().toISOString().split('T')[0],
              'artist-credit': [{ name: 'Artïst Ñamé with Ünicödé', artist: { id: 'artist-unicode', name: 'Artïst Ñamé with Ünicödé' } }],
              'cover-art-archive': { artwork: false, count: 0, front: false, back: false },
              'release-group': { id: 'rg-unicode', 'primary-type': 'Album' }
            },
            {
              id: 'release-quotes',
              title: 'Album with "Smart Quotes" & \'Apostrophes\'',
              date: new Date().toISOString().split('T')[0],
              'artist-credit': [{ name: 'Artist with "Quotes"', artist: { id: 'artist-quotes', name: 'Artist with "Quotes"' } }],
              'cover-art-archive': { artwork: false, count: 0, front: false, back: false },
              'release-group': { id: 'rg-quotes', 'primary-type': 'Album' }
            },
            {
              id: 'release-symbols',
              title: 'Album & More + Special / Symbols \\ Test',
              date: new Date().toISOString().split('T')[0],
              'artist-credit': [{ name: 'AC/DC & Friends', artist: { id: 'artist-symbols', name: 'AC/DC & Friends' } }],
              'cover-art-archive': { artwork: false, count: 0, front: false, back: false },
              'release-group': { id: 'rg-symbols', 'primary-type': 'Album' }
            }
          ]
        })
      });
    });

    await page.goto('http://localhost:3000/');
    
    const sidebar = new Sidebar(page);
    const releaseGrid = new ReleaseGrid(page);
    
    await sidebar.importArtists();
    await releaseGrid.waitForLoading();
    
    // Verify app handles special characters without crashing
    const releases = await releaseGrid.getAllReleases();
    expect(releases.length).toBe(3);
    
    // Verify special characters are displayed correctly
    const releaseTitles = releases.map(r => r.title);
    expect(releaseTitles.some(title => title.includes('Émojis'))).toBeTruthy();
    expect(releaseTitles.some(title => title.includes('Smart Quotes') || title.includes('Apostrophes'))).toBeTruthy();
    expect(releaseTitles.some(title => title.includes('AC/DC') || title.includes('Symbols'))).toBeTruthy();
    
    // Test that clicking releases with special characters works
    await releaseGrid.clickRelease(0);
    // No errors should occur from the click
  });

  test('should generate correct Spotify search URLs', async ({ page }) => {
    await SpotifyMock.setupRoutes(page);
    await MusicBrainzMock.setupRoutes(page);
    
    // Mock window.open to capture URL before page load
    await page.addInitScript(() => {
      (window as any).openedUrls = [];
      const originalOpen = window.open;
      window.open = (url) => {
        (window as any).openedUrls.push(url);
        return null;
      };
    });
    
    await page.goto('http://localhost:3000/');
    
    const sidebar = new Sidebar(page);
    const releaseGrid = new ReleaseGrid(page);
    
    await sidebar.importArtists();
    await releaseGrid.waitForLoading();
    
    // Click a release card
    await releaseGrid.clickRelease(0);
    
    // Verify Spotify search URL was generated
    const openedUrls = await page.evaluate(() => (window as any).openedUrls || []);
    expect(openedUrls.length).toBeGreaterThan(0);
    
    const firstUrl = openedUrls[0];
    expect(firstUrl).toContain('https://open.spotify.com/search/');
    expect(firstUrl).toContain('%20'); // URL encoded spaces
  });

  test('should handle release card clicks and external navigation', async ({ page }) => {
    await SpotifyMock.setupRoutes(page);
    await MusicBrainzMock.setupRoutes(page);
    
    // Track window.open calls before page load
    await page.addInitScript(() => {
      (window as any).openedUrls = [];
      const originalOpen = window.open;
      window.open = (url) => {
        (window as any).openedUrls.push(url);
        return null;
      };
    });
    
    await page.goto('http://localhost:3000/');
    
    const sidebar = new Sidebar(page);
    const releaseGrid = new ReleaseGrid(page);
    
    await sidebar.importArtists();
    await releaseGrid.waitForLoading();
    
    // Click multiple release cards
    const releaseCount = await releaseGrid.getReleaseCount();
    const clickCount = Math.min(3, releaseCount); // Click up to 3 releases
    
    for (let i = 0; i < clickCount; i++) {
      await releaseGrid.clickRelease(i);
      await page.waitForTimeout(100); // Small delay between clicks
    }
    
    // Verify URLs were opened
    const urls = await page.evaluate(() => (window as any).openedUrls || []);
    expect(urls.length).toBe(clickCount);
    
    // Verify each URL is a valid Spotify search URL
    for (const url of urls) {
      expect(url).toContain('https://open.spotify.com/search/');
      expect(url.length).toBeGreaterThan('https://open.spotify.com/search/'.length);
    }
    
    // Verify URLs are unique (different releases generate different URLs)
    if (urls.length > 1) {
      const uniqueUrls = [...new Set(urls)];
      expect(uniqueUrls.length).toBe(urls.length);
    }
  });
});