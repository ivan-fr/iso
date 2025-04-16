// AI pour les mobs Bouftou
import { findPath } from './entities.js';
import { player } from './entities.js';
import { isTileValidAndFree, GRID_COLS, GRID_ROWS } from './grid.js';

/**
 * IA de Bouftou : cherche à aller au contact du joueur et attaque au CAC si possible.
 * @param {object} bouftou - L'entité bouftou à jouer
 * @param {function} animateEntityMove - Fonction d'animation de déplacement
 * @param {function} onAttack - Fonction appelée lors d'une attaque (inflige les dégâts)
 * @param {function} onComplete - Callback quand l'IA a fini son tour
 */
export async function bouftouAI(bouftou, animateEntityMove, onAttack, onComplete) {
    // 1. Cherche à se rapprocher du joueur
    let dist = Math.abs(bouftou.gridX - player.gridX) + Math.abs(bouftou.gridY - player.gridY);
    let canAttack = dist === 1 && bouftou.ap > 0;
    if (canAttack) {
        // Attaque CAC
        onAttack(bouftou, player);
        bouftou.ap--;
        if (onComplete) onComplete();
        return;
    }
    // Sinon, déplacement intelligent vers le joueur
    let path = findPath(bouftou.gridX, bouftou.gridY, player.gridX, player.gridY, bouftou, isTileValidAndFree, player, null);
    if (path && path.length > 1) {
        // On ne va pas sur la case du joueur, on s'arrête à côté
        let maxMove = Math.min(bouftou.mp, path.length - 2);
        if (maxMove > 0) {
            let nextStep = path[maxMove];
            await new Promise(resolve => animateEntityMove(bouftou, nextStep.x, nextStep.y, maxMove, resolve));
            bouftou.gridX = nextStep.x;
            bouftou.gridY = nextStep.y;
            bouftou.mp -= maxMove;
        }
    }
    // Vérifie à nouveau si on peut attaquer après déplacement
    dist = Math.abs(bouftou.gridX - player.gridX) + Math.abs(bouftou.gridY - player.gridY);
    if (dist === 1 && bouftou.ap > 0) {
        onAttack(bouftou, player);
        bouftou.ap--;
    }
    if (onComplete) onComplete();
}
