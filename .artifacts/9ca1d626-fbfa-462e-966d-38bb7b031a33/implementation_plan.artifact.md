# Enable SVG Imports in React Native

The user is unable to import SVG files as React components in their React Native project. While `react-native-svg` is installed, the necessary build-time transformer (`react-native-svg-transformer`) and configuration are missing.

## Proposed Changes

### Dependencies

#### [MODIFY] [package.json](file:///C:/Users/Sherly Sanjana.A/CentiQ/package.json)
- Add `react-native-svg-transformer` to `devDependencies`.

### Configuration

#### [MODIFY] [metro.config.js](file:///C:/Users/Sherly Sanjana.A/CentiQ/metro.config.js)
- Update Metro configuration to use `react-native-svg-transformer` for `.svg` files.
- Exclude `.svg` from the standard asset registry.

### TypeScript Support

#### [NEW] [declarations.d.ts](file:///C:/Users/Sherly Sanjana.A/CentiQ/declarations.d.ts)
- Add a type declaration for `.svg` files so TypeScript doesn't complain about the imports.

## Verification Plan

### Automated Tests
- N/A (Build configuration change)

### Manual Verification
1. Run `npm install` or `yarn install`.
2. Try importing an SVG file in `App.tsx`:
   ```tsx
   import Logo from './path/to/logo.svg';
   // ...
   <Logo width={120} height={40} />
   ```
3. Restart the Metro bundler with `npx react-native start --reset-cache`.
