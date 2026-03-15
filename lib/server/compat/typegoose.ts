import {
  getModelForClass,
  index,
  modelOptions,
  Prop,
  setGlobalOptions,
  Severity,
} from '@typegoose/typegoose';
import type { Ref } from '@typegoose/typegoose';
import type { Model } from 'mongoose';

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
