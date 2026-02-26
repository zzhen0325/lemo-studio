import { ComfyUIService } from '@/lib/api/comfyui-service';
import { type NextRequest, NextResponse } from 'next/server';
import { ErrorResponseFactory } from '@/app/models/errors';
import { IViewComfy } from '@/types/comfy-input';

// 简单的日志工具类
const logger = {
    log: (message: unknown, ...args: unknown[]) => console.log(message, ...args),
    info: (message: unknown, ...args: unknown[]) => console.info(message, ...args),
    error: (message: unknown, ...args: unknown[]) => console.error(message, ...args),
    warn: (message: unknown, ...args: unknown[]) => console.warn(message, ...args),
};

const errorResponseFactory = new ErrorResponseFactory();

export async function POST(request: NextRequest) {
    const logid = request.headers.get('x-tt-logid');
    // console.log('logid:', request.headers.get('x-tt-logid'));
    // console.log('所有请求头:', JSON.stringify(headersObj, null, 2));

    // logger.info('============ req ==============', {
    //     referer: request.headers.get('referer'),
    //     headers: headersObj
    // });

    const formData = await request.formData();
    let workflow = undefined;
    if (formData.get('workflow') && formData.get('workflow') !== 'undefined') {
        workflow = JSON.parse(formData.get('workflow') as string);
    }
    logger.log({
        logId: logid ?? '',
        message: '============ logid ==============',
    });
    let viewComfy: IViewComfy = { inputs: [], textOutputEnabled: false };
    if (formData.get('viewComfy') && formData.get('viewComfy') !== 'undefined') {
        viewComfy = JSON.parse(formData.get('viewComfy') as string);
    }

    // for (const [key, value] of Array.from(formData.entries())) {
    //     if (key !== 'workflow') {
    //         console.log(value, File, File instanceof Blob, value instanceof Blob);
    //         logger.info('============ file 挂了！ ==============');
    //         if (value instanceof File) {
    //             viewComfy.inputs.push({ key, value });
    //         }
    //     }
    // }

    if (!viewComfy) {
        return new NextResponse("viewComfy is required", { status: 400 });
    }
    // return NextResponse.json({ message: 'success' });
    try {
        const apiKey = formData.get('apiKey') as string | undefined;

        const comfyUIService = new ComfyUIService({ apiKey });
        const stream = await comfyUIService.runWorkflow({ workflow, viewComfy });
        logger.log({
            logId: logid ?? '',
            message: '============ stream ==============',
        });
        return new NextResponse<ReadableStream<Uint8Array>>(stream, {
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': 'attachment; filename="generated_images.bin"'
            }
        });
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    } catch (error: unknown) {
        logger.log({
            level: 'error',
            logId: logid ?? '',
            message: '============ catch ==============',
        });
        const responseError = errorResponseFactory.getErrorResponse(error);
        return NextResponse.json(responseError, {
            status: 500,
        });
    }
}
