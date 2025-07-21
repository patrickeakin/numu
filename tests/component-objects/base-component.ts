import { Page, Locator } from '@playwright/test';

export abstract class BaseComponent {
  constructor(protected page: Page) {}

  protected abstract get rootSelector(): string;

  async waitForComponent(): Promise<void> {
    await this.page.waitForSelector(this.rootSelector);
  }

  async isVisible(): Promise<boolean> {
    return await this.page.isVisible(this.rootSelector);
  }

  async waitForVisible(): Promise<void> {
    await this.page.waitForSelector(this.rootSelector, { state: 'visible' });
  }

  async waitForHidden(): Promise<void> {
    await this.page.waitForSelector(this.rootSelector, { state: 'hidden' });
  }

  protected locator(selector: string): Locator {
    return this.page.locator(selector);
  }
}