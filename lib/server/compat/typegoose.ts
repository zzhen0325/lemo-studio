import {
  getModelForClass,
  index,
  modelOptions,
  Prop,
  setGlobalOptions,
  Severity,
} from '@byted/typegoose';
import type { Ref } from '@byted/typegoose';
import type { Model } from '@byted/bytedmongoose';

setGlobalOptions({
  options: {
    allowMixed: Severity.ALLOW,
  },
});

export function Database(name: string) {
  void name;
  return function decorator(target: unknown) {
    void target;
    return undefined;
  };
}

export { getModelForClass, index, modelOptions, Prop };
export type { Ref };
export type ModelType<T> = Model<T>;
