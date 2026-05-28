const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/screens/events/chat/ChatSystem.tsx';
let code = fs.readFileSync(path, 'utf8');

const replacement = `
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/Card';
import { Input } from '../../../ui/Input';
import { Button } from '../../../ui/Button';
import { MessageSquare, Send, Paperclip, Smile, MoreVertical } from 'lucide-react';
import { cn } from '../../../ui/lib/cn';
import { SdkUser } from '../../../sdk/types';
import { getMessages, saveMessage, ChatMessage } from '../../../lib/db/chatDB';

interface Props {
  eventId: string;
  currentUser: SdkUser;
}

export function ChatSystem({ eventId, currentUser }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const [activeCategory, setActiveCategory] = useState<'general' | 'layout' | 'logistics' | 'vendors' | 'urgent'>('general');

  // Load from IndexedDB
  useEffect(() => {
    getMessages(eventId, activeCategory).then((msgs) => {
      if (msgs.length === 0) {
        // Hydrate demo if completely empty
        const initial: ChatMessage = { 
          id: \`demo-\${Date.now()}\`, 
          eventId,
          threadId: activeCategory, 
          senderId: 'sys', 
          senderName: 'System', 
          body: \`Welcome to the \${activeCategory} thread!\`, 
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
`;

code = code.replace(/import React, \{ useState, useEffect, useRef \} from 'react';[\s\S]*?const categories = \['general', 'layout', 'logistics', 'vendors', 'urgent'\] as const;/m, replacement + "\n  const categories = ['general', 'layout', 'logistics', 'vendors', 'urgent'] as const;");

fs.writeFileSync(path, code);
