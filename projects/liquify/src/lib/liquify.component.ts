import {
  Component, OnInit, OnChanges, OnDestroy, Input, ElementRef,
  Output, ViewChild, ChangeDetectorRef, SimpleChanges, ViewEncapsulation, AfterViewInit
} from '@angular/core';
import createWorker from 'offscreen-canvas/create-worker';
import insideWorker from 'offscreen-canvas/inside-worker';
import {FunctionOverrideInterface} from './interfaces/function.override.interface';
import {DefaultFunctionSources} from './defaults/function.sources.default';
import { ChartWorker } from './chart-worker';

@Component({
  selector: 'lib-liquify',
  templateUrl: './liquify.component.html',
  styles: [],
  // Without encapsulation the library won't usable. See: https://github.com/angular/angular-cli/issues/11392
  encapsulation: ViewEncapsulation.ShadowDom,
})
export class LiquifyComponent implements OnChanges, OnDestroy, AfterViewInit {
  @Input() addresses: string[];
  @Input() width = 600;
  @Input() height = 300;
  @Input() chartType = 'line';
  @Input() xAxisType = 'time';
  @Input() yAxisType = 'linear';
  @Input() suspended = false;
  @Input() timeBackward = false;
  @Input() functionSource: FunctionOverrideInterface = new DefaultFunctionSources();
  @Input() dataSetIDs = ['0'];
  @Input() specialMessages = new Map<string, string>();
  @Input() colors: Map<string, number[]>; // <dataSetID, rgb>
  @Input() duration = 10000;

  @ViewChild('chart', {static: true}) canvasRef: ElementRef;

  built = false;
  @Output() latency = 60;
  actDate: number = Date.now();
  updateDateInterval;
  functionSourceUrl: string;
  functionsBlob: Blob;
  workerBlob: Blob;

  workerUrl;
  worker;
  workerSource: ChartWorker = new ChartWorker();

  constructor(private changeDetRef: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    if (this.functionSource !== undefined) {
      const blobPartArrFromObj = this.createBlobPartArrFromObj(this.functionSource);
      this.functionsBlob = new Blob( blobPartArrFromObj, {type: 'application/javascript'});
      this.functionSourceUrl = URL.createObjectURL(this.functionsBlob);
    }
    const insideWorkerStr = 'insideWorker = ' + insideWorker.toString() + ';\n';
    const blobPartArr = this.createBlobPartArrFromObj(this.workerSource);
    blobPartArr.push('setUpWorker()');
    this.workerBlob = new Blob([insideWorkerStr,
                                 '{importScripts(Chart = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/2.9.3/Chart.bundle.js");}\n',
                                ...blobPartArr], {type: 'application/javascript'});
    this.workerUrl = URL.createObjectURL(this.workerBlob);
    // workerListener has a different scope, 'this' isn't the LiquifyComponent in it, so 'that' is passed to it
    const that = this;
    function workerListener(e: any) {
      if (e.data.type === 'updateLatency') {
        that.latency = e.data.latency;
        that.changeDetRef.detectChanges();
      }
    }
    console.log(this.canvasRef);
    this.worker = createWorker(this.canvasRef.nativeElement, this.workerUrl, workerListener);
    this.buildChart();
    this.updateDateInterval = setInterval(() => this.updateDate(), 1000);
    this.sendSpecialMessages();
  }

