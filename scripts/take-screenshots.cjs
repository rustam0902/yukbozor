/**
 * Yukbozor.uz real app screenshots via Puppeteer
 *
 * Usage:
 *   YUKBOZOR_PHONE="+998..." YUKBOZOR_PASSWORD="..." node scripts/take-screenshots.cjs
 *
 * Output: attached_assets/generated_images/screenshots/{device}-{num}-{label}.png
 * Devices: phone (390x844), tablet7 (600x960), tablet10 (1280x800)
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.YUKBOZOR_URL || 'http://localhost:5000';
const PHONE = process.env.YUKBOZOR_PHONE || '+998998689247';
const PASSWORD = process.env.YUKBOZOR_PASSWORD || 'test123';
const CHROMIUM = process.env.CHROMIUM_PATH ||
  '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium';
const OUT_DIR = path.join(__dirname, '../attached_assets/generated_images/screenshots');

fs.mkdirSync(OUT_DIR, { recursive: true });

const DEVICES = [
  { name: 'phone',    width: 390,  height: 844,  isMobile: true  },
  { name: 'tablet7',  width: 600,  height: 960,  isMobile: true  },
  { name: 'tablet10', width: 1280, height: 800,  isMobile: false },
];

const DPR = 2;

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitReady(page, ms = 1500) {
  try { await page.waitForNetworkIdle({ idleTime: 1200, timeout: 8000 }); }
  catch (_) { await delay(ms); }
}

async function shot(page, device, num, label) {
  const file = path.join(OUT_DIR, `${device}-${String(num).padStart(2, '0')}-${label}.png`);
  await delay(600);
  await page.screenshot({ path: file, fullPage: false });
  const size = fs.statSync(file).size;
  console.log(`  ✓ ${path.basename(file)} (${(size / 1024).toFixed(0)} KB)`);
  return file;
}

/**
 * Login via API fetch (bypasses the custom phone mask input).
 * Also reloads the page so React auth state re-initialises with the cookie.
 */
async function loginAndReload(page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await delay(1200);

  const result = await page.evaluate(async (phone, pass, url) => {
    const r = await fetch(`${url}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ phone, password: pass }),
    });
    const d = await r.json();
    return { status: r.status, name: d.user?.displayName, roles: d.user?.roles };
  }, PHONE, PASSWORD, BASE_URL);

  console.log('   Auth:', JSON.stringify(result));

  // Reload so React picks up the auth cookie before any navigation
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await delay(1500);

  return result.status === 200;
}

async function nav(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitReady(page);
  await delay(700);
}

async function clickFirst(page, selectors) {
  for (const sel of selectors) {
    try {
      const el = await page.$(sel);
      if (el) { await el.click(); return true; }
    } catch (_) {}
  }
  return false;
}

async function runForDevice(browser, device) {
  console.log(`\n=== ${device.name} (${device.width}x${device.height}) ===`);
  const page = await browser.newPage();
  await page.setViewport({
    width: device.width,
    height: device.height,
    isMobile: device.isMobile,
    deviceScaleFactor: DPR,
  });

  // ── 1. Home / landing page ──────────────────────────────────────────────
  console.log('1. Home...');
  await nav(page, BASE_URL);
  await shot(page, device.name, 1, 'home');

  // ── 2. Login form with phone pre-filled ────────────────────────────────
  console.log('2. Login...');
  await nav(page, `${BASE_URL}/login`);
  // Pre-fill phone via paste event (bypasses masked-input)
  await page.evaluate((phone) => {
    const inp = document.querySelector('input[type="tel"]');
    if (!inp) return;
    const ev = new ClipboardEvent('paste', {
      bubbles: true, cancelable: true, clipboardData: new DataTransfer(),
    });
    ev.clipboardData.setData('text/plain', phone);
    inp.dispatchEvent(ev);
  }, PHONE);
  await delay(300);
  const pwdEl = await page.$('input[type="password"]');
  if (pwdEl) { await pwdEl.click({ clickCount: 3 }); await pwdEl.type(PASSWORD, { delay: 20 }); }
  await shot(page, device.name, 2, 'login');

  // ── Authenticate ────────────────────────────────────────────────────────
  const ok = await loginAndReload(page);
  if (!ok) console.log('   ⚠ Auth failed!');

  // ── 3. Carrier dashboard – available orders ────────────────────────────
  console.log('3. Carrier dashboard...');
  await nav(page, `${BASE_URL}/carrier`);
  await shot(page, device.name, 3, 'carrier-available-orders');

  // ── 4. Customer dashboard – my orders ─────────────────────────────────
  console.log('4. Customer orders...');
  await nav(page, `${BASE_URL}/customer`);
  await shot(page, device.name, 4, 'customer-my-orders');

  // ── 5. Create order dialog ──────────────────────────────────────────────
  console.log('5. Create order dialog...');
  await nav(page, `${BASE_URL}/customer`);
  await delay(500);
  const opened = await clickFirst(page, [
    '[data-testid="button-create-order-page"]',
    '[data-testid="button-create-order"]',
  ]);
  if (!opened) {
    // Fallback: look for any button with 'Создать' or 'заказ' in text
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent?.trim() || '', btn);
      if (text.includes('Создат') || (text.includes('заказ') && text.length < 30)) {
        await btn.click(); break;
      }
    }
  }
  await delay(1200);
  await shot(page, device.name, 5, 'create-order-dialog');

  // ── 6. Carrier dashboard – filter to assigned / submit-offer dialog ────
  console.log('6. Carrier submit-offer...');
  await nav(page, `${BASE_URL}/carrier`);
  // Try to click the first order row to open offer dialog
  await clickFirst(page, [
    '[data-testid^="card-order-"]',
    '.border.rounded-md.p-4',
    '[data-testid^="text-order-number-"]',
  ]);
  await delay(1200);
  await shot(page, device.name, 6, 'carrier-order-detail');

  // ── 7. Public announcements ────────────────────────────────────────────
  console.log('7. Announcements...');
  await nav(page, `${BASE_URL}/announcements`);
  await shot(page, device.name, 7, 'announcements');

  // ── 8. Profile ─────────────────────────────────────────────────────────
  console.log('8. Profile...');
  await nav(page, `${BASE_URL}/customer/profile`);
  await shot(page, device.name, 8, 'profile');

  await page.close();
}

(async () => {
  console.log('Launching Chromium...');
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: CHROMIUM,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  const all = [];
  for (const device of DEVICES) {
    try {
      await runForDevice(browser, device);
    } catch (err) {
      console.error(`Error for ${device.name}:`, err.message);
    }
  }

  await browser.close();

  // Final summary
  const files = fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.png')).sort();
  console.log(`\n=== Done: ${files.length} screenshots ===`);
  files.forEach(f => {
    const kb = (fs.statSync(path.join(OUT_DIR, f)).size / 1024).toFixed(0);
    console.log(`  ${f} (${kb} KB)`);
  });
})();
