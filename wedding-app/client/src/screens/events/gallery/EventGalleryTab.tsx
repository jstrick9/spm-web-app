/**
 * EventGalleryTab — Phase 21: wired to real gallery backend.
 *
 * Images are uploaded as data URIs (base64) and stored in the DB.
 * In production, you'd swap this for S3/blob storage — the API
 * shape stays identical; only the `url` field changes.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Image as ImageIcon, Upload, Tag, X, Maximize2, ChevronLeft, ChevronRight } from 'lucide-react';
import { sdk } from '../../../sdk';
import type { SdkGalleryImage } from '../../../sdk/gallery';
import { Button } from '../../../ui/Button';
import { Card, CardContent } from '../../../ui/Card';
import { Badge } from '../../../ui/Badge';
import { Skeleton } from '../../../ui/Skeleton';
import { useToast } from '../../../ui/Toast';
import { usePrompt } from '../../../ui/usePrompt';
import { usePermission } from '../../../lib/usePermission';
import { cn } from '../../../ui/lib/cn';

interface Props { eventId: string }

const CATEGORIES = ['florals', 'linens', 'lighting', 'vibe', 'ceremony', 'reception', 'other'] as const;

export function EventGalleryTab({ eventId }: Props) {
  const { ask, askConfirm, promptNode } = usePrompt();
  const { toast } = useToast();
  const qc = useQueryClient();
  const canManage = usePermission('gallery.manage');
  const fileRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<SdkGalleryImage | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['gallery', eventId],
    queryFn: () => sdk.gallery.list(eventId),
  });

  const images = data?.images ?? [];
  const counts = data?.counts ?? {};
  const total = images.length;
  const filtered = filter ? images.filter(img => img.category === filter) : images;

  // Lightbox navigation: arrow keys + prev/next (UX-09).
  const lightboxIndex = lightbox ? filtered.findIndex((img) => img.id === lightbox.id) : -1;
  const stepLightbox = useCallback((direction: 1 | -1) => {
    if (filtered.length === 0 || lightboxIndex === -1) return;
    const next = (lightboxIndex + direction + filtered.length) % filtered.length;
    setLightbox(filtered[next]);
  }, [filtered, lightboxIndex]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') stepLightbox(1);
      else if (e.key === 'ArrowLeft') stepLightbox(-1);
      else if (e.key === 'Escape') setLightbox(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, stepLightbox]);

  // Touch swipe navigation for the lightbox (mobile parity).
  const touchStartX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 40) return;
    stepLightbox(dx < 0 ? 1 : -1);
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sdk.gallery.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gallery', eventId] });
      toast({ title: 'Image removed', variant: 'success' });
    },
  });

  const recategorizeMutation = useMutation({
    mutationFn: ({ id, category }: { id: string; category: string }) =>
      sdk.gallery.update(id, { category }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gallery', eventId] });
    },
  });

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      const reader = new FileReader();
      reader.onload = async () => {
        const url = reader.result as string;
        await sdk.gallery.upload(eventId, {
          filename: file.name,
          url,
          category: 'vibe',
        });
        qc.invalidateQueries({ queryKey: ['gallery', eventId] });
      };
      reader.readAsDataURL(file);
    }
    toast({ title: `${files.length} image(s) uploaded`, variant: 'success' });
    e.target.value = ''; // reset
  }

  if (isLoading) return <Skeleton className="h-48" />;

  return (
    <div className="space-y-5">
      {promptNode}
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setFilter(null)}
            className={cn(
              "px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer",
              !filter ? 'bg-brand text-on-brand' : 'bg-surface-2 text-fg-muted hover:bg-surface-2/80'
            )}
          >
            All ({total})
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(filter === cat ? null : cat)}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer capitalize",
                filter === cat ? 'bg-brand text-on-brand' : 'bg-surface-2 text-fg-muted hover:bg-surface-2/80'
              )}
            >
              {cat} ({counts[cat] ?? 0})
            </button>
          ))}
        </div>

        {canManage && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleUpload}
            />
            <Button size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="h-3.5 w-3.5 mr-1" /> Upload
            </Button>
          </>
        )}
      </div>

      {/* Gallery grid */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-fg-muted text-sm">
            <ImageIcon className="h-8 w-8 mx-auto mb-2 text-fg-subtle" />
            {filter ? 'No images in this category.' : 'No mood board images yet.'}
            {canManage && !filter && ' Click Upload to add photos.'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map(img => (
            <div key={img.id} className="group relative rounded-lg overflow-hidden border border-border bg-surface aspect-square">
              <img
                src={img.url}
                alt={img.caption || img.filename}
                className="w-full h-full object-cover cursor-pointer transition-transform group-hover:scale-105"
                onClick={() => setLightbox(img)}
              />

              {/* Overlay actions */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors pointer-events-none" />
              <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Badge variant="default" className="text-[10px] capitalize bg-black/60 text-white border-0">
                  {img.category}
                </Badge>
              </div>
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setLightbox(img)}
                  className="p-1 rounded bg-black/50 text-white hover:bg-black/70"
                >
                  <Maximize2 className="h-3 w-3" />
                </button>
                {canManage && (
                  <button
                    onClick={async () => { if (await askConfirm({ title: 'Remove this image?', destructive: true })) deleteMutation.mutate(img.id); }}
                    className="p-1 rounded bg-black/50 text-white hover:bg-red-600" aria-label="Remove image"
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                )}
              </div>

              {/* Re-categorize on hover */}
              {canManage && (
                <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <select
                    className="w-full text-[10px] bg-black/60 text-white border-0 rounded px-1 py-0.5"
                    value={img.category}
                    onChange={e => recategorizeMutation.mutate({ id: img.id, category: e.target.value })}
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8"
          onClick={() => setLightbox(null)}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <button className="absolute top-4 right-4 text-white hover:text-gray-300" onClick={() => setLightbox(null)} aria-label="Close image preview">
            <X className="h-6 w-6" />
          </button>
          {lightboxIndex > 0 && (
            <button className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white bg-black/40 hover:bg-black/60 rounded-full p-2" onClick={(e) => { e.stopPropagation(); stepLightbox(-1); }} aria-label="Previous image">
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          <img
            src={lightbox.url}
            alt={lightbox.caption || lightbox.filename}
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={e => e.stopPropagation()}
          />
          {lightboxIndex < filtered.length - 1 && (
            <button className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white bg-black/40 hover:bg-black/60 rounded-full p-2" onClick={(e) => { e.stopPropagation(); stepLightbox(1); }} aria-label="Next image">
              <ChevronRight className="h-6 w-6" />
            </button>
          )}
          {lightbox.caption && (
            <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-4 py-2 rounded">
              {lightbox.caption}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
