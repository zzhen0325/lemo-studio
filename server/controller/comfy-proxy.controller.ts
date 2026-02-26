import { Inject } from '@gulux/gulux';
import { Body, Controller, Delete, Get, Header, Patch, Post, Put, Query, Res, Files } from '@gulux/gulux/application-http';
import type { HTTPResponse } from '@gulux/gulux/application-http';
import { Readable } from 'node:stream';
import { ComfyProxyService } from '../service/comfy-proxy.service';

@Controller('/comfy-proxy')
export default class ComfyProxyController {
  @Inject()
  private readonly comfyProxyService!: ComfyProxyService;

  private async handleRequest(
    method: string,
    query: Record<string, string | string[] | undefined>,
    body: unknown,
    files: Record<string, unknown> | undefined,
    res?: HTTPResponse,
    headerApiKey?: string,
    authorization?: string,
  ) {
    const pathValue = query.path;
    const path = Array.isArray(pathValue) ? pathValue[0] : pathValue;
    const apiKey = headerApiKey || (typeof query.apiKey === 'string' ? query.apiKey : undefined) || (typeof query.comfyApiKey === 'string' ? query.comfyApiKey : undefined);

    const response = await this.comfyProxyService.proxyRequest({
      method,
      path,
      query,
      body,
      files,
      apiKey,
      authorization,
    });

    if (!res) {
      return response;
    }

    res.status = response.status;
    for (const [key, value] of response.headers.entries()) {
      const lower = key.toLowerCase();
      if (['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade'].includes(lower)) {
        continue;
      }
      res.set(key, value);
    }
    if (response.body) {
      const stream = response.body as ReadableStream<Uint8Array>;
      res.body = (Readable as unknown as { fromWeb: (stream: ReadableStream<Uint8Array>) => Readable }).fromWeb(stream);
    }
  }

  @Get()
  public async getProxy(
    @Query() query: Record<string, string | string[] | undefined>,
    @Header('x-comfy-api-key') headerApiKey?: string,
    @Header('authorization') authorization?: string,
    @Res() res?: HTTPResponse,
  ) {
    return this.handleRequest('GET', query, undefined, undefined, res, headerApiKey, authorization);
  }

  @Post()
  public async postProxy(
    @Query() query: Record<string, string | string[] | undefined>,
    @Body() body: unknown,
    @Files() files: Record<string, unknown>,
    @Header('x-comfy-api-key') headerApiKey?: string,
    @Header('authorization') authorization?: string,
    @Res() res?: HTTPResponse,
  ) {
    return this.handleRequest('POST', query, body, files, res, headerApiKey, authorization);
  }

  @Put()
  public async putProxy(
    @Query() query: Record<string, string | string[] | undefined>,
    @Body() body: unknown,
    @Files() files: Record<string, unknown>,
    @Header('x-comfy-api-key') headerApiKey?: string,
    @Header('authorization') authorization?: string,
    @Res() res?: HTTPResponse,
  ) {
    return this.handleRequest('PUT', query, body, files, res, headerApiKey, authorization);
  }

  @Patch()
  public async patchProxy(
    @Query() query: Record<string, string | string[] | undefined>,
    @Body() body: unknown,
    @Files() files: Record<string, unknown>,
    @Header('x-comfy-api-key') headerApiKey?: string,
    @Header('authorization') authorization?: string,
    @Res() res?: HTTPResponse,
  ) {
    return this.handleRequest('PATCH', query, body, files, res, headerApiKey, authorization);
  }

  @Delete()
  public async deleteProxy(
    @Query() query: Record<string, string | string[] | undefined>,
    @Body() body: unknown,
    @Header('x-comfy-api-key') headerApiKey?: string,
    @Header('authorization') authorization?: string,
    @Res() res?: HTTPResponse,
  ) {
    return this.handleRequest('DELETE', query, body, undefined, res, headerApiKey, authorization);
  }
}
