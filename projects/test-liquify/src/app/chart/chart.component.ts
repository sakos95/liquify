import { Component, OnInit, Input, ViewChild, ElementRef, Output, ChangeDetectorRef,
  SimpleChanges, OnChanges, OnDestroy, AfterViewInit, EventEmitter } from '@angular/core';
import { FunctionOverrideInterface } from 'projects/liquify/src/lib/interfaces/function.override.interface';
import { DefaultFunctionSources } from 'projects/liquify/src/lib/defaults/function.sources.default';
import { ChartWorker } from 'projects/liquify/src/lib/chart-worker';
import Chart from 'chart.js';

@Component({
  selector: 'app-chart',
  templateUrl: './chart.component.html',
  styleUrls: ['./chart.component.css']
})
export class ChartComponent implements  OnChanges, OnInit, OnDestroy, AfterViewInit {

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
  @Output() latencyEmitter = new EventEmitter<number>();
  latency = 60;
  actDate: number = Date.now();
  updateDateInterval;

  workerUrl;
  worker;
  lastRenderedElementDate;
  myChart;
  messageData;
  dataMap;
  datasets;
  connections: Map<string, any>;
  ctx;
  messages;
  renderChartInterval;

  constructor(private changeDetRef: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    this.messages = new Map<string, string[]>();
    this.createMessageData();
    this.connectToAddresses();
    Chart.defaults.global.animation.duration = 0;
    this.ctx = this.canvasRef.nativeElement.getContext('2d');
    this.buildChart();
    this.updateDateInterval = setInterval(() => this.updateDate(), 1000);
    this.sendSpecialMessages(this.specialMessages);
  }

  ngOnInit() {
  }

  ngOnChanges(changes: SimpleChanges) {
    console.log(changes);

    if (this.built) {
      // update existing chart
      this.updateAddresses(this.addresses);
      // this.updateChart();
    } else if (!this.built) {
      // first message, set canvas values
      this.messages = new Map<string, string[]>();
      this.createMessageData();
      this.connectToAddresses();
      Chart.defaults.global.animation.duration = 0;
      this.ctx = this.canvasRef.nativeElement.getContext('2d');
      // build new chart
      this.buildChart();
    }
    // Width and height input changed, set size!
    if ((changes.width || changes.height)) {
      console.log('Size changed to: ' + this.width + ' x ' + this.height);
      if (this.width && this.height) {
        this.setSize(this.width, this.height);
      }
    }
    if (changes.specialMessages) {
      this.sendSpecialMessages(this.specialMessages);
    }
    if (changes.dataSetIDs) {
      this.updateDataSetIDs();
    }
    if (changes.colors) {
      this.updateColors();
    }
    if (changes.chartType) {
      this.updateChartType();
    }
    if (changes.xAxisType) {
      this.updateXAxisType();
    }
    if (changes.yAxisType) {
      this.updateYAxisType();
    }
  }

  ngOnDestroy() {
    clearInterval(this.updateDateInterval);
    clearInterval(this.renderChartInterval);
    this.closeConnections();
    this.myChart.destroy();
  }

  // sends build message to worker
  buildChart() {
    if (this.addresses !== undefined) {
      this.dataMap = new Map<string, any[]>(); // dataMap pairs dataSetIDs to data arrays
      this.datasets = [];
      if (this.messageData !== undefined) {
        this.messageData.forEach((value, key) => {
          let dataArr = [];
          // conversion from metric to chart data
          for (const data of value) {
          const convertedData = this.functionSource.convertMessageToData(data);
          dataArr.push(convertedData);
          }
          let borderColor ='rgba(' + Math.round(Math.random() * 255) + ',' +
                          Math.round(Math.random() * 255) + ',' +
                          Math.round(Math.random() * 255) + ', 1)';
          if (this.colors !== undefined && this.colors.has(key)) {
          const color = this.colors.get(key);
          if (color.length === 3) {
              borderColor = 'rgba(' + color[0] + ',' + color[1] + ',' + color[2] + ', 1)';
          }
          }
          let dataset= {
          label: 'Scatter Dataset',
          data: dataArr,
          backgroundColor: 'rgba(0, 0, 0, 0)',
          borderColor: borderColor,
          borderWidth: 1,
          lineTension: 0,
          pointRadius: 0,//if 0, the point is not rendered
          };
          this.dataMap.set(key, dataset);
          // creating datasets for chart
          this.datasets = [...this.datasets, dataset];
        });
        this.myChart = new Chart(this.ctx, {
            type: this.chartType,
            data: {
                datasets: this.datasets
            },
            options: {
                maintainAspectRatio: false,
                responsive: true,
                legend: false,
                scales: {
                    xAxes: [{
                    beforeBuildTicks: (mychart) => {
                        // setting correct format for reversed time
                        if (mychart.type === 'time') {
                        mychart.options.ticks.reverse = this.timeBackward;
                        if (this.timeBackward) {
                            mychart.options.time.displayFormats = {
                            millisecond:	'-mm:ss',
                            second: '-mm:ss',
                            minute:	'-h:mm:ss',
                            };
                        } else {
                            mychart.options.time.displayFormats = {
                            millisecond:	'mm:ss',
                            second: 'mm:ss',
                            minute:	'h:mm:ss',
                            };
                        }
                        }
                    },
                        type: this.xAxisType,
                        time: {
                        // converting dates to time since view
                        parser: (date) => {
                            if (this.timeBackward) {
                            return this.actDate - date;
                            } else {
                            return date;
                            }
                        }
                        },
                        ticks: {
                        reverse: this.timeBackward, // time since view requires reversed order
                        source: 'data',
                        autoSkip: true // skips overlapping ticks
                        },
                        position: 'bottom'
                    }],
                    yAxes: [
                    {
                        type: this.yAxisType,
                        ticks: {
                        beginAtZero: true
                        }
                    }
                    ]
                }
          }
        });
      }
      this.setSize(this.width, this.height);
      this.renderChartInterval = setInterval(() => this.renderChart(), 30);
      this.built = true;
    }
  }

