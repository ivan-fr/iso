// Définitions des types d'ennemis spéciaux
export const ENEMY_TYPES = {
  bouftou: {
    name: 'Bouftou',
    image: 'bouftou.png',
    hp: 40,
    maxHp: 40,
    mp: 4,
    ap: 1,
    aiType: 'bouftou',
    size: 26,
  },
  boufton_noir: {
    name: 'Boufton noir',
    image: 'boufton_noir.png',
    hp: 32,
    maxHp: 32,
    mp: 6,
    ap: 2,
    aiType: 'boufton_noir',
    size: 26,
  },
  chef: {
    name: 'Chef de guerre Bouftou',
    image: 'chef.png',
    hp: 65,
    maxHp: 65,
    mp: 4,
    ap: 2,
    aiType: 'chef',
    size: 28,
  },
  boss: {
    name: 'Boss',
    image: 'br.png',
    hp: 150,
    maxHp: 150,
    mp: 6,
    ap: 2,
    aiType: 'boss',
    size: 36,
  }
};
