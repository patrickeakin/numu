import { BaseComponent } from './base-component';
import { Locator } from '@playwright/test';

export interface ProgressStatus {
  current: number;
  total: number;
  releases: number;
}

export class ProgressIndicator extends BaseComponent {
  protected get rootSelector(): string {
    return '.loading';
  }

  private get progressTextSelector(): string {
    return '[data-testid="progress-text"]';
  }

  private get releasesCountSelector(): string {
    return '[data-testid="releases-count"]';
  }

  private get progressBarSelector(): string {
    return '.progress-bar';
  }

  async getCurrentProgress(): Promise<ProgressStatus> {
    const progressText = await this.page.textContent(this.progressTextSelector) || '';
    const countText = await this.page.textContent(this.releasesCountSelector) || '';

    // Parse "5 of 50 artists checked"
    const progressMatch = progressText.match(/(\d+) of (\d+) artists/);
    const releasesMatch = countText.match(/Found (\d+) new releases/);

    return {
      current: progressMatch ? parseInt(progressMatch[1]) : 0,
      total: progressMatch ? parseInt(progressMatch[2]) : 0,
      releases: releasesMatch ? parseInt(releasesMatch[1]) : 0
    };
  }

  async getProgressPercentage(): Promise<number> {
    const progressBar = await this.page.locator(this.progressBarSelector);
    const style = await progressBar.getAttribute('style') || '';
    const widthMatch = style.match(/width:\s*(\d+(?:\.\d+)?)%/);
    return widthMatch ? parseFloat(widthMatch[1]) : 0;
  }

  async waitForCompletion(timeout: number = 30000): Promise<void> {
    await this.page.waitForSelector(this.rootSelector, { state: 'hidden', timeout });
  }

  async isLoading(): Promise<boolean> {
    return await this.isVisible();
  }

  async waitForProgress(): Promise<void> {
    await this.page.waitForSelector(this.progressTextSelector);
  }

  get container(): Locator {
    return this.page.locator('.loading');
  }

  get status(): Locator {
    return this.page.locator('.loading-text');
  }

  async cancel(): Promise<void> {
    // Look for a cancel button if it exists, otherwise just wait for completion
    const cancelButton = this.page.locator('[data-testid="cancel-button"]');
    if (await cancelButton.isVisible()) {
      await cancelButton.click();
    }
  }

  async waitForLoading(): Promise<void> {
    await this.container.waitFor({ state: 'hidden' });
  }
}