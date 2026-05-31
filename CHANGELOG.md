[Compare changes](https://github.com/stacksjs/backupx/compare/v0.1.2...v0.1.3)

### 🐛 Bug Fixes

- **scripts**: stop double-generating CHANGELOG on release ([91ef442](https://github.com/stacksjs/backupx/commit/91ef442))
- **directory**: restore parameter names in matchesPatterns ([1f0fe90](https://github.com/stacksjs/backupx/commit/1f0fe90))
- kebab staged-lint + gitlint pkg path; small docs tidy ([4465061](https://github.com/stacksjs/backupx/commit/4465061))
- add setup-bun to publish-commit job ([e946dbe](https://github.com/stacksjs/backupx/commit/e946dbe))
- normalize actions/checkout to v6 ([777f8ca](https://github.com/stacksjs/backupx/commit/777f8ca))
- resolve typecheck errors ([400bad7](https://github.com/stacksjs/backupx/commit/400bad7))

### ♻️ Code Refactoring

- **cli**: swap cac for @stacksjs/clapp ([daaa216](https://github.com/stacksjs/backupx/commit/daaa216))

### 🤖 Continuous Integration

- drop redundant setup-bun (pantry installs bun via deps.yaml) ([cca4377](https://github.com/stacksjs/backupx/commit/cca4377))

### 🧹 Chores

- release v0.1.3 ([3b1c881](https://github.com/stacksjs/backupx/commit/3b1c881))
- add release:patch/minor/major scripts ([e867725](https://github.com/stacksjs/backupx/commit/e867725))
- wip ([2ffb322](https://github.com/stacksjs/backupx/commit/2ffb322))
- **deps**: refresh bun.lock to pick up @stacksjs/logsmith 0.2.3 ([0f24d10](https://github.com/stacksjs/backupx/commit/0f24d10))
- **deps**: refresh bun.lock to pick up buddy-bot 0.9.20 ([805210d](https://github.com/stacksjs/backupx/commit/805210d))
- **deps**: bump better-dx to ^0.2.15 ([f4d55c1](https://github.com/stacksjs/backupx/commit/f4d55c1))
- ignore pantry directory ([0208fea](https://github.com/stacksjs/backupx/commit/0208fea))
- **ci**: bump actions/checkout to v6, actions/cache to v5 ([f850d49](https://github.com/stacksjs/backupx/commit/f850d49))
- refresh bun.lock and apply pickier --fix ([4258d1d](https://github.com/stacksjs/backupx/commit/4258d1d))
- refresh bun.lock ([f23a428](https://github.com/stacksjs/backupx/commit/f23a428))
- refresh bun.lock to pick up latest pickier ([07f2b2e](https://github.com/stacksjs/backupx/commit/07f2b2e))
- fresh install to pick up dtsx 0.9.14 and bunfig 0.15.9 ([b96afe1](https://github.com/stacksjs/backupx/commit/b96afe1))
- use --bun flag in release script ([703c159](https://github.com/stacksjs/backupx/commit/703c159))
- fresh install to pick up pickier 0.1.21 ([7345f89](https://github.com/stacksjs/backupx/commit/7345f89))
- fix lint errors ([3a9b388](https://github.com/stacksjs/backupx/commit/3a9b388))
- update dependencies ([37f9887](https://github.com/stacksjs/backupx/commit/37f9887))
- repo cleanup and modernization ([bf6abe7](https://github.com/stacksjs/backupx/commit/bf6abe7))
- remove @stacksjs/docs ([797c39e](https://github.com/stacksjs/backupx/commit/797c39e))
- remove redundant docs/.vitepress ([8c794ca](https://github.com/stacksjs/backupx/commit/8c794ca))
- remove .zed and .cursor folders ([41ccd6d](https://github.com/stacksjs/backupx/commit/41ccd6d))
- use Pantry action for publish-commit and add job dependencies ([b9da3ea](https://github.com/stacksjs/backupx/commit/b9da3ea))
- update better-dx to ^0.2.7 ([eac7ff0](https://github.com/stacksjs/backupx/commit/eac7ff0))
- update CLAUDE.md with project context and crosswind details ([7311779](https://github.com/stacksjs/backupx/commit/7311779))
- add proper claude code guidelines ([f0f3023](https://github.com/stacksjs/backupx/commit/f0f3023))
- **deps**: update dependency actions/checkout to v6.0.2 (#1388) ([5b114f7](https://github.com/stacksjs/backupx/commit/5b114f7)) ([#1388](https://github.com/stacksjs/backupx/issues/1388), [#1388](https://github.com/stacksjs/backupx/issues/1388))
- wip ([8e3476e](https://github.com/stacksjs/backupx/commit/8e3476e))
- wip ([8c5799a](https://github.com/stacksjs/backupx/commit/8c5799a))
- wip ([2c689d5](https://github.com/stacksjs/backupx/commit/2c689d5))
- wip ([37ac349](https://github.com/stacksjs/backupx/commit/37ac349))
- wip ([618a771](https://github.com/stacksjs/backupx/commit/618a771))
- wip ([d51419e](https://github.com/stacksjs/backupx/commit/d51419e))
- **deps**: update dependency actions/cache to v5.0.3 (#1795) ([5c3da0c](https://github.com/stacksjs/backupx/commit/5c3da0c)) ([#1795](https://github.com/stacksjs/backupx/issues/1795), [#1795](https://github.com/stacksjs/backupx/issues/1795))
- **deps**: update all non-major dependencies (#1796) ([9469cf6](https://github.com/stacksjs/backupx/commit/9469cf6)) ([#1796](https://github.com/stacksjs/backupx/issues/1796), [#1796](https://github.com/stacksjs/backupx/issues/1796))
- wip ([1cf0be4](https://github.com/stacksjs/backupx/commit/1cf0be4))
- wip ([6f2fc27](https://github.com/stacksjs/backupx/commit/6f2fc27))
- wip ([149a046](https://github.com/stacksjs/backupx/commit/149a046))
- wip ([85c8de1](https://github.com/stacksjs/backupx/commit/85c8de1))
- wip ([4211504](https://github.com/stacksjs/backupx/commit/4211504))
- **deps**: update stacksjs/action-releaser action to v1.2.7 (#2) ([d09a86d](https://github.com/stacksjs/backupx/commit/d09a86d)) ([#2](https://github.com/stacksjs/backupx/issues/2), [#2](https://github.com/stacksjs/backupx/issues/2))
- **deps**: update actions/checkout action to v5 (#3) ([64405e1](https://github.com/stacksjs/backupx/commit/64405e1)) ([#3](https://github.com/stacksjs/backupx/issues/3), [#3](https://github.com/stacksjs/backupx/issues/3))
- **deps**: update all non-major dependencies (#19) ([9c2d970](https://github.com/stacksjs/backupx/commit/9c2d970)) ([#19](https://github.com/stacksjs/backupx/issues/19), [#19](https://github.com/stacksjs/backupx/issues/19))
- add better-dx and claude ([caaea30](https://github.com/stacksjs/backupx/commit/caaea30))
- add clarity ([7b74e66](https://github.com/stacksjs/backupx/commit/7b74e66))
- add clarity ([2ba1d80](https://github.com/stacksjs/backupx/commit/2ba1d80))
- update tools ([980a6c3](https://github.com/stacksjs/backupx/commit/980a6c3))
- update tools ([a325bc4](https://github.com/stacksjs/backupx/commit/a325bc4))
- adjust readme ([ab8fa57](https://github.com/stacksjs/backupx/commit/ab8fa57))

### ⏪ Reverts

- keep staged-lint kebab + bunx gitlint shorthand ([38b78d9](https://github.com/stacksjs/backupx/commit/38b78d9))

### 📄 Miscellaneous

- Merge pull request #13 from stacksjs/chore/add-clarity ([732c208](https://github.com/stacksjs/backupx/commit/732c208)) ([#13](https://github.com/stacksjs/backupx/issues/13), [#13](https://github.com/stacksjs/backupx/issues/13))

### Contributors

- Adelino Ngomacha <adelinob335@gmail.com>
- Chris <chrisbreuer93@gmail.com>
- Glenn Michael Torregosa <gtorregosa@gmail.com>
- Michael Vincent Caballero <mike.cabz32@gmail.com>
- cab-mikee <mike.cabz32@gmail.com>
- glennmichael123 <gtorregosa@gmail.com>
- renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

## v0.1.1...main

[compare changes](https://github.com/stacksjs/backupx/compare/v0.1.1...main)

### 🏡 Chore

- Adjust readme ([de93bd6](https://github.com/stacksjs/backupx/commit/de93bd6))
- Adjust wording ([e205488](https://github.com/stacksjs/backupx/commit/e205488))
- Use icon prop ([b6404e3](https://github.com/stacksjs/backupx/commit/b6404e3))
- Attach zip files ([2f97222](https://github.com/stacksjs/backupx/commit/2f97222))

### ❤️ Contributors

- Chris ([@chrisbbreuer](https://github.com/chrisbbreuer))

## v0.1.0...main

[compare changes](https://github.com/stacksjs/backupx/compare/v0.1.0...main)

### 🏡 Chore

- Properly use backupx name everywhere ([65566fe](https://github.com/stacksjs/backupx/commit/65566fe))

### ❤️ Contributors

- Chris ([@chrisbbreuer](https://github.com/chrisbbreuer))

## ...main

### 🏡 Chore

- Wip ([001fdf5](https://github.com/stacksjs/backupx/commit/001fdf5))
- Wip ([7e73250](https://github.com/stacksjs/backupx/commit/7e73250))
- Wip ([d261aed](https://github.com/stacksjs/backupx/commit/d261aed))
- Wip ([13d043f](https://github.com/stacksjs/backupx/commit/13d043f))
- Wip ([bba4cdd](https://github.com/stacksjs/backupx/commit/bba4cdd))
- Wip ([6e639cc](https://github.com/stacksjs/backupx/commit/6e639cc))
- Wip ([b85d001](https://github.com/stacksjs/backupx/commit/b85d001))
- Wip ([846bd35](https://github.com/stacksjs/backupx/commit/846bd35))
- Wip ([9fe5f9b](https://github.com/stacksjs/backupx/commit/9fe5f9b))
- Wip ([181f919](https://github.com/stacksjs/backupx/commit/181f919))
- Wip ([7cdb7ec](https://github.com/stacksjs/backupx/commit/7cdb7ec))
- Wip ([fa59929](https://github.com/stacksjs/backupx/commit/fa59929))
- Wip ([6f2581b](https://github.com/stacksjs/backupx/commit/6f2581b))
- Wip ([d8601e8](https://github.com/stacksjs/backupx/commit/d8601e8))
- Wip ([24ef96f](https://github.com/stacksjs/backupx/commit/24ef96f))
- Wip ([5b6b166](https://github.com/stacksjs/backupx/commit/5b6b166))
- Wip ([8084779](https://github.com/stacksjs/backupx/commit/8084779))
- Wip ([c0230e3](https://github.com/stacksjs/backupx/commit/c0230e3))
- Wip ([cc708e6](https://github.com/stacksjs/backupx/commit/cc708e6))
- Wip ([2c506fe](https://github.com/stacksjs/backupx/commit/2c506fe))
- Wip ([291d802](https://github.com/stacksjs/backupx/commit/291d802))
- Wip ([1f67b4d](https://github.com/stacksjs/backupx/commit/1f67b4d))
- Wip ([4e34c18](https://github.com/stacksjs/backupx/commit/4e34c18))

### ❤️ Contributors

- Chris ([@chrisbbreuer](https://github.com/chrisbbreuer))
