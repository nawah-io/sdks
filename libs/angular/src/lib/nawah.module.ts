import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NawahService } from './nawah.service';

@NgModule({
  imports: [CommonModule],
  providers: [NawahService],
})
export class NawahModule {}
