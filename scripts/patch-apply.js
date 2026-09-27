#!/usr/bin/env node
/**
 * Applies all patches from patches/ directory to the engine/ source.
 * Patches are applied in alphabetical order.
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const PATCHES_DIR = path.join(__dirname, "..", "patches");
const ENGINE_DIR = path.join(__dirname, "..", "engine");

if (!fs.existsSync(ENGINE_DIR)) {
  console.error("❌ Engine directory not found. Run 'npm run setup' first.");
  process.exit(1);
}

const patches = fs.readdirSync(PATCHES_DIR)
  .filter(f => f.endsWith(".patch"))
  .sort();

if (patches.length === 0) {
  console.log("No patches to apply.");
  process.exit(0);
}

console.log(`Applying ${patches.length} patches...\n`);

for (const patch of patches) {
  const patchPath = path.join(PATCHES_DIR, patch);
  console.log(`  Applying: ${patch}`);
  try {
    execSync(`git apply --directory=engine "${patchPath}"`, {
      cwd: path.join(__dirname, ".."),
      stdio: "pipe",
    });
    console.log(`  ✅ ${patch}`);
  } catch (e) {
    console.error(`  ❌ Failed: ${patch}`);
    console.error(`     ${e.stderr?.toString().trim()}`);
    process.exit(1);
  }
}

console.log(`\n✅ All ${patches.length} patches applied successfully.`);
