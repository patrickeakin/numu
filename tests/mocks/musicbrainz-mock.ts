import { Page, Route } from '@playwright/test';
import testReleases from '../fixtures/test-releases.json';

export class MusicBrainzMock {
  static async setupRoutes(page: Page): Promise<void> {
    // Mock artist search endpoint
    await page.route('**/musicbrainz.org/ws/2/artist**', async (route: Route) => {
      const url = new URL(route.request().url());
      const query = url.searchParams.get('query') || '';
      
      // Extract artist name from query
      const artistMatch = query.match(/artist:"([^"]+)"/);
      const artistName = artistMatch ? artistMatch[1] : '';
      
      let artists = [];
      
      // Simple artist matching
      if (artistName.toLowerCase().includes('beatles')) {
        artists = [{ id: 'mb_artist_1', name: 'The Beatles' }];
      } else if (artistName.toLowerCase().includes('califone')) {
        artists = [{ id: 'mb_artist_2', name: 'Califone' }];
      } else if (artistName.toLowerCase().includes('queen')) {
        artists = [{ id: 'mb_artist_3', name: 'Queen' }];
      } else if (artistName.toLowerCase().includes('zeppelin')) {
        artists = [{ id: 'mb_artist_4', name: 'Led Zeppelin' }];
      } else if (artistName.toLowerCase().includes('radiohead')) {
        artists = [{ id: 'mb_artist_5', name: 'Radiohead' }];
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ artists })
      });
    });

    // Mock release search endpoint
    await page.route('**/musicbrainz.org/ws/2/release**', async (route: Route) => {
      const url = new URL(route.request().url());
      const query = url.searchParams.get('query') || '';
      
      // Extract artist ID from query
      const artistIdMatch = query.match(/arid:(\w+)/);
      const artistId = artistIdMatch ? artistIdMatch[1] : '';
      
      let releases = [];
      
      // Return different releases based on artist ID
      if (artistId === 'mb_artist_1') {
        releases = [{
          id: 'mb_release_1',
          title: 'Abbey Road (50th Anniversary)',
          date: new Date().toISOString().split('T')[0], // Today's date
          'artist-credit': [{ name: 'The Beatles', artist: { id: 'mb_artist_1', name: 'The Beatles' } }],
          'cover-art-archive': { artwork: true, count: 1, front: true, back: false },
          'release-group': { id: 'mb_rg_1', 'primary-type': 'Album' }
        }];
      } else if (artistId === 'mb_artist_2') {
        releases = [
          {
            id: 'mb_release_2',
            title: "The Villager's Companion",
            date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Yesterday
            'artist-credit': [{ name: 'Califone', artist: { id: 'mb_artist_2', name: 'Califone' } }],
            'cover-art-archive': { artwork: true, count: 1, front: true, back: false },
            'release-group': { id: 'mb_rg_2', 'primary-type': 'Album' }
          },
          {
            id: 'mb_release_3',
            title: "The Villager's Companion Vol 2",
            date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 days ago
            'artist-credit': [{ name: 'Califone', artist: { id: 'mb_artist_2', name: 'Califone' } }],
            'cover-art-archive': { artwork: true, count: 1, front: true, back: false },
            'release-group': { id: 'mb_rg_2', 'primary-type': 'Album' }
          }
        ];
      } else if (artistId === 'mb_artist_3') {
        releases = [{
          id: 'mb_release_4',
          title: 'Bohemian Rhapsody (Remastered)',
          date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3 days ago
          'artist-credit': [{ name: 'Queen', artist: { id: 'mb_artist_3', name: 'Queen' } }],
          'cover-art-archive': { artwork: true, count: 1, front: true, back: false },
          'release-group': { id: 'mb_rg_3', 'primary-type': 'Single' }
        }];
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ releases })
      });
    });

    // Mock cover art archive
    await page.route('**/coverartarchive.org/release/**', async (route: Route) => {
      const releaseId = route.request().url().split('/').pop() || '';
      
      const mockCoverArt = {
        images: [{
          front: true,
          image: `https://coverartarchive.org/release/${releaseId}/front-500.jpg`,
          thumbnails: {
            small: `https://coverartarchive.org/release/${releaseId}/front-250.jpg`,
            large: `https://coverartarchive.org/release/${releaseId}/front-500.jpg`
          }
        }]
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCoverArt)
      });
    });
  }

  static async setupRateLimit(page: Page): Promise<void> {
    await page.route('**/musicbrainz.org/ws/2/**', async (route: Route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Rate limit exceeded'
        })
      });
    });
  }

  static async setupNetworkError(page: Page): Promise<void> {
    await page.route('**/musicbrainz.org/ws/2/**', async (route: Route) => {
      await route.abort('failed');
    });
  }
}