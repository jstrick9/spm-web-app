/**
 * Platform Studio — Day 3 ships the **presets gallery** tab.
 * Day 4 adds Custom Theme (granular editor) + Widget Studio + Layout Studio.
 *
 * Reading order:
 *   - Loads org config from server (sdk.platformConfig.getOrg)
 *   - Renders THEME_PRESETS as cards with mini-previews
 *   - Hovering a preset → live-previews via setPreviewOverride
 *   - Clicking "Apply" → PUTs the preset to the server and updates the
 *     ConfigProvider's org layer
 *
 * Permission gate: anyone hitting this page must have `roles.manage`.
 * The server enforces this on PUT regardless.
 */
import { Check, ExternalLink, Loader2, Palette } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PageBody, PageHeader } from '../ui/AppShell';
import { Button } from '../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/Tabs';
import { useToast } from '../ui/Toast';
import { usePlatformConfig } from '../config/ConfigProvider';
import { THEME_PRESETS, type ThemePreset } from '../config/presets';
import { sdk } from '../sdk';
import type { PartialPlatformConfig } from '../config/schema';
import { BrandingEditor, ConfigSectionEditor } from './platformStudioEditors';

interface Props {
  orgId: string;
  /** Called after a successful save so the parent can refresh its config layer. */
  onSaved: (orgConfig: PartialPlatformConfig) => void;
}

export function PlatformStudio({ orgId, onSaved }: Props) {
  const { config, setPreviewOverride, previewActive } = usePlatformConfig();
  const { toast } = useToast();
  const [serverConfig, setServerConfig] = useState<PartialPlatformConfig | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    sdk.platformConfig.getOrg(orgId).then((r) => setServerConfig(r.config)).catch(() => { /* config not available yet */ });
  }, [orgId]);

  // While hovering, show that preset live. When un-hovering, clear preview.
  useEffect(() => {
    if (!hovered) { setPreviewOverride(null); return; }
    const preset = THEME_PRESETS.find((p) => p.id === hovered);
    if (preset) setPreviewOverride(preset.config);
    return () => { setPreviewOverride(null); };
  }, [hovered, setPreviewOverride]);

  const current = useMemo(() => serverConfig ?? config, [serverConfig, config]);

  async function saveConfig(next: PartialPlatformConfig, busyKey: string) {
    setBusyId(busyKey);
    try {
      const r = await sdk.platformConfig.putOrg(orgId, next);
      setServerConfig(r.config);
      onSaved(r.config);
      toast({ title: 'Platform settings saved', description: 'Changes are live for your organization.', variant: 'success' });
    } catch (e) {
      toast({ title: 'Could not save', description: (e as Error).message, variant: 'destructive' });
    } finally { setBusyId(null); }
  }

  async function apply(preset: ThemePreset) {
    setBusyId(preset.id);
    try {
      // Merge preset over existing server config so we don't clobber
      // non-theme settings the admin already configured.
      const next: PartialPlatformConfig = {
        ...(serverConfig ?? {}),
        theme: { ...(serverConfig?.theme ?? {}), ...(preset.config.theme ?? {}) },
      };
      const r = await sdk.platformConfig.putOrg(orgId, next);
      setServerConfig(r.config);
      // Keep the committed theme applied immediately while the parent org
      // layer refreshes; it is cleared on unmount or when a card is released.
      setPreviewOverride({ theme: r.config.theme });
      onSaved(r.config);
      toast({
        title: `Applied "${preset.name}"`,
        description: 'The theme is live for everyone in your organization.',
        variant: 'success',
      });
    } catch (e) {
      toast({
        title: 'Could not save',
        description: (e as Error).message,
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Platform Studio"
        description="Configure how the platform looks and behaves for everyone in your organization."
        actions={
          <div className="flex items-center gap-2">
            {previewActive && (
              <Badge variant="warning" className="px-3 py-1">
                Live preview active — release the card to clear
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={() => window.dispatchEvent(new CustomEvent('wvi:open-owner-setup'))}>
              Restart setup wizard
            </Button>
          </div>
        }
      />
      <PageBody>
        <Tabs defaultValue="theme">
          <TabsList>
            <TabsTrigger value="theme">Theme</TabsTrigger>
            <TabsTrigger value="widgets">Widgets</TabsTrigger>
            <TabsTrigger value="layout">Layout</TabsTrigger>
            <TabsTrigger value="branding">Branding</TabsTrigger>
          </TabsList>

          <TabsContent value="theme">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {THEME_PRESETS.map((preset) => {
                const isActive = serverConfig?.theme?.brand === preset.config.theme?.brand;
                return (
                  <Card
                    key={preset.id}
                    className="cursor-pointer transition-shadow hover:shadow-elev-1"
                    onMouseEnter={() => setHovered(preset.id)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered(preset.id)}
                    onBlur={() => setHovered(null)}
                    tabIndex={0}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            {preset.name}
                            {isActive && (
                              <Badge variant="success" className="ml-1">
                                <Check className="h-3 w-3" />
                                Active
                              </Badge>
                            )}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {preset.description}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Color swatch */}
                      <div className="flex gap-2">
                        {preset.swatch.map((rgb, i) => (
                          <div
                            key={i}
                            className="h-10 w-10 rounded-md border border-border"
                            style={{ background: `rgb(${rgb})` }}
                            aria-hidden="true"
                          />
                        ))}
                      </div>
                      {/* Font preview */}
                      <div className="text-xs text-fg-subtle">
                        Display: <span className="text-fg-muted">{preset.config.theme?.fontDisplay}</span> ·
                        Body: <span className="text-fg-muted">{preset.config.theme?.fontBody}</span>
                      </div>
                      <Button
                        className="w-full"
                        disabled={isActive || busyId !== null}
                        isLoading={busyId === preset.id}
                        onClick={(e) => { e.stopPropagation(); void apply(preset); }}
                      >
                        {isActive ? 'Currently applied' : 'Apply to organization'}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Card className="mt-8 border-dashed">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Palette className="h-4 w-4" />
                  Custom Theme
                </CardTitle>
                <CardDescription>
                  Tweak any individual color, font, density, radius, or motion setting
                  with a live preview. Coming Day 4 of Phase 3.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" disabled>
                  Open Custom Editor
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="widgets">
            <ConfigSectionEditor
              title="Widget slots"
              description="Configure the widgets rendered in each dashboard, event, and portal slot."
              value={current.widgets ?? {}}
              busy={busyId === 'widgets'}
              onSave={(widgets) => void saveConfig({ ...current, widgets }, 'widgets')}
            />
          </TabsContent>

          <TabsContent value="layout">
            <ConfigSectionEditor
              title="Navigation and feature layout"
              description="Configure navigation order, hidden items, sidebar defaults, and feature flags."
              value={current.layout ?? {}}
              busy={busyId === 'layout'}
              onSave={(layout) => void saveConfig({ ...current, layout }, 'layout')}
            />
          </TabsContent>

          <TabsContent value="branding">
            <BrandingEditor
              value={current.branding ?? {}}
              busy={busyId === 'branding'}
              onSave={(branding) => void saveConfig({ ...current, branding }, 'branding')}
            />
          </TabsContent>
        </Tabs>
      </PageBody>
    </>
  );
}
