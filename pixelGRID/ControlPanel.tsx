
import React from 'react';
import { GridParams, PixelShape, ScaleMode, MediaType } from './types';

interface ControlPanelProps {
  params: GridParams;
  setParams: (p: GridParams) => void;
  mediaType: MediaType;
  onExport: () => void;
  onReset: () => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ params, setParams, mediaType, onExport, onReset }) => {
  const updateParam = (key: keyof GridParams, value: any) => {
    setParams({ ...params, [key]: value });
  };

  const isVideo = mediaType === MediaType.VIDEO;

  return (
    <div className="bg-black/80 backdrop-blur-md border border-white/10 p-4 rounded-lg w-80 max-h-[90vh] overflow-y-auto space-y-6 shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <h2 className="text-xs font-black tracking-widest text-red-500 uppercase">System Parameters</h2>
        <div className="flex gap-2">
          <button
            onClick={onReset}
            className="text-[10px] bg-zinc-800 px-2 py-1 rounded hover:bg-zinc-700 transition-colors"
          >
            RESET
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Master Speed */}
        <div className={!isVideo ? 'opacity-30 pointer-events-none' : ''}>
          <div className="flex justify-between text-[10px] mb-1 uppercase tracking-wider text-zinc-400">
            <span>Master Speed</span>
            <span className="text-red-400">{params.masterSpeed.toFixed(1)}x</span>
          </div>
          <input
            type="range" min="0.1" max="3.0" step="0.1"
            value={params.masterSpeed}
            onChange={(e) => updateParam('masterSpeed', parseFloat(e.target.value))}
            className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-red-600"
          />
        </div>

        {/* Grid Density */}
        <div>
          <div className="flex justify-between text-[10px] mb-1 uppercase tracking-wider text-zinc-400">
            <span>Grid Density</span>
            <span className="text-red-400">{params.gridDensity}</span>
          </div>
          <input
            type="range" min="20" max="200" step="1"
            value={params.gridDensity}
            onChange={(e) => updateParam('gridDensity', parseInt(e.target.value))}
            className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-red-600"
          />
        </div>

        {/* Cluster Threshold */}
        <div>
          <div className="flex justify-between text-[10px] mb-1 uppercase tracking-wider text-zinc-400">
            <span>Cluster Threshold</span>
            <span className="text-red-400">{params.clusterThreshold.toFixed(2)}</span>
          </div>
          <input
            type="range" min="0.0" max="1.0" step="0.01"
            value={params.clusterThreshold}
            onChange={(e) => updateParam('clusterThreshold', parseFloat(e.target.value))}
            className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-red-600"
          />
        </div>

        {/* Pixel Shape */}
        <div>
          <div className="text-[10px] mb-1 uppercase tracking-wider text-zinc-400">Pixel Shape</div>
          <div className="grid grid-cols-3 gap-1">
            {Object.values(PixelShape).map(shape => (
              <button
                key={shape}
                onClick={() => updateParam('pixelShape', shape)}
                className={`text-[9px] py-1 border rounded transition-all ${params.pixelShape === shape
                    ? 'bg-red-600 border-red-500 text-white'
                    : 'bg-zinc-900 border-white/5 text-zinc-500 hover:border-zinc-700'
                  }`}
              >
                {shape}
              </button>
            ))}
          </div>
        </div>

        {/* Size Scale */}
        <div>
          <div className="flex justify-between text-[10px] mb-1 uppercase tracking-wider text-zinc-400">
            <span>Size Scale</span>
            <span className="text-red-400">{params.sizeScale.toFixed(2)}</span>
          </div>
          <input
            type="range" min="0.5" max="2.0" step="0.05"
            value={params.sizeScale}
            onChange={(e) => updateParam('sizeScale', parseFloat(e.target.value))}
            className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-red-600"
          />
        </div>

        {/* Min Pixel Filter */}
        <div>
          <div className="flex justify-between text-[10px] mb-1 uppercase tracking-wider text-zinc-400">
            <span>Min Pixel Filter</span>
            <span className="text-red-400">{params.minPixelFilter.toFixed(2)}</span>
          </div>
          <input
            type="range" min="0.0" max="0.8" step="0.01"
            value={params.minPixelFilter}
            onChange={(e) => updateParam('minPixelFilter', parseFloat(e.target.value))}
            className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-red-600"
          />
        </div>

        {/* Rotation Chaos */}
        <div>
          <div className="flex justify-between text-[10px] mb-1 uppercase tracking-wider text-zinc-400">
            <span>Rotation Chaos</span>
            <span className="text-red-400">{params.rotationChaos.toFixed(2)}</span>
          </div>
          <input
            type="range" min="0.0" max="1.0" step="0.01"
            value={params.rotationChaos}
            onChange={(e) => updateParam('rotationChaos', parseFloat(e.target.value))}
            className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-red-600"
          />
        </div>

        {/* Red Noise Intensity */}
        <div>
          <div className="flex justify-between text-[10px] mb-1 uppercase tracking-wider text-zinc-400">
            <span>Red Noise Intensity</span>
            <span className="text-red-400">{params.redNoiseIntensity.toFixed(2)}</span>
          </div>
          <input
            type="range" min="0.0" max="1.0" step="0.01"
            value={params.redNoiseIntensity}
            onChange={(e) => updateParam('redNoiseIntensity', parseFloat(e.target.value))}
            className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-red-600"
          />
        </div>

        {/* Scale Mode (Image Only) */}
        <div className={isVideo ? 'opacity-30 pointer-events-none' : ''}>
          <div className="text-[10px] mb-1 uppercase tracking-wider text-zinc-400">Scale Mode</div>
          <div className="grid grid-cols-2 gap-1">
            {Object.values(ScaleMode).map(mode => (
              <button
                key={mode}
                onClick={() => updateParam('imageScaleMode', mode)}
                className={`text-[9px] py-1 border rounded transition-all ${params.imageScaleMode === mode
                    ? 'bg-red-600 border-red-500 text-white'
                    : 'bg-zinc-900 border-white/5 text-zinc-500 hover:border-zinc-700'
                  }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-white/10">
        <button
          onClick={onExport}
          className="w-full bg-white text-black text-[10px] font-bold py-3 rounded uppercase tracking-[0.2em] hover:bg-red-500 hover:text-white transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
          Export Output
        </button>
      </div>
    </div>
  );
};

export default ControlPanel;
