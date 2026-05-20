import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface EmojiData {
  emoji: string;
  name: string;
  keywords: string[];
}

interface EmojiCategory {
  name: string;
  icon: string;
  emojis: EmojiData[];
}

// Comprehensive emoji library with names and keywords
const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    name: 'Wedding & Romance',
    icon: '💒',
    emojis: [
      { emoji: '💒', name: 'Wedding Chapel', keywords: ['wedding', 'chapel', 'church', 'ceremony', 'venue'] },
      { emoji: '💍', name: 'Ring', keywords: ['ring', 'engagement', 'wedding', 'diamond', 'proposal'] },
      { emoji: '👰', name: 'Bride', keywords: ['bride', 'wedding', 'woman', 'veil', 'dress'] },
      { emoji: '🤵', name: 'Groom', keywords: ['groom', 'wedding', 'man', 'suit', 'tuxedo'] },
      { emoji: '👰‍♀️', name: 'Bride with Veil', keywords: ['bride', 'veil', 'wedding', 'woman'] },
      { emoji: '🤵‍♂️', name: 'Man in Tuxedo', keywords: ['groom', 'tuxedo', 'wedding', 'man', 'formal'] },
      { emoji: '💐', name: 'Bouquet', keywords: ['bouquet', 'flowers', 'wedding', 'bride', 'arrangement'] },
      { emoji: '💑', name: 'Couple with Heart', keywords: ['couple', 'love', 'heart', 'romance', 'wedding'] },
      { emoji: '💏', name: 'Kiss', keywords: ['kiss', 'love', 'couple', 'romance', 'wedding'] },
      { emoji: '❤️', name: 'Red Heart', keywords: ['heart', 'love', 'romance', 'red', 'valentine'] },
      { emoji: '💕', name: 'Two Hearts', keywords: ['hearts', 'love', 'romance', 'couple'] },
      { emoji: '💖', name: 'Sparkling Heart', keywords: ['heart', 'sparkle', 'love', 'romance'] },
      { emoji: '💗', name: 'Growing Heart', keywords: ['heart', 'growing', 'love', 'romance'] },
      { emoji: '💘', name: 'Heart with Arrow', keywords: ['heart', 'arrow', 'cupid', 'love', 'romance'] },
      { emoji: '💝', name: 'Heart with Ribbon', keywords: ['heart', 'ribbon', 'gift', 'love', 'romance'] },
      { emoji: '💞', name: 'Revolving Hearts', keywords: ['hearts', 'revolving', 'love', 'romance'] },
      { emoji: '💓', name: 'Beating Heart', keywords: ['heart', 'beating', 'love', 'romance'] },
      { emoji: '🥂', name: 'Champagne Glasses', keywords: ['champagne', 'toast', 'celebration', 'cheers', 'wedding'] },
      { emoji: '🍾', name: 'Champagne Bottle', keywords: ['champagne', 'bottle', 'celebration', 'party'] },
      { emoji: '✨', name: 'Sparkles', keywords: ['sparkles', 'magic', 'celebration', 'glamour', 'decoration'] },
      { emoji: '🎊', name: 'Confetti Ball', keywords: ['confetti', 'celebration', 'party', 'wedding'] },
      { emoji: '🎉', name: 'Party Popper', keywords: ['party', 'celebration', 'confetti', 'wedding'] },
      { emoji: '🕊️', name: 'Dove', keywords: ['dove', 'peace', 'bird', 'white', 'wedding', 'release'] },
      { emoji: '🦢', name: 'Swan', keywords: ['swan', 'bird', 'elegant', 'white', 'wedding', 'lake'] },
      { emoji: '🤍', name: 'White Heart', keywords: ['heart', 'white', 'pure', 'love', 'wedding'] },
      { emoji: '🩷', name: 'Pink Heart', keywords: ['heart', 'pink', 'love', 'romance', 'blush'] },
      { emoji: '🩵', name: 'Light Blue Heart', keywords: ['heart', 'blue', 'love', 'something blue'] },
      { emoji: '💜', name: 'Purple Heart', keywords: ['heart', 'purple', 'love', 'romance'] },
      { emoji: '🧡', name: 'Orange Heart', keywords: ['heart', 'orange', 'love', 'autumn', 'fall'] },
      { emoji: '💛', name: 'Yellow Heart', keywords: ['heart', 'yellow', 'love', 'friendship'] },
      { emoji: '💚', name: 'Green Heart', keywords: ['heart', 'green', 'love', 'nature'] },
      { emoji: '🎈', name: 'Balloon', keywords: ['balloon', 'party', 'decoration', 'celebration'] },
      { emoji: '🎀', name: 'Ribbon', keywords: ['ribbon', 'bow', 'decoration', 'gift'] },
      { emoji: '🎁', name: 'Gift', keywords: ['gift', 'present', 'box', 'wedding'] },
      { emoji: '💎', name: 'Gem Stone', keywords: ['gem', 'diamond', 'jewel', 'engagement'] },
    ]
  },
  {
    name: 'Wedding Decor',
    icon: '🌸',
    emojis: [
      { emoji: '🏺', name: 'Classic Vase', keywords: ['vase', 'vases', 'floral', 'decor', 'vessel'] },
      { emoji: '🍶', name: 'Ceramic Vase', keywords: ['vase', 'ceramic', 'decor', 'vessel'] },
      { emoji: '🥣', name: 'Decorative Bowl', keywords: ['bowl', 'decor', 'centerpiece', 'vessel'] },
      { emoji: '🕯️', name: 'Candlestick', keywords: ['candle', 'candlestick', 'lighting', 'taper', 'brass'] },
      { emoji: '🕎', name: 'Menorah', keywords: ['candle', 'religious', 'lighting', 'ceremony'] },
      { emoji: '🪔', name: 'Diya Lamp', keywords: ['lamp', 'candle', 'lighting', 'decor'] },
      { emoji: '🔥', name: 'Pillar Candle', keywords: ['candle', 'pillar', 'decor', 'fire'] },
      { emoji: '🏮', name: 'Lantern', keywords: ['lantern', 'light', 'lighting', 'decor', 'ambient'] },
      { emoji: '💡', name: 'Edison Bulb', keywords: ['light', 'bulb', 'industrial', 'lighting', 'decor'] },
      { emoji: '✨', name: 'Twinkle Lights', keywords: ['sparkles', 'magic', 'lighting', 'string lights'] },
      { emoji: '🌸', name: 'Flower Arrangement', keywords: ['floral', 'flower', 'arrangement', 'decor'] },
      { emoji: '💐', name: 'Bouquet', keywords: ['bouquet', 'floral', 'wedding', 'flowers'] },
      { emoji: '🎍', name: 'Bamboo Piece', keywords: ['foliage', 'greenery', 'floral', 'bamboo'] },
      { emoji: '🌿', name: 'Eucalyptus', keywords: ['foliage', 'greenery', 'floral', 'nature'] },
      { emoji: '🍃', name: 'Vine', keywords: ['vine', 'greenery', 'floral', 'nature'] },
      { emoji: '🥀', name: 'Dried Floral', keywords: ['wilted', 'flower', 'dried', 'rustic'] },
      { emoji: '🌺', name: 'Tropical Flower', keywords: ['hibiscus', 'flower', 'tropical', 'floral'] },
      { emoji: '🌻', name: 'Sunflower', keywords: ['sunflower', 'flower', 'rustic', 'yellow'] },
      { emoji: '🧵', name: 'Table Runner', keywords: ['runner', 'linen', 'cloth', 'table', 'textile'] },
      { emoji: '🧺', name: 'Table Linen', keywords: ['linen', 'cloth', 'basket', 'textile'] },
      { emoji: '🪧', name: 'Welcome Sign', keywords: ['sign', 'welcome', 'signage', 'decor'] },
      { emoji: '📜', name: 'Scroll/Guest Sign', keywords: ['sign', 'guest', 'scroll', 'signage'] },
      { emoji: '📋', name: 'Menu Card', keywords: ['menu', 'signage', 'table', 'info'] },
      { emoji: '🔢', name: 'Table Number', keywords: ['number', 'table', 'signage', 'identifier'] },
      { emoji: '✍️', name: 'Handwritten Sign', keywords: ['sign', 'handwriting', 'calligraphy', 'decor'] },
      { emoji: '⛩️', name: 'Ceremony Arch', keywords: ['arch', 'arbor', 'ceremony', 'entrance'] },
      { emoji: '🖼️', name: 'Photo Backdrop', keywords: ['frame', 'backdrop', 'wall', 'photo booth'] },
      { emoji: '🚶', name: 'Aisle Runner', keywords: ['aisle', 'runner', 'walkway', 'carpet'] },
      { emoji: '🏛️', name: 'Architectural Pillar', keywords: ['column', 'pillar', 'pedestal', 'architectural'] },
      { emoji: '💎', name: 'Gemstone Decor', keywords: ['gem', 'diamond', 'jewel', 'engagement', 'sparkle'] },
      { emoji: '🛋️', name: 'Lounge Sofa', keywords: ['couch', 'sofa', 'furniture', 'lounge'] },
      { emoji: '🪑', name: 'Chiavari Chair', keywords: ['chair', 'seat', 'seating', 'folding', 'basic'] },
      { emoji: '🎀', name: 'Silk Ribbon', keywords: ['ribbon', 'bow', 'decoration', 'gift'] },
      { emoji: '🎈', name: 'Event Balloon', keywords: ['balloon', 'party', 'decoration', 'celebration'] },
      { emoji: '🎊', name: 'Confetti Ball', keywords: ['confetti', 'celebration', 'party', 'wedding'] },
      { emoji: '🪄', name: 'Sparkle Wand', keywords: ['magic', 'sparkle', 'decor'] },
      { emoji: '🎁', name: 'Gift Box', keywords: ['gift', 'present', 'box', 'wedding'] },
      { emoji: '📸', name: 'Photo Station', keywords: ['camera', 'photo', 'picture', 'memory'] },
      { emoji: '🎵', name: 'Musical Decor', keywords: ['music', 'note', 'sound', 'entertainment'] },
      { emoji: '🎤', name: 'Microphone Stand', keywords: ['mic', 'speech', 'ceremony', 'audio'] },
    ]
  },
  {
    name: 'Flowers & Plants',
    icon: '🌸',
    emojis: [
      { emoji: '🌸', name: 'Cherry Blossom', keywords: ['cherry', 'blossom', 'flower', 'pink', 'spring'] },
      { emoji: '🌹', name: 'Rose', keywords: ['rose', 'flower', 'red', 'romantic', 'love'] },
      { emoji: '🌷', name: 'Tulip', keywords: ['tulip', 'flower', 'spring', 'garden'] },
      { emoji: '🌺', name: 'Hibiscus', keywords: ['hibiscus', 'flower', 'tropical', 'pink'] },
      { emoji: '🌻', name: 'Sunflower', keywords: ['sunflower', 'flower', 'yellow', 'summer', 'rustic'] },
      { emoji: '🌼', name: 'Blossom', keywords: ['blossom', 'flower', 'daisy', 'white', 'yellow'] },
      { emoji: '💮', name: 'White Flower', keywords: ['flower', 'white', 'pure', 'decoration'] },
      { emoji: '🏵️', name: 'Rosette', keywords: ['rosette', 'flower', 'decoration', 'award'] },
      { emoji: '🪻', name: 'Hyacinth', keywords: ['hyacinth', 'flower', 'purple', 'spring'] },
      { emoji: '🪷', name: 'Lotus', keywords: ['lotus', 'flower', 'pink', 'water', 'zen'] },
      { emoji: '🌾', name: 'Sheaf of Rice', keywords: ['wheat', 'grain', 'rustic', 'farm', 'harvest'] },
      { emoji: '🌿', name: 'Herb', keywords: ['herb', 'greenery', 'leaf', 'plant', 'eucalyptus'] },
      { emoji: '☘️', name: 'Shamrock', keywords: ['shamrock', 'clover', 'green', 'luck'] },
      { emoji: '🍀', name: 'Four Leaf Clover', keywords: ['clover', 'luck', 'green', 'lucky'] },
      { emoji: '🍃', name: 'Leaf Fluttering', keywords: ['leaf', 'leaves', 'wind', 'green', 'nature'] },
      { emoji: '🍂', name: 'Fallen Leaf', keywords: ['leaf', 'autumn', 'fall', 'orange', 'rustic'] },
      { emoji: '🍁', name: 'Maple Leaf', keywords: ['maple', 'leaf', 'autumn', 'fall', 'red'] },
      { emoji: '🌴', name: 'Palm Tree', keywords: ['palm', 'tree', 'tropical', 'beach', 'destination'] },
      { emoji: '🌳', name: 'Deciduous Tree', keywords: ['tree', 'oak', 'garden', 'outdoor', 'nature'] },
      { emoji: '🌲', name: 'Evergreen Tree', keywords: ['pine', 'tree', 'forest', 'winter', 'christmas'] },
      { emoji: '🪴', name: 'Potted Plant', keywords: ['plant', 'pot', 'indoor', 'decoration', 'greenery'] },
      { emoji: '🌵', name: 'Cactus', keywords: ['cactus', 'desert', 'succulent', 'southwestern'] },
      { emoji: '🎋', name: 'Tanabata Tree', keywords: ['bamboo', 'tree', 'decoration', 'asian'] },
      { emoji: '🎍', name: 'Pine Decoration', keywords: ['pine', 'decoration', 'bamboo', 'asian'] },
    ]
  },
  {
    name: 'Chairs & Seating',
    icon: '🪑',
    emojis: [
      { emoji: '🪑', name: 'Chair', keywords: ['chair', 'seat', 'seating', 'folding', 'basic'] },
      { emoji: '💺', name: 'Seat', keywords: ['seat', 'chair', 'theater', 'cushion', 'padded'] },
      { emoji: '🛋️', name: 'Couch', keywords: ['couch', 'sofa', 'lounge', 'loveseat', 'seating'] },
      { emoji: '🏛️', name: 'Chiavari Chair', keywords: ['chiavari', 'ballroom', 'elegant', 'gold', 'classic'] },
      { emoji: '👑', name: 'Throne', keywords: ['throne', 'royal', 'king', 'queen', 'sweetheart'] },
      { emoji: '🎭', name: 'Theater Seats', keywords: ['theater', 'ceremony', 'row', 'seating'] },
      { emoji: '⬜', name: 'White Chair', keywords: ['white', 'plastic', 'resin', 'chair', 'garden'] },
      { emoji: '⬛', name: 'Black Chair', keywords: ['black', 'folding', 'chair', 'formal'] },
      { emoji: '🟫', name: 'Wood Chair', keywords: ['wood', 'wooden', 'farm', 'rustic', 'chair'] },
      { emoji: '🪵', name: 'Bench', keywords: ['bench', 'wood', 'rustic', 'pew', 'seating'] },
      { emoji: '🩶', name: 'Silver Chair', keywords: ['silver', 'metal', 'gray', 'modern', 'chair'] },
      { emoji: '🔲', name: 'Ghost Chair', keywords: ['ghost', 'clear', 'acrylic', 'transparent', 'modern'] },
      { emoji: '✨', name: 'Gold Chiavari', keywords: ['gold', 'chiavari', 'elegant', 'ballroom'] },
      { emoji: '🪶', name: 'Wingback Chair', keywords: ['wingback', 'accent', 'lounge', 'elegant'] },
      { emoji: '🛡️', name: 'Cross Back Chair', keywords: ['cross', 'back', 'x-back', 'vineyard', 'rustic'] },
      { emoji: '⭕', name: 'Round Back Chair', keywords: ['round', 'back', 'louis', 'french', 'elegant'] },
      { emoji: '🔷', name: 'Blue Velvet Chair', keywords: ['blue', 'velvet', 'accent', 'elegant'] },
      { emoji: '🟣', name: 'Purple Velvet Chair', keywords: ['purple', 'velvet', 'accent', 'royal'] },
      { emoji: '🟢', name: 'Sage Chair', keywords: ['sage', 'green', 'garden', 'natural'] },
      { emoji: '🟡', name: 'Gold Chair', keywords: ['gold', 'yellow', 'elegant', 'ballroom'] },
      { emoji: '🪺', name: 'Egg Chair', keywords: ['egg', 'papasan', 'lounge', 'modern'] },
      { emoji: '🧶', name: 'Wicker Chair', keywords: ['wicker', 'rattan', 'boho', 'natural'] },
      { emoji: '🎪', name: 'Event Seating', keywords: ['event', 'tent', 'seating', 'outdoor'] },
      { emoji: '🏖️', name: 'Beach Chair', keywords: ['beach', 'destination', 'outdoor', 'casual'] },
    ]
  },
  {
    name: 'Tables & Furniture',
    icon: '🪑',
    emojis: [
      { emoji: '⭕', name: 'Round Table', keywords: ['round', 'table', 'circular', 'dining'] },
      { emoji: '⬜', name: 'Square Table', keywords: ['square', 'table', 'rectangular'] },
      { emoji: '▬', name: 'Rectangle Table', keywords: ['rectangle', 'table', 'banquet', 'long'] },
      { emoji: '🔶', name: 'Head Table', keywords: ['head', 'table', 'sweetheart', 'main'] },
      { emoji: '🍽️', name: 'Dining Table', keywords: ['dining', 'table', 'plate', 'dinner'] },
      { emoji: '🪞', name: 'Mirror/Glass Table', keywords: ['mirror', 'glass', 'table', 'elegant'] },
      { emoji: '🗄️', name: 'Cabinet', keywords: ['cabinet', 'storage', 'furniture'] },
      { emoji: '🚪', name: 'Door', keywords: ['door', 'entrance', 'exit', 'entry'] },
      { emoji: '🪟', name: 'Window', keywords: ['window', 'glass', 'view', 'light'] },
      { emoji: '🛏️', name: 'Bed', keywords: ['bed', 'lodging', 'bedroom', 'suite'] },
      { emoji: '🪔', name: 'Diya Lamp', keywords: ['lamp', 'candle', 'light', 'decoration'] },
      { emoji: '🏮', name: 'Lantern', keywords: ['lantern', 'light', 'decoration', 'asian'] },
      { emoji: '💡', name: 'Light Bulb', keywords: ['light', 'bulb', 'idea', 'edison', 'string lights'] },
      { emoji: '🔌', name: 'Outlet', keywords: ['outlet', 'electric', 'power', 'plug'] },
      { emoji: '🪤', name: 'Coat Check', keywords: ['coat', 'check', 'storage'] },
      { emoji: '🏺', name: 'Vase', keywords: ['vase', 'vases', 'floral', 'decor'] },
      { emoji: '🏺', name: 'Bud Vase', keywords: ['vase', 'small', 'floral', 'decor'] },
      { emoji: '🕯️', name: 'Candlestick', keywords: ['candle', 'candlestick', 'lighting', 'taper'] },
      { emoji: '🕯️', name: 'Taper Candle', keywords: ['candle', 'taper', 'decor'] },
      { emoji: '🕯️', name: 'Votive Candle', keywords: ['candle', 'small', 'decor'] },
      { emoji: '🔥', name: 'Pillar Candle', keywords: ['candle', 'pillar', 'decor'] },
      { emoji: '🏮', name: 'Lantern', keywords: ['lantern', 'light', 'lighting', 'decor'] },
      { emoji: '🧵', name: 'Table Runner', keywords: ['runner', 'linen', 'cloth', 'table'] },
      { emoji: '🧺', name: 'Linen', keywords: ['linen', 'cloth', 'basket', 'decor'] },
      { emoji: '🪧', name: 'Welcome Sign', keywords: ['sign', 'welcome', 'signage', 'decor'] },
      { emoji: '📜', name: 'Guest Sign', keywords: ['sign', 'guest', 'scroll', 'signage'] },
      { emoji: '📜', name: 'Menu Card', keywords: ['menu', 'signage', 'table', 'decor'] },
      { emoji: '🔢', name: 'Table Number', keywords: ['number', 'table', 'signage'] },
      { emoji: '🎍', name: 'Floral Arrangement', keywords: ['floral', 'arrangement', 'centerpiece', 'decor'] },
      { emoji: '💐', name: 'Bouquet', keywords: ['bouquet', 'floral', 'wedding', 'decor'] },
      { emoji: '🌸', name: 'Floral Piece', keywords: ['floral', 'flower', 'piece', 'decor'] },
      { emoji: '✨', name: 'Sparkles', keywords: ['sparkles', 'magic', 'accent', 'decor'] },
      { emoji: '💎', name: 'Gem', keywords: ['gem', 'diamond', 'crystal', 'decor'] },
      { emoji: '🪞', name: 'Mirror', keywords: ['mirror', 'reflection', 'glass', 'decor'] },
      { emoji: '🏮', name: 'Paper Lantern', keywords: ['lantern', 'paper', 'lighting', 'decor'] },
      { emoji: '🪴', name: 'Floor Plant', keywords: ['plant', 'potted', 'decor'] },
      { emoji: '🌿', name: 'Greenery', keywords: ['foliage', 'greenery', 'floral', 'decor'] },
      { emoji: '🧺', name: 'Bread Basket', keywords: ['basket', 'food', 'table', 'decor'] },
      { emoji: '🧂', name: 'Salt & Pepper', keywords: ['salt', 'pepper', 'shaker', 'table', 'decor'] },
    ]
  },
  {
    name: 'Food & Drinks',
    icon: '🎂',
    emojis: [
      { emoji: '🎂', name: 'Birthday Cake', keywords: ['cake', 'wedding', 'dessert', 'celebration'] },
      { emoji: '🍰', name: 'Cake Slice', keywords: ['cake', 'slice', 'dessert', 'wedding'] },
      { emoji: '🧁', name: 'Cupcake', keywords: ['cupcake', 'dessert', 'sweet', 'treat'] },
      { emoji: '🍩', name: 'Donut', keywords: ['donut', 'dessert', 'sweet', 'breakfast'] },
      { emoji: '🍪', name: 'Cookie', keywords: ['cookie', 'dessert', 'sweet', 'favor'] },
      { emoji: '🍫', name: 'Chocolate', keywords: ['chocolate', 'candy', 'sweet', 'dessert'] },
      { emoji: '🍬', name: 'Candy', keywords: ['candy', 'sweet', 'favor', 'dessert'] },
      { emoji: '🍭', name: 'Lollipop', keywords: ['lollipop', 'candy', 'sweet', 'colorful'] },
      { emoji: '🍷', name: 'Wine Glass', keywords: ['wine', 'glass', 'red', 'drink', 'bar'] },
      { emoji: '🥂', name: 'Champagne', keywords: ['champagne', 'toast', 'celebration', 'cheers'] },
      { emoji: '🍾', name: 'Champagne Bottle', keywords: ['champagne', 'bottle', 'celebration'] },
      { emoji: '🍸', name: 'Cocktail', keywords: ['cocktail', 'martini', 'drink', 'bar'] },
      { emoji: '🍹', name: 'Tropical Drink', keywords: ['tropical', 'drink', 'cocktail', 'beach'] },
      { emoji: '🥤', name: 'Cup with Straw', keywords: ['cup', 'drink', 'beverage', 'refreshment'] },
      { emoji: '☕', name: 'Coffee', keywords: ['coffee', 'drink', 'cafe', 'hot', 'espresso'] },
      { emoji: '🫖', name: 'Teapot', keywords: ['tea', 'teapot', 'drink', 'afternoon'] },
      { emoji: '🍵', name: 'Tea', keywords: ['tea', 'cup', 'drink', 'hot'] },
      { emoji: '🧃', name: 'Juice Box', keywords: ['juice', 'drink', 'kids', 'beverage'] },
      { emoji: '🍴', name: 'Fork and Knife', keywords: ['utensils', 'dining', 'dinner', 'meal'] },
      { emoji: '🍽️', name: 'Plate', keywords: ['plate', 'dinner', 'dining', 'meal'] },
      { emoji: '🥗', name: 'Salad', keywords: ['salad', 'food', 'healthy', 'appetizer'] },
      { emoji: '🍕', name: 'Pizza', keywords: ['pizza', 'food', 'casual', 'late night'] },
      { emoji: '🍔', name: 'Burger', keywords: ['burger', 'food', 'casual', 'slider'] },
      { emoji: '🌮', name: 'Taco', keywords: ['taco', 'food', 'mexican', 'casual'] },
      { emoji: '🧀', name: 'Cheese', keywords: ['cheese', 'appetizer', 'charcuterie'] },
      { emoji: '🥐', name: 'Croissant', keywords: ['croissant', 'pastry', 'breakfast', 'brunch'] },
      { emoji: '🥖', name: 'Baguette', keywords: ['bread', 'baguette', 'french', 'bakery'] },
      { emoji: '🍇', name: 'Grapes', keywords: ['grapes', 'fruit', 'wine', 'vineyard'] },
      { emoji: '🍓', name: 'Strawberry', keywords: ['strawberry', 'fruit', 'dessert', 'chocolate'] },
      { emoji: '🫐', name: 'Blueberries', keywords: ['blueberry', 'fruit', 'berry'] },
    ]
  },
  {
    name: 'Music & Entertainment',
    icon: '🎵',
    emojis: [
      { emoji: '🎵', name: 'Musical Note', keywords: ['music', 'note', 'song', 'dj'] },
      { emoji: '🎶', name: 'Musical Notes', keywords: ['music', 'notes', 'song', 'melody'] },
      { emoji: '🎤', name: 'Microphone', keywords: ['microphone', 'mic', 'speech', 'toast', 'karaoke'] },
      { emoji: '🎧', name: 'Headphones', keywords: ['headphones', 'music', 'dj', 'audio'] },
      { emoji: '🎹', name: 'Piano', keywords: ['piano', 'music', 'keyboard', 'instrument'] },
      { emoji: '🎸', name: 'Guitar', keywords: ['guitar', 'music', 'band', 'acoustic'] },
      { emoji: '🎺', name: 'Trumpet', keywords: ['trumpet', 'music', 'band', 'brass'] },
      { emoji: '🎻', name: 'Violin', keywords: ['violin', 'music', 'string', 'quartet'] },
      { emoji: '🥁', name: 'Drum', keywords: ['drum', 'music', 'band', 'percussion'] },
      { emoji: '🎷', name: 'Saxophone', keywords: ['saxophone', 'music', 'jazz', 'band'] },
      { emoji: '💃', name: 'Dancing Woman', keywords: ['dance', 'dancing', 'woman', 'party'] },
      { emoji: '🕺', name: 'Dancing Man', keywords: ['dance', 'dancing', 'man', 'party'] },
      { emoji: '👯', name: 'People Dancing', keywords: ['dance', 'people', 'party', 'group'] },
      { emoji: '🪩', name: 'Disco Ball', keywords: ['disco', 'ball', 'dance', 'party', 'lights'] },
      { emoji: '🎬', name: 'Clapperboard', keywords: ['movie', 'film', 'video', 'action'] },
      { emoji: '📽️', name: 'Film Projector', keywords: ['projector', 'movie', 'slideshow', 'memories'] },
      { emoji: '🎭', name: 'Theater Masks', keywords: ['theater', 'drama', 'performance', 'entertainment'] },
      { emoji: '🎪', name: 'Circus Tent', keywords: ['tent', 'circus', 'event', 'entertainment'] },
      { emoji: '🎠', name: 'Carousel', keywords: ['carousel', 'merry-go-round', 'fun', 'carnival'] },
      { emoji: '🎡', name: 'Ferris Wheel', keywords: ['ferris', 'wheel', 'carnival', 'fair'] },
    ]
  },
  {
    name: 'Photography & Media',
    icon: '📷',
    emojis: [
      { emoji: '📷', name: 'Camera', keywords: ['camera', 'photo', 'photography', 'picture'] },
      { emoji: '📸', name: 'Camera Flash', keywords: ['camera', 'flash', 'photo', 'selfie'] },
      { emoji: '🎥', name: 'Video Camera', keywords: ['video', 'camera', 'film', 'recording'] },
      { emoji: '📹', name: 'Camcorder', keywords: ['video', 'camcorder', 'recording', 'memory'] },
      { emoji: '📺', name: 'Television', keywords: ['tv', 'screen', 'display', 'slideshow'] },
      { emoji: '🖼️', name: 'Frame', keywords: ['frame', 'picture', 'photo', 'art', 'display'] },
      { emoji: '🖥️', name: 'Computer Screen', keywords: ['screen', 'display', 'slideshow', 'monitor'] },
      { emoji: '📱', name: 'Mobile Phone', keywords: ['phone', 'mobile', 'selfie', 'social'] },
      { emoji: '🔊', name: 'Speaker High', keywords: ['speaker', 'sound', 'audio', 'loud'] },
      { emoji: '📢', name: 'Loudspeaker', keywords: ['speaker', 'announcement', 'loud', 'audio'] },
      { emoji: '🎙️', name: 'Studio Microphone', keywords: ['microphone', 'studio', 'podcast', 'recording'] },
      { emoji: '💻', name: 'Laptop', keywords: ['laptop', 'computer', 'slideshow', 'presentation'] },
      { emoji: '🪞', name: 'Mirror', keywords: ['mirror', 'reflection', 'booth', 'photo'] },
      { emoji: '📿', name: 'Prayer Beads', keywords: ['props', 'accessories', 'booth'] },
    ]
  },
  {
    name: 'Venues & Buildings',
    icon: '🏰',
    emojis: [
      { emoji: '🏰', name: 'Castle', keywords: ['castle', 'venue', 'fairytale', 'palace'] },
      { emoji: '⛪', name: 'Church', keywords: ['church', 'chapel', 'ceremony', 'religious'] },
      { emoji: '🕌', name: 'Mosque', keywords: ['mosque', 'religious', 'ceremony'] },
      { emoji: '🕍', name: 'Synagogue', keywords: ['synagogue', 'religious', 'ceremony'] },
      { emoji: '🛕', name: 'Temple', keywords: ['temple', 'hindu', 'religious', 'ceremony'] },
      { emoji: '💒', name: 'Wedding Chapel', keywords: ['wedding', 'chapel', 'ceremony', 'venue'] },
      { emoji: '🏛️', name: 'Classical Building', keywords: ['building', 'classical', 'venue', 'elegant'] },
      { emoji: '🏨', name: 'Hotel', keywords: ['hotel', 'lodging', 'accommodation', 'venue'] },
      { emoji: '🏡', name: 'House with Garden', keywords: ['house', 'garden', 'venue', 'backyard'] },
      { emoji: '🏠', name: 'House', keywords: ['house', 'home', 'venue', 'residence'] },
      { emoji: '🏩', name: 'Love Hotel', keywords: ['hotel', 'honeymoon', 'romantic'] },
      { emoji: '⛲', name: 'Fountain', keywords: ['fountain', 'water', 'garden', 'feature'] },
      { emoji: '🗼', name: 'Tower', keywords: ['tower', 'landmark', 'eiffel', 'destination'] },
      { emoji: '🌉', name: 'Bridge at Night', keywords: ['bridge', 'night', 'scenic', 'photo'] },
      { emoji: '🏞️', name: 'National Park', keywords: ['park', 'nature', 'outdoor', 'scenic'] },
      { emoji: '🏕️', name: 'Camping', keywords: ['tent', 'outdoor', 'glamping', 'rustic'] },
      { emoji: '⛺', name: 'Tent', keywords: ['tent', 'outdoor', 'camping', 'reception'] },
      { emoji: '🏖️', name: 'Beach', keywords: ['beach', 'destination', 'ocean', 'seaside'] },
      { emoji: '🌅', name: 'Sunrise', keywords: ['sunrise', 'sunset', 'beach', 'scenic'] },
      { emoji: '🌄', name: 'Mountain Sunrise', keywords: ['mountain', 'sunrise', 'scenic', 'outdoor'] },
      { emoji: '🏔️', name: 'Mountain', keywords: ['mountain', 'outdoor', 'scenic', 'destination'] },
    ]
  },
  {
    name: 'Outdoor & Nature',
    icon: '🌳',
    emojis: [
      { emoji: '🌳', name: 'Tree', keywords: ['tree', 'oak', 'outdoor', 'garden', 'nature'] },
      { emoji: '🌲', name: 'Evergreen', keywords: ['pine', 'evergreen', 'forest', 'christmas'] },
      { emoji: '🌴', name: 'Palm Tree', keywords: ['palm', 'tropical', 'beach', 'destination'] },
      { emoji: '🪨', name: 'Rock', keywords: ['rock', 'stone', 'boulder', 'landscape'] },
      { emoji: '🏞️', name: 'Park', keywords: ['park', 'nature', 'landscape', 'scenic'] },
      { emoji: '🏕️', name: 'Campsite', keywords: ['camp', 'outdoor', 'tent', 'rustic'] },
      { emoji: '⛱️', name: 'Umbrella', keywords: ['umbrella', 'beach', 'shade', 'sun'] },
      { emoji: '🌊', name: 'Wave', keywords: ['wave', 'ocean', 'beach', 'water'] },
      { emoji: '💧', name: 'Droplet', keywords: ['water', 'droplet', 'fountain', 'rain'] },
      { emoji: '🌧️', name: 'Rain', keywords: ['rain', 'weather', 'cloud', 'water'] },
      { emoji: '⛅', name: 'Sun Behind Cloud', keywords: ['sun', 'cloud', 'weather', 'outdoor'] },
      { emoji: '☀️', name: 'Sun', keywords: ['sun', 'sunny', 'bright', 'outdoor'] },
      { emoji: '🌙', name: 'Moon', keywords: ['moon', 'night', 'evening', 'romantic'] },
      { emoji: '⭐', name: 'Star', keywords: ['star', 'night', 'twinkle', 'decoration'] },
      { emoji: '🌟', name: 'Glowing Star', keywords: ['star', 'glowing', 'sparkle', 'decoration'] },
      { emoji: '💫', name: 'Dizzy Star', keywords: ['star', 'sparkle', 'magic', 'twinkle'] },
      { emoji: '🦋', name: 'Butterfly', keywords: ['butterfly', 'garden', 'nature', 'spring'] },
      { emoji: '🐝', name: 'Bee', keywords: ['bee', 'garden', 'flower', 'nature'] },
      { emoji: '🐦', name: 'Bird', keywords: ['bird', 'nature', 'outdoor', 'garden'] },
      { emoji: '🦆', name: 'Duck', keywords: ['duck', 'pond', 'water', 'garden'] },
      { emoji: '🐇', name: 'Rabbit', keywords: ['rabbit', 'bunny', 'garden', 'spring'] },
      { emoji: '🌈', name: 'Rainbow', keywords: ['rainbow', 'colorful', 'weather', 'luck'] },
      { emoji: '❄️', name: 'Snowflake', keywords: ['snow', 'winter', 'cold', 'frozen'] },
      { emoji: '🔥', name: 'Fire', keywords: ['fire', 'flame', 'firepit', 'heat', 'warmth'] },
    ]
  },
  {
    name: 'Decorations',
    icon: '🎀',
    emojis: [
      { emoji: '🎀', name: 'Ribbon', keywords: ['ribbon', 'bow', 'decoration', 'gift'] },
      { emoji: '🎁', name: 'Gift', keywords: ['gift', 'present', 'wrapped', 'favor'] },
      { emoji: '🎈', name: 'Balloon', keywords: ['balloon', 'party', 'decoration', 'celebration'] },
      { emoji: '🎊', name: 'Confetti Ball', keywords: ['confetti', 'celebration', 'party'] },
      { emoji: '🎉', name: 'Party Popper', keywords: ['party', 'popper', 'celebration', 'confetti'] },
      { emoji: '🕯️', name: 'Candle', keywords: ['candle', 'light', 'romantic', 'centerpiece'] },
      { emoji: '🪔', name: 'Diya Lamp', keywords: ['lamp', 'candle', 'light', 'decoration'] },
      { emoji: '🏮', name: 'Red Lantern', keywords: ['lantern', 'light', 'decoration', 'asian'] },
      { emoji: '🪩', name: 'Mirror Ball', keywords: ['disco', 'ball', 'mirror', 'dance', 'party'] },
      { emoji: '💎', name: 'Gem', keywords: ['gem', 'diamond', 'crystal', 'decoration', 'sparkle'] },
      { emoji: '📿', name: 'Beads', keywords: ['beads', 'decoration', 'garland', 'string'] },
      { emoji: '🧵', name: 'Thread', keywords: ['thread', 'ribbon', 'sewing', 'craft'] },
      { emoji: '🪡', name: 'Sewing Needle', keywords: ['needle', 'sewing', 'craft', 'alterations'] },
      { emoji: '🧶', name: 'Yarn', keywords: ['yarn', 'knit', 'craft', 'decoration'] },
      { emoji: '🎐', name: 'Wind Chime', keywords: ['wind', 'chime', 'decoration', 'sound'] },
      { emoji: '🎏', name: 'Carp Streamer', keywords: ['streamer', 'flag', 'decoration', 'wind'] },
      { emoji: '🎑', name: 'Moon Viewing', keywords: ['moon', 'viewing', 'ceremony', 'asian'] },
      { emoji: '🧿', name: 'Evil Eye', keywords: ['eye', 'amulet', 'protection', 'decoration'] },
      { emoji: '📜', name: 'Scroll', keywords: ['scroll', 'menu', 'program', 'invitation'] },
      { emoji: '✉️', name: 'Envelope', keywords: ['envelope', 'invitation', 'mail', 'card'] },
      { emoji: '💌', name: 'Love Letter', keywords: ['love', 'letter', 'heart', 'invitation', 'card'] },
      { emoji: '📋', name: 'Clipboard', keywords: ['clipboard', 'checklist', 'planning', 'list'] },
      { emoji: '🏷️', name: 'Tag', keywords: ['tag', 'label', 'place card', 'favor'] },
      { emoji: '🔖', name: 'Bookmark', keywords: ['bookmark', 'program', 'menu', 'card'] },
    ]
  },
  {
    name: 'Transportation',
    icon: '🚗',
    emojis: [
      { emoji: '🚗', name: 'Car', keywords: ['car', 'getaway', 'transport', 'vehicle'] },
      { emoji: '🚙', name: 'SUV', keywords: ['suv', 'car', 'transport', 'vehicle'] },
      { emoji: '🚕', name: 'Taxi', keywords: ['taxi', 'cab', 'transport', 'ride'] },
      { emoji: '🚌', name: 'Bus', keywords: ['bus', 'shuttle', 'transport', 'guest'] },
      { emoji: '🚐', name: 'Minibus', keywords: ['minibus', 'van', 'shuttle', 'transport'] },
      { emoji: '🚎', name: 'Trolleybus', keywords: ['trolley', 'bus', 'vintage', 'transport'] },
      { emoji: '🏎️', name: 'Racing Car', keywords: ['sports car', 'luxury', 'getaway'] },
      { emoji: '🚓', name: 'Police Car', keywords: ['escort', 'police', 'security'] },
      { emoji: '🚑', name: 'Ambulance', keywords: ['ambulance', 'medical', 'emergency'] },
      { emoji: '🚒', name: 'Fire Engine', keywords: ['fire', 'truck', 'emergency'] },
      { emoji: '🛻', name: 'Pickup Truck', keywords: ['truck', 'pickup', 'rustic', 'farm'] },
      { emoji: '🚜', name: 'Tractor', keywords: ['tractor', 'farm', 'rustic', 'country'] },
      { emoji: '🏍️', name: 'Motorcycle', keywords: ['motorcycle', 'bike', 'getaway'] },
      { emoji: '🛵', name: 'Scooter', keywords: ['scooter', 'vespa', 'getaway', 'vintage'] },
      { emoji: '🚲', name: 'Bicycle', keywords: ['bicycle', 'bike', 'decoration', 'vintage'] },
      { emoji: '🛴', name: 'Kick Scooter', keywords: ['scooter', 'fun', 'photo'] },
      { emoji: '🚁', name: 'Helicopter', keywords: ['helicopter', 'arrival', 'departure', 'luxury'] },
      { emoji: '✈️', name: 'Airplane', keywords: ['airplane', 'plane', 'destination', 'honeymoon'] },
      { emoji: '🛩️', name: 'Small Plane', keywords: ['plane', 'private', 'luxury', 'charter'] },
      { emoji: '🚀', name: 'Rocket', keywords: ['rocket', 'space', 'departure', 'future'] },
      { emoji: '⛵', name: 'Sailboat', keywords: ['sailboat', 'boat', 'yacht', 'water', 'nautical'] },
      { emoji: '🚤', name: 'Speedboat', keywords: ['speedboat', 'boat', 'water', 'getaway'] },
      { emoji: '🛥️', name: 'Motorboat', keywords: ['boat', 'motorboat', 'yacht', 'water'] },
      { emoji: '🚢', name: 'Ship', keywords: ['ship', 'cruise', 'boat', 'water'] },
      { emoji: '🛳️', name: 'Cruise Ship', keywords: ['cruise', 'ship', 'honeymoon', 'vacation'] },
      { emoji: '🚂', name: 'Train', keywords: ['train', 'vintage', 'transport', 'romantic'] },
      { emoji: '🚃', name: 'Railway Car', keywords: ['train', 'car', 'transport', 'romantic'] },
      { emoji: '🚄', name: 'High Speed Train', keywords: ['train', 'fast', 'modern', 'transport'] },
      { emoji: '🎠', name: 'Carousel Horse', keywords: ['carousel', 'horse', 'vintage', 'whimsical'] },
      { emoji: '🐴', name: 'Horse', keywords: ['horse', 'carriage', 'riding', 'country'] },
      { emoji: '🐎', name: 'Racing Horse', keywords: ['horse', 'racing', 'elegant'] },
      { emoji: '🦓', name: 'Zebra', keywords: ['zebra', 'safari', 'unique', 'destination'] },
      { emoji: '🫏', name: 'Donkey', keywords: ['donkey', 'beer burrow', 'beverage', 'service'] },
      { emoji: '🐪', name: 'Camel', keywords: ['camel', 'desert', 'destination', 'unique'] },
    ]
  },
  {
    name: 'People & Attire',
    icon: '👗',
    emojis: [
      { emoji: '👗', name: 'Dress', keywords: ['dress', 'gown', 'wedding', 'attire'] },
      { emoji: '👰', name: 'Person with Veil', keywords: ['bride', 'veil', 'wedding'] },
      { emoji: '🤵', name: 'Person in Tuxedo', keywords: ['groom', 'tuxedo', 'formal'] },
      { emoji: '👠', name: 'High Heel', keywords: ['heel', 'shoe', 'bride', 'formal'] },
      { emoji: '👡', name: 'Sandal', keywords: ['sandal', 'shoe', 'summer', 'beach'] },
      { emoji: '👢', name: 'Boot', keywords: ['boot', 'shoe', 'country', 'western'] },
      { emoji: '👞', name: 'Man Shoe', keywords: ['shoe', 'dress shoe', 'formal', 'groom'] },
      { emoji: '👟', name: 'Sneaker', keywords: ['sneaker', 'casual', 'comfortable', 'dancing'] },
      { emoji: '👑', name: 'Crown', keywords: ['crown', 'tiara', 'royal', 'princess'] },
      { emoji: '💄', name: 'Lipstick', keywords: ['lipstick', 'makeup', 'beauty', 'bride'] },
      { emoji: '💅', name: 'Nail Polish', keywords: ['nail', 'polish', 'manicure', 'beauty'] },
      { emoji: '💍', name: 'Ring', keywords: ['ring', 'diamond', 'engagement', 'wedding'] },
      { emoji: '💎', name: 'Gem Stone', keywords: ['gem', 'diamond', 'jewelry', 'sparkle'] },
      { emoji: '📿', name: 'Necklace', keywords: ['necklace', 'beads', 'jewelry', 'accessory'] },
      { emoji: '👔', name: 'Necktie', keywords: ['tie', 'formal', 'groom', 'groomsman'] },
      { emoji: '🎩', name: 'Top Hat', keywords: ['hat', 'formal', 'groom', 'vintage'] },
      { emoji: '👒', name: 'Woman Hat', keywords: ['hat', 'sun hat', 'garden', 'elegant'] },
      { emoji: '🧢', name: 'Cap', keywords: ['cap', 'hat', 'casual', 'getting ready'] },
      { emoji: '🎓', name: 'Graduation Cap', keywords: ['graduation', 'cap', 'ceremony'] },
      { emoji: '🧥', name: 'Coat', keywords: ['coat', 'jacket', 'winter', 'formal'] },
      { emoji: '🧣', name: 'Scarf', keywords: ['scarf', 'winter', 'accessory', 'wrap'] },
      { emoji: '🧤', name: 'Gloves', keywords: ['gloves', 'formal', 'winter', 'accessory'] },
      { emoji: '🕶️', name: 'Sunglasses', keywords: ['sunglasses', 'shades', 'cool', 'outdoor'] },
      { emoji: '👓', name: 'Glasses', keywords: ['glasses', 'reading', 'toast', 'speech'] },
      { emoji: '🥻', name: 'Sari', keywords: ['sari', 'traditional', 'indian', 'cultural'] },
      { emoji: '🥿', name: 'Flat Shoe', keywords: ['flat', 'shoe', 'comfortable', 'dancing'] },
      { emoji: '👙', name: 'Bikini', keywords: ['bikini', 'beach', 'destination', 'honeymoon'] },
      { emoji: '🩱', name: 'One-Piece', keywords: ['swimsuit', 'beach', 'pool', 'honeymoon'] },
    ]
  },
  {
    name: 'Symbols & Shapes',
    icon: '⭐',
    emojis: [
      { emoji: '❤️', name: 'Red Heart', keywords: ['heart', 'red', 'love'] },
      { emoji: '🧡', name: 'Orange Heart', keywords: ['heart', 'orange', 'autumn'] },
      { emoji: '💛', name: 'Yellow Heart', keywords: ['heart', 'yellow', 'friendship'] },
      { emoji: '💚', name: 'Green Heart', keywords: ['heart', 'green', 'nature'] },
      { emoji: '💙', name: 'Blue Heart', keywords: ['heart', 'blue', 'something blue'] },
      { emoji: '💜', name: 'Purple Heart', keywords: ['heart', 'purple', 'elegant'] },
      { emoji: '🖤', name: 'Black Heart', keywords: ['heart', 'black', 'formal'] },
      { emoji: '🤍', name: 'White Heart', keywords: ['heart', 'white', 'pure', 'wedding'] },
      { emoji: '🩷', name: 'Pink Heart', keywords: ['heart', 'pink', 'blush'] },
      { emoji: '🩵', name: 'Light Blue Heart', keywords: ['heart', 'light blue', 'sky'] },
      { emoji: '🩶', name: 'Gray Heart', keywords: ['heart', 'gray', 'silver'] },
      { emoji: '🤎', name: 'Brown Heart', keywords: ['heart', 'brown', 'rustic'] },
      { emoji: '⭐', name: 'Star', keywords: ['star', 'yellow', 'rating'] },
      { emoji: '🌟', name: 'Glowing Star', keywords: ['star', 'glowing', 'sparkle'] },
      { emoji: '✨', name: 'Sparkles', keywords: ['sparkle', 'magic', 'glamour'] },
      { emoji: '💫', name: 'Dizzy', keywords: ['star', 'dizzy', 'sparkle'] },
      { emoji: '⚡', name: 'Lightning', keywords: ['lightning', 'bolt', 'power'] },
      { emoji: '🔴', name: 'Red Circle', keywords: ['red', 'circle', 'dot'] },
      { emoji: '🟠', name: 'Orange Circle', keywords: ['orange', 'circle', 'dot'] },
      { emoji: '🟡', name: 'Yellow Circle', keywords: ['yellow', 'circle', 'dot'] },
      { emoji: '🟢', name: 'Green Circle', keywords: ['green', 'circle', 'dot'] },
      { emoji: '🔵', name: 'Blue Circle', keywords: ['blue', 'circle', 'dot'] },
      { emoji: '🟣', name: 'Purple Circle', keywords: ['purple', 'circle', 'dot'] },
      { emoji: '🟤', name: 'Brown Circle', keywords: ['brown', 'circle', 'dot'] },
      { emoji: '⚫', name: 'Black Circle', keywords: ['black', 'circle', 'dot'] },
      { emoji: '⚪', name: 'White Circle', keywords: ['white', 'circle', 'dot'] },
      { emoji: '🟥', name: 'Red Square', keywords: ['red', 'square', 'box'] },
      { emoji: '🟧', name: 'Orange Square', keywords: ['orange', 'square', 'box'] },
      { emoji: '🟨', name: 'Yellow Square', keywords: ['yellow', 'square', 'box'] },
      { emoji: '🟩', name: 'Green Square', keywords: ['green', 'square', 'box'] },
      { emoji: '🟦', name: 'Blue Square', keywords: ['blue', 'square', 'box'] },
      { emoji: '🟪', name: 'Purple Square', keywords: ['purple', 'square', 'box'] },
      { emoji: '🟫', name: 'Brown Square', keywords: ['brown', 'square', 'box'] },
      { emoji: '⬛', name: 'Black Square', keywords: ['black', 'square', 'box'] },
      { emoji: '⬜', name: 'White Square', keywords: ['white', 'square', 'box'] },
      { emoji: '🔶', name: 'Orange Diamond', keywords: ['orange', 'diamond', 'shape'] },
      { emoji: '🔷', name: 'Blue Diamond', keywords: ['blue', 'diamond', 'shape'] },
      { emoji: '🔸', name: 'Small Orange Diamond', keywords: ['orange', 'diamond', 'small'] },
      { emoji: '🔹', name: 'Small Blue Diamond', keywords: ['blue', 'diamond', 'small'] },
      { emoji: '▪️', name: 'Black Small Square', keywords: ['black', 'square', 'small'] },
      { emoji: '▫️', name: 'White Small Square', keywords: ['white', 'square', 'small'] },
      { emoji: '◻️', name: 'White Medium Square', keywords: ['white', 'square', 'medium'] },
      { emoji: '◼️', name: 'Black Medium Square', keywords: ['black', 'square', 'medium'] },
      { emoji: '◽', name: 'White Medium-Small Square', keywords: ['white', 'square'] },
      { emoji: '◾', name: 'Black Medium-Small Square', keywords: ['black', 'square'] },
      { emoji: '🔲', name: 'Black Square Button', keywords: ['black', 'square', 'button'] },
      { emoji: '🔳', name: 'White Square Button', keywords: ['white', 'square', 'button'] },
      { emoji: '♠️', name: 'Spade', keywords: ['spade', 'card', 'suit'] },
      { emoji: '♥️', name: 'Heart Suit', keywords: ['heart', 'card', 'suit', 'red'] },
      { emoji: '♦️', name: 'Diamond Suit', keywords: ['diamond', 'card', 'suit', 'red'] },
      { emoji: '♣️', name: 'Club', keywords: ['club', 'card', 'suit'] },
    ]
  },
  {
    name: 'Signs & Arrows',
    icon: '➡️',
    emojis: [
      { emoji: '➡️', name: 'Right Arrow', keywords: ['arrow', 'right', 'direction', 'next'] },
      { emoji: '⬅️', name: 'Left Arrow', keywords: ['arrow', 'left', 'direction', 'back'] },
      { emoji: '⬆️', name: 'Up Arrow', keywords: ['arrow', 'up', 'direction'] },
      { emoji: '⬇️', name: 'Down Arrow', keywords: ['arrow', 'down', 'direction'] },
      { emoji: '↗️', name: 'Up-Right Arrow', keywords: ['arrow', 'diagonal', 'northeast'] },
      { emoji: '↘️', name: 'Down-Right Arrow', keywords: ['arrow', 'diagonal', 'southeast'] },
      { emoji: '↙️', name: 'Down-Left Arrow', keywords: ['arrow', 'diagonal', 'southwest'] },
      { emoji: '↖️', name: 'Up-Left Arrow', keywords: ['arrow', 'diagonal', 'northwest'] },
      { emoji: '↔️', name: 'Left-Right Arrow', keywords: ['arrow', 'horizontal', 'both'] },
      { emoji: '↕️', name: 'Up-Down Arrow', keywords: ['arrow', 'vertical', 'both'] },
      { emoji: '🔄', name: 'Counterclockwise Arrows', keywords: ['arrows', 'rotate', 'refresh'] },
      { emoji: '🔃', name: 'Clockwise Arrows', keywords: ['arrows', 'rotate', 'sync'] },
      { emoji: '✅', name: 'Check Mark', keywords: ['check', 'done', 'complete', 'yes'] },
      { emoji: '❌', name: 'Cross Mark', keywords: ['cross', 'no', 'wrong', 'cancel'] },
      { emoji: '❓', name: 'Question Mark', keywords: ['question', 'help', 'ask'] },
      { emoji: '❗', name: 'Exclamation Mark', keywords: ['exclamation', 'important', 'alert'] },
      { emoji: '‼️', name: 'Double Exclamation', keywords: ['exclamation', 'urgent', 'important'] },
      { emoji: '⁉️', name: 'Exclamation Question', keywords: ['question', 'exclamation', 'surprise'] },
      { emoji: '💯', name: 'Hundred Points', keywords: ['hundred', 'perfect', 'score'] },
      { emoji: '🔢', name: 'Input Numbers', keywords: ['numbers', 'input', 'keypad'] },
      { emoji: '🔠', name: 'Input Letters', keywords: ['letters', 'alphabet', 'input'] },
      { emoji: '🆗', name: 'OK Button', keywords: ['ok', 'okay', 'button', 'confirm'] },
      { emoji: '🆕', name: 'New Button', keywords: ['new', 'button', 'fresh'] },
      { emoji: '🆓', name: 'Free Button', keywords: ['free', 'button', 'complimentary'] },
      { emoji: '🚻', name: 'Restroom', keywords: ['restroom', 'bathroom', 'toilet', 'wc'] },
      { emoji: '🚺', name: "Women's Room", keywords: ['women', 'bathroom', 'restroom', 'ladies'] },
      { emoji: '🚹', name: "Men's Room", keywords: ['men', 'bathroom', 'restroom', 'gentlemen'] },
      { emoji: '🚼', name: 'Baby Symbol', keywords: ['baby', 'changing', 'station', 'nursery'] },
      { emoji: '♿', name: 'Wheelchair', keywords: ['wheelchair', 'accessible', 'disability', 'handicap'] },
      { emoji: '🅿️', name: 'Parking', keywords: ['parking', 'car', 'lot', 'space'] },
      { emoji: '🚭', name: 'No Smoking', keywords: ['no smoking', 'prohibited', 'sign'] },
      { emoji: '🚫', name: 'Prohibited', keywords: ['prohibited', 'no', 'not allowed', 'forbidden'] },
      { emoji: '⛔', name: 'No Entry', keywords: ['no entry', 'stop', 'prohibited'] },
      { emoji: '🔞', name: 'No One Under 18', keywords: ['adult', '18', 'restricted', 'bar'] },
      { emoji: '📵', name: 'No Mobile Phones', keywords: ['no phone', 'prohibited', 'unplugged'] },
      { emoji: '🔇', name: 'Muted Speaker', keywords: ['mute', 'silent', 'quiet', 'ceremony'] },
      { emoji: 'ℹ️', name: 'Information', keywords: ['info', 'information', 'help', 'desk'] },
    ]
  },
  {
    name: 'Hands & Gestures',
    icon: '👏',
    emojis: [
      { emoji: '👏', name: 'Clapping Hands', keywords: ['clap', 'applause', 'celebration'] },
      { emoji: '🙌', name: 'Raising Hands', keywords: ['hands', 'celebration', 'hooray'] },
      { emoji: '👐', name: 'Open Hands', keywords: ['hands', 'open', 'welcome'] },
      { emoji: '🤲', name: 'Palms Up', keywords: ['palms', 'up', 'prayer', 'offering'] },
      { emoji: '🤝', name: 'Handshake', keywords: ['handshake', 'deal', 'greeting', 'agreement'] },
      { emoji: '🙏', name: 'Folded Hands', keywords: ['pray', 'please', 'thank you', 'hope'] },
      { emoji: '✌️', name: 'Victory Hand', keywords: ['peace', 'victory', 'two', 'photo'] },
      { emoji: '🤞', name: 'Crossed Fingers', keywords: ['fingers', 'crossed', 'luck', 'hope'] },
      { emoji: '🤟', name: 'Love-You Gesture', keywords: ['love', 'you', 'sign language'] },
      { emoji: '🤘', name: 'Sign of Horns', keywords: ['rock', 'horns', 'party'] },
      { emoji: '🤙', name: 'Call Me Hand', keywords: ['call', 'shaka', 'hang loose'] },
      { emoji: '👈', name: 'Pointing Left', keywords: ['point', 'left', 'direction'] },
      { emoji: '👉', name: 'Pointing Right', keywords: ['point', 'right', 'direction'] },
      { emoji: '👆', name: 'Pointing Up', keywords: ['point', 'up', 'direction'] },
      { emoji: '👇', name: 'Pointing Down', keywords: ['point', 'down', 'direction'] },
      { emoji: '☝️', name: 'Index Pointing Up', keywords: ['point', 'one', 'attention'] },
      { emoji: '👍', name: 'Thumbs Up', keywords: ['thumbs', 'up', 'like', 'good', 'approve'] },
      { emoji: '👎', name: 'Thumbs Down', keywords: ['thumbs', 'down', 'dislike', 'bad'] },
      { emoji: '✊', name: 'Raised Fist', keywords: ['fist', 'power', 'solidarity'] },
      { emoji: '👊', name: 'Oncoming Fist', keywords: ['fist', 'bump', 'punch'] },
      { emoji: '🤛', name: 'Left-Facing Fist', keywords: ['fist', 'bump', 'left'] },
      { emoji: '🤜', name: 'Right-Facing Fist', keywords: ['fist', 'bump', 'right'] },
      { emoji: '👋', name: 'Waving Hand', keywords: ['wave', 'hello', 'goodbye', 'hi'] },
      { emoji: '🖐️', name: 'Hand with Fingers', keywords: ['hand', 'five', 'high five', 'stop'] },
      { emoji: '✋', name: 'Raised Hand', keywords: ['hand', 'stop', 'high five'] },
      { emoji: '🖖', name: 'Vulcan Salute', keywords: ['vulcan', 'spock', 'star trek'] },
      { emoji: '💪', name: 'Flexed Biceps', keywords: ['strong', 'muscle', 'power', 'flex'] },
      { emoji: '🦾', name: 'Mechanical Arm', keywords: ['arm', 'robot', 'strong', 'prosthetic'] },
      { emoji: '💅', name: 'Nail Polish', keywords: ['nail', 'manicure', 'beauty', 'fabulous'] },
      { emoji: '🤳', name: 'Selfie', keywords: ['selfie', 'photo', 'camera', 'picture'] },
    ]
  },
  {
    name: 'Numbers',
    icon: '1️⃣',
    emojis: [
      { emoji: '0️⃣', name: 'Zero', keywords: ['zero', '0', 'number'] },
      { emoji: '1️⃣', name: 'One', keywords: ['one', '1', 'number', 'first'] },
      { emoji: '2️⃣', name: 'Two', keywords: ['two', '2', 'number', 'second'] },
      { emoji: '3️⃣', name: 'Three', keywords: ['three', '3', 'number', 'third'] },
      { emoji: '4️⃣', name: 'Four', keywords: ['four', '4', 'number', 'fourth'] },
      { emoji: '5️⃣', name: 'Five', keywords: ['five', '5', 'number', 'fifth'] },
      { emoji: '6️⃣', name: 'Six', keywords: ['six', '6', 'number', 'sixth'] },
      { emoji: '7️⃣', name: 'Seven', keywords: ['seven', '7', 'number', 'seventh'] },
      { emoji: '8️⃣', name: 'Eight', keywords: ['eight', '8', 'number', 'eighth'] },
      { emoji: '9️⃣', name: 'Nine', keywords: ['nine', '9', 'number', 'ninth'] },
      { emoji: '🔟', name: 'Ten', keywords: ['ten', '10', 'number', 'tenth'] },
      { emoji: '#️⃣', name: 'Hash', keywords: ['hash', 'number', 'pound', 'hashtag'] },
      { emoji: '*️⃣', name: 'Asterisk', keywords: ['asterisk', 'star', 'multiply'] },
    ]
  },
];

