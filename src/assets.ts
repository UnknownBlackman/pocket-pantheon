import { AssetType, defineAssets } from '@iwsdk/core';
import { createTestCube } from './scene-assets/test-cube.scene-asset.js';
import {
  createCampfire,
  createDiorama,
  createField,
  createHut,
  createShrine,
  createVillager,
} from './scene-assets/village.scene-asset.js';

const publicAssetUrl = (filePath: string): string =>
  `${import.meta.env.BASE_URL}${filePath.replace(/^\/+/u, '')}`;

const uikitml = (fileName: string, name: string) => ({
  url: publicAssetUrl(`ui/${fileName}`),
  type: AssetType.UIKitML,
  name,
});

export default defineAssets({
  'test-cube': createTestCube(),
  diorama: createDiorama(),
  villager: createVillager(),
  field: createField(),
  hut: createHut(),
  shrine: createShrine(),
  campfire: createCampfire(),
  'welcome-panel': uikitml('welcome.uikitml', 'Welcome Panel'),
});
