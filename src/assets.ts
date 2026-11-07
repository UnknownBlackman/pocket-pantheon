import { AssetType, defineAssets } from '@iwsdk/core';
import { createTestCube } from './scene-assets/test-cube.scene-asset.js';

const publicAssetUrl = (filePath: string): string =>
  `${import.meta.env.BASE_URL}${filePath.replace(/^\/+/u, '')}`;

const uikitml = (fileName: string, name: string) => ({
  url: publicAssetUrl(`ui/${fileName}`),
  type: AssetType.UIKitML,
  name,
});

export default defineAssets({
  'test-cube': createTestCube(),
  'welcome-panel': uikitml('welcome.uikitml', 'Welcome Panel'),
});
