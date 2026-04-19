import type {
  DungeonMap,
  Player,
  PlayerStatKey,
  PlayerStats,
  PlayerUpgrades,
  SpawnedEnemy,
  TurnResources
} from './types.js';

const PLAYER_MAX_STAT = 6;

const BASE_PLAYER_STATS: PlayerStats = {
  vida: 6,
  velocidad: 1,
  dano: 1,
  defensa: 1,
  alcance: 2
};

const EMPTY_UPGRADES: PlayerUpgrades = {
  vida: 0,
  velocidad: 0,
  dano: 0,
  defensa: 0,
  alcance: 0
};

function clampStat(value: number): number {
  return Math.min(value, PLAYER_MAX_STAT);
}

export function getBasePlayerStats(): PlayerStats {
  return { ...BASE_PLAYER_STATS };
}

export function createPlayer(map: DungeonMap): Player {
  const startX = map.side === 'A' ? 0 : map.width - 1;
  const startY = map.height - 1;

  return {
    nombre: 'Aventurero',
    x: startX,
    y: startY,
    vidaActual: BASE_PLAYER_STATS.vida,
    stats: { ...BASE_PLAYER_STATS },
    mejorasDisponibles: 0,
    mejorasAplicadas: { ...EMPTY_UPGRADES },
    nivelesCompletados: 0
  };
}

export function movePlayerToMapStart(player: Player, map: DungeonMap): Player {
  return {
    ...player,
    x: map.side === 'A' ? 0 : map.width - 1,
    y: map.height - 1
  };
}

export function grantLevelCompletionUpgrade(player: Player): Player {
  return {
    ...player,
    nivelesCompletados: player.nivelesCompletados + 1,
    mejorasDisponibles: player.mejorasDisponibles + 1
  };
}

export function canUpgradeStat(player: Player, stat: PlayerStatKey): boolean {
  if (stat === 'alcance') {
    return false;
  }

  return player.mejorasDisponibles > 0 && player.stats[stat] < PLAYER_MAX_STAT;
}

export function upgradePlayerStat(player: Player, stat: PlayerStatKey): Player {
  if (!canUpgradeStat(player, stat)) {
    return player;
  }

  const upgradedStatValue = clampStat(player.stats[stat] + 1);
  const upgradedCurrentHealth =
    stat === 'vida'
      ? Math.min(upgradedStatValue, player.vidaActual + 1)
      : player.vidaActual;

  return {
    ...player,
    vidaActual: upgradedCurrentHealth,
    stats: {
      ...player.stats,
      [stat]: upgradedStatValue
    },
    mejorasAplicadas: {
      ...player.mejorasAplicadas,
      [stat]: player.mejorasAplicadas[stat] + 1
    },
    mejorasDisponibles: player.mejorasDisponibles - 1
  };
}

function isWithinBounds(map: DungeonMap, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

function getTile(map: DungeonMap, x: number, y: number) {
  if (!isWithinBounds(map, x, y)) {
    return null;
  }

  return map.tiles[y][x];
}

function hasEnemyAt(enemies: SpawnedEnemy[], x: number, y: number): boolean {
  return enemies.some(enemy => enemy.x === x && enemy.y === y);
}

export function getMovementCost(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): number | null {
  const dx = Math.abs(toX - fromX);
  const dy = Math.abs(toY - fromY);

  if (dx === 0 && dy === 0) {
    return null;
  }

  if (dx > 1 || dy > 1) {
    return null;
  }

  if (dx === 1 && dy === 1) {
    return 3;
  }

  if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
    return 2;
  }

  return null;
}

export function canMoveTo(
  map: DungeonMap,
  player: Player,
  enemies: SpawnedEnemy[],
  targetX: number,
  targetY: number,
  turn: TurnResources
): boolean {
  if (!isWithinBounds(map, targetX, targetY)) {
    return false;
  }

  const movementCost = getMovementCost(player.x, player.y, targetX, targetY);
  if (movementCost === null) {
    return false;
  }

  const tile = getTile(map, targetX, targetY);
  if (!tile || tile.bloqueaMovimiento) {
    return false;
  }

  if (hasEnemyAt(enemies, targetX, targetY)) {
    return false;
  }

  if (movementCost > turn.velocidadDisponible) {
    return false;
  }

  return true;
}

export function movePlayer(
  map: DungeonMap,
  player: Player,
  enemies: SpawnedEnemy[],
  turn: TurnResources,
  targetX: number,
  targetY: number
): { player: Player; turn: TurnResources } {
  const movementCost = getMovementCost(player.x, player.y, targetX, targetY);

  if (
    movementCost === null ||
    !canMoveTo(map, player, enemies, targetX, targetY, turn)
  ) {
    return { player, turn };
  }

  return {
    player: {
      ...player,
      x: targetX,
      y: targetY
    },
    turn: {
      ...turn,
      velocidadDisponible: turn.velocidadDisponible - movementCost
    }
  };
}

