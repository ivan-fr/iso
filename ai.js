// AI pour les mobs Bouftou
import { findPath, animateEntityPath, player, boss } from './entities.js';
import { isTileValidAndFree } from './grid.js';

/**
 * IA de Bouftou : cherche à aller au contact du joueur et attaque au CAC si possible.
 * @param {object} bouftou - L'entité bouftou à jouer
 * @param {function} animateEntityMove - Fonction d'animation de déplacement
 * @param {function} onAttack - Fonction appelée lors d'une attaque (inflige les dégâts)
 * @param {function} onComplete - Callback quand l'IA a fini son tour
 * @param {array} bouftousList - Liste des autres bouftous
 */
export async function bouftouAI(bouftou, animateEntityMove, onAttack, onComplete, bouftousList = []) {
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
    // Custom tile validity for Bouftou: block obstacles and other bouftous
    function bouftouTileValid(x, y) {
        if (x === player.gridX && y === player.gridY) return true;
        return isTileValidAndFree(x, y, bouftou, player, boss, bouftousList);
    }
    // Sinon, déplacement intelligent vers le joueur
    let path = findPath(bouftou.gridX, bouftou.gridY, player.gridX, player.gridY, bouftou, bouftouTileValid, player, boss);
    console.log('Bouftou', bouftou.id, 'path:', path);
    if (path && path.length > 1) {
        // On ne va pas sur la case du joueur, on s'arrête à côté
        let maxMove = Math.min(bouftou.mp, path.length - 2);
        console.log('Bouftou', bouftou.id, 'va tenter de se déplacer de', maxMove, 'cases');
        if (maxMove > 0) {
            // Animation étape par étape comme pour les autres entités
            const subPath = path.slice(0, maxMove + 1);
            await new Promise(resolve => animateEntityPath(bouftou, subPath, animateEntityMove, resolve));
            bouftou.gridX = subPath[subPath.length - 1].x;
            bouftou.gridY = subPath[subPath.length - 1].y;
            bouftou.mp -= maxMove;
        }
    } else {
        console.log('Bouftou', bouftou.id, 'aucun chemin trouvé ou déjà à côté du joueur');
    }
    // Vérifie à nouveau si on peut attaquer après déplacement
    dist = Math.abs(bouftou.gridX - player.gridX) + Math.abs(bouftou.gridY - player.gridY);
    if (dist === 1 && bouftou.ap > 0) {
        onAttack(bouftou, player);
        bouftou.ap--;
    }
    if (onComplete) onComplete();
}
