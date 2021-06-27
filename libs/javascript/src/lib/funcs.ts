import * as rs from 'jsrsasign';
import { Observable, Subject } from 'rxjs';
import { webSocket } from 'rxjs/webSocket';
import { NawahBase } from './nawah-base';
import { CallArgs, Doc, Res, SDKConfig } from './nawah.models';

const JWS = rs.KJUR.jws.JWS;

export function populateFilesUploads(
  nawah: NawahBase,
  config: SDKConfig,
  callArgs: CallArgs
): Array<Observable<Res<Doc>>> {
  const files: {
    [key: string]: FileList;
  } = {};
  const filesUploads: Array<Observable<Res<Doc>>> = [];

  if (callArgs.doc) {
    for (const attr of Object.keys(callArgs.doc)) {
      if (callArgs.doc[attr] instanceof FileList) {
        nawah.log('log', 'Detected FileList for doc attr:', attr);
        files[attr] = callArgs.doc[attr];
        callArgs.doc[attr] = [];
        nawah.log('log', 'Attempting to read files from:', files[attr]);
        for (let i = 0; i < files[attr].length; i++) {
          callArgs.doc[attr].push(files[attr][i].name);
          nawah.log('log', 'Attempting to read file:', i, files[attr][i]);
          const fileUpload: Observable<Res<Doc>> = new Observable(
            (observer) => {
              const form: FormData = new FormData();
              form.append('__module', callArgs.endpoint.split('/')[0]);
              form.append('__attr', attr);
              form.append(
                'lastModified',
                files[attr][i].lastModified.toString()
              );
              form.append('type', files[attr][i].type);
              form.append('name', files[attr][i].name);
              form.append('file', files[attr][i], files[attr][i].name);
              const xhr: XMLHttpRequest = new XMLHttpRequest();

              xhr.responseType = 'json';

              xhr.onload = () => {
                const res: Res<Doc> = xhr.response;
                if (res.status != 200 || !res.args.count) {
                  observer.error(xhr.response);
                  return;
                }

                callArgs.doc![attr][i] = {
                  __file: res.args.docs[0]._id,
                };
                observer.complete();
                observer.unsubscribe();
              };

              xhr.onerror = () => {
                observer.error(xhr.response);
              };

              xhr.open(
                'POST',
                `${config.api
                  .replace('ws', 'http')
                  .replace('/ws', '')}/file/create`
              );
              xhr.setRequestHeader('X-Auth-Bearer', callArgs.sid!);
              xhr.setRequestHeader('X-Auth-Token', callArgs.token!);
              xhr.setRequestHeader('X-Auth-App', config.appId);
              xhr.send(form);
            }
          );
          filesUploads.push(fileUpload);
        }
      }
    }
  }

  nawah.log('log', 'Populated filesObservables:', filesUploads);

  return filesUploads;
}

export function websocketInit(nawah: NawahBase, config: SDKConfig): Subject<any> {
  return webSocket(config.api);
}

export function generateJWT(nawah: NawahBase, config: SDKConfig, callArgs: CallArgs, token: string) {
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
};