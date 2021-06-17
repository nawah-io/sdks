import { Injectable } from '@angular/core';
import {
  AUTH_STATE,
  CallArgs,
  Doc,
  INIT_STATE,
  Nawah,
  Res,
  ResArgsDoc,
  SDKConfig,
  Session,
} from '@nawah/javascript';
import { Observable, Subject } from 'rxjs';

@Injectable()
export class NawahService {
  connections: Array<Nawah> = [];
  #activeConnectionId!: number;

  get activeConnection(): Nawah {
    return this.connections[this.#activeConnectionId];
  }

  get inited(): INIT_STATE {
    return this.activeConnection.inited;
  }
  get inited$(): Subject<INIT_STATE> {
    return this.activeConnection.inited$;
  }

  get authed(): AUTH_STATE {
    return this.activeConnection.authed;
  }
  get authed$(): Subject<AUTH_STATE> {
    return this.activeConnection.authed$;
  }

  get session(): Session | undefined {
    return this.activeConnection.session;
  }

  constructor() {}

  setActiveConnection(id: number): void {
    if (id >= this.connections.length) {
      throw Error("Connection 'id' is invalid.");
    }

    this.#activeConnectionId = id;
  }

  init(config: SDKConfig): Observable<Res<Doc>> {
    let connection: Nawah = new Nawah();
    let connectionSubject: Observable<Res<Doc>> = connection.init(config);

    this.#activeConnectionId = this.connections.length;
    this.connections.push(connection);

    return connectionSubject;
  }

  close(connection?: Nawah): Observable<Res<Doc>> {
    connection ??= this.activeConnection;

    return connection.close();
  }

  reset(forceInited: boolean = false, connection?: Nawah): void {
    connection ??= this.activeConnection;

    connection.reset(forceInited);
  }

  call<T extends Doc>(
    callArgs: CallArgs,
    connection?: Nawah
  ): Observable<Res<T, ResArgsDoc>> {
    connection ??= this.activeConnection;

    return connection.call(callArgs);
  }

  deleteWatch(
    watch: string | '__all',
    connection?: Nawah
  ): Observable<Res<Doc>> {
    connection ??= this.activeConnection;

    return connection.deleteWatch(watch);
  }

  generateAuthHash(
    authVar: string,
    authVal: string,
    password: string,
    connection?: Nawah
  ): string {
    connection ??= this.activeConnection;

    return connection.generateAuthHash(authVar, authVal, password);
  }

  auth(
    authVar: string,
    authVal: string,
    password: string,
    groups?: Array<string>,
    connection?: Nawah
  ): Observable<Res<Doc>> {
    connection ??= this.activeConnection;

    return connection.auth(authVar, authVal, password, groups);
  }

  reauth(
    sid?: string,
    token?: string,
    groups?: Array<string>,
    connection?: Nawah
  ): Observable<Res<Doc>> {
    connection ??= this.activeConnection;

    return connection.reauth(sid, token, groups);
  }

  signout(connection?: Nawah): Observable<Res<Doc>> {
    connection ??= this.activeConnection;

    return connection.signout();
  }

  checkAuth(groups?: Array<string>, connection?: Nawah): Observable<Res<Doc>> {
    connection ??= this.activeConnection;

    return connection.checkAuth(groups);
  }
}
