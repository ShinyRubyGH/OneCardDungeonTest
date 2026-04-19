import type { DungeonMap, Tile } from './types.js';

export const MAP_CODES = {
  EMPTY: 0,
  START: 13,
  WALL: 14
} as const;

export const MAP_A: number[][] = [
  [9, 5, 0, 1, 13],
  [7, 0, 0, 14, 5],
  [11, 0, 9, 0, 1],
  [3, 14, 7, 14, 9],
  [13, 11, 9, 11, 5]
];

export const MAP_B: number[][] = [
  [13, 6, 2, 8, 10],
  [2, 6, 10, 0, 12],
  [14, 10, 0, 14, 0],
  [10, 0, 12, 14, 12],
  [6, 8, 0, 4, 13]
];

function isWall(code: number): boolean {
  return code === MAP_CODES.WALL;
}

function isStart(code: number): boolean {
  return code === MAP_CODES.START;
}

function isEmpty(code: number): boolean {
  return code === MAP_CODES.EMPTY;
}

function isEnemySpawn(code: number): boolean {
  return code >= 1 && code <= 12;
}

function cloneLayout(layout: number[][]): number[][] {
  return layout.map(row => [...row]);
}

function invertLayout180(layout: number[][]): number[][] {
  return cloneLayout(layout)
    .reverse()
    .map(row => [...row].reverse());
}

function getBaseLayoutForLevel(level: number): number[][] {
  return level % 2 === 1 ? MAP_A : MAP_B;
}

function isInvertedForLevel(level: number): boolean {
  const phase = Math.ceil(level / 2);
  return phase % 2 === 0;
}

export function getLayoutForLevel(level: number): number[][] {
  const baseLayout = getBaseLayoutForLevel(level);
  return isInvertedForLevel(level) ? invertLayout180(baseLayout) : cloneLayout(baseLayout);
}

function createTile(x: number, y: number, code: number): Tile {
  if (isWall(code)) {
    return {
      x,
      y,
      code,
      nivel: null,
      spawnNivel: null,
      type: 'wall',
      bloqueaMovimiento: true,
      bloqueaVision: true,
      esInicio: false
    };
  }

  if (isStart(code)) {
    return {
      x,
      y,
      code,
      nivel: null,
      spawnNivel: null,
      type: 'stairs',
      bloqueaMovimiento: false,
      bloqueaVision: false,
      esInicio: true
    };
  }

  if (isEmpty(code)) {
    return {
      x,
      y,
      code,
      nivel: null,
      spawnNivel: null,
      type: 'floor',
      bloqueaMovimiento: false,
      bloqueaVision: false,
      esInicio: false
    };
  }

  if (isEnemySpawn(code)) {
    return {
      x,
      y,
      code,
      nivel: code,
      spawnNivel: code,
      type: 'floor',
      bloqueaMovimiento: false,
      bloqueaVision: false,
      esInicio: false
    };
  }

  return {
    x,
    y,
    code,
    nivel: null,
    spawnNivel: null,
    type: 'floor',
    bloqueaMovimiento: false,
    bloqueaVision: false,
    esInicio: false
  };
}

export function buildMapForLevel(level: number): DungeonMap {
  const layout = getLayoutForLevel(level);

  const tiles = layout.map((row, y) =>
    row.map((code, x) => createTile(x, y, code))
  );

  return {
    width: 5,
    height: 5,
    tiles,
    level,
    phase: Math.ceil(level / 2),
    side: level % 2 === 1 ? 'A' : 'B',
    inverted: isInvertedForLevel(level)
  };
}

export function getSpawnTilesForLevel(map: DungeonMap, nivelActual: number): Tile[] {
  return map.tiles
    .flat()
    .filter(tile => tile.spawnNivel === nivelActual);
}

export function getStartTiles(map: DungeonMap): Tile[] {
  return map.tiles
    .flat()
    .filter(tile => tile.esInicio);
}