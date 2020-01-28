import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import { LiquifyModule } from 'projects/liquify/src/public-api';
import { ChartComponent } from './chart/chart.component';

@NgModule({
  declarations: [
    AppComponent,
    ChartComponent
  ],
  imports: [
    BrowserModule,
    LiquifyModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
