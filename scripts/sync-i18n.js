import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCALES_DIR = path.join(__dirname, '../public/_locales');

function run() {
  if (!fs.existsSync(LOCALES_DIR)) {
    console.error(`Locales directory not found at: ${LOCALES_DIR}`);
    process.exit(1);
  }

  const locales = fs.readdirSync(LOCALES_DIR).filter((file) => {
    const fullPath = path.join(LOCALES_DIR, file);
    return fs.statSync(fullPath).isDirectory();
  });

  const filesMap = {};
  const allKeys = new Set();

  // Read all files
  for (const locale of locales) {
    const filePath = path.join(LOCALES_DIR, locale, 'messages.json');
    if (!fs.existsSync(filePath)) {
      console.warn(`Warning: messages.json not found for locale "${locale}"`);
      continue;
    }
    try {
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      filesMap[locale] = { filePath, content };
      for (const key of Object.keys(content)) {
        allKeys.add(key);
      }
    } catch (err) {
      console.error(`Error reading/parsing JSON for locale "${locale}":`, err.message);
    }
  }

  const unionKeys = Array.from(allKeys).sort();
  let hasMissing = false;

  console.log(`Found ${locales.length} locales: ${locales.join(', ')}`);
  console.log(`Total unique translation keys in union: ${unionKeys.length}\n`);

  for (const locale of locales) {
    const fileData = filesMap[locale];
    if (!fileData) continue;

    const { filePath, content } = fileData;
    const missingKeys = [];
    const sortedContent = {};

    // Check for missing keys and build sorted object
    for (const key of unionKeys) {
      if (content[key] === undefined) {
        missingKeys.push(key);
      } else {
        sortedContent[key] = content[key];
      }
    }

    // Write sorted content back to file
    try {
      fs.writeFileSync(filePath, `${JSON.stringify(sortedContent, null, 2)}\n`, 'utf8');
      console.log(`✅ Sorted and wrote messages.json for locale "${locale}"`);
    } catch (err) {
      console.error(`Error writing messages.json for locale "${locale}":`, err.message);
    }

    if (missingKeys.length > 0) {
      hasMissing = true;
      console.warn(`⚠️ Locale "${locale}" is missing ${missingKeys.length} keys:`);
      for (const k of missingKeys) {
        console.warn(`   - ${k}`);
      }
    } else {
      console.log(`🎉 Locale "${locale}" is complete (0 missing keys).`);
    }
    console.log('');
  }

  if (hasMissing) {
    console.log('⚠️ Process completed with warnings. Some locales have missing keys.');
  } else {
    console.log('✨ All locales are fully synchronized and sorted!');
  }
}

run();
