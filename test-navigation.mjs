import { chromium } from 'playwright';

async function testNavigation() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Collect errors
  const errors = [];
  page.on('pageerror', error => {
    console.log(`   PAGE ERROR: ${error.message}`);
    errors.push(error.message);
  });

  try {
    // Login first
    console.log('1. Logging in...');
    await page.goto('http://localhost:5173/login');
    await page.fill('#identifier', 'admin');
    await page.fill('#password', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    console.log('   Logged in successfully');
    await page.screenshot({ path: '/tmp/nav-0-after-login.png' });

    // Test each sidebar item by text content
    const sidebarItems = [
      { name: 'Dashboard' },
      { name: 'Test Cases' },
      { name: 'Test Suites' },
      { name: 'Requirements' },
      { name: 'Executions' },
      { name: 'Bugs' },
      { name: 'AI Agents' },
      { name: 'Coverage' },
    ];

    for (let i = 0; i < sidebarItems.length; i++) {
      const item = sidebarItems[i];
      console.log(`\n${i + 2}. Clicking "${item.name}"...`);

      try {
        // Use text-based selector
        await page.click(`nav >> text="${item.name}"`);
        await page.waitForTimeout(1500);

        const url = page.url();
        console.log(`   URL: ${url}`);

        // Take screenshot
        const screenshotPath = `/tmp/nav-${i + 1}-${item.name.toLowerCase().replace(/\s/g, '-')}.png`;
        await page.screenshot({ path: screenshotPath });
        console.log(`   Screenshot: ${screenshotPath}`);

      } catch (err) {
        console.log(`   CLICK ERROR: ${err.message}`);
      }
    }

    // Summary
    console.log('\n========== SUMMARY ==========');
    if (errors.length > 0) {
      console.log(`ERRORS FOUND: ${errors.length}`);
      errors.forEach((e, i) => console.log(`  ${i + 1}. ${e.substring(0, 100)}...`));
    } else {
      console.log('No JavaScript errors detected!');
    }

    console.log('\nBrowser will stay open for 5 seconds...');
    await page.waitForTimeout(5000);

  } catch (error) {
    console.error('Fatal error:', error.message);
    await page.screenshot({ path: '/tmp/nav-error.png' });
  } finally {
    await browser.close();
    console.log('Browser closed.');
  }
}

testNavigation();
