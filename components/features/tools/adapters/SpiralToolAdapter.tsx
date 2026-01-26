import dynamic from 'next/dynamic';
import { ToolComponentProps } from '../tool-configs';

// 动态导入以避免 SSR 和副作用冲突
const Spiral = dynamic(() => import('@/components/ui/spiral'), {
    ssr: false,
    loading: () => <div className="w-full h-full bg-black flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin"></div></div>
});

const SpiralToolAdapter: React.FC<ToolComponentProps> = (props) => {
    // 映射通用的参数到 Spiral 组件特定的 props
    const spiralProps = {
        totalDots: typeof props.totalDots === 'number' ? props.totalDots : 900,
        dotRadius: typeof props.dotRadius === 'number' ? props.dotRadius : 2,
        duration: typeof props.duration === 'number' ? props.duration : 1,
        dotColor: typeof props.dotColor === 'string' ? props.dotColor : "#FFFFFF",
        backgroundColor: typeof props.backgroundColor === 'string' ? props.backgroundColor : "#000000",
        margin: typeof props.margin === 'number' ? props.margin : 2,
        minOpacity: typeof props.minOpacity === 'number' ? props.minOpacity : 0.3,
        maxOpacity: typeof props.maxOpacity === 'number' ? props.maxOpacity : 1,
        minScale: typeof props.minScale === 'number' ? props.minScale : 0.5,
        maxScale: typeof props.maxScale === 'number' ? props.maxScale : 1.5,
        useMultipleColors: typeof props.useMultipleColors === 'boolean' ? props.useMultipleColors : false,
        colors: Array.isArray(props.colors) ? props.colors : [
            { color: props.color1 as string || "#FF0000" },
            { color: props.color2 as string || "#00FF00" },
            { color: props.color3 as string || "#0000FF" },
        ],
    };

    return (
        <div className="w-full h-full flex items-center justify-center bg-black">
            <div className="w-full h-full max-w-[800px] max-h-[800px] aspect-square">
                <Spiral {...spiralProps} />
            </div>
        </div>
    );
};

export default SpiralToolAdapter;
