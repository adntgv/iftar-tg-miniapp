import { test, expect } from '@playwright/test';

test.describe('Iftar App E2E Tests', () => {
  test('homepage loads correctly', async ({ page }) => {
    await page.goto('https://iftar.adntgv.com');
    
    // Check page title
    await expect(page).toHaveTitle(/Iftar App/);
    
    // Check main elements are visible
    await expect(page.locator('text=Рамадан 2026')).toBeVisible();
  });

  test('calendar is displayed', async ({ page }) => {
    await page.goto('https://iftar.adntgv.com');
    
    // Wait for the calendar to load
    await page.waitForSelector('.card', { timeout: 5000 });
    
    // Check calendar grid exists
    await expect(page.locator('.calendar-grid').first()).toBeVisible();
    
    // Check week days are shown
    await expect(page.locator('text=Пн')).toBeVisible();
    await expect(page.locator('text=Вт')).toBeVisible();
  });

  test('legend is displayed', async ({ page }) => {
    await page.goto('https://iftar.adntgv.com');
    
    await expect(page.locator('text=Приглашаю')).toBeVisible();
    await expect(page.locator('text=Иду')).toBeVisible();
    await expect(page.locator('text=Ожидает')).toBeVisible();
  });

  test('FAB button is visible', async ({ page }) => {
    await page.goto('https://iftar.adntgv.com');
    
    // Check FAB exists
    await expect(page.locator('.fab')).toBeVisible();
  });

  test('clicking FAB opens create modal', async ({ page }) => {
    await page.goto('https://iftar.adntgv.com');
    
    // Click FAB
    await page.click('.fab');
    
    // Check modal appears
    await expect(page.locator('text=Новый ифтар')).toBeVisible({ timeout: 3000 });
  });

  test('modal has all required fields', async ({ page }) => {
    await page.goto('https://iftar.adntgv.com');
    
    // Open modal
    await page.click('.fab');
    
    // Wait for modal
    await page.waitForSelector('text=Новый ифтар');
    
    // Check fields exist
    await expect(page.locator('input[type="time"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Мой дом"]')).toBeVisible();
    await expect(page.locator('input[placeholder="@username"]')).toBeVisible();
    await expect(page.locator('text=Создать ифтар')).toBeVisible();
  });

  test('can close modal', async ({ page }) => {
    await page.goto('https://iftar.adntgv.com');
    
    // Open modal
    await page.click('.fab');
    await page.waitForSelector('text=Новый ифтар');
    
    // Close modal (click X button)
    await page.click('.modal-content button:first-child');
    
    // Modal should be closed
    await expect(page.locator('text=Новый ифтар')).not.toBeVisible({ timeout: 2000 });
  });

  test('no console errors on page load', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.goto('https://iftar.adntgv.com');
    await page.waitForTimeout(2000);
    
    // Filter out expected Supabase errors (tables don't exist yet)
    const unexpectedErrors = errors.filter(e => 
      !e.includes('PGRST') && 
      !e.includes('Failed to fetch') &&
      !e.includes('supabase')
    );
    
    expect(unexpectedErrors).toHaveLength(0);
  });
});
