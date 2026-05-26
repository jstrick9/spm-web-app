/**
 * UiPreview — a single page showing every base component side-by-side.
 * Visit via `#/preview` in the app. Serves as a living styleguide and
 * the smoke test for the design system.
 */
import { useState } from 'react';
import { Calendar, ChevronRight, Search, Users, Sparkles } from 'lucide-react';
import { Badge } from '../Badge';
import { Button } from '../Button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../Card';
import { DataTable, type Column } from '../DataTable';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger, DialogClose,
} from '../Dialog';
import { EmptyState } from '../EmptyState';
import { Input } from '../Input';
import { Label } from '../Label';
import { Skeleton } from '../Skeleton';
import { Sparkline } from '../Sparkline';
import { StatCard } from '../StatCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../Tabs';
import { ThemeToggle } from '../ThemeToggle';
import { useToast } from '../Toast';

export function UiPreview() {
  const { toast } = useToast();
  return (
    <div className="min-h-screen bg-bg text-fg">
      {/* Hero */}
      <div className="bg-hero-editorial border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="flex items-start justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-pill bg-accent-soft px-3 py-1 text-xs font-medium text-brand-strong">
                <Sparkles className="h-3 w-3" />
                Design system
              </div>
              <h1 className="font-display text-5xl font-medium tracking-tight">
                Wedding Venue Intelligence
              </h1>
              <p className="mt-3 max-w-prose text-lg text-fg-muted">
                The component library, brand tokens, and intelligence primitives
                that the platform is built on.
              </p>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-12 space-y-16">

        {/* Buttons */}
        <Section title="Buttons" description="Primary actions. Use `variant` and `size` to compose.">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="accent">Accent</Button>
            <Button variant="destructive">Delete</Button>
            <Button variant="link">Link</Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button size="xs">Extra small</Button>
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <Button isLoading>Saving…</Button>
            <Button disabled>Disabled</Button>
          </div>
        </Section>

        {/* Inputs */}
        <Section title="Inputs" description="Labels + inputs + states.">
          <div className="grid max-w-md gap-3">
            <div>
              <Label htmlFor="email" required>Email</Label>
              <Input id="email" type="email" placeholder="owner@venue.com" className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="search">Search</Label>
              <Input id="search" startSlot={<Search className="h-4 w-4" />} placeholder="Search guests…" className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="invalid">Invalid example</Label>
              <Input id="invalid" defaultValue="not-an-email" invalid className="mt-1.5" />
            </div>
          </div>
        </Section>

        {/* Badges */}
        <Section title="Badges" description="Status, labels, counts.">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Default</Badge>
            <Badge variant="brand">Brand</Badge>
            <Badge variant="accent">Accent</Badge>
            <Badge variant="success">Confirmed</Badge>
            <Badge variant="warning">Pending</Badge>
            <Badge variant="danger">Cancelled</Badge>
            <Badge variant="info">Info</Badge>
            <Badge variant="outline">Draft</Badge>
          </div>
        </Section>

        {/* Cards */}
        <Section title="Cards" description="Composable container.">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Default card</CardTitle>
                <CardDescription>Basic information container.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-fg-muted">Cards group related content. They have shadow, border, and a 12px radius.</p>
              </CardContent>
              <CardFooter>
                <Button size="sm">Action</Button>
              </CardFooter>
            </Card>
            <Card interactive className="cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Interactive
                  <ChevronRight className="h-4 w-4 text-fg-subtle" />
                </CardTitle>
                <CardDescription>Hover for a subtle lift.</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-2xl">Editorial</CardTitle>
                <CardDescription>Mix the serif <code>font-display</code> for couple-facing surfaces.</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </Section>

        {/* Intelligence widgets */}
        <Section title="Intelligence widgets" description="Building blocks for the dashboard aesthetic.">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Booking conversion"
              value="34%"
              trend={{ value: 12, direction: 'up' }}
              benchmark={{ label: 'Industry', value: '22%' }}
              rightSlot={
                <span className="text-success">
                  <Sparkline data={[10, 14, 18, 16, 22, 28, 34]} />
                </span>
              }
            />
            <StatCard
              label="Avg revenue per event"
              value="$28,400"
              trend={{ value: 8, direction: 'up' }}
              description="Last 90 days"
              rightSlot={
                <span className="text-brand">
                  <Sparkline data={[24, 25, 23, 27, 26, 28, 28.4]} />
                </span>
              }
            />
            <StatCard
              label="RSVP velocity"
              value="42"
              description="responses this week"
              trend={{ value: 18, direction: 'up' }}
            />
            <StatCard
              label="Vacancy"
              value="3"
              description="weekends in next 90d"
              trend={{ value: 50, direction: 'down', isGood: true }}
              benchmark={{ label: 'Comp set', value: '7' }}
            />
          </div>
        </Section>

        {/* Tabs */}
        <Section title="Tabs">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="guests">Guests</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
              <Card><CardContent className="pt-6">Overview content.</CardContent></Card>
            </TabsContent>
            <TabsContent value="guests">
              <Card><CardContent className="pt-6">Guest list content.</CardContent></Card>
            </TabsContent>
            <TabsContent value="timeline">
              <Card><CardContent className="pt-6">Timeline content.</CardContent></Card>
            </TabsContent>
          </Tabs>
        </Section>

        {/* Data table */}
        <Section title="Data table" description="Tables for guests, vendors, layouts, etc.">
          <SampleTable />
        </Section>

        {/* Dialog + Toast */}
        <Section title="Dialog & Toast">
          <div className="flex flex-wrap gap-3">
            <Dialog>
              <DialogTrigger asChild><Button variant="outline">Open dialog</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete event?</DialogTitle>
                  <DialogDescription>
                    This will permanently remove the event and all associated data.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                  <Button variant="destructive">Delete</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button
              variant="secondary"
              onClick={() => toast({ title: 'Saved', description: 'Your changes are live.', variant: 'success' })}
            >Show success toast</Button>
            <Button
              variant="secondary"
              onClick={() => toast({ title: 'Network error', description: 'Could not reach the server.', variant: 'destructive' })}
            >Show error toast</Button>
          </div>
        </Section>

        {/* Skeleton + Empty */}
        <Section title="Loading + empty states">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardContent className="space-y-3 pt-6">
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
            <Card>
              <EmptyState
                icon={<Users className="h-5 w-5" />}
                title="No guests yet"
                description="Add your first guest to get started."
                action={<Button size="sm">Add guest</Button>}
              />
            </Card>
          </div>
        </Section>

        {/* Type stack */}
        <Section title="Typography">
          <div className="space-y-4">
            <div>
              <div className="text-xs text-fg-subtle">font-display (Fraunces) — editorial</div>
              <p className="font-display text-4xl">An elegant wedding awaits.</p>
            </div>
            <div>
              <div className="text-xs text-fg-subtle">Inter — body</div>
              <p className="text-lg">The quick brown fox jumps over the lazy dog. 1234567890</p>
            </div>
            <div>
              <div className="text-xs text-fg-subtle">JetBrains Mono — data</div>
              <p className="font-mono text-sm">SELECT count(*) FROM guests WHERE rsvp_status = 'attending';</p>
            </div>
          </div>
        </Section>

        <footer className="border-t border-border pt-8 text-center text-xs text-fg-subtle">
          Wedding Venue Intelligence Platform — design system v0.3
        </footer>
      </div>
    </div>
  );
}

