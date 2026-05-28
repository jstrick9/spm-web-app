const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/screens/events/layouts/CanvasPage.tsx';
let code = fs.readFileSync(path, 'utf8');

// Add Sparkles icon
code = code.replace(
  "import { Loader2, Save, Move, Search, History, Check, AlertTriangle, ArrowLeftRight, X } from 'lucide-react';",
  "import { Loader2, Save, Move, Search, History, Check, AlertTriangle, ArrowLeftRight, X, Sparkles } from 'lucide-react';"
);

const aiAlgorithm = `
  const generateAILayout = () => {
    if (!window.confirm('This will replace your current layout with an AI generated suggestion based on your guest count. Proceed?')) {
      return;
    }

    const guestCount = event.guest_count || 100;
    const tableCapacity = 8; // Assuming 60" rounds
    const tablesNeeded = Math.ceil(guestCount / tableCapacity);
    
    // We need to pack them into the venue structural boundaries if they exist,
    // or just a default grid. We'll use a simple grid layout avoiding the center (dance floor).
    
    const newItems: any[] = [];
    const startX = 100;
    const startY = 100;
    const spacingX = 120;
    const spacingY = 120;
    
    let currentX = startX;
    let currentY = startY;
    let tablesPlaced = 0;
    
    // Add Dance Floor in center
    newItems.push({
      id: \`df-\${Date.now()}\`, type: 'dance_floor', x: 400, y: 300, width: 200, height: 200, label: 'Dance Floor', rotation: 0
    });
    
    // Add Head Table
    newItems.push({
      id: \`ht-\${Date.now()}\`, type: 'rect_table', x: 400, y: 100, width: 144, height: 48, label: 'Head Table', rotation: 0
    });

    const danceFloorBounds = { minX: 300, maxX: 500, minY: 200, maxY: 400 };

    while (tablesPlaced < tablesNeeded) {
      // Check if current position intersects dance floor or head table
      const inDanceFloor = currentX > danceFloorBounds.minX && currentX < danceFloorBounds.maxX && currentY > danceFloorBounds.minY && currentY < danceFloorBounds.maxY;
      const inHeadTable = currentY < 150 && currentX > 300 && currentX < 500;
      
      if (!inDanceFloor && !inHeadTable) {
         newItems.push({
           id: \`t\${tablesPlaced}-\${Date.now()}\`,
           type: 'round_table',
           x: currentX,
           y: currentY,
           radius: 30, // 60" round is 30 radius in this scale
           label: \`Table \${tablesPlaced + 1}\`,
           rotation: 0
         });
         
         // Add Chairs around table
         const chairRadius = 30 + 15; // table radius + space
         for(let c=0; c < tableCapacity; c++) {
            const angle = (c / tableCapacity) * Math.PI * 2;
            newItems.push({
               id: \`c\${tablesPlaced}-\${c}-\${Date.now()}\`,
               type: 'chair',
               x: currentX + Math.cos(angle) * chairRadius,
               y: currentY + Math.sin(angle) * chairRadius,
               radius: 9,
               label: '',
               rotation: 0
            });
         }
         tablesPlaced++;
      }
      
      currentX += spacingX;
      if (currentX > 700) {
        currentX = startX;
        currentY += spacingY;
      }
    }

    setItems(newItems);
    setHasChanges(true);
    resetView();
    toast({ title: 'Layout Generated', description: \`Packed \${tablesNeeded} tables for \${guestCount} guests.\`, variant: 'success' });
  };
`;

code = code.replace(
  "const resetView = () => {",
  aiAlgorithm + "\n  const resetView = () => {"
);

const aiButton = `
           <Button variant="secondary" className="bg-purple-100 text-purple-900 border-purple-200 hover:bg-purple-200" size="sm" onClick={generateAILayout}>
             <Sparkles className="w-4 h-4 mr-1 text-purple-600" /> Auto-Suggest Layout
           </Button>
           <Button variant="outline" size="sm" onClick={resetView}>Reset View</Button>
`;

code = code.replace(
  "<Button variant=\"outline\" size=\"sm\" onClick={resetView}>Reset View</Button>",
  aiButton
);

fs.writeFileSync(path, code);
