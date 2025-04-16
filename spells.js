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

// Gestion des sorts, logique d'attaque, sélection

const spells = {
    fireball: {
        name: "Fireball",
        damage: 50,
        manaCost: 30,
        description: "Lance une boule de feu infligeant des dégâts importants."
    },
    iceSpike: {
        name: "Ice Spike",
        damage: 30,
        manaCost: 20,
        description: "Projette un pic de glace qui ralentit l'ennemi."
    },
    heal: {
        name: "Heal",
        damage: 0,
        manaCost: 25,
        description: "Restaure une partie des points de vie."
    }
};

function castSpell(spellName, caster, target) {
    const spell = spells[spellName];
    if (!spell) {
        console.error("Sort inconnu:", spellName);
        return;
    }

    if (caster.mana < spell.manaCost) {
        console.error("Mana insuffisant pour lancer le sort:", spellName);
        return;
    }

    caster.mana -= spell.manaCost;

    if (spell.damage > 0) {
        target.health -= spell.damage;
        console.log(`${caster.name} inflige ${spell.damage} points de dégâts à ${target.name} avec ${spell.name}.`);
    } else {
        caster.health += spell.damage; // spell.damage is 0 for heal
        console.log(`${caster.name} utilise ${spell.name} et restaure des points de vie.`);
    }
}

export { spells, castSpell };