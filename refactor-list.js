const fs = require('fs');
const path = require('path');

// 1. Prefix Bar
let prefixPath = path.join(__dirname, 'app/studio/dataset/_components/collection-detail/CollectionDetailPrefixBar.tsx');
let content = fs.readFileSync(prefixPath, 'utf-8');

content = content.replace(
    /className="flex w-full flex-wrap h-12 min-h-\[40px\] p-2 border border-white\/10 rounded-xl bg-background"/,
    'className="flex w-full flex-wrap h-10 min-h-[40px] p-1.5 border border-[#2e2e2e] rounded-xl bg-[#161616] shrink-0 shadow-sm"'
);
content = content.replace(
    /className="flex items-center gap-1 bg-white\/10 hover:bg-white\/20 text-white px-3 py-1 rounded-sm text-xs font-medium/g,
    'className="flex items-center gap-1 bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border border-teal-500/20 px-3 py-1 rounded-lg text-[13px] font-medium'
);

content = content.replace(
    /className="flex-1 bg-transparent border-none text-foreground text-sm focus-visible:ring-0 h-8"/,
    'className="flex-1 bg-transparent border-none text-zinc-300 text-[13px] focus-visible:ring-0 h-7"'
);
content = content.replace(
    /className="w-auto h-12 bg-secondary hover:bg-secondary\/80 text-secondary-foreground border border-white\/10"/,
    'className="w-auto h-10 bg-[#1a1a1a] hover:bg-[#2a2a2a] text-zinc-300 border-[#2e2e2e] rounded-xl shadow-sm hover:text-white shrink-0"'
);

fs.writeFileSync(prefixPath, content, 'utf-8');
console.log('Prefix Bar updated');

// 2. ListView
let listPath = path.join(__dirname, 'app/studio/dataset/_components/collection-detail/CollectionDetailListView.tsx');
content = fs.readFileSync(listPath, 'utf-8');

content = content.replace(
    /className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative"/,
    'className="grid grid-cols-1 lg:grid-cols-2 gap-4 relative overflow-y-auto custom-scrollbar flex-1 min-h-0 pr-2"'
);

// Empty add state
content = content.replace(
    /className="flex flex-col items-center justify-center cursor-pointer border-2 border-dashed border-white\/10 bg-card\/40 rounded-2xl p-10 hover:border-primary\/50 hover:bg-primary\/5 transition-all group min-h-\[300px\]"/,
    'className="flex flex-col items-center justify-center cursor-pointer border-2 border-dashed border-[#2e2e2e] bg-[#161616] rounded-2xl p-6 hover:border-teal-500/50 hover:bg-teal-500/5 transition-all group min-h-[240px] h-full"'
);
content = content.replace(
    /className="w-16 h-16 rounded-full bg-muted flex items-center justify-center group-hover:scale-110 group-hover:bg-primary\/20 transition-all"/,
    'className="w-12 h-12 rounded-full flex flex-col items-center justify-center group-hover:scale-110 transition-all"'
);
content = content.replace(
    /className="h-8 w-8 text-muted-foreground group-hover:text-primary"/,
    'className="h-8 w-8 text-zinc-500 group-hover:text-teal-500"'
);

fs.writeFileSync(listPath, content, 'utf-8');
console.log('List View structure updated');
