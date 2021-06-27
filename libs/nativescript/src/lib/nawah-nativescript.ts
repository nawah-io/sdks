import { session } from '@nativescript/background-http';
import { ApplicationSettings, File } from '@nativescript/core';
import { CallArgs, Doc, NawahBase, Res, SDKConfig } from '@nawah/javascript';
import * as rs from 'jsrsasign';
import { Observable } from 'rxjs';
import { webSocket } from 'rxjs/webSocket';

const JWS = rs.KJUR.jws.JWS;

export class NawahNS extends NawahBase {
  constructor() {
    super({
      websocketInit: (nawah: NawahBase, config: SDKConfig) => {
        require('nativescript-websockets');
        return webSocket(config.api);
      },
      cacheSet: (
        nawah: NawahBase,
        config: SDKConfig,
        key: string,
        value: string
      ) => ApplicationSettings.setString(key, value),
      cacheGet: (nawah: NawahBase, config: SDKConfig, key: string) =>
        ApplicationSettings.getString(key),
      generateJWT: (
        nawah: NawahBase,
        config: SDKConfig,
        callArgs: CallArgs,
        token: string
      ) => {
        const oHeader = { alg: 'HS256', typ: 'JWT' };
        const tNow = Math.round(new Date().getTime() / 1000);
        const tEnd = Math.round(new Date().getTime() / 1000) + 86400;
        const sHeader = JSON.stringify(oHeader);
        const sPayload = JSON.stringify({
          ...callArgs,
          iat: tNow,
          exp: tEnd,
        });
        const sJWT = JWS.sign('HS256', sHeader, sPayload, {
          utf8: token,
        });

        nawah.log('log', 'Generated token for', callArgs.endpoint, ':', sJWT);

        return sJWT;
      },
      populateFilesUploads: (
        nawah: NawahBase,
        config: SDKConfig,
        callArgs: CallArgs
      ) => {
        if (!callArgs.doc) return [];
        const files: { [key: string]: Array<File> } = {};
        const filesUploads: Array<Observable<Res<Doc>>> = [];
        for (const attr of Object.keys(callArgs.doc)) {
          // [DOC] Assert valid type before checking
          if (
            callArgs.doc[attr] instanceof Array &&
            callArgs.doc[attr].length &&
            callArgs.doc[attr][0] instanceof File
          ) {
            nawah.log('log', 'Detected File for doc attr: ', attr);
            files[attr] = callArgs.doc[attr];
            callArgs.doc[attr] = [];

            nawah.log('log', 'Attempting to read files from:', files[attr]);
            for (const i of Object.keys(files[attr])) {
              callArgs.doc[attr].push(files[attr][Number(i)].name);
              nawah.log(
                'log',
                'Attempting to read file:',
                i,
                files[attr][Number(i)]
              );

              const url = `${config.api
                .replace('ws', 'http')
                .replace('/ws', '')}/file/create`;
              const description = 'ns-limp file upload';

              const request = {
                url: url,
                method: 'POST',
                headers: {
                  'Content-Type': 'multipart/form-data',
                  'X-Auth-Bearer': callArgs.sid,
                  'X-Auth-Token': callArgs.token,
                  'X-Auth-App': config.appId,
                },
                description: description,
                androidAutoDeleteAfterUpload: false,
                androidNotificationTitle: 'Photo Uploading...',
              };
              const fileUpload: Observable<Res<Doc>> = new Observable<Res<Doc>>(
                (observer) => {
                  const params = [
                    {
                      name: '__module',
                      value: callArgs.endpoint.split('/')[0],
                    },
                    { name: '__attr', value: attr },
                    { name: 'name', value: files[attr][Number(i)].name },
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    {
                      name: 'type',
                      value: (files[attr][Number(i)] as any).type,
                    },
                    {
                      name: 'lastModified',
                      value: (Number(new Date().getTime()) / 1000)
                        .toFixed(0)
                        .toString(),
                    },
                    { name: 'file', filename: files[attr][Number(i)].path },
                  ];
                  const task = session(
                    new Date().getTime().toString()
                  ).multipartUpload(params, request);

                  task.on('complete', () => {
                    nawah.log('log', 'File uploaded.... complete');
                  });

                  task.on('responded', (e) => {
                    nawah.log('log', 'File uploaded....');
                    const res: Res<Doc> = JSON.parse(e.data);
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (callArgs as any).doc[attr][i] = {
                      __file: res.args.docs[0]._id,
                    };
                    observer.complete();
                    observer.unsubscribe();
                  });

                  task.on('error', (e) => {
                    nawah.log(
                      'log',
                      'File upload error....',
                      e.responseCode,
                      e.response
                    );
                    observer.error(e);
                  });
                }
              );
              filesUploads.push(fileUpload);
            }
          }
        }

        nawah.log('log', 'Populated filesObservables:', filesUploads);

        return filesUploads;
      },
    });
  }
}
