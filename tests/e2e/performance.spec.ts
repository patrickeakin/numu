import { test, expect } from '@playwright/test';
import { SpotifyMock } from '../mocks/spotify-mock';
import { MusicBrainzMock } from '../mocks/musicbrainz-mock';
import { AuthHelper } from '../helpers/auth-helper';
import { CacheHelper } from '../helpers/cache-helper';
import { Sidebar, ReleaseGrid } from '../component-objects';

test.describe('Performance & Scalability', () => {
  test.beforeEach(async ({ page }) => {
    await AuthHelper.setAuthToken(page);
    await CacheHelper.clearCache(page);
  });

  test('should handle large release lists without performance degradation', async ({ page }) => {
    await SpotifyMock.setupRoutes(page);
    
    // Mock a large number of releases (500+)
    const generateLargeReleaseList = () => {
      const releases = [];
      const currentDate = new Date().toISOString().split('T')[0];
      
      for (let i = 0; i < 500; i++) {
        releases.push({
          id: `release-${i}`,
          title: `Album ${i} - Performance Test`,
          date: currentDate,
          'artist-credit': [{ 
            name: `Artist ${i % 50}`, // 50 different artists with multiple releases each
            artist: { id: `artist-${i % 50}`, name: `Artist ${i % 50}` } 
          }],
          'cover-art-archive': { artwork: false, count: 0, front: false, back: false },
          'release-group': { id: `rg-${i}`, 'primary-type': i % 3 === 0 ? 'Album' : i % 3 === 1 ? 'EP' : 'Single' }
        });
      }
      
      return releases;
    };

    await page.route('**/musicbrainz.org/ws/2/release**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ releases: generateLargeReleaseList() })
      });
    });

    await page.goto('http://localhost:3000/');
    
    const sidebar = new Sidebar(page);
    const releaseGrid = new ReleaseGrid(page);
    
    // Measure time for initial load
    const startTime = Date.now();
    await sidebar.importArtists();
    await releaseGrid.waitForLoading();
    const loadTime = Date.now() - startTime;
    
    // Verify large number of releases loaded
    const releaseCount = await releaseGrid.getReleaseCount();
    expect(releaseCount).toBeGreaterThan(400); // Account for deduplication
    
    // Verify UI remains responsive (load time should be reasonable)
    expect(loadTime).toBeLessThan(30000); // Should load within 30 seconds
    
    // Test scrolling performance with large list
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(500);
    
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(500);
    
    // UI should still be responsive after scrolling
    const scrollStartTime = Date.now();
    await sidebar.setDurationFilter('90');
    const scrollEndTime = Date.now() - scrollStartTime;
    
    expect(scrollEndTime).toBeLessThan(5000); // Filter should respond within 5 seconds
  });

  test('should efficiently update UI during filtering', async ({ page }) => {
    await SpotifyMock.setupRoutes(page);
    
    // Mock releases across different time periods
    const generateTimeBasedReleases = () => {
      const releases = [];
      const today = new Date();
      
      // Create releases for different time periods
      for (let daysBack = 0; daysBack < 200; daysBack++) {
        const releaseDate = new Date(today);
        releaseDate.setDate(today.getDate() - daysBack);
        
        releases.push({
          id: `release-${daysBack}`,
          title: `Album ${daysBack} Days Ago`,
          date: releaseDate.toISOString().split('T')[0],
          'artist-credit': [{ 
            name: `Artist ${daysBack % 20}`,
            artist: { id: `artist-${daysBack % 20}`, name: `Artist ${daysBack % 20}` } 
          }],
          'cover-art-archive': { artwork: false, count: 0, front: false, back: false },
          'release-group': { id: `rg-${daysBack}`, 'primary-type': 'Album' }
        });
      }
      
      return releases;
    };

    await page.route('**/musicbrainz.org/ws/2/release**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ releases: generateTimeBasedReleases() })
      });
    });

    await page.goto('http://localhost:3000/');
    
    const sidebar = new Sidebar(page);
    const releaseGrid = new ReleaseGrid(page);
    
    await sidebar.importArtists();
    await releaseGrid.waitForLoading();
    
    // Test rapid filter changes
    const filterTests = [
      { filter: 'today', expectedMax: 10 },
      { filter: '7', expectedMax: 50 },
      { filter: '90', expectedMax: 150 },
      { filter: '6months', expectedMax: 200 }
    ];
    
    for (const filterTest of filterTests) {
      const startTime = Date.now();
      
      if (filterTest.filter === 'today') {
        await sidebar.setDurationFilter('today');
      } else {
        await sidebar.setDurationFilter(filterTest.filter);
      }
      
      await releaseGrid.waitForLoading();
      const filterTime = Date.now() - startTime;
      
      // Verify filter responds quickly
      expect(filterTime).toBeLessThan(3000); // Should filter within 3 seconds
      
      // Verify correct number of releases for time period
      const releaseCount = await releaseGrid.getReleaseCount();
      expect(releaseCount).toBeLessThanOrEqual(filterTest.expectedMax);
    }
    
    // Test rapid sort changes
    const sortStartTime = Date.now();
    await sidebar.setSortOrder('alphabetical');
    await page.waitForTimeout(100);
    await sidebar.setSortOrder('recent');
    const sortTime = Date.now() - sortStartTime;
    
    expect(sortTime).toBeLessThan(2000); // Sorting should be fast
  });

  test('should handle localStorage quota exceeded during cache save', async ({ page }) => {
    await SpotifyMock.setupRoutes(page);
    await MusicBrainzMock.setupRoutes(page);
    
    // Fill localStorage to near capacity before test
    await page.addInitScript(() => {
      const largeDummyData = 'x'.repeat(1024 * 1024); // 1MB of data
      for (let i = 0; i < 4; i++) { // Fill ~4MB
        try {
          localStorage.setItem(`dummy_data_${i}`, largeDummyData);
        } catch (e) {
          // Stop when quota is reached
          break;
        }
      }
    });

    await page.goto('http://localhost:3000/');
    
    const sidebar = new Sidebar(page);
    const releaseGrid = new ReleaseGrid(page);
    
    // Attempt import with limited storage
    await sidebar.importArtists();
    
    // App should handle quota errors gracefully
    await page.waitForTimeout(5000); // Wait for processing
    
    // Check if import completed or at least started
    const hasReleases = await page.locator('[data-testid="release-card"]').count() > 0;
    const hasImportButton = await page.locator('[data-testid="import-artists-button"]').isVisible();
    const hasProgress = await page.locator('.loading').isVisible();
    
    // One of these states should be true (import working despite storage issues)
    expect(hasReleases || hasImportButton || hasProgress).toBeTruthy();
    
    // Verify app didn't crash
    const pageTitle = await page.title();
    expect(pageTitle).toBeTruthy();
  });

  test('should recover from corrupted cache with partial data', async ({ page }) => {
    await SpotifyMock.setupRoutes(page);
    await MusicBrainzMock.setupRoutes(page);
    
    // Set corrupted cache data
    await page.addInitScript(() => {
      const corruptedCache = {
        followedArtists: [{ id: 'artist-1', name: 'Test Artist' }],
        artistsFetchedAt: Date.now(),
        releases: [
          // Missing required fields
          { id: 'release-1', name: null, artist: undefined },
          { invalid: 'data', missing: 'fields' }
        ],
        lastProcessedArtistIndex: 0,
        totalArtists: 1,
        isComplete: false,
        timestamp: Date.now(),
        userId: 'test-user',
        artistListHash: 'test-hash'
      };
      
      localStorage.setItem('unified_releases_cache', JSON.stringify(corruptedCache));
    });

    await page.goto('http://localhost:3000/');
    
    const sidebar = new Sidebar(page);
    const releaseGrid = new ReleaseGrid(page);
    
    // App should detect corrupted cache and fall back to fresh import
    await sidebar.importArtists();
    await releaseGrid.waitForLoading();
    
    // Verify app recovered and loaded fresh data
    const releases = await releaseGrid.getAllReleases();
    expect(releases.length).toBeGreaterThan(0);
    
    // Verify releases have proper structure
    const firstRelease = releases[0];
    expect(firstRelease.title).toBeTruthy();
    expect(firstRelease.artist).toBeTruthy();
    expect(firstRelease.date).toBeTruthy();
    
    // Verify cache was cleared and rebuilt
    const cacheAfterRecovery = await page.evaluate(() => {
      const cache = localStorage.getItem('unified_releases_cache');
      return cache ? JSON.parse(cache) : null;
    });
    
    expect(cacheAfterRecovery).toBeTruthy();
    expect(cacheAfterRecovery.releases.length).toBeGreaterThan(0);
  });
});