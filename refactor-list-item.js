const fs = require('fs');
const path = require('path');

let itemPath = path.join(__dirname, 'app/studio/dataset/_components/collection-detail/CollectionDetailListItem.tsx');
let content = fs.readFileSync(itemPath, 'utf-8');

// Global card style
content = content.replace(
    /className={`flex flex-col sm:flex-row bg-card\/40 border rounded-2xl overflow-hidden group transition-all duration-300 hover:shadow-lg \${isSelected\n          \? 'border-primary ring-1 ring-primary shadow-\[0_0_15px_oklch\(var\(--primary\)\/0\.15\)\] bg-primary\/5'\n          : 'border-white\/5 hover:border-white\/20'\n        }`}/m,
    "className={`flex flex-col sm:flex-row bg-[#1a1a1a] border rounded-2xl overflow-hidden group transition-all duration-200 shadow-sm ${isSelected\n          ? 'border-teal-500 ring-1 ring-teal-500 shadow-[0_0_15px_rgba(20,184,166,0.15)] bg-teal-500/5'\n          : 'border-[#2e2e2e] hover:border-[#3a3a3a] hover:bg-[#1f1f1f]'\n        }`}"
);

// Left Image Panel
content = content.replace(
    /className={`w-full sm:w-\[320px\] lg:w-\[400px\] shrink-0 relative bg-background\/30 sm:min-h-\[320px\] border-b sm:border-b-0 sm:border-r border-white\/5 flex items-center justify-center p-3 cursor-pointer transition-colors \${isSelected \? 'bg-primary\/5' : ''}`}/,
    "className={`w-full sm:w-[280px] lg:w-[320px] shrink-0 relative bg-[#161616] sm:min-h-[240px] border-b sm:border-b-0 sm:border-r border-[#2e2e2e] flex items-center justify-center p-2 cursor-pointer transition-colors ${isSelected ? 'bg-teal-500/5' : ''}`}"
);
content = content.replace(
    /className="w-full h-full min-h-\[300px\] sm:min-h-full relative rounded-xl overflow-hidden bg-muted\/20"/,
    'className="w-full h-full min-h-[240px] sm:min-h-full relative rounded-xl overflow-hidden bg-[#0e0e0e]"'
);

