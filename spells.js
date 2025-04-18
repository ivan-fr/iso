// --- Sorts ---
/**
 * List of available spells.
 * @type {ReadonlyArray<{name: string, key: string, color: string, damage: () => number, range: number, aoe: boolean, push: boolean}>}
 */
export const SPELLS = Object.freeze([
    {
        name: 'Mono-cible',
        key: '1',
        color: '#f1c40f',
        damage: () => 22 + Math.floor(Math.random() * 7), // 22-28
        range: 7,
        aoe: false,
        push: false
    },
    {
        name: 'Zone croix',
        key: '2',
        color: '#e67e22',
        damage: () => 10 + Math.floor(Math.random() * 6), // 10-15
        range: 7,
        aoe: true,
        push: false
    },
    {
        name: 'Poussée',
        key: '3',
        color: '#00b894',
        damage: () => 8 + Math.floor(Math.random() * 5), // 8-12
        range: 7,
        aoe: false,
        push: true
    },
    // Sort de corps à corps du boss
    {
        name: 'Coup de Masse (CAC)',
        key: null,
        color: '#c0392b',
        damage: () => 30 + Math.floor(Math.random() * 7), // 30-36
        range: 1,
        aoe: false,
        push: false,
        bossOnly: true
    },
    // Sort à distance du boss
    {
        name: 'Boule de Feu',
        key: null,
        color: '#ff5733',
        damage: () => 13 + Math.floor(Math.random() * 5), // 13-17
        range: 5,
        aoe: false,
        push: false,
        bossOnly: true
    },
    // Sorts Boufton noir
    {
        name: 'Boulance noire',
        key: null,
        color: '#222',
        damage: () => 6 + Math.floor(Math.random() * 3), // 6-8
        range: 3,
        aoe: false,
        push: false,
        bouftonNoirOnly: true,
        cost: 2
    },
    {
        name: 'Retrait PM',
        key: null,
        color: '#0099ff',
        damage: () => 0,
        range: 4,
        aoe: false,
        push: false,
        bouftonNoirOnly: true,
        special: 'remove_mp',
        cost: 1
    },
    // Sorts Chef de guerre
    {
        name: 'Coup de corne',
        key: null,
        color: '#ffb347',
        damage: () => 20 + Math.floor(Math.random() * 6), // 20-25
        range: 1,
        aoe: false,
        push: false,
        chefOnly: true,
        cost: 2
    },
    {
        name: 'Soutien PM',
        key: null,
        color: '#2ecc40',
        damage: () => 0,
        range: 4,
        aoe: false,
        push: false,
        chefOnly: true,
        special: 'give_mp',
        cost: 1
    }
]);

// Internal state for selected spell
let _selectedSpell = 0;

/**
 * Set the selected spell index.
 * @param {number} index
 */
export function setSelectedSpell(index) {
    if (index >= 0 && index < SPELLS.length) {
        _selectedSpell = index;
    }
}

/**
 * Get the current selected spell index.
 * @returns {number}
 */
export function getSelectedSpellIndex() {
    return _selectedSpell;
}

/**
 * Get the currently selected spell object.
 * @returns {object}
 */
export function getSelectedSpell() {
    return SPELLS[_selectedSpell];
}