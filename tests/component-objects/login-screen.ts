import { BaseComponent } from './base-component';
import { Locator } from '@playwright/test';

export class LoginScreen extends BaseComponent {
  protected get rootSelector(): string {
    return '.login-container';
  }

  get loginButton(): Locator {
    return this.page.locator('[data-testid="login-logo"]');
  }

  get appTitle(): Locator {
    return this.page.locator('[data-testid="login-logo"]');
  }

  get instructions(): Locator {
    return this.page.locator('.login-instructions');
  }

  async login(): Promise<void> {
    await this.loginButton.click();
  }

  async getInstructions(): Promise<string> {
    return await this.instructions.textContent() || '';
  }

  async waitForLoginScreen(): Promise<void> {
    await this.loginButton.waitFor();
  }
}