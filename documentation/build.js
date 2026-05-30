import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const diagramsDir = path.join(__dirname, 'diagrams');
const outputDir = path.join(__dirname, 'output');
const htmlPath = path.join(__dirname, 'document.html');
const pdfPath = path.join(outputDir, 'Clinic_Management_System_Documentation.pdf');
const logPath = path.join(__dirname, 'build.log');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(logPath, line);
  console.log(msg);
}

function findBrowser() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  return candidates.find(p => fs.existsSync(p)) || null;
}

function generateDiagrams() {
  log('Generating UML diagrams...');
  const files = fs.readdirSync(diagramsDir).filter(f => f.endsWith('.mmd'));
  for (const file of files) {
    const input = path.join(diagramsDir, file);
    const output = path.join(diagramsDir, file.replace('.mmd', '.png'));
    try {
      execSync(`npx --yes @mermaid-js/mermaid-cli -i "${input}" -o "${output}" -b white -w 1200`, {
        cwd: __dirname,
        stdio: 'pipe',
        timeout: 120000
      });
      log(`Generated ${file.replace('.mmd', '.png')}`);
    } catch (e) {
      log(`Warning: Could not generate ${file}: ${e.message}`);
    }
  }
}

async function generatePdf() {
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const browserPath = findBrowser();
  if (!browserPath) throw new Error('No Chrome or Edge found for PDF generation');

  log(`Using browser: ${browserPath}`);

  let launch;
  try {
    const mod = await import('puppeteer-core');
    launch = mod.default;
  } catch {
    const mod = await import('puppeteer');
    launch = mod.default;
  }

  log('Launching browser...');
  const browser = await launch.launch({
    executablePath: browserPath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--allow-file-access-from-files']
  });

  const page = await browser.newPage();
  const fileUrl = `file:///${htmlPath.replace(/\\/g, '/')}`;
  await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 60000 });

  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '2.5cm', bottom: '2.5cm', left: '2cm', right: '2cm' },
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: '<div style="width:100%;text-align:center;font-size:9px;color:#666;font-family:Times New Roman;"><span class="pageNumber"></span></div>'
  });

  await browser.close();

  const stats = fs.statSync(pdfPath);
  log(`PDF saved: ${pdfPath} (${stats.size} bytes)`);
}

try {
  fs.writeFileSync(logPath, '');
  generateDiagrams();
  await generatePdf();
  log('Build completed successfully');
} catch (err) {
  log(`Build failed: ${err.stack || err.message}`);
  process.exit(1);
}
