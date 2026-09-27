# Building Dev Browser

## Prerequisites

### Linux
```bash
sudo apt install build-essential git python3 nodejs npm rustc
# Plus Firefox build dependencies
```

### macOS
- Xcode Command Line Tools
- Homebrew
```bash
brew install node rust python
```

### Windows
- MozillaBuild
- Visual Studio Build Tools
- Node.js
- Rust

## Step-by-Step Instructions

1. Fork and clone the repository.
2. Run `npm run setup` (downloads Firefox source into `engine/`).
3. Run `npm run patch:apply` (applies patches).
4. Run `./engine/mach build` (builds the browser, takes 2-4 hours first time).
5. Run `./engine/mach run` (launches Dev Browser).
6. Build the daemon:
   ```bash
   cd daemon && cargo build --release
   ```

## Hardware Requirements
- RAM: 8GB+ (16GB recommended)
- Disk: 50GB+ free space
- CPU: 4+ cores recommended

## Troubleshooting
If you encounter build errors, ensure all Mozilla/Gecko dependencies are properly installed for your OS and that you are using a compatible Python 3 version.
