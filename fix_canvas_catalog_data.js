const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/screens/events/layouts/CanvasPage.tsx';
let code = fs.readFileSync(path, 'utf8');

// We need to inject the fetch for the actual catalog replacing the hardcoded CATALOG_ITEMS
const replacement = `
  const { data: catalogData } = useQuery({
    queryKey: ['catalog', event.organization_id],
    queryFn: async () => {
      const [tables, chairs, dances, stages] = await Promise.all([
        sdk.catalog.list(event.organization_id, 'table'),
        sdk.catalog.list(event.organization_id, 'fixture'), // We'll pull chairs and dance floors from here
      ]);
      return [...tables.items, ...chairs.items];
    }
  });

  const CATALOG_ITEMS = catalogData?.map(c => {
     let spec = {};
     try { spec = JSON.parse(c.spec as any || '{}'); } catch {}
     return {
        label: c.name,
        type: (spec as any).type || c.kind,
        props: spec
     };
  }) || [];

  const handleAddItem = (catalogItem: any) => {
`;

code = code.replace(/const CATALOG_ITEMS = \[[\s\S]*?\];\s*const handleAddItem = \(catalogItem: typeof CATALOG_ITEMS\[0\]\) => \{/m, replacement);

fs.writeFileSync(path, code);
