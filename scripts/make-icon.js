// Rasterizes assets/icon.svg into the platform icon files:
//   assets/icon.png  (256x256, used for the Electron window)
//   assets/icon.ico  (multi-size, used by the Windows installer/exe)
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const pngToIco = require('png-to-ico');

const assets = path.join(__dirname, '..', 'assets');
const svg = fs.readFileSync(path.join(assets, 'icon.svg'));

async function main() {
  // High-res window icon.
  await sharp(svg, { density: 384 }).resize(256, 256).png()
    .toFile(path.join(assets, 'icon.png'));

  // Also a 512 for Linux / general use.
  await sharp(svg, { density: 384 }).resize(512, 512).png()
    .toFile(path.join(assets, 'icon-512.png'));

  // Multi-resolution .ico for Windows.
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const buffers = await Promise.all(
    sizes.map((s) => sharp(svg, { density: 384 }).resize(s, s).png().toBuffer())
  );
  const ico = await pngToIco(buffers);
  fs.writeFileSync(path.join(assets, 'icon.ico'), ico);

  console.log('Generated assets/icon.png, assets/icon-512.png, assets/icon.ico');
}

main().catch((e) => { console.error(e); process.exit(1); });
