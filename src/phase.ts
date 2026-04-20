import type { EnergyStatKey, Player, TurnPhase, TurnResources } from './types.js';

export function getInitialTurnResources(player: Player): TurnResources {
  return {
    energyDice: [],
    assignedEnergy: {
      velocidad: null,
      ataque: null,
      defensa: null,
      alcance: null
    },
    selectedDieIndex: null,
    velocidadDisponible: 0,
    ataqueDisponible: 0,
    defensaTotal: player.stats.defensa,
    alcanceTotal: player.stats.alcance
  };
}

export function rollEnergyDice(): number[] {
  return [
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1
  ];
}

export function setRolledDice(player: Player, dice: number[]): TurnResources {
  return {
    energyDice: dice,
    assignedEnergy: {
      velocidad: null,
      ataque: null,
      defensa: null,
      alcance: null
    },
    selectedDieIndex: null,
    velocidadDisponible: 0,
    ataqueDisponible: 0,
    defensaTotal: player.stats.defensa,
    alcanceTotal: player.stats.alcance
  };
}

export function selectEnergyDie(
  turn: TurnResources,
  dieIndex: number
): TurnResources {
  if (dieIndex < 0 || dieIndex >= turn.energyDice.length) {
    return turn;
  }

  return {
    ...turn,
    selectedDieIndex: dieIndex
  };
}

export function assignSelectedDieToStat(
  player: Player,
  turn: TurnResources,
  stat: EnergyStatKey
): TurnResources {
  if (turn.selectedDieIndex === null) {
    return turn;
  }

  if (turn.assignedEnergy[stat] !== null) {
    return turn;
  }

  const dieValue = turn.energyDice[turn.selectedDieIndex];
  const remainingDice = turn.energyDice.filter((_, index) => index !== turn.selectedDieIndex);

  const assignedEnergy = {
    ...turn.assignedEnergy,
    [stat]: dieValue
  };

  const velocidadBonus = assignedEnergy.velocidad ?? 0;
  const ataqueBonus = assignedEnergy.ataque ?? 0;
  const defensaBonus = assignedEnergy.defensa ?? 0;
  const alcanceBonus = assignedEnergy.alcance ?? 0;

  return {
    energyDice: remainingDice,
    assignedEnergy,
    selectedDieIndex: null,
    velocidadDisponible: player.stats.velocidad + velocidadBonus,
    ataqueDisponible: player.stats.dano + ataqueBonus,
    defensaTotal: player.stats.defensa + defensaBonus,
    alcanceTotal: player.stats.alcance + alcanceBonus
  };
}

export function isEnergyAssignmentComplete(turn: TurnResources): boolean {
  return (
    (turn.assignedEnergy.velocidad !== null || turn.assignedEnergy.alcance !== null) &&
    turn.assignedEnergy.ataque !== null &&
    turn.assignedEnergy.defensa !== null
  );
}

export function getNextPhase(currentPhase: TurnPhase): TurnPhase {
  switch (currentPhase) {
    case 'energy':
      return 'adventurer';
    case 'adventurer':
      return 'monster-move';
    case 'monster-move':
      return 'monster-attack';
    case 'monster-attack':
      return 'energy';
    case 'level-complete':
      return 'energy';
    case 'game-over':
      return 'game-over';
    default:
      return 'energy';
  }
}

export function getPhaseLabel(phase: TurnPhase): string {
  switch (phase) {
    case 'energy':
      return 'Fase de Energía';
    case 'adventurer':
      return 'Fase de Aventurero';
    case 'monster-move':
      return 'Fase de Movimiento de Monstruos';
    case 'monster-attack':
      return 'Fase de Ataque de Monstruos';
    case 'level-complete':
      return 'Fin de Nivel';
    case 'game-over':
      return 'Fin del Juego';
    default:
      return 'Fase desconocida';
  }
}

export function getPhaseDescription(phase: TurnPhase): string {
  switch (phase) {
    case 'energy':
      return 'Tira 3 dados y asigna uno a velocidad, uno a ataque y uno a defensa.';
    case 'adventurer':
      return 'El aventurero puede moverse y atacar gastando sus recursos del turno.';
    case 'monster-move':
      return 'Los monstruos se mueven uno por uno intentando quedar en alcance y línea de visión.';
    case 'monster-attack':
      return 'Los monstruos en alcance y línea de visión atacan al aventurero.';
    case 'level-complete':
      return 'Todos los monstruos han sido derrotados. Elige tu mejora de nivel.';
    case 'game-over':
      return 'El aventurero ha caído en la mazmorra.';
    default:
      return '';
  }
}