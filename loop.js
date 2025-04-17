import { drawBackground, drawGrid, drawEntity, drawProjectiles, drawDamageAnimations, drawTile, drawEndGameOverlay } from './draw.js';
import { player, boss } from './entities.js';
import { projectiles, damageAnimations, gameOver, gameTick, isMoving, isBossActing, playerState, reachableTiles, attackableTiles, bouftousState } from './game.js';
import { SPELLS, getSelectedSpellIndex } from './spells.js';
import { mapGrid, TILE_W, TILE_H, GRID_COLS, GRID_ROWS, isoToScreen } from './grid.js';
import { currentTurn, hoveredTile } from './game.js';
import { hasLineOfSight } from './grid.js';

// Image loading (mimic game_legacy.js)
const tileImage = new window.Image();
tileImage.src = 'sol.png';
let tileImageLoaded = false;
tileImage.onload = () => { tileImageLoaded = true; };
const bossImage = new window.Image();
let bossImageLoaded = false;
bossImage.src = 'br.png';
bossImage.onload = () => { bossImageLoaded = true; };
const playerImage = new window.Image();
let playerImageLoaded = false;
playerImage.src = 'iop.png';
playerImage.onload = () => { playerImageLoaded = true; };

// Chargement des images d'obstacles
window.arbreImage = new window.Image();
window.arbreImage.src = 'arbre.png';
window.caisseImage = new window.Image();
window.caisseImage.src = 'caisse.png';

// Chargement de l'image des Bouftous
window.bouftouImage = new window.Image();
window.bouftouImage.src = 'bouftou.png'; // chemin sans './' pour cohérence
window.bouftouImage.onload = () => { window.bouftouImage.loaded = true; };

export function startGameLoop() {
    function gameLoop() {
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        drawBackground(ctx, canvas);
        // Prépare liste d'entités à dessiner (skip boss si mort)
        const entitiesToDraw = [
            { entity: player, color: '#3498db', args: [TILE_W, TILE_H, bossImage, bossImageLoaded, playerImage, playerImageLoaded, currentTurn] },
            ...(boss.hp > 0 ? [{ entity: boss, color: '#c0392b', args: [TILE_W, TILE_H, bossImage, bossImageLoaded, playerImage, playerImageLoaded, currentTurn] }] : []),
            ...bouftousState.map(b => ({ entity: b, color: '#bada55', args: [TILE_W, TILE_H, null, false, null, false, null] }))
        ];
        drawGrid(
            ctx,
            mapGrid,
            playerState,
            reachableTiles,
            attackableTiles,
            hoveredTile,
            SPELLS,
            getSelectedSpellIndex(),
            TILE_W,
            TILE_H,
            GRID_COLS,
            GRID_ROWS,
            hasLineOfSight,
            player,
            null, // getTilesInRangeBFS (not used in drawGrid)
            drawTile,
            tileImage,
            tileImageLoaded,
            entitiesToDraw
        );
        drawProjectiles(ctx, projectiles, SPELLS);
        drawDamageAnimations(ctx, damageAnimations);
        drawEndGameOverlay(ctx, canvas, gameOver, player);
        gameTick();
        requestAnimationFrame(gameLoop);
    }
    gameLoop();
}