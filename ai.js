// AI pour les mobs Bouftou
import { findPath, animateEntityPath, player, boss } from './entities.js';
import { isTileValidAndFree } from './grid.js';

/**
 * Planifie l'action du bouftou: chemin de mouvement et attaques.
 * @param {object} bouftou
 * @param {object[]} bouftousList - autres bouftous
 * @returns {{movePath:{x:number,y:number}[], initialAttack:boolean, postMoveAttack:boolean, moveCost:number}}
 */
export function computeBouftouPlan(bouftou, bouftousList = []) {
    const blockers = [player, boss, ...bouftousList].filter(e => e !== bouftou);
    // Attaque initiale si adjacent
    const dist0 = Math.abs(bouftou.gridX - player.gridX) + Math.abs(bouftou.gridY - player.gridY);
    const initialAttack = dist0 === 1 && bouftou.ap > 0;
    if (initialAttack) {
        return { movePath: [], initialAttack: true, postMoveAttack: false, moveCost: 0 };
    }
    // Chemin A* vers le joueur
    const isValid = (x, y) => {
        // Autorise la dernière case correspondant au joueur
        if (x === player.gridX && y === player.gridY) return true;
        return isTileValidAndFree(x, y, bouftou, player, boss, bouftousList);
    };
    const path = findPath(bouftou.gridX, bouftou.gridY, player.gridX, player.gridY, bouftou, isValid, player, boss) || [];
    let movePath = [];
    let moveCost = 0;
    if (path.length > 1) {
        moveCost = Math.min(bouftou.mp, path.length - 2);
        movePath = path.slice(0, moveCost + 1);
    }
    // Attaque après déplacement si adjacent
    let postMoveAttack = false;
    if (moveCost > 0) {
        const end = movePath[movePath.length - 1];
        const dist1 = Math.abs(end.x - player.gridX) + Math.abs(end.y - player.gridY);
        postMoveAttack = dist1 === 1 && bouftou.ap > 0;
    }
    return { movePath, initialAttack, postMoveAttack, moveCost };
}

/**
 * IA de Bouftou : cherche à aller au contact du joueur et attaque au CAC si possible.
 * @param {object} bouftou - L'entité bouftou à jouer
 * @param {function} animateEntityMove - Fonction d'animation de déplacement
 * @param {function} onAttack - Fonction appelée lors d'une attaque (inflige les dégâts)
 * @param {function} onComplete - Callback quand l'IA a fini son tour
 * @param {array} bouftousList - Liste des autres bouftous
 */
export async function bouftouAI(bouftou, animateEntityMove, onAttack, onComplete, bouftousList = []) {
    const plan = computeBouftouPlan(bouftou, bouftousList);
    // Attaque initiale
    if (plan.initialAttack) {
        onAttack(bouftou, player);
        bouftou.ap--;
        if (onComplete) onComplete();
        return;
    }
    // Déplacement
    if (plan.movePath.length > 1) {
        console.log('Bouftou', bouftou.id, 'se déplace de', plan.moveCost, 'cases');
        await new Promise(resolve => animateEntityPath(bouftou, plan.movePath, animateEntityMove, resolve));
        const end = plan.movePath[plan.movePath.length - 1];
        bouftou.gridX = end.x;
        bouftou.gridY = end.y;
        bouftou.mp -= plan.moveCost;
    }
    // Attaque après déplacement
    if (plan.postMoveAttack) {
        onAttack(bouftou, player);
        bouftou.ap--;
    }
    if (onComplete) onComplete();
}