export function getReachCostByMovement(
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  const diagonalSteps = Math.min(dx, dy);
  const orthogonalSteps = Math.max(dx, dy) - diagonalSteps;

  return diagonalSteps * 3 + orthogonalSteps * 2;
}

function getTileCorners(x: number, y: number): Array<{ x: number; y: number }> {
  return [
    { x, y },
    { x: x + 1, y },
    { x, y: y + 1 },
    { x: x + 1, y: y + 1 }
  ];
}

function segmentIntersectsTileInterior(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  tileX: number,
  tileY: number
): boolean {
  const epsilon = 1e-9;
  const minX = tileX + epsilon;
  const maxX = tileX + 1 - epsilon;
  const minY = tileY + epsilon;
  const maxY = tileY + 1 - epsilon;

  const dx = bx - ax;
  const dy = by - ay;

  let t0 = 0;
  let t1 = 1;

  const clip = (p: number, q: number): boolean => {
    if (p === 0) {
      return q >= 0;
    }

    const t = q / p;

    if (p < 0) {
      if (t > t1) {
        return false;
      }

      if (t > t0) {
        t0 = t;
      }
    } else {
      if (t < t0) {
        return false;
      }

      if (t < t1) {
        t1 = t;
      }
    }

    return true;
  };

  return (
    clip(-dx, ax - minX) &&
    clip(dx, maxX - ax) &&
    clip(-dy, ay - minY) &&
    clip(dy, maxY - ay) &&
    t0 <= t1
  );
}

function isVisionBlockingTile(
  map: DungeonMap,
  enemies: SpawnedEnemy[],
  tileX: number,
  tileY: number,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): boolean {
  if ((tileX === fromX && tileY === fromY) || (tileX === toX && tileY === toY)) {
    return false;
  }

  const tile = getTile(map, tileX, tileY);
  if (!tile) {
    return false;
  }

  if (tile.bloqueaVision) {
    return true;
  }

  return hasEnemyAt(enemies, tileX, tileY);
}

export function hasLineOfSight(
  map: DungeonMap,
  enemies: SpawnedEnemy[],
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): boolean {
  const sourceCorners = getTileCorners(fromX, fromY);
  const targetCorners = getTileCorners(toX, toY);

  for (const sourceCorner of sourceCorners) {
    for (const targetCorner of targetCorners) {
      let blocked = false;

      for (let y = 0; y < map.height && !blocked; y += 1) {
        for (let x = 0; x < map.width; x += 1) {
          if (!isVisionBlockingTile(map, enemies, x, y, fromX, fromY, toX, toY)) {
            continue;
          }

          if (
            segmentIntersectsTileInterior(
              sourceCorner.x,
              sourceCorner.y,
              targetCorner.x,
              targetCorner.y,
              x,
              y
            )
          ) {
            blocked = true;
            break;
          }
        }
      }

      if (!blocked) {
        return true;
      }
    }
  }

  return false;
}

export function canAttackEnemy(
  map: DungeonMap,
  player: Player,
  enemy: SpawnedEnemy,
  enemies: SpawnedEnemy[],
  turn: TurnResources
): boolean {
  if (turn.ataqueDisponible <= 0) {
    return false;
  }

  if (turn.ataqueDisponible <= enemy.stats.defensa) {
    return false;
  }

  const reachCost = getReachCostByMovement(player.x, player.y, enemy.x, enemy.y);
  if (reachCost > turn.alcanceTotal) {
    return false;
  }

  return hasLineOfSight(map, enemies, player.x, player.y, enemy.x, enemy.y);
}

export function attackEnemy(
  enemies: SpawnedEnemy[],
  enemyIndex: number,
  turn: TurnResources
): { enemies: SpawnedEnemy[]; turn: TurnResources } {
  const target = enemies[enemyIndex];
  if (!target) {
    return { enemies, turn };
  }

  const attackCost = target.stats.defensa;
  const damage = turn.ataqueDisponible - target.stats.defensa;

  if (turn.ataqueDisponible <= attackCost || damage <= 0) {
    return { enemies, turn };
  }

  const nextTurn: TurnResources = {
    ...turn,
    ataqueDisponible: turn.ataqueDisponible - attackCost
  };

  const updatedEnemies = enemies
    .map((enemy, index) =>
      index === enemyIndex
        ? { ...enemy, vidaActual: enemy.vidaActual - damage }
        : enemy
    )
    .filter(enemy => enemy.vidaActual > 0);

  return {
    enemies: updatedEnemies,
    turn: nextTurn
  };
}