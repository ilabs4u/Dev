# Contributing to Dev Browser

Welcome to the Dev Browser project! We're excited to have you contribute. This guide will help you get started.

## Code of Conduct
Please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## How to Report Bugs
If you find a bug, please help us by reporting it using our [Bug Report Template](.github/ISSUE_TEMPLATE/bug_report.yml).

## How to Suggest Features
We welcome new ideas! Please use our [Feature Request Template](.github/ISSUE_TEMPLATE/feature_request.yml) to suggest features.

## Development Setup

### Prerequisites
* Git
* Node.js 20+
* Rust toolchain
* Python 3.x
* MozillaBuild (Windows) or build dependencies (Linux/Mac)

### Steps
1. Fork and clone the repository
2. Run `npm run setup`
3. Run `npm run patch:apply`
4. Run `./mach build`

## Project Structure
* `src/dev/` - Dev Browser specific source code
* `patches/` - Patches applied to the underlying browser engine
* `plugins/` - Built-in and community Lua plugins
* `daemon/` - The Rust daemon backend

## How the Patch System Works
**Important:** Never edit the `engine/` directory directly. Make your changes in the engine directory and use the patch-export script to generate a patch in the `patches/` directory.

## How to Write Lua Plugins
For instructions on creating Lua plugins, please refer to our [Plugin Guide](docs/plugin-guide.md).

## Code Style
* JavaScript/TypeScript: ESLint + Prettier
* Lua: Luacheck
* Rust: `cargo fmt`

## Commit Convention
We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:
* `feat`: A new feature
* `fix`: A bug fix
* `docs`: Documentation only changes
* `chore`: Changes to the build process or auxiliary tools
* `plugin`: Changes related to plugins

## Pull Request Process
1. Create a branch from `main`
2. Implement one feature or fix per PR
3. Fill out the PR template checklist completely
4. PRs are merged via "Squash and merge"

## Review Process
* CI must pass
* At least 1 maintainer approval is required
* Be open to constructive feedback

## Good First Issues
Looking for a way to contribute? Search for issues labeled `good first issue`!
