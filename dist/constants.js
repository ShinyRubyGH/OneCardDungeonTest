export const PLAYER_CLASS_OPTIONS = [
    {
        id: 'paladin',
        nombre: 'Paladin',
        titulo: 'Paladin',
        descripcion: 'Una vez por nivel conserva 1 dado de energia del turno anterior.'
    },
    {
        id: 'barbaro',
        nombre: 'Barbaro',
        titulo: 'Barbaro',
        descripcion: 'Una vez por turno, con 1 de vida, puede volver a tirar los dados de energia.'
    },
    {
        id: 'arquera',
        nombre: 'Arquera',
        titulo: 'Arquera',
        descripcion: 'Una vez por nivel puede asignar un dado a Alcance en lugar de Velocidad.'
    },
    {
        id: 'maga',
        nombre: 'Maga',
        titulo: 'Maga',
        descripcion: 'Una vez por nivel puede volver a tirar todos los dados de energia.'
    }
];
export function getPlayerClassOption(id) {
    const option = PLAYER_CLASS_OPTIONS.find(candidate => candidate.id === id);
    if (!option) {
        throw new Error(`Clase de personaje desconocida: ${id}`);
    }
    return option;
}
