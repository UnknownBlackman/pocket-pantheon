import { defineComponents } from '@iwsdk/core';
import {
  BuildingView,
  ChronicleTablet,
  DioramaView,
  FavorPips,
  PowerEffect,
  VillageRoot,
  VillagerView,
} from './ecs/components.js';

export default defineComponents([
  VillageRoot,
  VillagerView,
  BuildingView,
  DioramaView,
  PowerEffect,
  FavorPips,
  ChronicleTablet,
]);