  // updates date below chart and sends message to worker
  updateDate() {
    this.actDate = Date.now();
    this.updateLatency();
    this.changeDetRef.detectChanges();
  }
  
  // set chart size
  setSize(width, height){
    this.canvasRef.nativeElement.width = width;
    this.canvasRef.nativeElement.height = height;
    this.canvasRef.nativeElement.style.width = width + 'px';
    this.canvasRef.nativeElement.style.height = height + 'px';
    if (this.myChart !== undefined) {// if chart is already built
        this.myChart.width = width;
        this.myChart.height = height;
        this.myChart.update(0); // update chart with new size
    }
  }

  updateChart() {
    // sets the limit of the oldest value
    const limitDate = Date.now() - (this.latency * 1000 + this.duration);
    if (this.messageData !== undefined) {
        // checks every dataSetID for a new value
        this.messageData.forEach((value, key) => {
        const actDataArr = this.dataMap.get(key).data;
        if (actDataArr !== undefined) {
            // delete data, that is older than limitDate
            if (actDataArr[0] !== undefined && actDataArr[0].measured < limitDate) {
            const limitDataIndex = actDataArr.findIndex(actValue => actValue.measured > limitDate);
            if(limitDataIndex === -1){
                // if all values are too old, deletes all from messageData, so that it won't be recognized as a new value
                // at the next update, because the chart's data array is empty
                actDataArr.splice(0, actDataArr.length);
                // delete value;
                this.messageData.set(key, []);
            } else {
                // delete old values
                actDataArr.splice(0, limitDataIndex);
            }
            }
            let newValue;
            const newIndex = value.length - 1;
            const actDataIndex = actDataArr.length - 1;
            // if actDataArr is empty, we found a new value
            let isNew = actDataArr[actDataArr.length - 1] === undefined;
            if (value[newIndex] !== undefined) {
            newValue = this.functionSource.convertMessageToData(value[newIndex]);
            if (this.chartType === 'bubble') {
                // the new value can't be equal to the last one
                isNew =  isNew ||
                actDataArr[actDataArr.length - 1].x !== newValue.x &&
                actDataArr[actDataArr.length - 1].y !== newValue.y &&
                actDataArr[actDataArr.length - 1].r !== newValue.r;
            } else {
                // the new value can't be equal to the last one
                isNew =  isNew ||
                actDataArr[actDataArr.length - 1].x !== newValue.x &&
                actDataArr[actDataArr.length - 1].y !== newValue.y;
            }
            if (isNew) {
                actDataArr.push(newValue);
            }
            }
        }
        });
    }
  }

  renderChart() {
    if (!this.suspended) {
        this.myChart.update(0);
    }
  }

  addData(latestStatus, address) {
    const points = 100;
    if (this.functionSource.checkData(latestStatus)) {
        let actData = this.messageData.get(this.functionSource.findDataSetID(latestStatus, address));
        // remove old elements from actData
        if (actData.length > points) {
        actData.splice(0, actData.length - points);
        }
        actData.push(latestStatus);
        this.updateChart();
    }
  }

