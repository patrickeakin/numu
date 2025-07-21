import { test, expect } from '@playwright/test';
import { SpotifyMock } from '../mocks/spotify-mock';
import { AuthHelper } from '../helpers/auth-helper';
import { LoginScreen, Sidebar } from '../component-objects';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await AuthHelper.clearAuth(page);
  });

  test('should display login screen when not authenticated', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    
    const loginScreen = new LoginScreen(page);
    await expect(loginScreen.loginButton).toBeVisible();
    await expect(loginScreen.appTitle).toHaveAttribute('alt', 'NUMU Logo');
  });

  test('should redirect to Spotify OAuth when login clicked', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    
    const loginScreen = new LoginScreen(page);
    
    // Start waiting for navigation before clicking
    const navigationPromise = page.waitForURL(/accounts\.spotify\.com.*authorize/);
    await loginScreen.login();
    await navigationPromise;
    
    // Verify we're redirected to Spotify OAuth
    expect(page.url()).toMatch(/accounts\.spotify\.com.*authorize/);
  });

  test('should authenticate successfully with OAuth callback', async ({ page }) => {
    await SpotifyMock.setupRoutes(page);
    
    // Simulate OAuth callback with access token
    await AuthHelper.simulateOAuthCallback(page);
    
    // Wait for authentication to complete
    await AuthHelper.waitForAuthentication(page);
    
    const sidebar = new Sidebar(page);
    await expect(sidebar.importButton).toBeVisible();
    await expect(sidebar.logoutButton).toBeVisible();
  });

  test('should preserve authentication state on page reload', async ({ page }) => {
    await SpotifyMock.setupRoutes(page);
    await AuthHelper.setAuthToken(page);
    
    await page.goto('http://localhost:3000/');
    
    const sidebar = new Sidebar(page);
    await expect(sidebar.importButton).toBeVisible();
    await expect(sidebar.logoutButton).toBeVisible();
  });

  test('should logout successfully and return to login screen', async ({ page }) => {
    await SpotifyMock.setupRoutes(page);
    await AuthHelper.setAuthToken(page);
    
    await page.goto('http://localhost:3000/');
    
    const sidebar = new Sidebar(page);
    await sidebar.logout();
    
    const loginScreen = new LoginScreen(page);
    await expect(loginScreen.loginButton).toBeVisible();
    
    // Verify token is removed
    const token = await AuthHelper.getAuthToken(page);
    expect(token).toBeNull();
  });

  test('should handle expired token gracefully', async ({ page }) => {
    await SpotifyMock.setupAuthError(page);
    await AuthHelper.setAuthToken(page, 'expired_token');
    
    await page.goto('http://localhost:3000/');
    
    const sidebar = new Sidebar(page);
    
    // Set up dialog handler to catch the alert
    page.on('dialog', async dialog => {
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toContain('Error fetching releases');
      await dialog.accept();
    });
    
    await sidebar.importArtists();
    
    // Wait a bit for the dialog to appear and be handled
    await page.waitForTimeout(1000);
  });

  test('should handle network errors during authentication', async ({ page }) => {
    await SpotifyMock.setupNetworkError(page);
    await AuthHelper.setAuthToken(page);
    
    await page.goto('http://localhost:3000/');
    
    const sidebar = new Sidebar(page);
    
    // Set up dialog handler to catch the alert
    page.on('dialog', async dialog => {
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toContain('Error fetching releases');
      await dialog.accept();
    });
    
    await sidebar.importArtists();
    
    // Wait a bit for the dialog to appear and be handled
    await page.waitForTimeout(1000);
  });
});