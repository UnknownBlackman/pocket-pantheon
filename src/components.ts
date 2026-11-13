import { defineComponents } from '@iwsdk/core';
import {
  BuildingView,
  ChronicleTablet,
  DioramaView,
  Dying,
  GraveView,
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
  Dying,
  GraveView,
]);
