// --- Sorts ---
export const SPELLS = [
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
    }
];

export let selectedSpell = 0;
export function setSelectedSpell(index) {
    selectedSpell = index;
}

// Utility to get current spell
export function getSelectedSpell() {
    return SPELLS[selectedSpell];
}