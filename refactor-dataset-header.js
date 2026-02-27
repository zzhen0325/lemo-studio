const fs = require('fs');
const path = require('path');

let headerPath = path.join(__dirname, 'app/studio/dataset/_components/collection-detail/CollectionDetailHeader.tsx');
let content = fs.readFileSync(headerPath, 'utf-8');

// Container style
content = content.replace(
    /className="sticky top-0 left-0 z-30 bg-\[#2C2D2F\] px-6 py-4 border rounded-md border-white\/5"/,
    'className="sticky top-0 left-0 z-30 bg-[#161616] px-4 py-3 border rounded-xl border-[#2e2e2e] shadow-sm shrink-0"'
);

// Buttons styling
content = content.replace(
    /className="text-white bg-muted\/50 border border-white\/10 hover:text-primary hover:bg-white\/10 h-10 px-4 rounded-lg"/,
    'className="text-zinc-300 bg-[#1a1a1a] border border-[#2e2e2e] hover:text-white hover:bg-[#2a2a2a] h-9 px-3 rounded-lg shadow-sm"'
);

content = content.replace(
    /className="h-8 py-1 text-xl font-bold w-\[200px\]"/,
    'className="h-8 py-1 text-lg font-semibold w-[200px] bg-[#1a1a1a] border-[#2e2e2e] text-white focus-visible:ring-1 focus-visible:ring-teal-500/50"'
);
content = content.replace(
    /className="text-2xl font-bold text-foreground cursor-pointer hover:bg-muted\/50 px-2 rounded -ml-2 transition-colors select-none"/,
    'className="text-lg font-semibold text-zinc-100 cursor-pointer hover:bg-[#2a2a2a] px-2 rounded-md -ml-2 transition-colors select-none"'
);
content = content.replace(
    /className="text-sm text-muted-foreground"/,
    'className="text-[13px] text-zinc-500"'
);

// Progress styling
content = content.replace(
    /bg-\[linear-gradient\(to_bottom,#12182d,#1d2446\)\] p-2 border border-white\/20 rounded-lg/g,
    'bg-[#1a1a1a] p-2 border border-[#2e2e2e] rounded-lg'
);
content = content.replace(
    /bg-white\/10 ml-3 border border-white\/10 hover:text-destructive/g,
    'bg-[#2a2a2a] ml-3 border-[#3a3a3a] text-zinc-300 hover:text-red-400'
);

// View switchers styling
content = content.replace(
    /className="flex items-center bg-muted\/50 rounded-lg p-1 border border-white\/10 mr-2 h-10"/,
    'className="flex items-center bg-[#1a1a1a] rounded-lg p-1 border border-[#2e2e2e] h-9"'
);
content = content.replace(/bg-primary\/20 text-primary/g, 'bg-[#2a2a2a] text-white shadow-sm');
content = content.replace(/text-muted-foreground hover:text-foreground/g, 'text-zinc-500 hover:text-zinc-300');
content = content.replace(
    /className="w-\[1px\] h-6 bg-white\/20 mx-2"/g,
    'className="w-[1px] h-4 bg-[#2e2e2e] mx-1"'
);
content = content.replace(
    /className="w-\[1px\] h-6 bg-white\/20 ml-2"/g,
    'className="w-[1px] h-4 bg-[#2e2e2e] ml-1 mr-2"'
);
content = content.replace(
    /className="w-\[1px\] h-6 bg-white\/20 mx-1"/g,
    'className="w-[1px] h-4 bg-[#2e2e2e] mx-1"'
);

// General buttons right side
content = content.replace(
    /className="text-primary hover:text-primary hover:bg-white\/10 h-10 px-4 rounded-lg"/g,
    'className="text-teal-500 border-teal-500/30 hover:bg-teal-500/10 hover:text-teal-400 h-9 px-3 rounded-lg"'
);
content = content.replace(
    /className="text-foreground"/g,
    'className="text-zinc-300 border-[#2e2e2e] hover:bg-[#2a2a2a] hover:text-white h-9 px-3 rounded-lg"'
);
content = content.replace(
    /className=\{selectedCount > 0 \? 'bg-primary text-primary-foreground hover:bg-primary\/90 h-10 px-4 rounded-lg' : 'text-foreground h-10 px-4 rounded-lg'\}/,
    'className={selectedCount > 0 ? \'bg-teal-600 border-teal-600 text-white hover:bg-teal-500 h-9 px-3 rounded-lg shadow-sm\' : \'text-zinc-300 border-[#2e2e2e] bg-[#1a1a1a] hover:bg-[#2a2a2a] hover:text-white h-9 px-3 rounded-lg shadow-sm\'}'
);

content = content.replace(
    /className="flex items-center bg-muted\/50 rounded-lg p-1 border border-white\/10"/,
    'className="flex items-center bg-[#1a1a1a] rounded-lg p-1 border border-[#2e2e2e] h-9"'
);

// Selected count active styling
content = content.replace(
    /className="flex items-center gap-2 bg-primary\/10 border border-primary\/20 rounded-lg px-3 py-1/g,
    'className="flex items-center gap-1 bg-teal-500/10 border border-teal-500/20 rounded-lg px-2 py-1 h-9'
);
content = content.replace(
    /text-primary mr-2/g,
    'text-teal-500 mr-2'
);
content = content.replace(
    /hover:bg-primary\/20/g,
    'hover:bg-teal-500/20 text-teal-400'
);
content = content.replace(
    /border-primary\/30 text-primary hover:bg-primary\/10/g,
    'border-teal-500/30 text-teal-500 hover:bg-teal-500/10'
);


fs.writeFileSync(headerPath, content, 'utf-8');
console.log('Dataset header updated');

