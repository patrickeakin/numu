import { BaseComponent } from './base-component';
import { Locator } from '@playwright/test';

export class Sidebar extends BaseComponent {
  protected get rootSelector(): string {
    return '.sidebar';
  }

  get importButton(): Locator {
    return this.page.locator('[data-testid="import-artists-button"]');
  }

  get logoutButton(): Locator {
    return this.page.locator('[data-testid="logout-button"]');
  }

  get refreshArtistsButton(): Locator {
    return this.page.locator('[data-testid="refresh-artists-button"]');
  }

  // Duration filters
  async selectDuration(duration: 'TODAY' | '7 DAYS' | '90 DAYS' | '6 MONTHS'): Promise<void> {
    const testId = {
      'TODAY': 'filter-today',
      '7 DAYS': 'filter-7days',
      '90 DAYS': 'filter-90days', 
      '6 MONTHS': 'filter-6months'
    }[duration];
    
    if (testId) {
      await this.page.click(`[data-testid="${testId}"]`);
    } else {
      await this.page.click(`text=${duration}`);
    }
  }

  async getActiveDuration(): Promise<string> {
    const activeElement = await this.page.locator('.sidebar li.active').first();
    return await activeElement.textContent() || '';
  }

  async getDurationCount(duration: string): Promise<number> {
    const countElement = await this.page.locator(`text=${duration} >> .. >> .count`);
    const countText = await countElement.textContent();
    return parseInt(countText || '0');
  }

  // Sort options
  async selectSort(sort: 'RECENT' | 'ARTIST'): Promise<void> {
    const testId = sort === 'RECENT' ? 'sort-recent' : 'sort-artist';
    await this.page.click(`[data-testid="${testId}"]`);
  }

  async getActiveSort(): Promise<string> {
    const activeSort = await this.page.locator('h3:has-text("ORDER") + ul li.active');
    return await activeSort.textContent() || '';
  }

  // Actions
  async logout(): Promise<void> {
    await this.page.click('[data-testid="logout-button"]');
  }

  async refreshArtists(): Promise<void> {
    await this.page.click('[data-testid="refresh-artists-button"]');
  }

  async startImport(): Promise<void> {
    await this.page.click('[data-testid="import-artists-button"]');
  }

  async isImportButtonVisible(): Promise<boolean> {
    return await this.page.isVisible('[data-testid="import-artists-button"]');
  }

  async importArtists(): Promise<void> {
    await this.startImport();
  }

  async setDurationFilter(days: string): Promise<void> {
    if (days === '7') {
      await this.page.click('[data-testid="filter-7days"]');
    } else if (days === '1') {
      await this.page.click('[data-testid="filter-today"]');
    } else if (days === '90' || days === '30') {
      await this.page.click('text=90 DAYS');
    } else if (days === '180') {
      await this.page.click('text=6 MONTHS');
    } else {
      await this.page.click('[data-testid="filter-7days"]'); // default
    }
  }

  async setSortOrder(order: string): Promise<void> {
    if (order === 'newest' || order === 'oldest') {
      await this.selectSort('RECENT');
    } else if (order === 'alphabetical') {
      await this.selectSort('ARTIST');
    }
  }

  async getDurationFilter(): Promise<string> {
    const active = await this.getActiveDuration();
    if (active.includes('TODAY')) return '1';
    if (active.includes('7 DAYS')) return '7';
    if (active.includes('90 DAYS')) return '90';
    if (active.includes('6 MONTHS')) return '180';
    return '7';
  }

  async getSortOrder(): Promise<string> {
    const active = await this.getActiveSort();
    if (active.includes('RECENT')) return 'newest';
    if (active.includes('ARTIST')) return 'alphabetical';
    return 'newest';
  }
}