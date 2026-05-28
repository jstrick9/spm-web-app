const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/screens/events/layouts/CanvasPage.tsx';
let code = fs.readFileSync(path, 'utf8');

// We need to inject the structural guidelines query and draw them underneath the layer
const replacement = `
  const { data: catalogData } = useQuery({
    queryKey: ['catalog', event.organization_id],
    queryFn: async () => {
      const [tables, fixtures, guidelines] = await Promise.all([
        sdk.catalog.list(event.organization_id, 'table'),
        sdk.catalog.list(event.organization_id, 'fixture'),
        sdk.catalog.list(event.organization_id, 'guideline' as any),
      ]);
      return { 
        items: [...tables.items, ...fixtures.items],
        guidelines: guidelines.items.find(i => i.name === 'Venue Structural Walls') 
      };
    }
  });

  const CATALOG_ITEMS = catalogData?.items.map(c => {
     let spec = {};
     try { spec = JSON.parse(c.spec as any || '{}'); } catch {}
     return {
        label: c.name,
        type: (spec as any).type || c.kind,
        props: spec
     };
  }) || [];

  const structuralLines = React.useMemo(() => {
     if (!catalogData?.guidelines?.spec) return [];
     try {
       const spec = typeof catalogData.guidelines.spec === 'string' ? JSON.parse(catalogData.guidelines.spec) : catalogData.guidelines.spec;
       return spec.lines || [];
     } catch { return []; }
  }, [catalogData?.guidelines]);

  const handleAddItem = (catalogItem: any) => {
`;

code = code.replace(/const \{ data: catalogData \} = useQuery\(\{[\s\S]*?const handleAddItem = \(catalogItem: any\) => \{/m, replacement);

const structuralRender = `
        <Layer>
          {/* Structural Boundaries */}
          <Group listening={false}>
            {structuralLines.map((line: any, i: number) => (
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
          </Group>
`;

code = code.replace("<Layer>", structuralRender);

// Import Line from konva
code = code.replace(
  "import { Stage, Layer, Rect, Circle, Text, Group, Transformer } from 'react-konva';",
  "import { Stage, Layer, Rect, Circle, Text, Group, Transformer, Line } from 'react-konva';"
);

fs.writeFileSync(path, code);
