import { generateJWT, populateFilesUploads, websocketInit } from './funcs';
import { NawahBase } from './nawah-base';
import { CallArgs, SDKConfig } from './nawah.models';

export class NawahJS extends NawahBase {
  constructor() {
    super({
      websocketInit: (nawah: NawahJS, config: SDKConfig) =>
        websocketInit(nawah, config),
      populateFilesUploads: (
        nawah: NawahJS,
        config: SDKConfig,
        callArgs: CallArgs
      ) => populateFilesUploads(nawah, config, callArgs),
      cacheSet: (
        nawah: NawahJS,
        config: SDKConfig,
        key: string,
        value: string
      ) => localStorage.setItem(`nawah__${config.cacheKey}__${key}`, value),
      cacheGet: (nawah: NawahJS, config: SDKConfig, key: string) =>
        localStorage.getItem(`nawah__${config.cacheKey}__${key}`) || undefined,
      cacheRemove: (nawah: NawahJS, config: SDKConfig, key: string) =>
        localStorage.removeItem(`nawah__${config.cacheKey}__${key}`),
      generateJWT: (
        nawah: NawahJS,
        config: SDKConfig,
        callArgs: CallArgs,
        token: string
      ) => generateJWT(nawah, config, callArgs, token),
    });
  }
}
