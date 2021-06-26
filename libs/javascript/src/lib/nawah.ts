import * as rs from 'jsrsasign';
import {
  combineLatest,
  interval,
  Observable,
  Subject,
  Subscription,
} from 'rxjs';
import { populateFilesUploads, websocketInit } from './funcs';
import {
  CallArgs,
  Doc,
  Query,
  Res,
  ResArgsDoc,
  ResArgsMsg,
  ResArgsSession,
  SDKConfig,
  Session,
} from './nawah.models';

const JWS = rs.KJUR.jws.JWS;

export enum INIT_STATE {
  NOT_INITED = 'NOT_INITED',
  INITING = 'INITING',
  INITED = 'INITED',
  DISCONNECTED = 'DISCONNECTED',
}

export enum AUTH_STATE {
  NOT_AUTHED = 'NOT_AUTHED',
  AUTHING = 'AUTHING',
  AUTHED = 'AUTHED',
}

export class Nawah {
  #config!: SDKConfig;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  #subject!: Subject<any>;
  #conn: Subject<Res<Doc>> = new Subject();

  #heartbeat: Observable<number> = interval(30000);
  #heartbeat$: Subscription = this.#heartbeat.subscribe({
    next: () => {
      if (this.inited == INIT_STATE.INITED && this.heartbeatActive) {
        this.call({ endpoint: 'heart/beat' }).subscribe({
          complete: () => {
            this.log('log', 'heart beat complete..');
          },
          error: () => {
            this.log('log', 'heart beat ....');
          },
        });
      }
    },
  });
  heartbeatActive = true;

  #queue: {
    noAuth: Array<{ subject: Array<Observable<Res<Doc>>>; callArgs: CallArgs }>;
    auth: Array<{ subject: Array<Observable<Res<Doc>>>; callArgs: CallArgs }>;
  } = {
    noAuth: [],
    auth: [],
  };

  inited: INIT_STATE = INIT_STATE.NOT_INITED;
  inited$: Subject<INIT_STATE> = new Subject();

  authed: AUTH_STATE = AUTH_STATE.NOT_AUTHED;
  authed$: Subject<AUTH_STATE> = new Subject();

  session?: Session;

  static websocketInit = (nawah: Nawah, config: SDKConfig) =>
    websocketInit(nawah, config);
  static populateFilesUploads = (
    nawah: Nawah,
    config: SDKConfig,
    callArgs: CallArgs
  ) => populateFilesUploads(nawah, config, callArgs);
  static cacheSet = (
    nawah: Nawah,
    config: SDKConfig,
    key: string,
    value: string
  ) => localStorage.setItem(`nawah__${config.cacheKey}__${key}`, value);
  static cacheGet = (nawah: Nawah, config: SDKConfig, key: string) =>
    localStorage.getItem(`nawah__${config.cacheKey}__${key}`) || undefined;
  static cacheRemove = (nawah: Nawah, config: SDKConfig, key: string) =>
    localStorage.removeItem(`nawah__${config.cacheKey}__${key}`);
  static generateJWT = (
    nawah: Nawah,
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
  };

  static setCallables(
    callables: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      websocketInit?: (nawah: Nawah, config: SDKConfig) => Subject<any>;
      populateFilesUploads?: (
        nawah: Nawah,
        config: SDKConfig,
        callArgs: CallArgs
      ) => Array<Observable<Res<Doc>>>;
      cacheSet?: (
        nawah: Nawah,
        config: SDKConfig,
        key: string,
        value: string
      ) => void;
      cacheGet?: (
        nawah: Nawah,
        config: SDKConfig,
        key: string
      ) => string | undefined;
      cacheRemove?: (nawah: Nawah, config: SDKConfig, key: string) => void;
      generateJWT?: (
        nawah: Nawah,
        config: SDKConfig,
        callArgs: CallArgs,
        token: string
      ) => string;
    } = {}
  ): void {
    if (callables.websocketInit) {
      Nawah.websocketInit = callables.websocketInit;
    }
    if (callables.populateFilesUploads) {
      Nawah.populateFilesUploads = callables.populateFilesUploads;
    }
    if (callables.cacheSet) {
      Nawah.cacheSet = callables.cacheSet;
    }
    if (callables.cacheGet) {
      Nawah.cacheGet = callables.cacheGet;
    }
    if (callables.cacheRemove) {
      Nawah.cacheRemove = callables.cacheRemove;
    }
    if (callables.generateJWT) {
      Nawah.generateJWT = callables.generateJWT;
    }
  }

  constructor() {
    this.inited$.subscribe({
      next: (init) => {
        this.inited = init;
        if (init == INIT_STATE.INITED) {
          if (this.#queue.noAuth) {
            this.log(
              'info',
              'Found calls in noAuth queue:',
              this.#queue.noAuth
            );
          }
          for (const call of this.#queue.noAuth) {
            this.log('info', 'processing noAuth call: ', call);
            combineLatest(call.subject).subscribe({
              complete: () => {
                // [DOC] Set callArgs sid, token as these values are were not present when the call was queued
                call.callArgs.sid = 'f00000000000000000000012';
                call.callArgs.token = this.#config.anonToken;
                this.log(
                  'info',
                  'sending noAuth queue request as JWT token:',
                  call.callArgs,
                  this.#config.anonToken
                );
                this.#subject.next({
                  token: Nawah.generateJWT(
                    this,
                    this.#config,
                    call.callArgs,
                    this.#config.anonToken
                  ),
                  call_id: call.callArgs.call_id,
                });
              },
              error: (err) => {
                this.log(
                  'error',
                  'Received error on fileSubject/filesSubjects: ',
                  err
                ); // [TODO] Specify subject for better debugging.
              },
            });
          }
          this.#queue.noAuth = [];
        }
      },
    });

    this.authed$.subscribe({
      next: (auth) => {
        this.authed = auth;
        if (auth == AUTH_STATE.AUTHED) {
          if (this.#queue.noAuth) {
            this.log('info', 'Found calls in auth queue:', this.#queue.auth);
          }
          for (const call of this.#queue.auth) {
            this.log('info', 'processing auth call: ', call);
            combineLatest(call.subject).subscribe({
              complete: () => {
                // [DOC] Set callArgs sid, token as these values are were not present when the call was queued
                call.callArgs.sid = this.session?._id;
                call.callArgs.token = this.session?.token;
                this.log(
                  'info',
                  'sending auth queue request as JWT token:',
                  call.callArgs,
                  this.#config.anonToken
                );
                this.#subject.next({
                  token: Nawah.generateJWT(
                    this,
                    this.#config,
                    call.callArgs,
                    (this.session as Session).token
                  ),
                  call_id: call.callArgs.call_id,
                });
              },
              error: (err) => {
                this.log(
                  'error',
                  'Received error on fileSubject/filesSubjects: ',
                  err
                ); // [TODO] Specify subject for better debugging.
              },
            });
          }
          this.#queue.auth = [];
        }
      },
    });
  }

  log(level: 'log' | 'info' | 'warn' | 'error', ...data: Array<unknown>): void {
    if (!this.#config?.debug) return;
    console[level](...data);
  }

  init(config: SDKConfig): Observable<Res<Doc>> {
    if (!config.api.startsWith('ws://') && !config.api.startsWith('wss://')) {
      throw new Error('SDK api is invalid');
    }
    if (config.authAttrs.length == 0) {
      throw new Error('SDK authAttrs not set');
    }
    config.debug ??= false;
    config.cacheKey ??= Math.random().toString(36).substring(7);
    this.#config = config;
    this.log('log', 'Resetting SDK before init');
    this.reset();
    this.#subject = Nawah.websocketInit(this, this.#config);

    this.log('log', 'Attempting to connect');

    this.#subject.subscribe({
      next: (res: Res<Doc>) => {
        this.log('log', 'Received new message:', res);
        this.#conn.next(res);
        if ((res.args as ResArgsMsg)?.code == 'CORE_CONN_READY') {
          this.reset();
          this.#config.anonToken = config.anonToken;
          this.call({
            endpoint: 'conn/verify',
            sid: 'f00000000000000000000012',
            token: this.#config.anonToken,
            doc: { app: config.appId },
          }).subscribe();
        } else if ((res.args as ResArgsMsg)?.code == 'CORE_CONN_OK') {
          this.inited$.next(INIT_STATE.INITED);
        } else if ((res.args as ResArgsMsg)?.code == 'CORE_CONN_CLOSED') {
          this.reset();
        } else if ((res.args as ResArgsSession)?.session) {
          this.log('log', 'Response has session obj');
          if (
            (res.args as ResArgsSession)?.session._id ==
            'f00000000000000000000012'
          ) {
            if (this.authed == AUTH_STATE.AUTHED) {
              this.session = undefined;
              this.authed$.next(AUTH_STATE.NOT_AUTHED);
            }

            Nawah.cacheRemove(this, this.#config, 'token');
            Nawah.cacheRemove(this, this.#config, 'sid');
            this.log('log', 'Session is null');
          } else {
            Nawah.cacheSet(
              this,
              this.#config,
              'sid',
              (res.args as ResArgsSession)?.session._id
            );
            Nawah.cacheSet(
              this,
              this.#config,
              'token',
              (res.args as ResArgsSession)?.session.token
            );
            this.session = (res.args as ResArgsSession)?.session;
            this.authed$.next(AUTH_STATE.AUTHED);
            this.log('log', 'Session updated');
          }
        }
      },
      error: (err: Res<Doc>) => {
        this.log('log', 'Received error:', err);
        this.#conn.error(err);
        this.reset(true);
      },
      complete: () => {
        this.log('log', 'Connection clean-closed');
        this.reset();
      },
    });

    return this.#subject;
  }

  close(): Observable<Res<Doc>> {
    const call = this.call({
      endpoint: 'conn/close',
    });
    return call;
  }

  reset(forceInited: boolean = false): void {
    try {
      if (forceInited || this.inited == INIT_STATE.INITED) {
        this.inited$.next(INIT_STATE.DISCONNECTED);
      }

      if (this.session) {
        this.session = undefined;
        this.authed$.next(AUTH_STATE.NOT_AUTHED);
      }
    } catch (error) {
      this.log('error', 'Unexpected error while resetting SDK.', error);
    }
  }

  call<T extends Doc>(callArgs: CallArgs): Observable<Res<T>> {
    if (this.authed == AUTH_STATE.AUTHED) {
      callArgs.sid =
        callArgs.sid ||
        Nawah.cacheGet(this, this.#config, 'sid') ||
        'f00000000000000000000012';
      callArgs.token =
        callArgs.token ||
        Nawah.cacheGet(this, this.#config, 'token') ||
        this.#config.anonToken;
    } else if (this.inited == INIT_STATE.INITED) {
      callArgs.sid = callArgs.sid || 'f00000000000000000000012';
      callArgs.token = callArgs.token || this.#config.anonToken;
    }
    callArgs.query = callArgs.query || [];
    callArgs.doc = callArgs.doc || {};
    callArgs.awaitAuth = callArgs.awaitAuth || false;
    callArgs.call_id = Math.random().toString(36).substring(7);

    this.log('log', 'callArgs', callArgs);

    const filesUploads = Nawah.populateFilesUploads(
      this,
      this.#config,
      callArgs
    );

    if (
      (this.inited == INIT_STATE.INITED &&
        callArgs.awaitAuth &&
        this.authed == AUTH_STATE.AUTHED) ||
      (this.inited == INIT_STATE.INITED && !callArgs.awaitAuth) ||
      callArgs.endpoint == 'conn/verify'
    ) {
      combineLatest(filesUploads).subscribe({
        error: (err) => {
          this.log('error', 'Received error on filesSubjects:', err);
        },
        complete: () => {
          this.log(
            'log',
            'sending request as JWT token:',
            callArgs,
            callArgs.token
          );
          this.#subject.next({
            token: Nawah.generateJWT(
              this,
              this.#config,
              callArgs,
              callArgs.token as string
            ),
            call_id: callArgs.call_id,
          });
        },
      });
    } else {
      this.log('warn', 'SDK not yet inited. Queuing call:', callArgs);
      if (callArgs.awaitAuth) {
        this.log('warn', 'Queuing in auth queue.');
        this.#queue.auth.push({
          subject: filesUploads,
          callArgs: callArgs,
        });
      } else {
        this.log('warn', 'Queuing in noAuth queue.');
        this.#queue.noAuth.push({
          subject: filesUploads,
          callArgs: callArgs,
        });
      }
    }

    const call = new Observable<Res<T>>((observer) => {
      const observable = this.#conn.subscribe({
        next: (res: Res<Doc>) => {
          if ((res.args as ResArgsDoc<Doc>)?.call_id == callArgs.call_id) {
            this.log(
              'log',
              'message received from observer on call_id:',
              res,
              callArgs.call_id
            );
            if (res.status == 200) {
              observer.next(res as Res<T>);
            } else {
              observer.error(res);
            }

            if (!(res.args as ResArgsDoc).watch) {
              this.log(
                'log',
                'completing the observer with call_id:',
                res.args.call_id
              );
              observer.complete();
              observer.unsubscribe();
              observable.unsubscribe();
            } else {
              this.log('log', 'Detected watch with call_id:', res.args.call_id);
            }
          }
        },
        error: (err: Res<Doc>) => {
          if (err.args?.call_id == callArgs.call_id) {
            observer.error(err);
          }
        },
        complete: () => {
          observer.complete();
        },
      });
    });
    return call;
  }

  deleteWatch(watch: string | '__all'): Observable<Res<Doc>> {
    const call = this.call({
      endpoint: 'watch/delete',
      query: [{ watch: watch }],
    });
    call.subscribe({
      error: (err: Res<Doc>) => {
        this.log('error', 'deleteWatch call err:', err);
      },
    });
    return call;
  }

  generateAuthHash(authVar: string, authVal: string, password: string): string {
    if (this.#config.authAttrs.indexOf(authVar) == -1 && authVar != 'token') {
      throw new Error(
        `Unknown authVar '${authVar}'. Accepted authAttrs: '${this.#config.authAttrs.join(
          ', '
        )}, token'`
      );
    }
    if (!password.match(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.{8,})/)) {
      throw new Error(
        'Password should be 8 chars, contains one lower-case char, one upper-case char, one number at least.'
      );
    }
    return `${authVar}${authVal}${password}${this.#config.anonToken}`;
  }

  auth(
    authVar: string,
    authVal: string,
    password: string,
    groups?: Array<string>
  ): Observable<Res<Doc>> {
    if (this.authed == AUTH_STATE.AUTHED)
      throw new Error('User already authed.');
    if (this.#config.authAttrs.indexOf(authVar) == -1) {
      throw new Error(
        `Unknown authVar '${authVar}'. Accepted authAttrs: '${this.#config.authAttrs.join(
          ', '
        )}'`
      );
    }
    this.authed$.next(AUTH_STATE.AUTHING);
    const doc: { [key: string]: string | Array<string> } = {
      hash: this.generateAuthHash(authVar, authVal, password),
    };
    doc[authVar] = authVal;
    if (groups && groups.length) {
      doc.groups = groups;
    }
    const call = this.call<Doc>({
      endpoint: 'session/auth',
      doc: doc,
    });
    call.subscribe({
      error: (err: Res<Doc>) => {
        this.authed$.next(AUTH_STATE.AUTHING);
        this.log('error', 'auth call err:', err);
      },
    });
    return call;
  }

  reauth(
    sid?: string,
    token?: string,
    groups?: Array<string>
  ): Observable<Res<Doc>> {
    sid ??= Nawah.cacheGet(this, this.#config, 'sid');
    token ??= Nawah.cacheGet(this, this.#config, 'token');

    this.authed$.next(AUTH_STATE.AUTHING);
    const query: Query = [
      { _id: sid || 'f00000000000000000000012', token: token },
    ];
    if (groups && groups.length) {
      query.push({ groups: groups });
    }
    const call: Observable<Res<Doc>> = this.call<Doc>({
      endpoint: 'session/reauth',
      sid: 'f00000000000000000000012',
      token: this.#config.anonToken,
      query: query,
    });
    call.subscribe({
      error: (err: Res<Session>) => {
        this.log('error', 'reauth call err:', err);
        Nawah.cacheRemove(this, this.#config, 'token');
        Nawah.cacheRemove(this, this.#config, 'sid');
        this.session = undefined;
        this.authed$.next(AUTH_STATE.NOT_AUTHED);
      },
    });
    return call;
  }

  signout(): Observable<Res<Doc>> {
    if (this.authed != AUTH_STATE.AUTHED || !this.session)
      throw new Error('User not authed.');
    const call = this.call({
      endpoint: 'session/signout',
      query: [{ _id: this.session._id }],
    });
    call.subscribe({
      error: (err: Res<Doc>) => {
        this.log('error', 'signout call err:', err);
      },
    });
    return call;
  }

  checkAuth(groups?: Array<string>): Observable<Res<Doc>> {
    this.log('log', 'attempting checkAuth');

    const call = this.reauth(undefined, undefined, groups);
    return call;
  }
}
