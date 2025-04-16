// Point d'entrée principal, initialisation, boucle de jeu, import des modules

import { initGame } from './game.js';
import { startGameLoop } from './loop.js';

// Boucle de jeu, initialisation, gestion des événements, orchestration à migrer ici depuis game.js

window.addEventListener('DOMContentLoaded', () => {
    initGame();
    startGameLoop();
});