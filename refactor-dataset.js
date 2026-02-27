const fs = require('fs');
const path = require('path');

// 1. DatasetManagerView
let dmvPath = path.join(__dirname, 'app/studio/dataset/_components/DatasetManagerView.tsx');
let content = fs.readFileSync(dmvPath, 'utf-8');

content = content.replace(
    /className="relative  h-full pt-12 w-full px-8"/,
    'className="relative h-full pt-4 pb-4 w-full px-4 lg:px-8 flex flex-col min-h-0 bg-[#0e0e0e]"'
);

content = content.replace(
    /<div className="relative z-10 flex flex-col h-full w-full mx-auto text-foreground">/m,
    '<div className="relative z-10 flex flex-col flex-1 h-full w-full max-w-[1440px] mx-auto min-h-0 text-foreground">'
);
content = content.replace(
    /<div id="dataset-scroll-container" className="flex-1 min-h-0 overflow-y-auto w-full">/,
    '<div id="dataset-scroll-container" className="flex-1 min-h-0 overflow-y-auto custom-scrollbar w-full">'
);
fs.writeFileSync(dmvPath, content, 'utf-8');


// 2. CollectionList
let clPath = path.join(__dirname, 'app/studio/dataset/_components/CollectionList.tsx');
content = fs.readFileSync(clPath, 'utf-8');

content = content.replace(
    /className={`space-y-6 w-full max-w-7xl mx-auto  pt-14 \${className || ''}`}/,
    'className={`space-y-4 w-full h-full flex flex-col ${className || \'\'}`}'
);

content = content.replace(
    /className="text-2xl font-bold text-foreground"/,
    'className="text-xl font-semibold text-zinc-200"'
);

// New Collection button style
content = content.replace(
    /className="bg-white\/10 hover:bg-white\/20 text-white rounded-xl"/,
    'className="bg-teal-600 hover:bg-teal-500 shadow-sm text-white rounded-xl h-9 px-4 text-sm font-medium border-0"'
);

// Card styling
content = content.replace(
    /className="bg-card border-white\/5 overflow-hidden hover:border-primary\/30 transition-all duration-300 cursor-pointer group hover:shadow-\[0_8px_30px_rgb\(0,0,0,0\.12\)\] hover:-translate-y-1"/g,
    'className="bg-[#1a1a1a] border-[#2e2e2e] rounded-2xl overflow-hidden hover:border-[#3a3a3a] hover:bg-[#1f1f1f] transition-all duration-200 cursor-pointer group shadow-sm"'
);

// Inner grid
content = content.replace(
    /className="grid grid-cols-2 grid-rows-2 h-full gap-\[1px\] bg-background\/50 p-\[1px\]"/g,
    'className="grid grid-cols-2 grid-rows-2 h-full gap-1 bg-[#161616] p-1"'
);
content = content.replace(
    /className="relative bg-muted\/50 flex items-center justify-center overflow-hidden"/g,
    'className="relative bg-[#0e0e0e] rounded-lg flex items-center justify-center overflow-hidden"'
);

// Card footer
content = content.replace(
    /className="p-4 flex justify-between items-center bg-card\/80 backdrop-blur-sm border-t border-white\/5"/g,
    'className="p-3 flex justify-between items-center bg-[#1a1a1a] border-t border-[#2e2e2e]"'
);
content = content.replace(
    /className="font-semibold text-base text-card-foreground truncate transition-colors group-hover:text-primary"/g,
    'className="font-medium text-[15px] text-zinc-200 truncate transition-colors"'
);
content = content.replace(
    /className="text-xs text-muted-foreground\/70"/g,
    'className="text-[13px] text-zinc-500 mt-0.5"'
);

// More button
content = content.replace(
    /className="border border-white\/10 hover:border-white\/20 rounded-lg"/g,
    'className=""'
);
content = content.replace(
    /className="h-8 w-8 text-white bg-black\/40 hover:bg-black\/60 rounded-lg"/g,
    'className="h-8 w-8 text-zinc-400 bg-transparent hover:text-white hover:bg-[#2e2e2e] rounded-xl"'
);

content = content.replace(
    /<DropdownMenuContent align="end" className="w-40 border border-white\/10 rounded-2xl">/g,
    '<DropdownMenuContent align="end" className="w-40 border-[#2e2e2e] bg-[#1a1a1a] rounded-xl text-zinc-300">'
);
content = content.replace(
    /<DropdownMenuItem/g,
    '<DropdownMenuItem className="data-[highlighted]:bg-[#2a2a2a] data-[highlighted]:text-white cursor-pointer rounded-lg"'
);

// Add scroll area for grid list
content = content.replace(
    /<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">/,
    '<div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-6">\n<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-5">'
);
content = content.replace(
    /(\s*)<\/div>\n(\s*)<\/div>\n(\s*)\);/m,
    '$1</div>\n$2</div>\n$2</div>\n$3);'
);

fs.writeFileSync(clPath, content, 'utf-8');

// 3. CollectionDetail
let cdPath = path.join(__dirname, 'app/studio/dataset/_components/CollectionDetail.tsx');
content = fs.readFileSync(cdPath, 'utf-8');

content = content.replace(
    /className="flex flex-col pb-20 pt-10 space-y-6 relative w-full px-10"/,
    'className="flex flex-col pb-6 space-y-4 relative w-full h-full min-h-0"'
);

content = content.replace(
    /<Button\s*type="button"\s*variant="secondary"\s*size="icon"\s*onClick=\{handleScrollToTop\}\s*className="fixed bottom-6 right-6 z-50 h-10 w-10/m,
    '<Button\n                    type="button"\n                    variant="secondary"\n                    size="icon"\n                    onClick={handleScrollToTop}\n                    className="fixed bottom-6 right-6 z-50 h-10 w-10 border-[#2e2e2e] bg-[#1a1a1a] text-zinc-300 hover:bg-[#2a2a2a] hover:text-white rounded-xl shadow-lg'
);
fs.writeFileSync(cdPath, content, 'utf-8');

console.log('Dataset base layout updated');
