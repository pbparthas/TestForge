import { chromium } from 'playwright';

async function testLoginFlow() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Go to login page
    console.log('1. Navigating to login page...');
    await page.goto('http://localhost:5173/login');
    await page.waitForLoadState('networkidle');

    // Take screenshot
    await page.screenshot({ path: '/tmp/01-login-page.png' });
    console.log('   Screenshot: /tmp/01-login-page.png');

    // Check page title
    const title = await page.locator('h1').first().textContent();
    console.log(`   Page title: ${title}`);

    // Fill login form
    console.log('2. Filling login form...');
    await page.fill('#identifier', 'admin');
    await page.fill('#password', 'admin123');
    await page.screenshot({ path: '/tmp/02-form-filled.png' });
    console.log('   Screenshot: /tmp/02-form-filled.png');

    // Click login button
    console.log('3. Clicking login button...');
    await page.click('button[type="submit"]');

    // Wait for navigation or error
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/03-after-login.png' });
    console.log('   Screenshot: /tmp/03-after-login.png');

    // Check current URL
    const currentUrl = page.url();
    console.log(`   Current URL: ${currentUrl}`);

    // Check for errors in console
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    // Check page content
    const pageContent = await page.content();
    if (pageContent.includes('Dashboard')) {
      console.log('4. SUCCESS: Dashboard loaded!');
    } else if (pageContent.includes('Invalid')) {
      console.log('4. FAILURE: Invalid credentials error');
    } else {
      console.log('4. UNKNOWN: Check screenshot');
    }

    // Wait for user to see the result
    console.log('\nBrowser will stay open for 10 seconds...');
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('Error:', error.message);
    await page.screenshot({ path: '/tmp/error-screenshot.png' });
  } finally {
    await browser.close();
    console.log('Browser closed.');
  }
}

testLoginFlow();
