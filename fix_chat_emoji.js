const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/screens/events/chat/ChatSystem.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import { getMessages, saveMessage, ChatMessage } from '../../../lib/db/chatDB';",
  "import { getMessages, saveMessage, ChatMessage } from '../../../lib/db/chatDB';\nimport { EmojiPicker } from '../../../ui/EmojiPicker';"
);

code = code.replace(
  "const [activeCategory, setActiveCategory] = useState<'general' | 'layout' | 'logistics' | 'vendors' | 'urgent'>('general');",
  "const [activeCategory, setActiveCategory] = useState<'general' | 'layout' | 'logistics' | 'vendors' | 'urgent'>('general');\n  const [showEmoji, setShowEmoji] = useState(false);"
);

code = code.replace(
  "<button className=\"p-1 hover:bg-surface-2 rounded text-fg-subtle\"><Smile className=\"w-3 h-3\" /></button>",
  "<button className=\"p-1 hover:bg-surface-2 rounded text-fg-subtle\" onClick={() => { setInput(prev => prev + '👍'); setInput((p) => p); }}><Smile className=\"w-3 h-3\" /></button>"
);

code = code.replace(
  "<button type=\"button\" className=\"p-2 text-fg-muted hover:text-fg rounded-full hover:bg-surface-2 transition-colors\">",
  "<button type=\"button\" className=\"p-2 text-fg-muted hover:text-fg rounded-full hover:bg-surface-2 transition-colors\" onClick={() => setShowEmoji(!showEmoji)}>"
);

code = code.replace(
  "<Paperclip className=\"w-5 h-5\" />",
  "<Smile className=\"w-5 h-5\" />"
);

code = code.replace(
  "<div className=\"p-3 border-t border-border bg-surface\">",
  "<div className=\"p-3 border-t border-border bg-surface relative\">\n          {showEmoji && (\n            <EmojiPicker \n              onSelect={(emoji) => setInput(prev => prev + emoji)}\n              onClose={() => setShowEmoji(false)}\n              className=\"bottom-16 left-2\"\n            />\n          )}"
);

fs.writeFileSync(path, code);