  connectToAddresses() {
    const that = this;
    if(this.connections === undefined){
        this.connections = new Map(); //Map of connections by address
        let connections = this.connections;
    }
    for (const address of this.addresses) {
        if (!this.connections.has(address)) {
          let actConnection = {socket: null, observer: null};
          actConnection.socket = new WebSocket(address);
          actConnection.socket.onmessage = function(data) {
            try {
              that.addData(JSON.parse(data.data), address);
            } catch(e) { }
          };

          actConnection.observer = {
              next: (data) => {
              actConnection.socket.send(JSON.stringify(data));
              },
          };

          actConnection.socket.onopen = function(data) {
              if (this.x < 1) {
                console.log(this.x);
              }
              let actMessages = this.messages.get(address);
              if (actMessages !== undefined) {
              for (const message of actMessages) {
                  actConnection.socket.send(message);
              }
              }
          };
          this.connections.set(address, actConnection);
        }
    }
    let keys = Array.from( this.connections.keys() );
    let closeableAddresses = keys.filter(value => !this.addresses.includes(value));
    for(let address of closeableAddresses){
        let actConnection = this.connections.get(address)
        if (actConnection.socket.readyState !== WebSocket.CLOSING || actConnection.socket.readyState !== WebSocket.CLOSED) {
        actConnection.socket.close();
        }
    }
  }

  sendSpecialMessages(newMessages: Map<string, string>) {
    let addresses=Array.from( newMessages.keys() );
    for(let address of addresses){
        let newMessage = newMessages.get(address);
        let actMessages;
        if (this.messages.has(address)) {
        actMessages = this.messages.get(address);
        } else {
        actMessages = [];
        this.messages.set(address, actMessages);
        }
        if (actMessages[actMessages.length - 1] !== newMessage) {
        if (this.connections.has(address)) {
            let actConnection = this.connections.get(address);
            if (actConnection.socket.readyState === WebSocket.OPEN) {
            actConnection.socket.send(newMessage);
            }
        }
        actMessages.push(newMessage);
        }
    }
  }

  closeConnections() {
  this.connections.forEach((connection, key) => {
      if (connection.socket.close !== undefined) {
      connection.socket.close();
      }
  });
  }
  // create empty array for every dataSetID in messageData
  createMessageData() {
    this.messageData = new Map();
    this.messageData = this.messageData;
    for (const dataSetID of this.dataSetIDs) {
      this.messageData.set(dataSetID, []);
    }
  }

  updateDataSetIDs() {
    for (const dataSetID of this.dataSetIDs) {
        // create empty array for every new dataSetID in messageData and in myChart
      if (!this.messageData.has(dataSetID)) {
        const actData = [];
        this.messageData.set(dataSetID, actData);
        if (this.myChart !== undefined) {
        let dataArr = [];
        for (const data of actData) {
          const convertedData = this.functionSource.convertMessageToData(data);
          dataArr.push(convertedData);
        }
        let borderColor ='rgba(' + Math.round(Math.random() * 255) + ',' +
                        Math.round(Math.random() * 255) + ',' +
                        Math.round(Math.random() * 255) + ', 1)';
        if (this.colors !== undefined && this.colors.has(dataSetID)) {
          const color = this.colors.get(dataSetID);
          if (color.length === 3) {
              borderColor = 'rgba(' + color[0] + ',' + color[1] + ',' + color[2] + ', 1)';
          }
        }
        let dataset = {
          label: 'Scatter Dataset',
          data: dataArr,
          backgroundColor: 'rgba(0, 0, 0, 0)',
          borderColor: borderColor,
          borderWidth: 1,
          lineTension: 0,
          pointRadius: 0,//if 0, the point is not rendered
        };
        this.dataMap.set(dataSetID, dataset);
        this.datasets.push(dataset);
        }
      }
    }
  }

  updateColors() {
    this.colors.forEach((color, dataSetID) => {
        let actDataset = this.dataMap.get(dataSetID);
        if (color.length === 3) {
        actDataset.borderColor = 'rgba(' + color[0] + ',' + color[1] + ',' + color[2] + ', 1)';
        }
    });
  }

  updateLatency() {
    this.latency = Infinity;
    // find latest value
    if (this.messageData !== undefined) {
      this.messageData.forEach((value, key) => {
        const actDataArr = this.dataMap.get(key).data;
        if (actDataArr !== undefined && actDataArr[actDataArr.length - 1] !== undefined) {
            this.latency = Math.min(this.latency, Date.now() - actDataArr[actDataArr.length - 1].measured);
        }
      });
    }
    this.latency = Math.round(this.latency / 1000);
    this.latencyEmitter.emit(this.latency);
  }

  // if new addresses array arrives, update this.addresses and update connections
  updateAddresses(adds) {
    this.addresses = adds;
    this.connectToAddresses();
    this.updateDataSetIDs();
  }

  // updates chartType on worker
  updateChartType() {
    this.myChart.config.type = this.chartType;
    this.myChart.update(0);
  }

  // updates xAxisType on worker
  updateXAxisType() {
    this.myChart.config.options.scales.xAxes[0].type = this.xAxisType;
    this.myChart.update(0);
  }

  // updates yAxisType on worker
  updateYAxisType() {
    this.myChart.config.options.scales.yAxes[0].type = this.yAxisType;
    this.myChart.update(0);
  }
}