// Selected icon top left
content = content.replace(
    /className={`absolute top-5 left-5 z-10 transition-opacity duration-200 \${isSelected \? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}/,
    "className={`absolute top-4 left-4 z-10 transition-opacity duration-200 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}"
);
content = content.replace(
    /className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shadow-md transition-colors \${isSelected\n                \? 'bg-primary border-primary'\n                : 'bg-black\/40 border-white\/60 backdrop-blur-sm hover:border-white'\n              }`}/m,
    "className={`w-6 h-6 rounded-full border flex items-center justify-center shadow-md transition-colors ${isSelected\n                ? 'bg-teal-500 border-teal-500 text-white'\n                : 'bg-black/40 border-white/60 backdrop-blur-sm hover:border-white'\n              }`}"
);
content = content.replace(
    /className="w-4 h-4 text-primary-foreground rotate-45"/,
    'className="w-4 h-4 text-white rotate-45"'
);

// Right Content Panel
content = content.replace(
    /className="flex-1 p-4 sm:p-6 flex flex-col gap-4 bg-transparent min-w-0"/,
    'className="flex-1 p-4 flex flex-col gap-3 bg-transparent min-w-0"'
);

content = content.replace(
    /className="text-base font-semibold text-foreground\/90 tracking-tight truncate"/,
    'className="text-[15px] font-medium text-zinc-200 tracking-tight truncate"'
);

// Buttons group matching
content = content.replace(
    /className="flex items-center bg-background\/60 backdrop-blur-sm rounded-lg p-0\.5 border border-white\/10"/,
    'className="flex items-center bg-[#161616] rounded-lg p-1 border border-[#2e2e2e]"'
);

content = content.replace(
    /className={`h-7 px-3 text-\[11px\] font-medium rounded-md transition-colors \${imagePromptLang === 'zh'\n                    \? 'bg-primary text-primary-foreground shadow-sm'\n                    : 'text-muted-foreground hover:text-foreground hover:bg-white\/5'\n                  }`}/gm,
    "className={`h-7 px-3 text-xs font-medium rounded-md transition-colors ${imagePromptLang === 'zh'\n                    ? 'bg-[#2a2a2a] text-white shadow-sm'\n                    : 'text-zinc-500 hover:text-zinc-300'\n                  }`}"
);
content = content.replace(
    /className={`h-7 px-3 text-\[11px\] font-medium rounded-md transition-colors \${imagePromptLang === 'en'\n                    \? 'bg-primary text-primary-foreground shadow-sm'\n                    : 'text-muted-foreground hover:text-foreground hover:bg-white\/5'\n                  }`}/gm,
    "className={`h-7 px-3 text-xs font-medium rounded-md transition-colors ${imagePromptLang === 'en'\n                    ? 'bg-[#2a2a2a] text-white shadow-sm'\n                    : 'text-zinc-500 hover:text-zinc-300'\n                  }`}"
);

content = content.replace(
    /className="w-\[1px\] h-4 bg-white\/10 mx-1"/,
    'className="w-[1px] h-4 bg-[#2e2e2e] mx-1"'
);

content = content.replace(
    /className="h-8 px-3 text-xs font-medium gap-1\.5 bg-white\/5 hover:bg-white\/15 border border-white\/10 text-foreground transition-all duration-200"/g,
    'className="h-8 px-3 text-xs font-medium gap-1.5 bg-[#1a1a1a] hover:bg-[#2a2a2a] border border-[#2e2e2e] text-zinc-300 hover:text-white transition-all duration-200 shadow-sm rounded-lg"'
);
content = content.replace(/text-primary\/80/g, 'text-teal-500');

content = content.replace(
    /className="h-8 w-8 bg-white\/5 hover:bg-white\/15 border border-white\/10 text-muted-foreground hover:text-foreground transition-all duration-200"/,
    'className="h-8 w-8 bg-[#1a1a1a] hover:bg-[#2a2a2a] border border-[#2e2e2e] text-zinc-400 hover:text-white transition-all duration-200 shadow-sm rounded-lg"'
);

content = content.replace(
    /className="h-8 w-8 text-muted-foreground hover:text-white hover:bg-destructive\/80 transition-all duration-200 ml-1"/,
    'className="h-8 w-8 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 transition-all duration-200 ml-1 rounded-lg"'
);

fs.writeFileSync(itemPath, content, 'utf-8');
console.log('CollectionDetailListItem layout and colors updated');


// 3. PromptTextareas (as the textarea styling usually resides there)
let textareasPath = path.join(__dirname, 'app/studio/dataset/_components/collection-detail/PromptTextareas.tsx');
if (fs.existsSync(textareasPath)) {
    let tContent = fs.readFileSync(textareasPath, 'utf-8');
    tContent = tContent.replace(/bg-muted\/50/g, 'bg-[#161616]');
    tContent = tContent.replace(/border-white\/10/g, 'border-[#2e2e2e]');
    tContent = tContent.replace(/focus-visible:ring-primary/g, 'focus-visible:ring-teal-500/50');
    tContent = tContent.replace(/text-foreground/g, 'text-zinc-300');
    tContent = tContent.replace(/placeholder:text-muted-foreground\/50/g, 'placeholder:text-zinc-600');
    tContent = tContent.replace(/text-primary/g, 'text-teal-500');
    tContent = tContent.replace(/bg-background\/50/g, 'bg-[#1a1a1a]');
    fs.writeFileSync(textareasPath, tContent, 'utf-8');
    console.log('PromptTextareas updated');
}

