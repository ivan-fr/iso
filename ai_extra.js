// IA pour Boufton noir et Chef de guerre Bouftou
import { findPath, animateEntityPath, player, boss } from './entities.js';
import { isTileValidAndFree, getTilesInRangeBFS, hasLineOfSight } from './grid.js';
import { SPELLS } from './spells.js';

// Boufton noir : attaque distance + sort spécial -2PM
export async function bouftonNoirAI(entity, animateEntityMove, onAttack, onSpecial, onComplete, enemiesList = []) {
    console.log('[BouftonNoirAI] Début IA pour', entity);
    // 1. Si à portée d'attaque spéciale (4 cases), l'utiliser (1/tour)
    if (entity.ap >= 1) {
        const dist = Math.abs(entity.gridX - player.gridX) + Math.abs(entity.gridY - player.gridY);
        console.log('[BouftonNoirAI] Test spécial : dist=', dist, 'ap=', entity.ap, '_specialUsed=', entity._specialUsed);
        if (dist <= 4 && entity._specialUsed !== true) {
            await onSpecial(entity, player);
            entity._specialUsed = true;
            console.log('[BouftonNoirAI] Spécial utilisé');
        }
    }
    // 2. Attaque à distance si possible
    while (entity.ap >= 2) {
        const dist = Math.abs(entity.gridX - player.gridX) + Math.abs(entity.gridY - player.gridY);
        const los = hasLineOfSight(entity.gridX, entity.gridY, player.gridX, player.gridY, player, boss, ...enemiesList);
        console.log('[BouftonNoirAI] Test attaque distance : dist=', dist, 'ap=', entity.ap, 'LoS=', los);
        if (dist <= 3 && los) {
            await onAttack(entity, player);
            entity.ap -= 2;
            console.log('[BouftonNoirAI] Attaque distance effectuée');
        } else {
            break;
        }
    }
    // 3. Déplacement vers le joueur sinon
    if (entity.mp > 0) {
        // Corrigé : la case du joueur est considérée comme accessible pour le pathfinding
        const isValid = (x, y) => {
            if (x === player.gridX && y === player.gridY) return true;
            return isTileValidAndFree(x, y, entity, player, boss, enemiesList);
        };
        const path = findPath(entity.gridX, entity.gridY, player.gridX, player.gridY, entity, isValid, player, boss) || [];
        console.log('[BouftonNoirAI] Plan déplacement :', path);
        let moveCost = Math.min(entity.mp, path.length - 1);
        if (moveCost > 0) {
            const movePath = path.slice(0, moveCost + 1);
            console.log('[BouftonNoirAI] Bouge vers', movePath);
            await new Promise(resolve => animateEntityPath(entity, movePath, animateEntityMove, resolve));
            const end = movePath[movePath.length - 1];
            entity.gridX = end.x;
            entity.gridY = end.y;
            entity.mp -= moveCost;
        } else {
            console.log('[BouftonNoirAI] Aucun déplacement possible');
        }
    }
    entity._specialUsed = false; // reset pour le prochain tour
    if (onComplete) onComplete();
}


// Chef de guerre Bouftou : attaque puissante + sort soutien
export async function chefAI(entity, animateEntityMove, onAttack, onSupport, onComplete, enemiesList = []) {
    // 1. Sort de soutien (1/tour) : donne +2PM à un allié à portée 4
    if (entity.ap >= 1 && entity._supportUsed !== true) {
        const allies = enemiesList.filter(e => e !== entity && e.hp > 0 && Math.abs(entity.gridX - e.gridX) + Math.abs(entity.gridY - e.gridY) <= 4);
        if (allies.length > 0) {
            await onSupport(entity, allies[0]); // Donne à un allié (le premier trouvé)
            entity._supportUsed = true;
        }
    }
    // 2. Attaque mêlée puissante (2PA)
    while (entity.ap >= 2 && Math.abs(entity.gridX - player.gridX) + Math.abs(entity.gridY - player.gridY) === 1) {
        await onAttack(entity, player);
        entity.ap -= 2;
    }
    // 3. Déplacement vers le joueur sinon
    if (entity.mp > 0) {
        const isValid = (x, y) => isTileValidAndFree(x, y, entity, player, boss, enemiesList);
        const path = findPath(entity.gridX, entity.gridY, player.gridX, player.gridY, entity, isValid, player, boss) || [];
        let moveCost = Math.min(entity.mp, path.length - 1);
        if (moveCost > 0) {
            const movePath = path.slice(0, moveCost + 1);
            await new Promise(resolve => animateEntityPath(entity, movePath, animateEntityMove, resolve));
            const end = movePath[movePath.length - 1];
            entity.gridX = end.x;
            entity.gridY = end.y;
            entity.mp -= moveCost;
        }
    }
    entity._supportUsed = false; // reset pour le prochain tour
    if (onComplete) onComplete();
}
