const fs = require('fs');
const path = require('path');

const configFile = process.env.BRANDCONFIG_PATH || path.join(__dirname, '..', 'brandingAssets', 'brandconfig.json');

function validate(obj, keys, parent) {
  for (const key of keys) {
    if (!(key in obj)) {
      throw new Error(`Missing required key '${parent ? parent + '.' : ''}${key}' in brandconfig.json`);
    }
  }
}

function loadConfig() {
  let raw;
  try {
    raw = fs.readFileSync(configFile, 'utf8');
  } catch (err) {
    throw new Error(`Unable to read brandconfig.json at ${configFile}`);
  }
  let config;
  try {
    config = JSON.parse(raw);
  } catch (err) {
    throw new Error('brandconfig.json contains invalid JSON');
  }

  validate(config, ['brandName','tagline','palette','fonts','logoPaths','imagery','stakeholders'], '');
  validate(config.palette, ['digitalTide','retailStone','cloudCommerce','midnightTrade','checkoutGold'], 'palette');
  validate(config.fonts, ['primary','websafe'], 'fonts');
  validate(config.logoPaths, ['singleLogo','allLogos'], 'logoPaths');
  validate(config.imagery, ['brandGuidePdf','colourPalette','photoStyle','coreElements','powerpointExample','stockDir','headshotsDir'], 'imagery');
  if (!Array.isArray(config.stakeholders) || config.stakeholders.length === 0) {
    throw new Error('brandconfig.json must include at least one stakeholder');
  }
  for (const [i, s] of config.stakeholders.entries()) {
    validate(s, ['name','title','email','imagePath'], `stakeholders[${i}]`);
  }

  return config;
}

const brandContext = loadConfig();
brandContext.__configFile = configFile;

console.log(`Loaded brandconfig for "${brandContext.brandName}" with ${brandContext.stakeholders.length} stakeholders and palette`, brandContext.palette);

module.exports = { brandContext };
