import { Inject } from '@gulux/gulux';
import { Body, Controller, Header, Post, Res } from '@gulux/gulux/application-http';
import type { HTTPResponse } from '@gulux/gulux/application-http';
import { Readable } from 'node:stream';
import { ComfyFluxKleinService } from '../service/comfy-fluxklein.service';

@Controller('/comfy-fluxklein')
export default class ComfyFluxKleinController {
  @Inject()
  private readonly comfyFluxKleinService!: ComfyFluxKleinService;

  @Post()
  public async postFluxKlein(
    @Body() body: Record<string, unknown>,
    @Header('x-tt-logid') logIdHeader?: string,
    @Header('X-TT-LOGID') logIdHeaderUpper?: string,
    @Res() res?: HTTPResponse,
  ) {
    const logId = logIdHeader ?? logIdHeaderUpper;
    const stream = await this.comfyFluxKleinService.runFluxKleinFromBody(body, logId);
    if (res) {
      res.set('Content-Type', 'application/octet-stream');
      res.set('Content-Disposition', 'attachment; filename="generated_images.bin"');
      const fromWeb = (Readable as unknown as { fromWeb: (stream: ReadableStream<Uint8Array>) => unknown }).fromWeb;
      res.body = fromWeb(stream);
      return;
    }
    return stream;
  }
}
