import { getMovementCost, getReachCostByMovement, hasLineOfSight } from './player.js';
export const ENEMIES = [
    {
        id: 'spider',
        nombre: 'Araña',
        stats: {
            vida: 2,
            velocidad: 5,
            ataque: 4,
            defensa: 4,
            alcance: 3,
            nivelesAparicion: [1, 5, 9]
        }
    },
    {
        id: 'skeleton',
        nombre: 'Esqueleto',
        stats: {
            vida: 3,
            velocidad: 4,
            ataque: 5,
            defensa: 4,
            alcance: 4,
            nivelesAparicion: [2, 6, 10]
        }
    },
    {
        id: 'ogre',
        nombre: 'Ogro',
        stats: {
            vida: 5,
            velocidad: 3,
            ataque: 7,
            defensa: 7,
            alcance: 2,
            nivelesAparicion: [3, 7, 11]
        }
    },
    {
        id: 'demon',
        nombre: 'Demonio',
        stats: {
            vida: 5,
            velocidad: 5,
            ataque: 5,
            defensa: 5,
            alcance: 5,
            nivelesAparicion: [4, 8, 12]
        }
    }
];
export function getEnemyByLevel(level) {
    return ENEMIES.find(enemy => enemy.stats.nivelesAparicion.includes(level));
}
export function getEnemiesForLevel(level) {
    return ENEMIES.filter(enemy => enemy.stats.nivelesAparicion.includes(level));
}
export function spawnEnemiesOnTiles(level, tiles) {
    const enemiesForLevel = getEnemiesForLevel(level);
    if (enemiesForLevel.length === 0) {
        return [];
    }
    return tiles.map((tile, index) => {
        const enemy = enemiesForLevel[index % enemiesForLevel.length];
        return {
            ...enemy,
            x: tile.x,
            y: tile.y,
            nivelOrigen: level,
            vidaActual: enemy.stats.vida
        };
    });
}
function keyFor(x, y) {
    return `${x},${y}`;
}
function parseKey(key) {
    const [x, y] = key.split(',').map(Number);
    return { x, y };
}
function isWithinBounds(map, x, y) {
    return x >= 0 && y >= 0 && x < map.width && y < map.height;
}
function canTraverseForMonsterPath(map, player, x, y) {
    if (!isWithinBounds(map, x, y)) {
        return false;
    }
    const tile = map.tiles[y][x];
    if (tile.bloqueaMovimiento) {
        return false;
    }
    return !(x === player.x && y === player.y);
}
function hasEnemyAt(enemies, x, y) {
    return enemies.some(enemy => enemy.x === x && enemy.y === y);
}
function isEmptyDestination(map, player, enemies, x, y) {
    if (!canTraverseForMonsterPath(map, player, x, y)) {
        return false;
    }
    return !hasEnemyAt(enemies, x, y);
}
function getNeighborCoords(map, x, y) {
    const neighbors = [];
    for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
            if (dx === 0 && dy === 0) {
                continue;
            }
            const nx = x + dx;
            const ny = y + dy;
            if (!isWithinBounds(map, nx, ny)) {
                continue;
            }
            const cost = getMovementCost(x, y, nx, ny);
            if (cost === null) {
                continue;
            }
            neighbors.push({ x: nx, y: ny, cost });
        }
    }
    return neighbors;
}
function computeShortestPaths(map, player, startX, startY) {
    const distances = new Map();
    const previous = new Map();
    const unvisited = new Set();
    for (let y = 0; y < map.height; y += 1) {
        for (let x = 0; x < map.width; x += 1) {
            if (!canTraverseForMonsterPath(map, player, x, y)) {
                continue;
            }
            const key = keyFor(x, y);
            distances.set(key, Number.POSITIVE_INFINITY);
            previous.set(key, null);
            unvisited.add(key);
        }
    }
    const startKey = keyFor(startX, startY);
    if (!distances.has(startKey)) {
        return { distances, previous };
    }
    distances.set(startKey, 0);
    while (unvisited.size > 0) {
        let currentKey = null;
        let currentDistance = Number.POSITIVE_INFINITY;
        for (const key of unvisited) {
            const distance = distances.get(key) ?? Number.POSITIVE_INFINITY;
            if (distance < currentDistance) {
                currentDistance = distance;
                currentKey = key;
            }
        }
        if (!currentKey || currentDistance === Number.POSITIVE_INFINITY) {
            break;
        }
        unvisited.delete(currentKey);
        const current = parseKey(currentKey);
        for (const neighbor of getNeighborCoords(map, current.x, current.y)) {
            if (!canTraverseForMonsterPath(map, player, neighbor.x, neighbor.y)) {
                continue;
            }
            const neighborKey = keyFor(neighbor.x, neighbor.y);
            if (!unvisited.has(neighborKey)) {
                continue;
            }
            const alternative = currentDistance + neighbor.cost;
            if (alternative < (distances.get(neighborKey) ?? Number.POSITIVE_INFINITY)) {
                distances.set(neighborKey, alternative);
                previous.set(neighborKey, currentKey);
            }
        }
    }
    return { distances, previous };
}
function buildPathTo(previous, startX, startY, targetX, targetY) {
    const startKey = keyFor(startX, startY);
    const targetKey = keyFor(targetX, targetY);
    if (startKey === targetKey) {
        return [{ x: startX, y: startY }];
    }
    const reversePath = [];
    let cursor = targetKey;
    while (cursor !== null) {
        reversePath.push(parseKey(cursor));
        if (cursor === startKey) {
            break;
        }
        cursor = previous.get(cursor) ?? null;
    }
    const last = reversePath[reversePath.length - 1];
    if (!last || last.x !== startX || last.y !== startY) {
        return [];
    }
    return reversePath.reverse();
}
function chooseTargetTile(map, player, enemies, enemy, distances) {
    const range = enemy.stats.alcance;
    const otherEnemies = enemies.filter(candidate => candidate !== enemy);
    const candidates = [];
    for (let y = 0; y < map.height; y += 1) {
        for (let x = 0; x < map.width; x += 1) {
            if (!isEmptyDestination(map, player, enemies, x, y)) {
                continue;
            }
            if (x !== enemy.x || y !== enemy.y) {
                if (!isEmptyDestination(map, player, otherEnemies, x, y)) {
                    continue;
                }
            }
            const travelCost = distances.get(keyFor(x, y));
            if (travelCost === undefined || !Number.isFinite(travelCost)) {
                continue;
            }
            const reachCostToPlayer = getReachCostByMovement(x, y, player.x, player.y);
            const hasLos = hasLineOfSight(map, otherEnemies, x, y, player.x, player.y);
            candidates.push({
                x,
                y,
                travelCost,
                reachCostToPlayer,
                hasLos
            });
        }
    }
    if (candidates.length === 0) {
        return { x: enemy.x, y: enemy.y };
    }
    const inRangeWithLos = candidates
        .filter(candidate => candidate.hasLos && candidate.reachCostToPlayer <= range)
        .sort((a, b) => {
        const maxRangeDelta = (range - b.reachCostToPlayer) - (range - a.reachCostToPlayer);
        if (maxRangeDelta !== 0) {
            return maxRangeDelta;
        }
        const travelDelta = a.travelCost - b.travelCost;
        if (travelDelta !== 0) {
            return travelDelta;
        }
        return a.reachCostToPlayer - b.reachCostToPlayer;
    });
    if (inRangeWithLos.length > 0) {
        const best = inRangeWithLos[0];
        return { x: best.x, y: best.y };
    }
    const withLosClosestToRange = candidates
        .filter(candidate => candidate.hasLos)
        .sort((a, b) => {
        const rangeDelta = Math.abs(a.reachCostToPlayer - range) - Math.abs(b.reachCostToPlayer - range);
        if (rangeDelta !== 0) {
            return rangeDelta;
        }
        return a.travelCost - b.travelCost;
    });
    if (withLosClosestToRange.length > 0) {
        const best = withLosClosestToRange[0];
        return { x: best.x, y: best.y };
    }
    const closestToPlayer = candidates.sort((a, b) => {
        const reachDelta = a.reachCostToPlayer - b.reachCostToPlayer;
        if (reachDelta !== 0) {
            return reachDelta;
        }
        return a.travelCost - b.travelCost;
    });
    const best = closestToPlayer[0];
    return { x: best.x, y: best.y };
}
function getBestReachableStep(map, player, enemies, enemy, path) {
    const blockedDestinations = enemies.filter(candidate => candidate !== enemy);
    const speed = enemy.stats.velocidad;
    if (path.length <= 1 || speed <= 0) {
        return { x: enemy.x, y: enemy.y };
    }
    let spent = 0;
    let best = { x: enemy.x, y: enemy.y };
    for (let index = 1; index < path.length; index += 1) {
        const from = path[index - 1];
        const to = path[index];
        const stepCost = getMovementCost(from.x, from.y, to.x, to.y);
        if (stepCost === null) {
            break;
        }
        if (spent + stepCost > speed) {
            break;
        }
        spent += stepCost;
        if (isEmptyDestination(map, player, blockedDestinations, to.x, to.y)) {
            best = { x: to.x, y: to.y };
        }
    }
    return best;
}
function compareMonsterTurnOrder(player, a, b) {
    const reachA = getReachCostByMovement(a.x, a.y, player.x, player.y);
    const reachB = getReachCostByMovement(b.x, b.y, player.x, player.y);
    if (reachA !== reachB) {
        return reachA - reachB;
    }
    if (a.y !== b.y) {
        return a.y - b.y;
    }
    return a.x - b.x;
}
function moveSingleMonster(map, player, enemies, movingEnemy) {
    const { distances, previous } = computeShortestPaths(map, player, movingEnemy.x, movingEnemy.y);
    const target = chooseTargetTile(map, player, enemies, movingEnemy, distances);
    const path = buildPathTo(previous, movingEnemy.x, movingEnemy.y, target.x, target.y);
    if (path.length === 0) {
        return movingEnemy;
    }
    const destination = getBestReachableStep(map, player, enemies, movingEnemy, path);
    if (destination.x === movingEnemy.x && destination.y === movingEnemy.y) {
        return movingEnemy;
    }
    return {
        ...movingEnemy,
        x: destination.x,
        y: destination.y
    };
}
export function resolveMonsterMovementPhase(map, player, enemies) {
    const orderedIndices = enemies
        .map((enemy, index) => ({ enemy, index }))
        .sort((a, b) => compareMonsterTurnOrder(player, a.enemy, b.enemy))
        .map(item => item.index);
    const currentEnemies = [...enemies];
    for (const index of orderedIndices) {
        const currentEnemy = currentEnemies[index];
        currentEnemies[index] = moveSingleMonster(map, player, currentEnemies, currentEnemy);
    }
    return currentEnemies;
}
function canMonsterAttackPlayer(map, player, enemy, enemies) {
    const reachCost = getReachCostByMovement(enemy.x, enemy.y, player.x, player.y);
    if (reachCost > enemy.stats.alcance) {
        return false;
    }
    return hasLineOfSight(map, enemies, enemy.x, enemy.y, player.x, player.y);
}
export function resolveMonsterAttackPhase(map, player, enemies, turn) {
    const totalAttack = enemies
        .filter(enemy => canMonsterAttackPlayer(map, player, enemy, enemies))
        .reduce((sum, enemy) => sum + enemy.stats.ataque, 0);
    const defense = Math.max(1, turn.defensaTotal);
    const damage = totalAttack < defense ? 0 : Math.floor(totalAttack / defense);
    return {
        player: {
            ...player,
            vidaActual: Math.max(0, player.vidaActual - damage)
        },
        totalAttack,
        damage
    };
}