// ─── helpers ──────────────────────────────────────────────
function Section({
  title, description, children,
}: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section>
      <header className="mb-4">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
      </header>
      {children}
    </section>
  );
}

interface SampleRow { id: string; guest: string; rsvp: 'pending'|'attending'|'declined'; table: string | null; meal: string | null }
const SAMPLE: SampleRow[] = [
  { id: '1', guest: 'Aunt Mary',       rsvp: 'attending', table: 'Table 3', meal: 'Vegan' },
  { id: '2', guest: 'Uncle Bob',       rsvp: 'attending', table: 'Table 3', meal: 'Standard' },
  { id: '3', guest: 'Cousin Lin',      rsvp: 'pending',   table: null,     meal: null },
  { id: '4', guest: 'Maid of Honor',   rsvp: 'attending', table: 'Head',   meal: 'Gluten-free' },
  { id: '5', guest: 'Best Man Tom',    rsvp: 'declined',  table: null,     meal: null },
];

function SampleTable() {
  const [search, setSearch] = useState('');
  const filtered = SAMPLE.filter(r =>
    r.guest.toLowerCase().includes(search.toLowerCase()) ||
    (r.meal ?? '').toLowerCase().includes(search.toLowerCase()),
  );
  const columns: Column<SampleRow>[] = [
    { id: 'guest', header: 'Guest', cell: (r) => <span className="font-medium">{r.guest}</span> },
    { id: 'rsvp', header: 'RSVP', cell: (r) => (
      <Badge variant={r.rsvp === 'attending' ? 'success' : r.rsvp === 'declined' ? 'danger' : 'warning'}>
        {r.rsvp}
      </Badge>
    )},
    { id: 'table', header: 'Table', cell: (r) => r.table ?? <span className="text-fg-subtle">—</span> },
    { id: 'meal', header: 'Meal', cell: (r) => r.meal ?? <span className="text-fg-subtle">—</span> },
    { id: 'a', header: '', className: 'w-0 text-right',
      cell: () => <Button size="xs" variant="ghost">Edit</Button> },
  ];
  return (
    <div className="space-y-3">
      <Input
        startSlot={<Search className="h-4 w-4" />}
        placeholder="Search guests…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
      />
      <DataTable
        data={filtered}
        columns={columns}
        emptyMessage="No guests match your search."
      />
    </div>
  );
}
