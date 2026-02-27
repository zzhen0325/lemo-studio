const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'app/studio/playground/_components/Banner/BannerModePanel.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Root layout & Template Section
content = content.replace(
    /<div className="w-full h-full overflow-y-auto pl-20 md:pl-28 lg:pl-32 pr-6 pb-6">\s*<div className="w-full max-w-\[1320px\] mx-auto pt-10">\s*<div className="grid grid-cols-1 xl:grid-cols-\[220px_minmax\(0,1\.35fr\)_420px\] gap-5">\s*<section className="rounded-3xl border border-white\/20 bg-black\/40 backdrop-blur-xl p-3 h-fit">/m,
    `<div className="w-full h-full overflow-hidden pl-[72px] md:pl-[84px] lg:pl-[100px] pr-4 pb-4 pt-4 flex flex-col">\n            <div className="w-full max-w-[1440px] mx-auto flex-1 min-h-0 flex flex-col">\n                <div className="grid grid-cols-1 xl:grid-cols-[220px_minmax(0,1.2fr)_340px] gap-4 h-full min-h-0">\n                    <section className="flex flex-col rounded-2xl border border-[#2e2e2e] bg-[#161616] p-3 overflow-hidden shadow-sm">`
);

// Template list container
content = content.replace(
    /<div className="space-y-3 max-h-\[560px\] overflow-y-auto pr-1">/m,
    `<div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-2 mt-2">`
);

// Preview Section Wrapper
content = content.replace(
    /<section className="rounded-3xl border border-white\/20 bg-black\/40 backdrop-blur-xl p-4">/m,
    `<div className="flex flex-col gap-4 overflow-hidden min-h-0">\n                        <section className="flex-1 rounded-2xl border border-[#2e2e2e] bg-[#1a1a1a] p-3 flex flex-col min-h-0 overflow-hidden shadow-sm">`
);

// Preview box
content = content.replace(
    /<div\s*ref=\{previewRef\}\s*className=\{cn\(\s*"relative w-full overflow-hidden rounded-2xl border border-white\/15 bg-black\/30",\s*"cursor-crosshair select-none"\s*\)\}\s*style=\{\{ aspectRatio: \`\$\{template\.width\}\/\$\{template\.height\}\` \}\}/m,
    `<div className="flex-1 relative w-full overflow-hidden rounded-xl border border-[#2e2e2e] bg-[#0e0e0e] shadow-inner mt-2 flex items-center justify-center">\n                            <div\n                                ref={previewRef}\n                                className={cn(\n                                    "relative overflow-hidden shadow-sm",\n                                    "cursor-crosshair select-none"\n                                )}\n                                style={{ \n                                    aspectRatio: \`\${template.width}/\${template.height}\`,\n                                    maxHeight: '100%',\n                                    maxWidth: '100%',\n                                    height: 'auto',\n                                    width: 'auto'\n                                }}`
);

// Close preview inner box
content = content.replace(
    /(\s*)<\/div>\n(\s*)<\/section>\n\n(\s*)<section className="rounded-3xl border border-white\/20 bg-black\/40 backdrop-blur-xl p-4 flex flex-col gap-4">/m,
    `$1</div>\n$1</div>\n$2</section>\n\n$3<!-- HISTORY_SECTION_PLACEHOLDER -->\n\n$2</div>\n\n$3<section className="flex flex-col rounded-2xl border border-[#2e2e2e] bg-[#1C1C1C] overflow-hidden shadow-sm">`
);

// Extract History Section
const historyRegex = /<section className="rounded-3xl border border-white\/20 bg-black\/40 backdrop-blur-xl p-4 xl:col-start-2 xl:col-span-2">([\s\S]*?)<\/section>/m;
const match = content.match(historyRegex);
if (match) {
    let historyContent = match[0];
    // Remove original history section
    content = content.replace(historyRegex, '');
    
    // Style history section
    historyContent = historyContent.replace(
        /<section className="rounded-3xl border border-white\/20 bg-black\/40 backdrop-blur-xl p-4 xl:col-start-2 xl:col-span-2">/m,
        `<section className="shrink-0 rounded-2xl border border-[#2e2e2e] bg-[#1a1a1a] p-3 shadow-sm h-[120px] flex flex-col">`
    );
    historyContent = historyContent.replace('mb-3', 'mb-2');
    historyContent = historyContent.replace('h-24', 'flex-1');
    
    content = content.replace('<!-- HISTORY_SECTION_PLACEHOLDER -->', historyContent);
}

// Right Panel Settings styles
// 1. Right panel internal padding & scroll
content = content.replace(
    /<section className="flex flex-col rounded-2xl border border-\[#2e2e2e\] bg-\[#1C1C1C\] overflow-hidden shadow-sm">/m,
    `<section className="flex flex-col rounded-2xl border border-[#2e2e2e] bg-[#1C1C1C] overflow-hidden shadow-sm">\n                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-3">`
);

// 2. Button and Bottom Area
content = content.replace(
    /<div className="flex items-center justify-between gap-3">([\s\S]*?)<\/div>\n(\s*)<\/section>/m,
    `</div>\n$2<div className="shrink-0 p-4 border-t border-[#2e2e2e] bg-[#161616] flex flex-col gap-3">\n$2    <Button className="w-full h-[42px] rounded-xl bg-teal-600 hover:bg-teal-500 text-white shadow-sm font-semibold transition-colors border-0" onClick={handleGenerateClick} disabled={isGenerating || isPreparingBannerGuideImage}>\n$2        {isPreparingBannerGuideImage ? '准备标注图...' : (isGenerating ? '生成中...' : 'Generate Banner')}\n$2    </Button>\n$2    <Button variant="outline" className="w-full h-8 rounded-lg border-transparent text-zinc-400 hover:text-white hover:bg-[#2a2a2a] text-xs" onClick={resetBannerPromptFinal}>\n$2        <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> 重置模板 Prompt\n$2    </Button>\n$2</div>\n$2</section>`
);

// Fix UI elements styling in Right Panel
content = content.replace(/border-white\/10 bg-white\/\[0\.02\] p-3/g, 'border-[#2e2e2e] bg-[#161616] p-3');
content = content.replace(/bg-white\/5 border-white\/15 text-white/g, 'bg-[#1a1a1a] border-[#2e2e2e] text-zinc-300 focus-visible:ring-1 focus-visible:ring-teal-500/50');
content = content.replace(/text-white\/60/g, 'text-zinc-400');
content = content.replace(/min-h-\[72px\]/g, 'min-h-[50px]');
content = content.replace(/min-h-\[160px\]/g, 'min-h-[100px]');
content = content.replace(/bg-black\/90 border-white\/20/g, 'bg-[#1C1C1C] border-[#2e2e2e]');
content = content.replace(/border-white\/20 text-white hover:bg-white\/10/g, 'border-[#3a3a3a] bg-[#1a1a1a] text-zinc-300 hover:text-white hover:bg-[#2a2a2a]');

// Replace template card styles
content = content.replace(/border-\[#E6FFD1\] bg-\[#E6FFD1\]\/10 shadow-\[0_0_0_1px_rgba\(230,255,209,0\.25\)\]/g, 'border-teal-500 bg-teal-500/10 ring-1 ring-teal-500/50');
content = content.replace(/border-white\/10 bg-white\/\[0\.02\] hover:bg-white\/\[0\.06\]/g, 'border-[#2e2e2e] bg-[#1a1a1a] hover:bg-[#222]');
content = content.replace(/border-\[#E6FFD1\]\/40 text-\[#E6FFD1\]/g, 'border-teal-500/40 text-teal-500');

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Successfully updated BannerModePanel.tsx');
