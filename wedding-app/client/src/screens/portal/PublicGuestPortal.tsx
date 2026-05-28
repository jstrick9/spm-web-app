import React, { useState, useEffect } from 'react';
import { ApiError, sdk } from '../../sdk';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Label } from '../../ui/Label';
import { Map as MapIcon, Home, Send, PieChart } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '../../ui/Badge';
import { Stage, Layer, Rect, Circle, Text, Group } from 'react-konva';
import { cn } from '../../ui/lib/cn';

export function PublicGuestPortal({ eventId }: { eventId: string }) {
  const [info, setInfo] = useState<{ title: string; startDate: string | null } | null>(null);
  const [guests, setGuests] = useState<Array<any>>([]);
  const [layout, setLayout] = useState<any>(null);
  const [polls, setPolls] = useState<any[]>([]);
  
  // URL params
  const [selectedGuestId, setSelectedGuestId] = useState('');
  
  const [attending, setAttending] = useState(true);
  const [mealChoice, setMealChoice] = useState('standard');
  const [notes, setNotes] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<'home' | 'map' | 'rsvp'>('home');

  useEffect(() => {
    // Read from query param if available
    const searchParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const guestParam = searchParams.get('guest');
    if (guestParam) setSelectedGuestId(guestParam);

    sdk.portal.info(eventId)
      .then((r) => { 
         setInfo({ title: r.event.title, startDate: r.event.startDate }); 
         setGuests(r.guests); 
         setLayout(r.layout);
         sdk.feedback.getPolls(eventId).then(res => setPolls(res.polls));
      })
      .catch(() => setError('Event not found.'));
  }, [eventId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selectedGuestId) { setError('Please pick your name.'); return; }
    try {
      await sdk.portal.submitRsvp(eventId, { guestId: selectedGuestId, attending, mealChoice, notes: notes || undefined });
      setDone(true);
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  if (error && !info) return <Card className="max-w-md mx-auto mt-20"><CardContent className="pt-6 text-danger">{error}</CardContent></Card>;
  if (!info) return <div className="min-h-screen flex items-center justify-center bg-[#fdfbf7]"><div className="animate-pulse text-fg-muted">Loading Portal...</div></div>;

  const inputStyle: React.CSSProperties = { width: '100%' };
  
  const activeGuest = guests.find(g => g.id === selectedGuestId);

  return (
    <div className="min-h-screen bg-[#fdfbf7] font-serif text-[#2c3e2e] flex flex-col relative pb-20">
      <header className="bg-white border-b border-[#e1d5c9] py-6 px-4 text-center sticky top-0 z-10 shadow-sm">
         <h1 className="text-2xl md:text-4xl font-display font-bold tracking-widest">{info.title}</h1>
         <p className="mt-2 text-sm text-gray-500 uppercase tracking-widest">{info.startDate ? new Date(info.startDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'}) : 'TBD'}</p>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full p-4 md:p-8">
         {activeTab === 'home' && (
            <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
               <div className="aspect-[21/9] w-full bg-[#e1d5c9] rounded-xl overflow-hidden shadow-lg relative flex items-center justify-center">
                  <div className="absolute inset-0 bg-black/20" />
                  <h2 className="relative z-10 text-white font-display text-4xl md:text-5xl lg:text-6xl text-center px-4 leading-tight shadow-sm">
                     We can't wait to <br/> celebrate with you.
                  </h2>
               </div>
               
               {activeGuest && (
                 <Card className="bg-white border-[#e1d5c9] shadow-sm text-center py-6">
                   <CardContent>
                     <h3 className="text-xl font-display mb-2">Welcome, {activeGuest.fullName}</h3>
                     <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">We are so excited to share our special day with you. Please browse the venue map to find your seat, or submit your RSVP!</p>
                     <div className="flex flex-wrap gap-4 justify-center">
                        <Button variant="outline" className="border-[#e1d5c9] text-[#2c3e2e] hover:bg-[#fdfbf7]" onClick={() => setActiveTab('map')}><MapIcon className="w-4 h-4 mr-2" /> View Map</Button>
                        <Button className="bg-[#2c3e2e] text-white hover:bg-[#1a251b]" onClick={() => setActiveTab('rsvp')}><Send className="w-4 h-4 mr-2" /> RSVP Now</Button>
                     </div>
                   </CardContent>
                 </Card>
               )}
               
               
               {polls.length > 0 && activeGuest && (
                  <div className="space-y-4 animate-in fade-in duration-700 delay-300">
                     <h3 className="font-display text-2xl text-center border-t border-[#e1d5c9] pt-8">Couple's Polls</h3>
                     {polls.filter((p: any) => p.status === 'active').map((poll: any) => (
                        <Card key={poll.id} className="border-[#e1d5c9] shadow-sm">
                           <CardContent className="p-6">
                              <h4 className="font-semibold text-lg mb-4">{poll.question}</h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                 {poll.options.map((opt: any) => (
                                    <Button 
                                      key={opt.id} 
                                      variant="outline" 
                                      className="justify-between border-[#e1d5c9] hover:bg-[#fdfbf7] text-[#2c3e2e] h-auto py-3 whitespace-normal text-left"
                                      onClick={async () => {
                                        await sdk.feedback.votePoll(eventId, poll.id, opt.id);
                                        const res = await sdk.feedback.getPolls(eventId);
                                        setPolls(res.polls);
                                      }}
                                    >
                                      <span>{opt.text}</span>
                                      <Badge variant="outline" className="ml-2 bg-[#e1d5c9]/30 border-[#e1d5c9] text-[#2c3e2e]">{opt.votes} votes</Badge>
                                    </Button>
                                 ))}
                              </div>
                           </CardContent>
                        </Card>
                     ))}
                  </div>
               )}


               {!activeGuest && (
                 <div className="text-center py-12">
                   <p className="text-lg mb-4">Please identify yourself to access personalized details.</p>
                   <Button onClick={() => setActiveTab('rsvp')} className="bg-[#2c3e2e] text-white hover:bg-[#1a251b]">Find Your Invitation</Button>
                 </div>
               )}
            </div>
         )}

         {activeTab === 'map' && (
            <div className="space-y-6 animate-in slide-in-from-right-8 duration-500 h-full flex flex-col">
               <div className="text-center">
                 <h2 className="text-3xl font-display">Venue Map</h2>
                 <p className="text-gray-500 mt-2">Pinch to zoom and drag to explore the layout.</p>
               </div>
               
               {activeGuest && layout && (
                  <div className="bg-pink-50 border border-pink-200 text-pink-800 p-4 rounded-lg flex items-center justify-center gap-2">
                     <span className="w-3 h-3 rounded-full bg-pink-500 animate-pulse" />
                     <span className="text-sm font-medium">Your seat is highlighted in pink!</span>
                  </div>
               )}

               <div className="flex-1 min-h-[500px] w-full bg-white border border-[#e1d5c9] rounded-xl overflow-hidden shadow-sm relative">
                  {!layout ? (
                     <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                        <MapIcon className="w-12 h-12 mb-4 opacity-50" />
                        <p>The layout map hasn't been published yet.</p>
                     </div>
                  ) : (
                     <PortalMapViewer layout={layout} activeGuestId={selectedGuestId} />
                  )}
               </div>
               
            </div>
         )}

         {activeTab === 'rsvp' && (
            <div className="animate-in slide-in-from-bottom-8 duration-500 max-w-lg mx-auto mt-8">
              {done ? (
                <Card className="text-center border-[#e1d5c9] shadow-lg">
                  <CardContent className="pt-10 pb-8">
                    <div className="text-6xl mb-4">💌</div>
                    <h2 className="font-display text-2xl">Thank You!</h2>
                    <p className="mt-2 text-gray-600">Your RSVP has been successfully received.</p>
                    <Button variant="outline" className="mt-6 border-[#e1d5c9]" onClick={() => setActiveTab('home')}>Return Home</Button>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-[#e1d5c9] shadow-lg">
                  <CardHeader className="text-center pb-2">
                    <CardTitle className="font-display text-3xl">RSVP</CardTitle>
                    <p className="text-sm text-gray-500 mt-2">Kindly respond by the deadline.</p>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={submit} className="space-y-6">
                      <div>
                        <Label htmlFor="gn" className="font-serif">Your Name</Label>
                        <select id="gn" required value={selectedGuestId} onChange={(e) => setSelectedGuestId(e.target.value)} className="mt-2 w-full h-12 px-4 rounded-md border border-[#e1d5c9] bg-white focus:ring-[#2c3e2e] focus:border-[#2c3e2e] font-sans">
                          <option value="">— Find your name —</option>
                          {guests.map((g) => <option key={g.id} value={g.id}>{g.fullName}</option>)}
                        </select>
                      </div>
                      
                      {selectedGuestId && (
                        <div className="animate-in fade-in duration-500 space-y-6">
                          <div>
                            <Label className="font-serif">Will you be attending?</Label>
                            <div className="flex gap-3 mt-2">
                              <Button type="button" className={cn("flex-1 h-12 font-medium tracking-widest", attending ? "bg-[#2c3e2e] text-white" : "bg-white text-[#2c3e2e] border border-[#e1d5c9] hover:bg-gray-50")} onClick={() => setAttending(true)}>JOYFULLY ACCEPT</Button>
                              <Button type="button" className={cn("flex-1 h-12 font-medium tracking-widest", !attending ? "bg-[#2c3e2e] text-white" : "bg-white text-[#2c3e2e] border border-[#e1d5c9] hover:bg-gray-50")} onClick={() => setAttending(false)}>REGRETFULLY DECLINE</Button>
                            </div>
                          </div>
                          
                          {attending && (
                            <div>
                              <Label htmlFor="meal" className="font-serif">Meal Preference</Label>
                              <select id="meal" value={mealChoice} onChange={(e) => setMealChoice(e.target.value)} className="mt-2 w-full h-12 px-4 rounded-md border border-[#e1d5c9] bg-white focus:ring-[#2c3e2e] focus:border-[#2c3e2e] font-sans">
                                <option value="standard">Standard (Beef/Chicken Duet)</option>
                                <option value="vegetarian">Vegetarian</option>
                                <option value="vegan">Vegan</option>
                                <option value="gluten-free">Gluten-Free</option>
                              </select>
                            </div>
                          )}
                          
                          <div>
                            <Label htmlFor="notes" className="font-serif">A Note for the Couple (Optional)</Label>
                            <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-2 w-full min-h-[100px] p-4 rounded-md border border-[#e1d5c9] bg-white focus:ring-[#2c3e2e] focus:border-[#2c3e2e] font-sans resize-none" style={inputStyle} placeholder="Leave your wishes or mention any specific dietary allergies..." />
                          </div>
                          
                          {error && <p className="text-sm text-red-600 font-sans">{error}</p>}
                          <Button type="submit" className="w-full h-12 bg-[#2c3e2e] text-white hover:bg-[#1a251b] font-medium tracking-widest">SEND RSVP</Button>
                        </div>
                      )}
                    </form>
                  </CardContent>
                </Card>
              )}
            </div>
         )}
      </main>
      
      {/* Mobile Safe Bottom Nav */}
      <nav className="fixed bottom-0 left-0 w-full bg-white border-t border-[#e1d5c9] pb-safe z-50">
        <div className="flex items-center justify-around h-16 max-w-md mx-auto">
           <button onClick={() => setActiveTab('home')} className={cn("flex flex-col items-center gap-1 w-20 transition-colors", activeTab === 'home' ? "text-[#2c3e2e]" : "text-gray-400 hover:text-gray-600")}>
              <Home className="w-5 h-5" />
              <span className="text-[10px] uppercase font-bold tracking-widest">Home</span>
           </button>
           <button onClick={() => setActiveTab('map')} className={cn("flex flex-col items-center gap-1 w-20 transition-colors", activeTab === 'map' ? "text-[#2c3e2e]" : "text-gray-400 hover:text-gray-600")}>
              <MapIcon className="w-5 h-5" />
              <span className="text-[10px] uppercase font-bold tracking-widest">Map</span>
           </button>
           <button onClick={() => setActiveTab('rsvp')} className={cn("flex flex-col items-center gap-1 w-20 transition-colors", activeTab === 'rsvp' ? "text-[#2c3e2e]" : "text-gray-400 hover:text-gray-600")}>
              <Send className="w-5 h-5" />
              <span className="text-[10px] uppercase font-bold tracking-widest">RSVP</span>
           </button>
        </div>
      </nav>
    </div>
  );
}

function PortalMapViewer({ layout, activeGuestId }: { layout: any; activeGuestId: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(0.8);
  const [pos, setPos] = useState({ x: 50, y: 50 });

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        });
      }
    };
    handleResize();
    // Center it somewhat
    setPos({ x: dimensions.width / 4, y: 50 });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const scaleBy = 1.05;
    const stage = e.target.getStage();
    if (!stage) return;
    const oldScale = stage.scaleX();
    const mousePointTo = {
      x: stage.getPointerPosition().x / oldScale - stage.x() / oldScale,
      y: stage.getPointerPosition().y / oldScale - stage.y() / oldScale,
    };
    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    setScale(newScale);
    setPos({
      x: -(mousePointTo.x - stage.getPointerPosition().x / newScale) * newScale,
      y: -(mousePointTo.y - stage.getPointerPosition().y / newScale) * newScale
    });
  };

  const items = Array.isArray(layout.items) ? layout.items : [];

  return (
    <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing">
      <Stage 
        width={dimensions.width} 
        height={dimensions.height}
        onWheel={handleWheel}
        onTouchMove={(e) => {
           // Simple touch pan could go here if needed
        }}
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
          {items.map((item: any) => {
            const isAssignedToActive = activeGuestId && item.guestId === activeGuestId;
            
            if (item.type === 'round_table') {
              return (
                <Group key={item.id} x={item.x} y={item.y}>
                   <Circle radius={item.radius} fill="#f3f4f6" stroke="#9ca3af" strokeWidth={2} />
                   <Text text={item.label} fontSize={14} fill="#374151" align="center" verticalAlign="middle" offsetX={item.radius||0} offsetY={7} width={(item.radius||0) * 2} />
                </Group>
              );
            }
            if (item.type === 'rect_table') {
               return (
                <Group key={item.id} x={item.x} y={item.y} rotation={item.rotation}>
                   <Rect width={item.width} height={item.height} offsetX={(item.width||0)/2} offsetY={(item.height||0)/2} fill="#f3f4f6" stroke="#9ca3af" strokeWidth={2} cornerRadius={4} />
                   <Text text={item.label} fontSize={14} fill="#374151" align="center" verticalAlign="middle" offsetX={(item.width||0)/2} offsetY={7} width={item.width} />
                </Group>
               );
            }
            if (item.type === 'dance_floor') {
               return (
                <Group key={item.id} x={item.x} y={item.y} rotation={item.rotation}>
                   <Rect width={item.width} height={item.height} offsetX={(item.width||0)/2} offsetY={(item.height||0)/2} fill="#e5e7eb" stroke="#d1d5db" strokeWidth={1} dash={[10, 5]} />
                   <Text text={item.label} fontSize={16} fill="#6b7280" fontStyle="italic" align="center" verticalAlign="middle" offsetX={(item.width||0)/2} offsetY={8} width={item.width} />
                </Group>
               );
            }
            if (item.type === 'chair') {
              return (
                 <Group key={item.id} x={item.x} y={item.y}>
                   <Circle 
                     radius={item.radius} 
                     fill={isAssignedToActive ? "#fdf2f8" : (item.guestId ? "#e5e7eb" : "#fff")} 
                     stroke={isAssignedToActive ? "#ec4899" : "#9ca3af"} 
                     strokeWidth={isAssignedToActive ? 3 : 1.5} 
                   />
                   {/* Draw pulsing ring if active */}
                   {isAssignedToActive && (
                     <Circle radius={item.radius + 8} stroke="#ec4899" strokeWidth={2} opacity={0.5} dash={[4, 4]} />
                   )}
                   {item.guestInitials && !isAssignedToActive && (
                     <Text text={item.guestInitials} fontSize={8} fill="#6b7280" align="center" verticalAlign="middle" offsetX={item.radius} offsetY={4} width={item.radius * 2} listening={false} />
                   )}
                 </Group>
              )
            }
            return null;
          })}
        </Layer>
      </Stage>
    </div>
  );
}
