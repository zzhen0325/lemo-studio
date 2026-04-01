import {
  DatasetRepository,
  HistoryRepository,
  ImageAssetsRepository,
  InfiniteCanvasRepository,
  PlaygroundShortcutsRepository,
  PresetsRepository,
  StylesRepository,
  ToolPresetsRepository,
  UsersRepository,
} from './repositories';
import { Logger } from './utils/logger';
import { AiService } from './service/ai.service';
import { ApiConfigService } from './service/api-config.service';
import { CheckGoogleApiService } from './service/check-google-api.service';
import { ComfyFluxKleinService } from './service/comfy-fluxklein.service';
import { ComfyProxyService } from './service/comfy-proxy.service';
import { ComfyService } from './service/comfy.service';
import { DatasetSyncService } from './service/dataset-sync.service';
import { DatasetService } from './service/dataset.service';
import { HistoryService } from './service/history.service';
import { InfiniteCanvasService } from './service/infinite-canvas.service';
import { LorasService } from './service/loras.service';
import { PlaygroundShortcutsService } from './service/playground-shortcuts.service';
import { PresetCategoriesService } from './service/preset-categories.service';
import { PresetsService } from './service/presets.service';
import { SaveImageService } from './service/save-image.service';
import { StylesService } from './service/styles.service';
import { ToolsPresetsService } from './service/tools-presets.service';
import { UploadService } from './service/upload.service';
import { UsersService } from './service/users.service';
import { ViewComfyConfigService } from './service/view-comfy.service';

function createRepositories() {
  return {
    datasetRepository: new DatasetRepository(),
    historyRepository: new HistoryRepository(),
    imageAssetsRepository: new ImageAssetsRepository(),
    infiniteCanvasRepository: new InfiniteCanvasRepository(),
    playgroundShortcutsRepository: new PlaygroundShortcutsRepository(),
    presetsRepository: new PresetsRepository(),
    stylesRepository: new StylesRepository(),
    toolPresetsRepository: new ToolPresetsRepository(),
    usersRepository: new UsersRepository(),
  };
}

export type ServerServices = Awaited<ReturnType<typeof createServerServices>>;

let servicesPromise: Promise<{
  logger: Logger;
  datasetRepository: DatasetRepository;
  historyRepository: HistoryRepository;
  imageAssetsRepository: ImageAssetsRepository;
  infiniteCanvasRepository: InfiniteCanvasRepository;
  playgroundShortcutsRepository: PlaygroundShortcutsRepository;
  presetsRepository: PresetsRepository;
  stylesRepository: StylesRepository;
  toolPresetsRepository: ToolPresetsRepository;
  usersRepository: UsersRepository;
  apiConfigService: ApiConfigService;
  aiService: AiService;
  checkGoogleApiService: CheckGoogleApiService;
  comfyFluxKleinService: ComfyFluxKleinService;
  comfyProxyService: ComfyProxyService;
  comfyService: ComfyService;
  datasetSyncService: DatasetSyncService;
  datasetService: DatasetService;
  historyService: HistoryService;
  infiniteCanvasService: InfiniteCanvasService;
  lorasService: LorasService;
  playgroundShortcutsService: PlaygroundShortcutsService;
  presetCategoriesService: PresetCategoriesService;
  presetsService: PresetsService;
  saveImageService: SaveImageService;
  stylesService: StylesService;
  toolsPresetsService: ToolsPresetsService;
  uploadService: UploadService;
  usersService: UsersService;
  viewComfyConfigService: ViewComfyConfigService;
}> | null = null;

async function createServerServices() {
  const logger = new Logger();
  const repositories = createRepositories();

  const apiConfigService = new ApiConfigService();
  const aiService = new AiService(apiConfigService, logger);
  const checkGoogleApiService = new CheckGoogleApiService(apiConfigService);
  const comfyFluxKleinService = new ComfyFluxKleinService();
  const comfyProxyService = new ComfyProxyService();
  const comfyService = new ComfyService();
  const datasetSyncService = new DatasetSyncService();
  const datasetService = new DatasetService(repositories.datasetRepository, repositories.imageAssetsRepository);
  const historyService = new HistoryService(repositories.historyRepository);
  const infiniteCanvasService = new InfiniteCanvasService(repositories.infiniteCanvasRepository);
  const lorasService = new LorasService();
  const playgroundShortcutsService = new PlaygroundShortcutsService(repositories.playgroundShortcutsRepository);
  const presetCategoriesService = new PresetCategoriesService(repositories.presetsRepository);
  const presetsService = new PresetsService(repositories.presetsRepository, repositories.imageAssetsRepository);
  const saveImageService = new SaveImageService(repositories.imageAssetsRepository);
  const stylesService = new StylesService(repositories.stylesRepository);
  const toolsPresetsService = new ToolsPresetsService(repositories.toolPresetsRepository, repositories.imageAssetsRepository);
  const uploadService = new UploadService(repositories.imageAssetsRepository);
  const usersService = new UsersService(repositories.usersRepository);
  const viewComfyConfigService = new ViewComfyConfigService();

  return {
    logger,
    ...repositories,
    apiConfigService,
    aiService,
    checkGoogleApiService,
    comfyFluxKleinService,
    comfyProxyService,
    comfyService,
    datasetSyncService,
    datasetService,
    historyService,
    infiniteCanvasService,
    lorasService,
    playgroundShortcutsService,
    presetCategoriesService,
    presetsService,
    saveImageService,
    stylesService,
    toolsPresetsService,
    uploadService,
    usersService,
    viewComfyConfigService,
  };
}

export async function getServerServices() {
  if (!servicesPromise) {
    servicesPromise = createServerServices().catch((error) => {
      servicesPromise = null;
      throw error;
    });
  }

  return servicesPromise;
}
