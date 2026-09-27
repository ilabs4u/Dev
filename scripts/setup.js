#!/usr/bin/env node
/**
 * Dev Browser Setup Script
 * Downloads Firefox source code and prepares the build environment.
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ENGINE_DIR = path.join(__dirname, "..", "engine");

console.log("🚀 Dev Browser Setup");
console.log("===================\n");

// Step 1: Check prerequisites
console.log("[1/4] Checking prerequisites...");
try {
  execSync("python3 --version", { stdio: "pipe" });
  console.log("  ✅ Python found");
} catch {
  try {
    execSync("python --version", { stdio: "pipe" });
    console.log("  ✅ Python found");
  } catch {
    console.error("  ❌ Python not found. Please install Python 3.x");
    process.exit(1);
  }
}

try {
  execSync("rustc --version", { stdio: "pipe" });
  console.log("  ✅ Rust found");
} catch {
  console.error("  ❌ Rust not found. Install from https://rustup.rs");
  process.exit(1);
}

// Step 2: Bootstrap Firefox source
console.log("\n[2/4] Downloading Firefox source (this will take a while)...");
if (!fs.existsSync(ENGINE_DIR)) {
  fs.mkdirSync(ENGINE_DIR, { recursive: true });
}

console.log("  Bootstrapping Mozilla build system...");
console.log("  This downloads ~1GB of source code.\n");
// TODO: Implement actual Firefox source download
// This will use Mozilla's `mach bootstrap` or Zen's initialization scripts
console.log("  ⚠️  TODO: Integrate with Zen Browser's engine initialization");
console.log("  For now, follow docs/building.md for manual setup.\n");

// Step 3: Build daemon
console.log("[3/4] Building helper daemon...");
try {
  execSync("cargo build", { cwd: path.join(__dirname, "..", "daemon"), stdio: "inherit" });
  console.log("  ✅ Daemon built");
} catch (e) {
  console.warn("  ⚠️  Daemon build failed (non-critical):", e.message);
}

// Step 4: Install npm dependencies
console.log("\n[4/4] Installing dependencies...");
execSync("npm install", { cwd: path.join(__dirname, ".."), stdio: "inherit" });

console.log("\n✅ Setup complete!");
console.log("\nNext steps:");
console.log("  1. npm run patch:apply   # Apply Dev patches to Firefox");
console.log("  2. ./engine/mach build   # Build the browser (2-4 hours first time)");
console.log("  3. ./engine/mach run     # Launch Dev Browser\n");
