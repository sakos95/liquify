import { Component, OnInit, ViewChild } from '@angular/core';
import Stats from 'stats.js';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'test-liquify';
  fakeURL = ['ws://localhost:9875/'];
  width = 600;
  height = 300;
  avgFps = [0];
  count = [0];
  avgTenSec = 0;
  n = 3;
  rows = 1;
  cols = 3;

  @ViewChild('containerDiv') containerDiv;

  ngOnInit() {
    this.width = window.innerWidth / this.cols - 20;
    this.height = window.innerHeight / this.rows - 20;
    let stats: Stats;
    stats = new Stats();
    stats.showPanel( 0 ); // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild( stats.dom );
    const beginTime = performance.now();
    const count = this.count;
    console.log(stats);
    const fps = this.avgFps;
    function animate() {
      count[0]++;
      fps[0] = count[0] / (performance.now() - beginTime) * 1000 ;
      stats.begin();
      // monitored code goes here
      stats.end();
      requestAnimationFrame( animate );
    }
    requestAnimationFrame( animate );
  }

  measureTenSec() {
    const beginTime = performance.now();
    const beginCount = this.count[0];
    console.log('measure began');
    setTimeout(() => {
      console.log('this.avgTenSec');
      this.avgTenSec = (this.count[0] - beginCount) / (performance.now() - beginTime) * 1000 ;
      console.log(this.avgTenSec);
    }, 10000);
  }

  addChart() {
    this.n++;
  }
}
