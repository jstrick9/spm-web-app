
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/Card';
import { Input } from '../../../ui/Input';
import { Button } from '../../../ui/Button';
import { MessageSquare, Send, Paperclip, Smile, MoreVertical } from 'lucide-react';
import { cn } from '../../../ui/lib/cn';
import { SdkUser } from '../../../sdk/types';
import { getMessages, saveMessage, ChatMessage } from '../../../lib/db/chatDB';
import { EmojiPicker } from '../../../ui/EmojiPicker';

interface Props {
  eventId: string;
  currentUser: SdkUser;
}

export function ChatSystem({ eventId, currentUser }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const [activeCategory, setActiveCategory] = useState<'general' | 'layout' | 'logistics' | 'vendors' | 'urgent'>('general');
  const [showEmoji, setShowEmoji] = useState(false);

  // Load from IndexedDB
  useEffect(() => {
    getMessages(eventId, activeCategory).then((msgs) => {
      if (msgs.length === 0) {
        // Hydrate demo if completely empty
        const initial: ChatMessage = { 
          id: `demo-${Date.now()}`, 
          eventId,
          threadId: activeCategory, 
          senderId: 'sys', 
          senderName: 'System', 
          body: `Welcome to the ${activeCategory} thread!`, 
          createdAt: new Date().toISOString(), 
          isOwn: false,
          synced: true 
        };
        saveMessage(initial).then(() => setMessages([initial]));
      } else {
        setMessages(msgs);
      }
    });
  }, [eventId, activeCategory]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      eventId,
      threadId: activeCategory,
      senderId: currentUser.id,
      senderName: currentUser.fullName || 'Me',
      body: input.trim(),
      createdAt: new Date().toISOString(),
      isOwn: true,
      synced: false // Pending sync with backend
    };

    setMessages(prev => [...prev, newMessage]);
    setInput('');
    
    await saveMessage(newMessage);
    
    // Auto-link detection, mentions, etc would hook in here before save to IndexedDB
  };

  const categories = ['general', 'layout', 'logistics', 'vendors', 'urgent'] as const;

  return (
    <Card className="flex flex-col h-[600px]">
      <CardHeader className="py-3 px-4 border-b border-border flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-brand" />
          Event Communications
        </CardTitle>
        <div className="flex gap-1 bg-surface-2 p-1 rounded-md">
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setActiveCategory(c)}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded capitalize transition-colors",
                activeCategory === c ? (c === 'urgent' ? 'bg-danger text-danger-fg' : 'bg-surface text-fg shadow-sm') : 'text-fg-muted hover:text-fg'
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 p-0 flex flex-col min-h-0 bg-surface-2/30">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.filter(m => m.threadId === activeCategory).map(msg => (
            <div key={msg.id} className={cn("flex flex-col max-w-[80%]", msg.isOwn ? "ml-auto items-end" : "mr-auto items-start")}>
              <div className="text-[10px] text-fg-muted mb-1 px-1">
                {msg.senderName} • {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className={cn(
                "px-4 py-2 rounded-2xl text-sm relative group",
                msg.isOwn 
                  ? "bg-brand text-brand-fg rounded-br-sm" 
                  : "bg-surface border border-border text-fg rounded-bl-sm"
              )}>
                {msg.body}
                <div className={cn(
                  "absolute top-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1",
                  msg.isOwn ? "-left-10" : "-right-10"
                )}>
                  <button className="p-1 hover:bg-surface-2 rounded text-fg-subtle" onClick={() => { setInput(prev => prev + '👍'); setInput((p) => p); }}><Smile className="w-3 h-3" /></button>
                </div>
              </div>
            </div>
          ))}
          {messages.filter(m => m.threadId === activeCategory).length === 0 && (
            <div className="h-full flex items-center justify-center text-sm text-fg-muted italic">
              No messages in #{activeCategory} yet.
            </div>
          )}
        </div>
        
        <div className="p-3 border-t border-border bg-surface relative">
          {showEmoji && (
            <EmojiPicker 
              onSelect={(emoji) => setInput(prev => prev + emoji)}
              onClose={() => setShowEmoji(false)}
              className="bottom-16 left-2"
            />
          )}
          <form onSubmit={handleSend} className="flex gap-2 items-center">
            <button type="button" className="p-2 text-fg-muted hover:text-fg rounded-full hover:bg-surface-2 transition-colors" onClick={() => setShowEmoji(!showEmoji)}>
              <Smile className="w-5 h-5" />
            </button>
            <Input 
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={`Message #${activeCategory}...`}
              className="flex-1 rounded-full bg-surface-2"
            />
            <Button type="submit" size="icon" className="rounded-full shrink-0" disabled={!input.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
