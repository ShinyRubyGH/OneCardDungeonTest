export type TileType = 'floor' | 'wall' | 'stairs';
export type CardSide = 'A' | 'B';
export type EnemyName = 'Araña' | 'Esqueleto' | 'Ogro' | 'Demonio';
export type PlayerStatKey = 'vida' | 'velocidad' | 'dano' | 'defensa' | 'alcance';
export type EnergyStatKey = 'velocidad' | 'ataque' | 'defensa';

export type TurnPhase =
  | 'energy'
  | 'adventurer'
  | 'monster-move'
  | 'monster-attack'
  | 'level-complete'
  | 'game-over';

export interface Tile {
  x: number;
  y: number;
  code: number;
  nivel: number | null;
  spawnNivel: number | null;
  type: TileType;
  bloqueaMovimiento: boolean;
  bloqueaVision: boolean;
  esInicio: boolean;
}

export interface DungeonMap {
  width: number;
  height: number;
  tiles: Tile[][];
  level: number;
  phase: number;
  side: CardSide;
  inverted: boolean;
}

export interface EnemyStats {
  vida: number;
  velocidad: number;
  ataque: number;
  defensa: number;
  alcance: number;
  nivelesAparicion: number[];
}

export interface EnemyDefinition {
  id: string;
  nombre: EnemyName;
  stats: EnemyStats;
}

export interface SpawnedEnemy extends EnemyDefinition {
  x: number;
  y: number;
  nivelOrigen: number;
  vidaActual: number;
}

export interface PlayerStats {
  vida: number;
  velocidad: number;
  dano: number;
  defensa: number;
  alcance: number;
}

export interface PlayerUpgrades {
  vida: number;
  velocidad: number;
  dano: number;
  defensa: number;
  alcance: number;
}

export interface Player {
  nombre: string;
  x: number;
  y: number;
  vidaActual: number;
  stats: PlayerStats;
  mejorasDisponibles: number;
  mejorasAplicadas: PlayerUpgrades;
  nivelesCompletados: number;
}

export interface TurnResources {
  energyDice: number[];
  assignedEnergy: {
    velocidad: number | null;
    ataque: number | null;
    defensa: number | null;
  };
  selectedDieIndex: number | null;
  velocidadDisponible: number;
  ataqueDisponible: number;
  defensaTotal: number;
  alcanceTotal: number;
}