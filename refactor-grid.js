const fs = require('fs');
const path = require('path');

let gridPath = path.join(__dirname, 'app/studio/dataset/_components/collection-detail/CollectionDetailGridView.tsx');
let content = fs.readFileSync(gridPath, 'utf-8');

// Grid container
content = content.replace(
    /<div className="space-y-4">/,
    '<div className="flex-1 overflow-y-auto custom-scrollbar pr-2 mt-4 space-y-4 min-h-0">'
);

// Add button
content = content.replace(
    /className="flex flex-col items-center justify-center cursor-pointer border-2 border-dashed border-white\/10 bg-card\/40 rounded-xl aspect-square hover:border-primary\/50 hover:bg-primary\/5 transition-all group relative overflow-hidden"/,
    'className="flex flex-col items-center justify-center cursor-pointer border-2 border-dashed border-[#2e2e2e] bg-[#161616] rounded-2xl aspect-square hover:border-teal-500/50 hover:bg-teal-500/5 transition-all group relative overflow-hidden"'
);

content = content.replace(
    /className="h-8 w-8 text-muted-foreground group-hover:text-primary mb-2"/,
    'className="h-8 w-8 text-zinc-500 group-hover:text-teal-500 mb-2 transition-colors"'
);
content = content.replace(
    /className="text-xs text-muted-foreground font-medium"/,
    'className="text-xs text-zinc-500 font-medium group-hover:text-teal-500 transition-colors"'
);

// Drag overlay
content = content.replace(
    /className="relative aspect-square bg-card border border-white\/10 rounded-xl overflow-hidden opacity-80 shadow-2xl cursor-grabbing pointer-events-none"/,
    'className="relative aspect-square bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl overflow-hidden opacity-80 shadow-2xl cursor-grabbing pointer-events-none"'
);

fs.writeFileSync(gridPath, content, 'utf-8');
console.log('Grid View layout updated');


// SortableImageCard
let cardPath = path.join(__dirname, 'app/studio/dataset/_components/collection-detail/SortableImageCard.tsx');
content = fs.readFileSync(cardPath, 'utf-8');

content = content.replace(
    /className={`group relative aspect-square bg-card border rounded-xl overflow-hidden transition-all select-none touch-none \${isSelected\n        \? 'ring-2 ring-primary border-primary shadow-\[0_0_15px_oklch\(var\(--primary\)\/0\.3\)\]'\n        : 'border-white\/10 hover:ring-2 hover:ring-primary\/50'\n        }`}/m,
    "className={`group relative aspect-square bg-[#1a1a1a] border rounded-2xl overflow-hidden transition-all select-none touch-none ${isSelected\n        ? 'ring-2 ring-teal-500 border-teal-500 shadow-[0_0_15px_rgba(20,184,166,0.2)]'\n        : 'border-[#2e2e2e] hover:ring-2 hover:ring-teal-500/50'\n        }`}"
);

content = content.replace(
    /className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shadow-md transition-colors \${isSelected \? 'bg-primary border-primary' : 'bg-black\/40 border-white\/60 backdrop-blur-sm hover:border-white'}`}/,
    "className={`w-6 h-6 rounded-full border flex items-center justify-center shadow-md transition-colors ${isSelected ? 'bg-teal-500 border-teal-500 text-white' : 'bg-black/40 border-white/60 backdrop-blur-sm hover:border-white'}`}"
);

content = content.replace(
    /className="w-4 h-4 text-primary-foreground rotate-45"/,
    'className="w-4 h-4 text-white rotate-45"'
);

content = content.replace(
    /className="bg-black\/50 backdrop-blur-sm rounded px-1\.5 py-0\.5 text-\[10px\] text-white\/80 font-mono truncate max-w-full"/,
    'className="bg-black/60 backdrop-blur-sm rounded-md px-1.5 py-0.5 text-[10px] text-zinc-300 font-mono truncate max-w-full"'
);

content = content.replace(
    /className="h-8 w-auto px-4 shadow-lg scale-90 hover:scale-100 transition-transform"/,
    'className="h-8 w-auto px-4 shadow-lg scale-90 hover:scale-100 transition-transform rounded-lg"'
);

fs.writeFileSync(cardPath, content, 'utf-8');
console.log('Sortable Image Card updated');
