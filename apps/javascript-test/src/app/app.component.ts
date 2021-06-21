import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
} from '@angular/core';
import {
  AUTH_STATE,
  Doc,
  INIT_STATE,
  Nawah,
  Res,
  ResArgsDoc,
  ResArgsMsg,
  ResArgsSession,
} from '@nawah/javascript';
import { Observable, of } from 'rxjs';
import { filter, map, mergeScan } from 'rxjs/operators';

const nawah = new Nawah();

nawah.inited$.subscribe({
  next: (inited) => {
    if (inited == INIT_STATE.INITED) {
      window.location.hash = 'tab-auth';
    }
  },
});

interface NawahLogEntry {
  datetime: string;
  res: Res<Doc, ResArgsMsg | ResArgsSession | ResArgsDoc<Doc>>;
}
type NawahLog = Array<NawahLogEntry>;

@Component({
  selector: 'nawah-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {
  apiUri: string =
    localStorage.getItem('nawah__api_uri') || 'ws://localhost/ws';
  anonToken: string =
    localStorage.getItem('nawah__anon_token') ||
    '__ANON_TOKEN_f00000000000000000000010';

  authVal: string = localStorage.getItem('nawah__auth_val') || '';
  password: string = localStorage.getItem('nawah__password') || '';

  callEndpoint: string = '';
  callSid: string = '';
  callToken: string = '';
  callQuery: string = '';
  callDoc: string = '';
  callDocFileAttr: string = '';
  @ViewChild('callDocFileInput', { read: ElementRef })
  callDocFileInput!: ElementRef;

  nawahLog$!: Observable<NawahLog>;
  get nawahInited(): INIT_STATE {
    return nawah.inited;
  }
  get nawahAuthed(): AUTH_STATE {
    return nawah.authed;
  }

  ngOnInit(): void {
    window.location.hash = 'tab-init';
  }

  init(): void {
    localStorage.setItem('nawah__api_uri', this.apiUri);
    localStorage.setItem('nawah__anon_token', this.anonToken);

    this.callSid = 'f00000000000000000000012';
    this.callToken = this.anonToken;

    this.nawahLog$ = nawah
      .init({
        api: this.apiUri,
        anonToken: this.anonToken,
        authAttrs: ['email'],
        appId: 'TEST_APP',
        debug: true,
      })
      .pipe(
        filter((res) => (res.args as ResArgsMsg).code != 'CORE_HEARTBEAT_OK'),
        map((res) => ({ datetime: new Date().toISOString(), res: res })),
        mergeScan((acc, value) => {
          acc.unshift(value);
          return of(acc);
        }, [] as NawahLog)
      );
  }

  checkAuth(): void {
    nawah.checkAuth().subscribe({
      next: (res) => {
        this.callSid = res.args.session._id;
        this.callToken = res.args.session.token;
      }
    });
  }

  auth(): void {
    localStorage.setItem('nawah__auth_val', this.authVal);
    localStorage.setItem('nawah__password', this.password);
    nawah.auth('email', this.authVal, this.password).subscribe({
      next: (res) => {
        this.callSid = res.args.session._id;
        this.callToken = res.args.session.token;
      },
    });
  }

  signout(): void {
    nawah.signout();
  }

  call(): void {
    let doc = JSON.parse(this.callDoc);
    if (this.callDocFileAttr) {
      let callDocFileInput = this.callDocFileInput.nativeElement;
      eval(`doc.${this.callDocFileAttr} = callDocFileInput.files;`);
    }

    nawah.call({
      endpoint: this.callEndpoint,
      query: JSON.parse(this.callQuery),
      doc: doc,
      sid: this.callSid,
      token: this.callToken,
    });
  }
}
