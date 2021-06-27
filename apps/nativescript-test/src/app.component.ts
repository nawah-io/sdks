import { Component, OnInit } from '@angular/core';
import { NawahNS } from '@nawah/nativescript';

const nawah = new NawahNS();

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  ngOnInit() {
    nawah.call({ endpoint: 'doc/read' }).subscribe({
      next: (res) => {
        console.log('doc/read', { res });
      },
    });
    nawah
      .init({
        api: 'ws://localhost/ws',
        anonToken: '__ANON_TOKEN_f00000000000000000000010',
        appId: 'TEST_APP',
        authAttrs: ['email'],
        debug: true,
      })
      .subscribe({
        next: (res) => {
          console.log({ res });
        },
        error: (err) => {
          console.log({ err });
        },
      });
  }
}
