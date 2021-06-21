import { Observable, Subject } from 'rxjs';
import { webSocket } from 'rxjs/webSocket';
import { Nawah } from './nawah';
import { CallArgs, Doc, Res, ResArgsDoc, SDKConfig } from './nawah.models';

export function populateFilesUploads(
  nawah: Nawah,
  config: SDKConfig,
  callArgs: CallArgs
): Array<Observable<Res<Doc>>> {
  let files: {
    [key: string]: FileList;
  } = {};
  let filesUploads: Array<Observable<Res<Doc>>> = [];

  if (callArgs.doc) {
    for (let attr of Object.keys(callArgs.doc)) {
      if (callArgs.doc[attr] instanceof FileList) {
        nawah.log('log', 'Detected FileList for doc attr:', attr);
        files[attr] = callArgs.doc[attr];
        callArgs.doc[attr] = [];
        nawah.log('log', 'Attempting to read files from:', files[attr]);
        for (let i = 0; i < files[attr].length; i++) {
          callArgs.doc[attr].push(files[attr][i].name);
          nawah.log('log', 'Attempting to read file:', i, files[attr][i]);
          let fileUpload: Observable<Res<Doc>> = new Observable((observer) => {
            let form: FormData = new FormData();
            form.append('__module', callArgs.endpoint.split('/')[0]);
            form.append('__attr', attr);
            form.append('lastModified', files[attr][i].lastModified.toString());
            form.append('type', files[attr][i].type);
            form.append('name', files[attr][i].name);
            form.append('file', files[attr][i], files[attr][i].name);
            let xhr: XMLHttpRequest = new XMLHttpRequest();

            xhr.responseType = 'json';

            xhr.onload = () => {
              callArgs.doc![attr][i] = {
                __file: (xhr.response as Res<Doc, ResArgsDoc>).args.docs[0]._id,
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
          });
          filesUploads.push(fileUpload);
        }
      }
    }
  }

  nawah.log('log', 'Populated filesObservables:', filesUploads);

  return filesUploads;
}

export function websocketInit(nawah: Nawah, config: SDKConfig): Subject<any> {
    return webSocket(config.api);
}