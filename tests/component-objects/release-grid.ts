import { BaseComponent } from './base-component';
import { Locator } from '@playwright/test';

export interface Release {
  artist: string;
  title: string;
  name: string; 
  date: string;
  type: string;
}

export class ReleaseGrid extends BaseComponent {
  protected get rootSelector(): string {
    return '.content';
  }

  private get releaseCardSelector(): string {
    return '[data-testid="release-card"]';
  }

  async getReleaseCount(): Promise<number> {
    return await this.page.locator(this.releaseCardSelector).count();
  }

  async getVisibleReleases(): Promise<Release[]> {
    const cards = await this.page.locator(this.releaseCardSelector).all();
    const releases: Release[] = [];

    for (const card of cards) {
      const artist = await card.locator('.artist-name').textContent() || '';
      const name = await card.locator('.release-title').textContent() || '';
      const date = await card.locator('.release-date').textContent() || '';
      const type = await card.locator('.release-type').textContent() || '';

      releases.push({ artist, name, date, type });
    }

    return releases;
  }

  async clickRelease(index: number): Promise<void> {
    await this.page.locator(this.releaseCardSelector).nth(index).click();
  }

  async hasReleases(): Promise<boolean> {
    return (await this.getReleaseCount()) > 0;
  }

  async getApiIndicator(index: number): Promise<string> {
    const indicator = await this.page.locator(this.releaseCardSelector).nth(index).locator('.api-indicator');
    return await indicator.textContent() || '';
  }

  async waitForReleases(): Promise<void> {
    await this.page.waitForSelector(this.releaseCardSelector);
  }

  async waitForNoReleases(): Promise<void> {
    await this.page.waitForSelector('.no-releases');
  }

  async getNoReleasesMessage(): Promise<string> {
    return await this.page.textContent('.no-releases') || '';
  }

  get container(): Locator {
    return this.page.locator('.content');
  }

  async getAllReleases(): Promise<Release[]> {
    const releases = await this.getVisibleReleases();
    return releases.map(r => ({
      ...r,
      title: r.name
    }));
  }

  async waitForLoading(): Promise<void> {
    // Wait for loading to disappear
    await this.page.waitForSelector('.loading', { state: 'hidden' });
  }

  async getCoverArtImages(): Promise<Locator[]> {
    const cards = await this.page.locator(this.releaseCardSelector).all();
    const images: Locator[] = [];
    for (let i = 0; i < cards.length; i++) {
      images.push(this.page.locator(this.releaseCardSelector).nth(i).locator('.album-artwork'));
    }
    return images;
  }
}