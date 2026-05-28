const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/screens/events/layouts/CanvasPage.tsx';
let code = fs.readFileSync(path, 'utf8');

const replacement = `
        <Stage 
          width={dimensions.width} 
          height={dimensions.height}
          onWheel={handleWheel}
          scaleX={scale}
          scaleY={scale}
          x={pos.x}
          y={pos.y}
          draggable
          onDragMove={(e) => {
             if (e.target === e.target.getStage()) {
                setPos({ x: e.target.x(), y: e.target.y() });
             }
          }}
        >
        <Layer>
`;

code = code.replace(/<Stage[\s\S]*?<Layer>/m, replacement);

fs.writeFileSync(path, code);
