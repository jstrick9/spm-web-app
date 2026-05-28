import React, { useState, useRef } from 'react';
import { Image as ImageIcon, Upload, Tag, Search, Plus, X, Maximize2 } from 'lucide-react';
import { Button } from '../../../ui/Button';
import { Card, CardContent } from '../../../ui/Card';
import { Input } from '../../../ui/Input';
import { Badge } from '../../../ui/Badge';
import { cn } from '../../../ui/lib/cn';
import { useToast } from '../../../ui/Toast';

interface Props {
  eventId: string;
}

interface GalleryImage {
  id: string;
  url: string;
  category: string;
  uploadedAt: string;
}

const CATEGORIES = ['florals', 'linens', 'lighting', 'centerpieces', 'vibe', 'other'];

export function EventGalleryTab({ eventId }: Props) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Local state mocking the DB for now (since we don't have a real file backend yet)
  const [images, setImages] = useState<GalleryImage[]>([
    { id: '1', url: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMjAwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBmaWxsPSIjOWNhM2FmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+U2FtcGxlIEZsb3JhbHM8L3RleHQ+PC9zdmc+', category: 'florals', uploadedAt: new Date().toISOString() },
    { id: '2', url: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMjAwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBmaWxsPSIjOWNhM2FmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+U2FtcGxlIExpbmVuczwvdGV4dD48L3N2Zz+', category: 'linens', uploadedAt: new Date().toISOString() },
  ]);
  
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<string>('all');
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Simulate upload by reading as data URL
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setImages(prev => [
            { 
              id: `img-${Date.now()}-${Math.random()}`, 
              url: event.target!.result as string, 
              category: 'other', 
              uploadedAt: new Date().toISOString() 
            },
            ...prev
          ]);
        }
      };
      reader.readAsDataURL(file);
    });
    
    toast({ title: 'Images uploaded to Mood Board', variant: 'success' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const updateCategory = (id: string, newCat: string) => {
    setImages(prev => prev.map(img => img.id === id ? { ...img, category: newCat } : img));
  };

  const deleteImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
  };

  const filtered = images.filter(img => {
    if (filterCat !== 'all' && img.category !== filterCat) return false;
    // We don't have titles yet, but we could search tags if we add them
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
        <h2 className="text-lg font-medium text-fg flex items-center gap-2">
           <ImageIcon className="w-5 h-5 text-brand" /> Photo & Mood Board Gallery
        </h2>
        <div className="flex items-center gap-2">
           <input 
             type="file" 
             multiple 
             accept="image/*" 
             className="hidden" 
             ref={fileInputRef}
             onChange={handleFileUpload}
           />
           <Button onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-4 h-4 mr-1" /> Upload Photos
           </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
         {/* Categories Sidebar */}
         <div className="w-full sm:w-48 shrink-0 space-y-1">
            <h3 className="text-xs font-semibold text-fg-subtle uppercase tracking-wider mb-3 px-2">Categories</h3>
            <button 
              onClick={() => setFilterCat('all')}
              className={cn(
                "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                filterCat === 'all' ? "bg-brand-soft text-brand-strong font-medium" : "text-fg-muted hover:bg-surface-2"
              )}
            >
              All Photos
              <span className="float-right text-xs bg-surface-2 px-1.5 rounded-pill text-fg-subtle">{images.length}</span>
            </button>
            {CATEGORIES.map(cat => {
              const count = images.filter(i => i.category === cat).length;
              return (
                <button 
                  key={cat}
                  onClick={() => setFilterCat(cat)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md text-sm transition-colors capitalize",
                    filterCat === cat ? "bg-brand-soft text-brand-strong font-medium" : "text-fg-muted hover:bg-surface-2"
                  )}
                >
                  {cat}
                  {count > 0 && <span className="float-right text-xs bg-surface-2 px-1.5 rounded-pill text-fg-subtle">{count}</span>}
                </button>
              );
            })}
         </div>

         {/* Gallery Grid */}
         <div className="flex-1 bg-surface border border-border rounded-lg p-4 min-h-[500px]">
            {filtered.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-center py-20">
                  <ImageIcon className="w-12 h-12 text-fg-subtle mb-4 opacity-50" />
                  <h3 className="text-lg font-medium text-fg">No photos in this category</h3>
                  <p className="text-sm text-fg-muted mt-1 mb-4 max-w-sm">
                    Upload inspiration imagery, linen swatches, or layout references to build the event mood board.
                  </p>
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()}>Upload Photos</Button>
               </div>
            ) : (
               <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {filtered.map(img => (
                    <div key={img.id} className="group relative aspect-square rounded-md overflow-hidden bg-surface-2 border border-border shadow-sm hover:shadow-md transition-all">
                       <img src={img.url} alt="" className="w-full h-full object-cover" />
                       
                       {/* Overlay Actions */}
                       <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                          <div className="flex justify-between items-start">
                             <select 
                               value={img.category}
                               onChange={(e) => updateCategory(img.id, e.target.value)}
                               className="text-xs bg-surface/90 text-fg rounded border-none py-1 px-2 capitalize cursor-pointer outline-none"
                             >
                               {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                             </select>
                             <button onClick={() => deleteImage(img.id)} className="p-1.5 bg-danger/90 text-white rounded-md hover:bg-danger transition-colors">
                                <X className="w-3.5 h-3.5" />
                             </button>
                          </div>
                          <div className="flex justify-end">
                             <button onClick={() => setFullScreenImage(img.url)} className="p-1.5 bg-black/60 text-white rounded-md hover:bg-black transition-colors backdrop-blur-sm">
                                <Maximize2 className="w-3.5 h-3.5" />
                             </button>
                          </div>
                       </div>
                    </div>
                  ))}
               </div>
            )}
         </div>
      </div>

      {/* Lightbox / Fullscreen Viewer */}
      {fullScreenImage && (
        <div 
           className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
           onClick={() => setFullScreenImage(null)}
        >
           <button className="absolute top-4 right-4 p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors">
             <X className="w-8 h-8" />
           </button>
           <img src={fullScreenImage} className="max-w-full max-h-full object-contain rounded-md shadow-2xl" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