  createBlobPartArrFromObj(sourceObj): string[] {
    const blobPartArr: string[] = [];
    const keys = Object.keys(sourceObj);
    for (const key of keys) {
      const descr = Object.getOwnPropertyDescriptor(sourceObj, key);
      if (descr.value !== undefined && descr.value !== null) {
        let actStr = 'this.' + key + '=';
        if (typeof descr.value === 'string' || descr.value instanceof String) {
          actStr += '\'' + descr.value.toString() + '\'';
        } else if (descr.value instanceof Array) {
          actStr += '[' + descr.value.toString() + ']';
        } else if (typeof descr.value === 'object' || descr.value instanceof Object) {
          actStr += '{' + this.createBlobPartArrFromObj(descr.value) + '}';
        } else {
          actStr += descr.value.toString();
        }
        actStr += ';\n';
        blobPartArr.push(actStr);
      }
    }
    const props = Object.getOwnPropertyNames(Object.getPrototypeOf(sourceObj)).filter((value) => value !== 'constructor');
    for (const prop of props) {
      const descr = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(sourceObj), prop);
      if (descr.value !== undefined) {
        blobPartArr.push('function ' + descr.value.toString() + '\n');
      }
    }
    return blobPartArr;
  }

  ngOnChanges(changes: SimpleChanges) {
    // console.log(changes);
    if (this.worker !== undefined && this.built) {
      // update existing chart
      this.updateAddresses();
      // this.updateChart();
    } else if (this.worker !== undefined && !this.built) {
      // build new chart
      this.buildChart();
    }
    // Width and height input changed, set size!
    if ((changes.width || changes.height)) {
      // console.log('Size changed to: ' + this.width + ' x ' + this.height);
      if (this.width && this.height) {
        this.setSize();
      }
    }
    if (this.worker !== undefined && changes.suspended) {
      this.updateSuspend();
    }
    if (this.worker !== undefined && changes.timeBackward) {
      this.updateTimeDisplay();
    }
    if (this.worker !== undefined && changes.specialMessages) {
      this.sendSpecialMessages();
    }
    if (this.worker !== undefined && changes.dataSetIDs) {
      this.updateDataSetIDs();
    }
    if (this.worker !== undefined && changes.colors) {
      this.updateColors();
    }
    if (this.worker !== undefined && changes.duration) {
      this.updateDuration();
    }
  }

  ngOnDestroy() {
    clearInterval(this.updateDateInterval);
    this.worker.post({type: 'close'});
  }

  // updates dataSetIDs on worker
  updateDataSetIDs() {
    this.worker.post({
      type: 'updateDataSetIDs', dataSetIDs: this.dataSetIDs
    });
  }

  // updates colors on worker
  updateColors() {
    this.worker.post({
      type: 'updateColors', colors: this.colors
    });
  }

  // sends build message to worker
  buildChart() {
    if (this.addresses !== undefined) {
      // messageData is probably unnecessary since worker connects to address
      this.worker.post({
        type: 'buildChart', chartType: this.chartType, timeBackward: this.timeBackward,
        xAxisType: this.xAxisType, yAxisType: this.yAxisType, actDate: this.actDate, addresses: this.addresses,
        dataSetIDs: this.dataSetIDs, functionSource: this.functionSourceUrl, colors: this.colors, duration: this.duration
      });
      this.setSize();
      this.built = true;
    }
  }

  setSize() {
    if (this.width && this.height) {
      if (this.worker) {
        console.log('Setting chart size to ' + this.width + ' x ' + this.height);
        this.worker.post({
          type: 'setSize', width: this.width, height: this.height
        });
      } else {
        console.log('Can\'t set chart size, worker hasn\'t been initialized just yet!');
      }
    } else {
      console.log('Tried to set chart size to something unimaginable: ' + this.width + ' x ' + this.height);
    }
  }

  updateSuspend() {
    this.worker.post({type : 'suspended', suspended : this.suspended});
  }

  // change time display between time since and current time
  updateTimeDisplay() {
    this.worker.post({type : 'timeBackward', timeBackward : this.timeBackward});
  }

  // updates date below chart and sends message to worker
  updateDate() {
    this.actDate = Date.now();
    this.worker.post({type: 'updateDate', actDate: this.actDate});
    this.changeDetRef.detectChanges();
  }

  // updates addresses on worker
  updateAddresses() {
    this.worker.post({type: 'updateAddresses', addresses: this.addresses});
  }

  // updates duration on worker
  updateDuration() {
    this.worker.post({type: 'updateDuration', duration: this.duration});
  }

  // sends the given messages to the given addresses
  sendSpecialMessages() {
    this.worker.post({type: 'sendSpecialMessages', messages: this.specialMessages});
  }
}
