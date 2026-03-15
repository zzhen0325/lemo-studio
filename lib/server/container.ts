import { Logger } from './compat/gulux';
import {
  ApiProviderModel,
  ApiSettingsModel,
  DatasetCollectionModel,
  DatasetEntryModel,
  GenerationModel,
  ImageAssetModel,
  InfiniteCanvasProjectModel,
  PresetCategoryModel,
  PresetModel,
  StyleStackModel,
  ToolPresetModel,
  UserModel,
  connectMongo,
} from './db';
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
import { PresetCategoriesService } from './service/preset-categories.service';
import { PresetsService } from './service/presets.service';
import { SaveImageService } from './service/save-image.service';
import { StylesService } from './service/styles.service';
import { ToolsPresetsService } from './service/tools-presets.service';
import { TranslateService } from './service/translate.service';
import { UploadService } from './service/upload.service';
import { UsersService } from './service/users.service';
import { ViewComfyConfigService } from './service/view-comfy.service';

function wire<T extends object>(service: T, dependencies: Record<string, unknown>): T {
  Object.assign(service as Record<string, unknown>, dependencies);
  return service;
}

export type ServerServices = Awaited<ReturnType<typeof createServerServices>>;

let servicesPromise: Promise<{
  logger: Logger;
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
  presetCategoriesService: PresetCategoriesService;
  presetsService: PresetsService;
  saveImageService: SaveImageService;
  stylesService: StylesService;
  toolsPresetsService: ToolsPresetsService;
  translateService: TranslateService;
  uploadService: UploadService;
  usersService: UsersService;
  viewComfyConfigService: ViewComfyConfigService;
}> | null = null;

async function createServerServices() {
  await connectMongo();

  const logger = new Logger();

  const apiConfigService = wire(new ApiConfigService(), {
    apiProviderModel: ApiProviderModel,
    apiSettingsModel: ApiSettingsModel,
  });

  const aiService = wire(new AiService(), {
    apiConfigService,
    logger,
  });

  const checkGoogleApiService = wire(new CheckGoogleApiService(), {
    apiConfigService,
  });

  const comfyFluxKleinService = new ComfyFluxKleinService();
  const comfyProxyService = new ComfyProxyService();
  const comfyService = new ComfyService();
  const datasetSyncService = new DatasetSyncService();

  const datasetService = wire(new DatasetService(), {
    datasetCollectionModel: DatasetCollectionModel,
    datasetEntryModel: DatasetEntryModel,
    imageAssetModel: ImageAssetModel,
  });

  const historyService = wire(new HistoryService(), {
    generationModel: GenerationModel,
    imageAssetModel: ImageAssetModel,
  });

  const infiniteCanvasService = wire(new InfiniteCanvasService(), {
    projectModel: InfiniteCanvasProjectModel,
  });

  const lorasService = new LorasService();

  const presetCategoriesService = wire(new PresetCategoriesService(), {
    categoryModel: PresetCategoryModel,
  });

  const presetsService = wire(new PresetsService(), {
    presetModel: PresetModel,
    imageAssetModel: ImageAssetModel,
  });

  const saveImageService = wire(new SaveImageService(), {
    imageAssetModel: ImageAssetModel,
  });

  const stylesService = wire(new StylesService(), {
    styleStackModel: StyleStackModel,
  });

  const toolsPresetsService = wire(new ToolsPresetsService(), {
    toolPresetModel: ToolPresetModel,
    imageAssetModel: ImageAssetModel,
  });

  const translateService = wire(new TranslateService(), {
    apiConfigService,
  });

  const uploadService = wire(new UploadService(), {
    imageAssetModel: ImageAssetModel,
  });

  const usersService = wire(new UsersService(), {
    userModel: UserModel,
  });

  const viewComfyConfigService = new ViewComfyConfigService();

  return {
    logger,
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
    presetCategoriesService,
    presetsService,
    saveImageService,
    stylesService,
    toolsPresetsService,
    translateService,
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