// Flatten all emojis for search
const ALL_EMOJIS = EMOJI_CATEGORIES.flatMap(cat => 
  cat.emojis.map(e => ({ ...e, category: cat.name }))
);

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
  position?: 'auto' | 'top' | 'bottom';
}

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ value, onChange, position = 'auto' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState(0);
  const [hoveredEmoji, setHoveredEmoji] = useState<EmojiData | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, direction: 'bottom' as 'top' | 'bottom' });

  // Calculate position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const dropdownHeight = 480; // Estimated height
      const dropdownWidth = 380; // Estimated width
      
      // Determine if dropdown should go up or down
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      let direction: 'top' | 'bottom' = 'bottom';
      let top = rect.bottom + 8;
      
      if (position === 'top' || (position === 'auto' && spaceBelow < dropdownHeight && spaceAbove > spaceBelow)) {
        direction = 'top';
        top = rect.top - dropdownHeight - 8;
      }
      
      // Ensure top is not negative
      if (top < 8) top = 8;
      
      // Ensure dropdown doesn't go off bottom
      if (direction === 'bottom' && top + dropdownHeight > viewportHeight - 8) {
        top = viewportHeight - dropdownHeight - 8;
      }
      
      // Calculate left position
      let left = rect.left;
      if (left + dropdownWidth > viewportWidth - 8) {
        left = viewportWidth - dropdownWidth - 8;
      }
      if (left < 8) left = 8;
      
      setDropdownPosition({ top, left, direction });
    }
  }, [isOpen, position]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  // Filter emojis based on search
  const filteredEmojis = search.trim() 
    ? ALL_EMOJIS.filter(e => 
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.keywords.some(k => k.toLowerCase().includes(search.toLowerCase()))
      )
    : EMOJI_CATEGORIES[activeCategory].emojis;

  const handleSelectEmoji = (emoji: string) => {
    onChange(emoji);
    setIsOpen(false);
    setSearch('');
    setHoveredEmoji(null);
  };

  return (
    <div className="relative inline-block">
      {/* Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white border-2 border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all shadow-sm"
        title="Pick an emoji"
      >
        <span className="text-2xl leading-none">{value || '😀'}</span>
        <span className="text-xs text-gray-500">▼</span>
      </button>

      {/* Dropdown - rendered via portal */}
      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="fixed bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: 380,
            height: 500,
            zIndex: 99999,
          }}
        >
          {/* Header with search - fixed at top */}
          <div className="flex-shrink-0 bg-white border-b border-gray-200 p-3">
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                }}
                placeholder="Search emojis by name or keyword..."
                className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                autoFocus
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                >
                  ✕
                </button>
              )}
            </div>
            
            {/* Search results count */}
            {search && (
              <div className="mt-2 text-xs text-gray-500">
                {filteredEmojis.length > 0 
                  ? `Found ${filteredEmojis.length} emoji${filteredEmojis.length !== 1 ? 's' : ''} for "${search}"`
                  : `No emojis found for "${search}"`
                }
              </div>
            )}
          </div>

          {/* Category tabs - only show when not searching */}
          {!search && (
            <div className="flex-shrink-0 flex overflow-x-auto border-b border-gray-200 bg-gray-50 px-1 py-1 gap-1">
              {EMOJI_CATEGORIES.map((cat, idx) => (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => setActiveCategory(idx)}
                  className={`flex-shrink-0 p-2 rounded-lg text-xl transition-all ${
                    activeCategory === idx
                      ? 'bg-purple-100 shadow-sm'
                      : 'hover:bg-gray-100'
                  }`}
                  title={cat.name}
                >
                  {cat.icon}
                </button>
              ))}
            </div>
          )}

          {/* Category name */}
          {!search && (
            <div className="flex-shrink-0 px-3 py-2 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-gray-100">
              <span className="text-sm font-semibold text-purple-800">
                {EMOJI_CATEGORIES[activeCategory].name}
              </span>
              <span className="text-xs text-gray-500 ml-2">
                ({EMOJI_CATEGORIES[activeCategory].emojis.length} emojis)
              </span>
            </div>
          )}

          {/* Emoji grid - scrollable area that takes remaining space */}
          <div className="flex-1 overflow-y-auto p-2 min-h-0">
            {filteredEmojis.length > 0 ? (
              <div className="grid grid-cols-8 gap-1">
                {filteredEmojis.map((emojiData, idx) => (
                  <button
                    key={`${emojiData.emoji}-${idx}`}
                    type="button"
                    onClick={() => handleSelectEmoji(emojiData.emoji)}
                    onMouseEnter={() => setHoveredEmoji(emojiData)}
                    onMouseLeave={() => setHoveredEmoji(null)}
                    className={`p-2 text-2xl rounded-lg transition-all hover:bg-purple-100 hover:scale-110 ${
                      value === emojiData.emoji ? 'bg-purple-200 ring-2 ring-purple-500' : ''
                    }`}
                    title={emojiData.name}
                  >
                    {emojiData.emoji}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <span className="text-4xl block mb-2">🔍</span>
                <p className="text-sm">No emojis found</p>
                <p className="text-xs mt-1">Try a different search term</p>
              </div>
            )}
          </div>

          {/* Emoji info footer - fixed at bottom */}
          <div className="flex-shrink-0 bg-gradient-to-r from-gray-50 to-gray-100 border-t border-gray-200 px-3 py-2 min-h-[48px]">
            {hoveredEmoji ? (
              <div className="flex items-center gap-3">
                <span className="text-3xl">{hoveredEmoji.emoji}</span>
                <div>
                  <div className="text-sm font-medium text-gray-800">{hoveredEmoji.name}</div>
                  <div className="text-xs text-gray-500 truncate max-w-[280px]">
                    {hoveredEmoji.keywords.slice(0, 5).join(', ')}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>👆</span>
                <span>Hover over an emoji to see its name</span>
              </div>
            )}
          </div>

          {/* Paste custom emoji section - always visible at bottom */}
          <div className="flex-shrink-0 bg-purple-50 border-t-2 border-purple-200 px-3 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-purple-700">📋 Paste custom:</span>
              <input
                type="text"
                placeholder="Paste any emoji here"
                className="flex-1 px-3 py-1.5 text-lg border-2 border-purple-300 rounded-lg text-center bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                maxLength={4}
                onChange={(e) => {
                  const val = e.target.value.trim();
                  if (val) {
                    handleSelectEmoji(val);
                  }
                }}
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default EmojiPicker;
