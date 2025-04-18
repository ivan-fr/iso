// Définition des salles, maps, ennemis
export const ROOMS = [
  // Salle 1
  {
    name: 'Salle 1',
    gridCols: 16,
    gridRows: 16,
    obstacles: [
      // exemple : {x:7, y:7}, {x:8, y:8}
    ],
    enemies: [
      { type: 'bouftou', gridX: 4, gridY: 11 },
      { type: 'bouftou', gridX: 11, gridY: 4 },
      { type: 'boufton_noir', gridX: 5, gridY: 5 },
      { type: 'boufton_noir', gridX: 11, gridY: 11 }
    ]
  },
  // Salle 2
  {
    name: 'Salle 2',
    gridCols: 18,
    gridRows: 15,
    obstacles: [
      {x: 6, y: 7}, {x: 7, y: 7}, {x: 8, y: 7}, {x: 9, y: 7},
      {x: 12, y: 3}, {x: 12, y: 4}, {x: 12, y: 5}
    ],
    enemies: [
      { type: 'bouftou', gridX: 4, gridY: 12 },
      { type: 'bouftou', gridX: 13, gridY: 3 },
      { type: 'boufton_noir', gridX: 7, gridY: 9 },
      { type: 'chef', gridX: 14, gridY: 7 }
    ]
  },
  // Salle 3
  {
    name: 'Salle 3',
    gridCols: 20,
    gridRows: 16,
    obstacles: [
      {x: 10, y: 8}, {x: 10, y: 9}, {x: 11, y: 8}, {x: 11, y: 9}
    ],
    enemies: [
      { type: 'bouftou', gridX: 5, gridY: 13 },
      { type: 'boufton_noir', gridX: 7, gridY: 7 },
      { type: 'chef', gridX: 15, gridY: 5 },
      { type: 'boss', gridX: 18, gridY: 14 }
    ]
  }
];
