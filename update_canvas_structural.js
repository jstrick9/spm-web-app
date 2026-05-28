const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/screens/events/layouts/CanvasPage.tsx';
let code = fs.readFileSync(path, 'utf8');

// I need to update the CanvasPage so it pulls the doors, windows, and pillars from the Venue Guideline and renders them on the background layer.
const extractionLogic = `
  const structuralData = React.useMemo(() => {
     if (!catalogData?.guidelines?.spec) return { lines: [], doors: [], windows: [], pillars: [] };
     try {
       const spec = typeof catalogData.guidelines.spec === 'string' ? JSON.parse(catalogData.guidelines.spec) : catalogData.guidelines.spec;
       return {
         lines: spec.lines || [],
         doors: spec.doors || [],
         windows: spec.windows || [],
         pillars: spec.pillars || []
       };
     } catch { return { lines: [], doors: [], windows: [], pillars: [] }; }
  }, [catalogData?.guidelines]);
`;

code = code.replace(/const structuralLines = React\.useMemo\(\(\) => \{[\s\S]*?\}, \[catalogData\?\.guidelines\]\);/, extractionLogic);

const renderLogic = `
        <Layer>
          {/* Structural Boundaries */}
          <Group listening={false}>
            {structuralData.lines.map((line: any, i: number) => (
              <Line
                key={line.id || i}
                points={line.points}
                stroke="#374151"
                strokeWidth={4}
                closed={true}
                fill="#f3f4f6"
                opacity={0.4}
                lineCap="round"
                lineJoin="round"
              />
            ))}
            
            {structuralData.doors.map((door: any) => (
              <Group key={door.id} x={door.x} y={door.y} rotation={door.rotation} opacity={0.6}>
                <Line points={[0, 0, door.width, 0]} stroke="#374151" strokeWidth={3} />
                <Arc x={0} y={0} innerRadius={door.width} outerRadius={door.width} angle={90} rotation={0} stroke="#9ca3af" strokeWidth={1} dash={[4, 4]} />
                <Line points={[0, 0, 0, door.width]} stroke="#374151" strokeWidth={2} />
              </Group>
            ))}
            
            {structuralData.windows.map((win: any) => (
              <Rect 
                key={win.id} x={win.x} y={win.y} width={win.width} height={6} rotation={win.rotation} offsetX={win.width/2} offsetY={3}
                fill="#bae6fd" stroke="#3b82f6" strokeWidth={2} opacity={0.6}
              />
            ))}
            
            {structuralData.pillars.map((pil: any) => (
              <Circle 
                key={pil.id} x={pil.x} y={pil.y} radius={pil.radius} 
                fill="#9ca3af" stroke="#4b5563" strokeWidth={2} opacity={0.6}
              />
            ))}
          </Group>
`;

code = code.replace(/<Layer>[\s\S]*?<Group listening=\{false\}>[\s\S]*?<\/Group>/m, renderLogic);

// Make sure Arc is imported
code = code.replace(
  "import { Stage, Layer, Rect, Circle, Text, Group, Transformer, Line } from 'react-konva';",
  "import { Stage, Layer, Rect, Circle, Text, Group, Transformer, Line, Arc } from 'react-konva';"
);

fs.writeFileSync(path, code);
