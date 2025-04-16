import { player, boss } from './entities.js';
import { SPELLS } from './spells.js';
import { mapGrid, TILE_W, TILE_H, GRID_COLS, GRID_ROWS, MAP_OFFSET_X, MAP_OFFSET_Y, MAX_MOVE_POINTS, MAX_ACTION_POINTS, PLAYER_MAX_HP, BOSS_MAX_HP, PLAYER_ATTACK_RANGE, BOSS_ATTACK_RANGE, BOSS_ATTACK_RANGE_SQ, PROJECTILE_SPEED } from './grid.js';
import { showMessage, updateUI } from './ui.js';

// Variables d'état globales
export let currentTurn = 'player';
export let playerState = 'idle';
export let reachableTiles = [];
export let attackableTiles = [];
export let isMoving = false;
export let isBossActing = false;
export let gameOver = false;
export let projectiles = [];
export let hoveredTile = null;
export let damageAnimations = [];

export function initGame() {
    // Initialisation des positions animées
    // ...initialisation des images, listeners, etc. à compléter selon besoin...
    // Sélection des éléments DOM requis pour updateUI
    const turnIndicator = document.getElementById('turn-indicator');
    const playerApDisplay = document.getElementById('player-ap');
    const playerMpDisplay = document.getElementById('player-mp');
    const bossApDisplay = document.getElementById('boss-ap');
    const bossMpDisplay = document.getElementById('boss-mp');
    const playerHealthBar = document.getElementById('player-health-bar');
    const bossHealthBar = document.getElementById('boss-health-bar');
    const endTurnButton = document.getElementById('endTurnButton');
    updateUI(
        turnIndicator,
        playerApDisplay,
        playerMpDisplay,
        bossApDisplay,
        bossMpDisplay,
        player,
        boss,
        playerHealthBar,
        bossHealthBar,
        currentTurn,
        isMoving,
        isBossActing,
        playerState,
        endTurnButton,
        gameOver
    );
    showMessage('Bienvenue ! Combattez le boss.', 3000);
}
