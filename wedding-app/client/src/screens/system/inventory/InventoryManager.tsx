import React, { useState } from 'react';
import { Package, Search, Plus, Barcode, AlertTriangle, ArrowDownToLine, ArrowUpToLine, Filter } from 'lucide-react';
import { PageBody, PageHeader } from '../../../ui/AppShell';
import { Card, CardContent } from '../../../ui/Card';
import { Button } from '../../../ui/Button';
import { Input } from '../../../ui/Input';
import { Badge } from '../../../ui/Badge';
import { DataTable, type Column } from '../../../ui/DataTable';

interface Props {
  orgId: string;
}

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: 'chair' | 'linen' | 'centerpiece' | 'av' | 'other';
  totalCount: number;
  availableCount: number;
  condition: 'good' | 'fair' | 'poor' | 'maintenance';
  ownerType: 'venue' | 'vendor_rental';
}

export function InventoryManager({ orgId }: Props) {
  const [search, setSearch] = useState('');
  
  // Simulated data state for Inventory tracking
  const [items, setItems] = useState<InventoryItem[]>([
    { id: 'inv1', sku: 'CHR-CHIAVARI-GLD', name: 'Gold Chiavari Chair', category: 'chair', totalCount: 200, availableCount: 185, condition: 'good', ownerType: 'venue' },
    { id: 'inv2', sku: 'LIN-120-WHT', name: '120" Round Linen - White', category: 'linen', totalCount: 40, availableCount: 40, condition: 'good', ownerType: 'venue' },
    { id: 'inv3', sku: 'AV-UPLIGHT-01', name: 'Wireless Uplight (RGB)', category: 'av', totalCount: 24, availableCount: 4, condition: 'maintenance', ownerType: 'vendor_rental' },
    { id: 'inv4', sku: 'DEC-VSE-TALL', name: 'Tall Glass Cylinder Vase', category: 'centerpiece', totalCount: 30, availableCount: 2, condition: 'fair', ownerType: 'venue' },
  ]);

  const filtered = items.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase()) || 
    item.sku.toLowerCase().includes(search.toLowerCase())
  );

  const lowStockItems = items.filter(i => i.availableCount < 10);
  const maintenanceItems = items.filter(i => i.condition === 'maintenance' || i.condition === 'poor');

  const columns: Column<InventoryItem>[] = [
    {
      id: 'sku',
      header: 'SKU / Barcode',
      cell: (i) => <span className="font-mono text-xs text-fg-muted">{i.sku}</span>
    },
    {
      id: 'name',
      header: 'Item Details',
      cell: (i) => (
        <div>
          <div className="font-medium text-fg">{i.name}</div>
          <div className="text-[10px] uppercase tracking-wider text-fg-subtle mt-0.5">{i.category} • {i.ownerType.replace('_', ' ')}</div>
        </div>
      )
    },
    {
      id: 'stock',
      header: 'Availability',
      cell: (i) => {
        const isLow = i.availableCount < 10;
        return (
          <div className="flex items-center gap-2">
            <span className="font-semibold">{i.availableCount}</span>
            <span className="text-fg-subtle text-xs">/ {i.totalCount}</span>
            {isLow && <Badge variant="warning" className="text-[10px] ml-2">Low Stock</Badge>}
          </div>
        );
      }
    },
    {
      id: 'condition',
      header: 'Condition',
      cell: (i) => (
        <Badge variant={
          i.condition === 'good' ? 'success' : 
          i.condition === 'fair' ? 'warning' : 'danger'
        } className="text-[10px] uppercase">
          {i.condition}
        </Badge>
      )
    },
    {
      id: 'actions',
      header: '',
      className: 'w-0 text-right',
      cell: (i) => (
        <div className="flex items-center gap-2 justify-end">
          <Button variant="ghost" size="xs" className="h-7 text-xs">Check Out</Button>
          <Button variant="ghost" size="xs" className="h-7 text-xs">Return</Button>
        </div>
      )
    }
  ];

  return (
    <>
      <PageHeader
        title="Inventory Manager"
        description="Track physical assets, check in/out logs, and monitor condition."
        actions={
          <div className="flex gap-2">
            <Button variant="outline"><Barcode className="w-4 h-4 mr-1" /> Scan Asset</Button>
            <Button><Plus className="w-4 h-4 mr-1" /> Add Item</Button>
          </div>
        }
      />
      <PageBody className="space-y-6">
         
         {/* Alerts Row */}
         {(lowStockItems.length > 0 || maintenanceItems.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {lowStockItems.length > 0 && (
                <div className="bg-warning-soft border border-warning/30 p-4 rounded-lg flex items-start gap-3">
                   <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                   <div>
                     <h4 className="font-semibold text-warning-strong text-sm">Low Stock Alert</h4>
                     <p className="text-xs text-warning-strong/80 mt-1">You have {lowStockItems.length} items running extremely low on available counts.</p>
                   </div>
                </div>
              )}
              {maintenanceItems.length > 0 && (
                <div className="bg-danger-soft border border-danger/30 p-4 rounded-lg flex items-start gap-3">
                   <AlertTriangle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
                   <div>
                     <h4 className="font-semibold text-danger-strong text-sm">Maintenance Required</h4>
                     <p className="text-xs text-danger-strong/80 mt-1">{maintenanceItems.length} assets are currently marked in poor condition or undergoing maintenance.</p>
                   </div>
                </div>
              )}
            </div>
         )}

         {/* Master Data Grid */}
         <Card>
           <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 justify-between bg-surface-2/30">
              <div className="flex-1 max-w-sm">
                <Input 
                  startSlot={<Search className="w-4 h-4 text-fg-muted" />} 
                  placeholder="Search SKU or item name..." 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <div className="flex gap-2 shrink-0">
                 <Button variant="outline" size="sm"><Filter className="w-4 h-4 mr-1" /> Filter</Button>
                 <Button variant="outline" size="sm"><ArrowUpToLine className="w-4 h-4 mr-1" /> Export Logs</Button>
              </div>
           </div>
           
           <DataTable 
             data={filtered}
             columns={columns}
             getRowKey={i => i.id}
             emptyMessage="No inventory assets found."
           />
         </Card>
      </PageBody>
    </>
  );
}
