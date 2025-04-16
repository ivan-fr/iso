import { drawBackground, drawGrid, drawEntity, drawProjectiles, drawDamageAnimations, drawTile, drawHighlightTiles, drawEndGameOverlay, drawEntitiesSorted } from './draw.js';
import { player, boss } from './entities.js';
import { projectiles, damageAnimations, gameOver, gameTick, isMoving, isBossActing, playerState, reachableTiles, attackableTiles } from './game.js';
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

export function startGameLoop() {
    function gameLoop() {
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        drawBackground(ctx, canvas);
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
            tileImageLoaded
        );
        drawHighlightTiles(
            ctx,
            currentTurn,
            isMoving,
            isBossActing,
            gameOver,
            playerState,
            reachableTiles,
            attackableTiles,
            player,
            TILE_W,
            TILE_H,
            isoToScreen
        );
        // Draw entities sorted by Y for correct overlap
        drawEntitiesSorted(ctx, [
            { entity: player, color: '#3498db', args: [TILE_W, TILE_H, bossImage, bossImageLoaded, playerImage, playerImageLoaded, currentTurn] },
            { entity: boss, color: '#c0392b', args: [TILE_W, TILE_H, bossImage, bossImageLoaded, playerImage, playerImageLoaded, currentTurn] }
        ], drawEntity);
        drawProjectiles(ctx, projectiles, SPELLS);
        drawDamageAnimations(ctx, damageAnimations);
        drawEndGameOverlay(ctx, canvas, gameOver, player);
        gameTick();
        requestAnimationFrame(gameLoop);
    }
    gameLoop();
}