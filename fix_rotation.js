const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/screens/events/layouts/CanvasPage.tsx';
let code = fs.readFileSync(path, 'utf8');

// I will add a mechanism for selecting items. When an item is selected we render a Transformer.
code = code.replace(
  "import { Stage, Layer, Rect, Circle, Text, Group } from 'react-konva';",
  "import { Stage, Layer, Rect, Circle, Text, Group, Transformer } from 'react-konva';"
);

code = code.replace(
  "const [hasChanges, setHasChanges] = useState(false);",
  "const [hasChanges, setHasChanges] = useState(false);\n  const [selectedId, setSelectedId] = useState<string | null>(null);\n  const trRef = useRef<any>(null);"
);

// We need to attach the Transformer logic
const transformerCode = `
        <Layer>
          {selectedId && (
            <Transformer
              ref={trRef}
              boundBoxFunc={(oldBox, newBox) => {
                // limit resize
                if (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5) {
                  return oldBox;
                }
                return newBox;
              }}
              enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
              rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
            />
          )}
        </Layer>
      </Stage>
`;

code = code.replace(/<\/Layer>\s*<\/Stage>/, "</Layer>" + transformerCode);

// I need to add onTransformEnd to nodes and onClick to set selectedId
const rectTableCode = `
            if (item.type === 'rect_table') {
               return (
                <Group 
                  key={item.id} 
                  id={item.id}
                  x={item.x} 
                  y={item.y} 
                  rotation={item.rotation} 
                  draggable 
                  onDragEnd={(e) => handleDragEnd(e, item.id)}
                  onClick={() => setSelectedId(item.id)}
                  onTransformEnd={(e) => {
                    const node = e.target;
                    setItems((prev) => 
                      prev.map(i => i.id === item.id ? { 
                        ...i, 
                        x: node.x(), 
                        y: node.y(), 
                        rotation: node.rotation(),
                        scaleX: node.scaleX(),
                        scaleY: node.scaleY()
                      } : i)
                    );
                    setHasChanges(true);
                  }}
                >
                   <Rect width={item.width} height={item.height} offsetX={(item.width||0)/2} offsetY={(item.height||0)/2} fill="#f3f4f6" stroke="#9ca3af" strokeWidth={2} cornerRadius={4} />
                   <Text text={item.label} fontSize={14} fill="#374151" align="center" verticalAlign="middle" offsetX={(item.width||0)/2} offsetY={7} width={item.width} />
                </Group>
               );
            }
`;

code = code.replace(/if \(item\.type === 'rect_table'\) \{[\s\S]*?\n            \}/, rectTableCode);

// And we need to connect the Transformer to the selected node
const effectCode = `
  useEffect(() => {
    if (selectedId && trRef.current) {
      const stage = trRef.current.getStage();
      const selectedNode = stage.findOne('#' + selectedId);
      if (selectedNode) {
        trRef.current.nodes([selectedNode]);
        trRef.current.getLayer().batchDraw();
      }
    }
  }, [selectedId, items]);
`;

code = code.replace("const handleWheel = (e: any) => {", effectCode + "\n\n  const handleWheel = (e: any) => {");

// De-select on stage click
code = code.replace(
  "<Stage ",
  "<Stage \n        onMouseDown={(e) => { if (e.target === e.target.getStage()) setSelectedId(null); }}"
);


fs.writeFileSync(path, code);
