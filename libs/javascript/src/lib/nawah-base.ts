import {
  combineLatest,
  interval,
  Observable,
  Subject,
  Subscription
} from 'rxjs';
import {
  CallArgs,
  Doc,
  Query,
  Require,
  Res,
  SDKConfig,
  Session
} from './nawah.models';

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

export class NawahBase {
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
            this._log(this, this.#config, 'log', 'heart beat complete..');
          },
          error: () => {
            this._log(this, this.#config, 'log', 'heart beat ....');
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

  _log!: (
    nawah: NawahBase,
    config: SDKConfig,
    level: 'log' | 'info' | 'warn' | 'error',
    ...values: Array<unknown>
  ) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _websocketInit!: (nawah: NawahBase, config: SDKConfig) => Subject<any>;
  _populateFilesUploads!: (
    nawah: NawahBase,
    config: SDKConfig,
    callArgs: Require<CallArgs, 'sid' | 'token' | 'doc'>
  ) => Array<Observable<Res<Doc>>>;
  _cacheSet!: (
    nawah: NawahBase,
    config: SDKConfig,
    key: string,
    value: string
  ) => void;
  _cacheGet!: (
    nawah: NawahBase,
    config: SDKConfig,
    key: string
  ) => string | undefined;
  _cacheRemove!: (nawah: NawahBase, config: SDKConfig, key: string) => void;
  _generateJWT!: (
    nawah: NawahBase,
    config: SDKConfig,
    callArgs: CallArgs,
    token: string
  ) => string;

  #cacheSession!: Session | undefined;
  get cacheSession(): Session | undefined {
    if (!this.#cacheSession) {
      const cacheSessionStr = this._cacheGet(this, this.#config, 'session');
      if (cacheSessionStr) {
        this.#cacheSession = JSON.parse(cacheSessionStr);
      }
    }

    return this.#cacheSession;
  }
  set cacheSession(session: Session | undefined) {
    this.#cacheSession = session;

    if (!session) {
      this._cacheRemove(this, this.#config, 'session');
      return;
    }

    this._cacheSet(this, this.#config, 'session', JSON.stringify(session));
  }

  constructor(
    callables: {
      log?: (
        nawah: NawahBase,
        config: SDKConfig,
        level: 'log' | 'info' | 'warn' | 'error',
        ...values: Array<unknown>
      ) => void;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      websocketInit?: (nawah: NawahBase, config: SDKConfig) => Subject<any>;
      populateFilesUploads?: (
        nawah: NawahBase,
        config: SDKConfig,
        callArgs: Require<CallArgs, 'sid' | 'token' | 'doc'>
      ) => Array<Observable<Res<Doc>>>;
      cacheSet?: (
        nawah: NawahBase,
        config: SDKConfig,
        key: string,
        value: string
      ) => void;
      cacheGet?: (
        nawah: NawahBase,
        config: SDKConfig,
        key: string
      ) => string | undefined;
      cacheRemove?: (nawah: NawahBase, config: SDKConfig, key: string) => void;
      generateJWT?: (
        nawah: NawahBase,
        config: SDKConfig,
        callArgs: CallArgs,
        token: string
      ) => string;
    } = {}
  ) {
    if (callables.log) {
      this._log = callables.log;
    }
    if (callables.websocketInit) {
      this._websocketInit = callables.websocketInit;
    }
    if (callables.populateFilesUploads) {
      this._populateFilesUploads = callables.populateFilesUploads;
    }
    if (callables.cacheSet) {
      this._cacheSet = callables.cacheSet;
    }
    if (callables.cacheGet) {
      this._cacheGet = callables.cacheGet;
    }
    if (callables.cacheRemove) {
      this._cacheRemove = callables.cacheRemove;
    }
    if (callables.generateJWT) {
      this._generateJWT = callables.generateJWT;
    }

    this.inited$.subscribe({
      next: (init) => {
        this.inited = init;
        if (init == INIT_STATE.INITED) {
          if (this.#queue.noAuth) {
            this._log(
              this,
              this.#config,
              'info',
              'Found calls in noAuth queue:',
              this.#queue.noAuth
            );
          }
          for (const call of this.#queue.noAuth) {
            this._log(
              this,
              this.#config,
              'info',
              'processing noAuth call: ',
              call
            );
            combineLatest(call.subject).subscribe({
              complete: () => {
                // [DOC] Set callArgs sid, token as these values are were not present when the call was queued
                call.callArgs.sid = 'f00000000000000000000012';
                call.callArgs.token = this.#config.anonToken;
                this._log(
                  this,
                  this.#config,
                  'info',
                  'sending noAuth queue request as JWT token:',
                  call.callArgs,
                  this.#config.anonToken
                );
                this.#subject.next({
                  token: this._generateJWT(
                    this,
                    this.#config,
                    call.callArgs,
                    this.#config.anonToken
                  ),
                  call_id: call.callArgs.call_id,
                });
              },
              error: (err) => {
                this._log(
                  this,
                  this.#config,
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
            this._log(
              this,
              this.#config,
              'info',
              'Found calls in auth queue:',
              this.#queue.auth
            );
          }
          for (const call of this.#queue.auth) {
            this._log(
              this,
              this.#config,
              'info',
              'processing auth call: ',
              call
            );
            combineLatest(call.subject).subscribe({
              complete: () => {
                // [DOC] Set callArgs sid, token as these values are were not present when the call was queued
                call.callArgs.sid = this.session?._id;
                call.callArgs.token = this.session?.token;
                this._log(
                  this,
                  this.#config,
                  'info',
                  'sending auth queue request as JWT token:',
                  call.callArgs,
                  this.#config.anonToken
                );
                this.#subject.next({
                  token: this._generateJWT(
                    this,
                    this.#config,
                    call.callArgs,
                    (this.session as Session).token
                  ),
                  call_id: call.callArgs.call_id,
                });
              },
              error: (err) => {
                this._log(
                  this,
                  this.#config,
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
    this._log(this, this.#config, 'log', 'Resetting SDK before init');
    this.reset();
    this.#subject = this._websocketInit(this, this.#config);

    this._log(this, this.#config, 'log', 'Attempting to connect');

    this.#subject.subscribe({
      next: (res: Res<Doc>) => {
        this._log(this, this.#config, 'log', 'Received new message:', res);
        this.#conn.next(res);
        if (res.args.code == 'CORE_CONN_READY') {
          this.reset();
          this.#config.anonToken = config.anonToken;
          this.call({
            endpoint: 'conn/verify',
            sid: 'f00000000000000000000012',
            token: this.#config.anonToken,
            doc: { app: config.appId },
          }).subscribe();
        } else if (res.args.code == 'CORE_CONN_OK') {
          this.inited$.next(INIT_STATE.INITED);
        } else if (res.args.code == 'CORE_CONN_CLOSED') {
          this.reset();
        } else if (res.args.session) {
          this._log(this, this.#config, 'log', 'Response has session obj');
          if (res.args.session._id == 'f00000000000000000000012') {
            if (this.authed == AUTH_STATE.AUTHED) {
              this.session = undefined;
              this.authed$.next(AUTH_STATE.NOT_AUTHED);
            }

            this.cacheSession = undefined;
            this._log(this, this.#config, 'log', 'Session is null');
          } else {
            this.cacheSession = res.args.session;
            this.session = res.args.session;
            this.authed$.next(AUTH_STATE.AUTHED);
            this._log(this, this.#config, 'log', 'Session updated');
          }
        }
      },
      error: (err: Res<Doc>) => {
        this._log(this, this.#config, 'log', 'Received error:', err);
        this.#conn.error(err);
        this.reset(true);
      },
      complete: () => {
        this._log(this, this.#config, 'log', 'Connection clean-closed');
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
      this._log(
        this,
        this.#config,
        'error',
        'Unexpected error while resetting SDK.',
        error
      );
    }
  }

  call<T extends Doc>(callArgs: CallArgs): Observable<Res<T>> {
    if (this.authed == AUTH_STATE.AUTHED) {
      callArgs.sid =
        callArgs.sid || this.cacheSession?._id || 'f00000000000000000000012';
      callArgs.token =
        callArgs.token || this.cacheSession?.token || this.#config.anonToken;
    } else if (this.inited == INIT_STATE.INITED) {
      callArgs.sid = callArgs.sid || 'f00000000000000000000012';
      callArgs.token = callArgs.token || this.#config.anonToken;
    }
    callArgs.query = callArgs.query || [];
    callArgs.doc = callArgs.doc || {};
    callArgs.awaitAuth = callArgs.awaitAuth || false;
    callArgs.call_id = Math.random().toString(36).substring(7);

    this._log(this, this.#config, 'log', 'callArgs', callArgs);

    const filesUploads = this._populateFilesUploads(
      this,
      this.#config,
      callArgs as Require<CallArgs, 'sid' | 'token' | 'doc'>
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
          this._log(
            this,
            this.#config,
            'error',
            'Received error on filesSubjects:',
            err
          );
        },
        complete: () => {
          this._log(
            this,
            this.#config,
            'log',
            'sending request as JWT token:',
            callArgs,
            callArgs.token
          );
          this.#subject.next({
            token: this._generateJWT(
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
      this._log(
        this,
        this.#config,
        'warn',
        'SDK not yet inited. Queuing call:',
        callArgs
      );
      if (callArgs.awaitAuth) {
        this._log(this, this.#config, 'warn', 'Queuing in auth queue.');
        this.#queue.auth.push({
          subject: filesUploads,
          callArgs: callArgs,
        });
      } else {
        this._log(this, this.#config, 'warn', 'Queuing in noAuth queue.');
        this.#queue.noAuth.push({
          subject: filesUploads,
          callArgs: callArgs,
        });
      }
    }

    const call = new Observable<Res<T>>((observer) => {
      const observable = this.#conn.subscribe({
        next: (res: Res<Doc>) => {
          if (res.args.call_id == callArgs.call_id) {
            this._log(
              this,
              this.#config,
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

            if (!res.args.watch) {
              this._log(
                this,
                this.#config,
                'log',
                'completing the observer with call_id:',
                res.args.call_id
              );
              observer.complete();
              observer.unsubscribe();
              observable.unsubscribe();
            } else {
              this._log(
                this,
                this.#config,
                'log',
                'Detected watch with call_id:',
                res.args.call_id
              );
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
        this._log(this, this.#config, 'error', 'deleteWatch call err:', err);
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
        this._log(this, this.#config, 'error', 'auth call err:', err);
      },
    });
    return call;
  }

  reauth(
    sid?: string,
    token?: string,
    groups?: Array<string>
  ): Observable<Res<Doc>> {
    sid ??= this.cacheSession?._id;
    token ??= this.cacheSession?.token;

    if (!sid || !token) {
      throw Error('No credentials cached or provided.');
    }

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
        this._log(this, this.#config, 'error', 'reauth call err:', err);
        this.cacheSession = undefined;
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
        this._log(this, this.#config, 'error', 'signout call err:', err);
      },
    });
    return call;
  }

  checkAuth(groups?: Array<string>): Observable<Res<Doc>> {
    this._log(this, this.#config, 'log', 'attempting checkAuth');

    const call = this.reauth(undefined, undefined, groups);
    return call;
  }
}
