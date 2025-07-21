import { Page } from '@playwright/test';

export interface CacheData {
  followedArtists: Array<{ id: string; name: string }>;
  artistsFetchedAt: number;
  releases: any[];
  lastProcessedArtistIndex: number;
  totalArtists: number;
  isComplete: boolean;
  timestamp: number;
  userId: string;
  artistListHash: string;
}

export class CacheHelper {
  static async setCache(page: Page, cacheData: CacheData): Promise<void> {
    await page.addInitScript((data) => {
      localStorage.setItem('unified_releases_cache', JSON.stringify(data));
    }, cacheData);
  }

  static async clearCache(page: Page): Promise<void> {
    await page.addInitScript(() => {
      localStorage.removeItem('unified_releases_cache');
    });
  }

  static async getCache(page: Page): Promise<CacheData | null> {
    return await page.evaluate(() => {
      const cached = localStorage.getItem('unified_releases_cache');
      return cached ? JSON.parse(cached) : null;
    });
  }

  static async setCompleteCache(page: Page, releases: any[] = []): Promise<void> {
    // Update release dates to be within the last 7 days for default filter
    const recentReleases = releases.map((release, index) => ({
      ...release,
      releaseDate: new Date(Date.now() - (index * 24 * 60 * 60 * 1000)).toISOString().split('T')[0] // Recent dates
    }));

    const cacheData: CacheData = {
      followedArtists: [
        { id: 'test_artist_1', name: 'The Beatles' },
        { id: 'test_artist_2', name: 'Califone' },
        { id: 'test_artist_3', name: 'Queen' }
      ],
      artistsFetchedAt: Date.now(),
      releases: recentReleases,
      lastProcessedArtistIndex: 3,
      totalArtists: 3,
      isComplete: true,
      timestamp: Date.now(),
      userId: 'test_user_123',
      artistListHash: 'test_hash_123'
    };
    
    await this.setCache(page, cacheData);
  }

  static async setIncompleteCache(page: Page, processedIndex: number = 1): Promise<void> {
    const cacheData: CacheData = {
      followedArtists: [
        { id: 'test_artist_1', name: 'The Beatles' },
        { id: 'test_artist_2', name: 'Califone' },
        { id: 'test_artist_3', name: 'Queen' }
      ],
      artistsFetchedAt: Date.now(),
      releases: [],
      lastProcessedArtistIndex: processedIndex,
      totalArtists: 3,
      isComplete: false,
      timestamp: Date.now(),
      userId: 'test_user_123',
      artistListHash: 'test_hash_123'
    };
    
    await this.setCache(page, cacheData);
  }

  static async setExpiredCache(page: Page): Promise<void> {
    const thirtyOneDaysAgo = Date.now() - (31 * 24 * 60 * 60 * 1000);
    const cacheData: CacheData = {
      followedArtists: [{ id: 'test_artist_1', name: 'The Beatles' }],
      artistsFetchedAt: thirtyOneDaysAgo,
      releases: [],
      lastProcessedArtistIndex: 0,
      totalArtists: 1,
      isComplete: false,
      timestamp: thirtyOneDaysAgo,
      userId: 'test_user_123',
      artistListHash: 'old_hash_123'
    };
    
    await this.setCache(page, cacheData);
  }
}