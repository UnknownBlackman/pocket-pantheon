import { defineComponents } from '@iwsdk/core';
import {
  BuildingView,
  DioramaView,
  VillageRoot,
  VillagerView,
} from './ecs/components.js';

export default defineComponents([VillageRoot, VillagerView, BuildingView, DioramaView]);
