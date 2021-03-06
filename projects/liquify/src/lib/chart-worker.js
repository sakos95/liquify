// Note: after changing this file run "browserify .\src\lib\chart-worker.js -o .\src\lib\chart-worker.bundle.js" to update bundle.
let insideWorker = require('offscreen-canvas/inside-worker');
//namespace('Chart') = importScripts("https://cdnjs.cloudflare.com/ajax/libs/Chart.js/2.9.3/Chart.js" as Chart);
{importScripts(Chart = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/2.9.3/Chart.bundle.js');}
//let Chart = require('chart.js');
let ctx, width, height, myChart, canvas, chartType, datasets, timeBackward, xAxisType, yAxisType, actDate, dataMap, renderChartInterval, dataSetIDs, messages, worker;

// set chart size
function setSize(width, height){
  canvas.width = width;
  canvas.height = height;
  this.myChart.width = width;
  this.myChart.height = height;
  if (this.myChart !== undefined) {// if chart is already built
    this.myChart.update(0); // update chart with new size
  }
}

function buildChart() {
  this.dataMap = new Map(); // dataMap pairs dataSetIDs to data arrays
  this.datasets = [];
  if (this.messageData !== undefined) {
  this.messageData.forEach((value, key) => {
    let dataArr = [];
    // conversion from metric to chart data
    for (const data of value) {
      const convertedData = convertMessageToData(data);
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
}

function updateChart() {
  console.log('update chart!');
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
            delete value;
            this.messageData.set(key, []);
          } else {
            // delete old values
            actDataArr.splice(0, limitDataIndex - 1);
          }
        }
        let newValue;
        const newIndex = value.length - 1;
        const actDataIndex = actDataArr.length - 1;
        // if actDataArr is empty, we found a new value
        let isNew = actDataArr[actDataArr.length - 1] === undefined;
        if (value[newIndex] !== undefined) {
          newValue = convertMessageToData(value[newIndex]);
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

function renderChart() {
  if(!this.suspended){
    this.myChart.update(0);
  }
}

function checkData(latestStatus) {
  if (self.checkData){
    return self.checkData(latestStatus);
  } else {
    console.log('Default checkData is used');
    return true;
  }
}

function findDataSetID(latestStatus, address) {
  if (self.findDataSetID){
    return self.findDataSetID(latestStatus, address);
  } else {
    console.log('Default findDataSetID is used');
    return '0';
  }
}

function addData(latestStatus, address) {
  const points = 100;
  if (checkData(latestStatus)) {
    let actData = this.messageData.get(findDataSetID(latestStatus, address));
    // remove old elements from actData
    if (actData.length > points) {
      actData.splice(0, actData.length - points);
    }
    actData.push(latestStatus);
    updateChart();
  }
}

function connectToAddresses() {
  if(this.connections === undefined){
    this.connections = new Map(); //Map of connections by address
  }
  for (const address of this.addresses) {
    if (!this.connections.has(address)) {
      let actConnection = {socket: null, observer: null};
      actConnection.socket = new WebSocket(address);
      actConnection.socket.onmessage = function(data) {
        try{
          addData(JSON.parse(data.data), address);
        } catch(e) { }
      };

      actConnection.observer = {
        next: (data) => {
          actConnection.socket.send(JSON.stringify(data));
        },
      };
      
      actConnection.socket.onopen = function(data) {
        let actMessages = messages.get(address);
        if (actMessages !== undefined) {
          for (const message of actMessages) {
            actConnection.socket.send(message);
          }
        }
      };
      this.connections.set(address, actConnection);
    }
  }
  let keys=Array.from( this.connections.keys() );
  let closeableAddresses = keys.filter(value => !this.addresses.includes(value));
  for(let address of closeableAddresses){
    let actConnection = this.connections.get(address)
    if (actConnection.socket.readyState !== WebSocket.CLOSING || actConnection.socket.readyState !== WebSocket.CLOSED) {
      actConnection.socket.close();
    }
  }
}

function sendSpecialMessages(newMessages){
  let addresses=Array.from( newMessages.keys() );
  for(let address of addresses){
    let newMessage = newMessages.get(address);
    let actMessages;
    if (messages.has(address)) {
      actMessages = messages.get(address);
    } else {
      actMessages = [];
      messages.set(address, actMessages);
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

function closeConnections() {
  this.connections.forEach((connection, key) => {
    if (connection.socket.close !== undefined) {
      connection.socket.close();
    }
  });
}

// create empty array for every dataSetID in messageData
function createMessageData() {
  this.messageData = new Map();
  for (const dataSetID of this.dataSetIDs) {
    this.messageData.set(dataSetID, []);
  }
}

function updateDataSetIDs() {
  for (const dataSetID of this.dataSetIDs) {
    // create empty array for every new dataSetID in messageData and in myChart
    if (!this.messageData.has(dataSetID)) {
      const actData = [];
      this.messageData.set(dataSetID, actData);
      if (this.myChart !== undefined) {
        let dataArr = [];
        for (const data of actData) {
          const convertedData = convertMessageToData(data);
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

function updateColors() {
  this.colors.forEach((color, dataSetID) => {
    let actDataset = this.dataMap.get(dataSetID);
    if (color.length === 3) {
      actDataset.borderColor = 'rgba(' + color[0] + ',' + color[1] + ',' + color[2] + ', 1)';
    }
  });
}

function updateLatency() {
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
  // if chart is empty send 0 latency
  worker.post({ type: 'updateLatency', latency: this.latency === Infinity ? 0 : this.latency });
}

// if new addresses array arrives, update this.addresses and update connections
function updateAddresses(addresses) {
  this.addresses = addresses;
  connectToAddresses();
  updateDataSetIDs();
}

function convertMessageToData(data) {
  if (self.convertMessageToData) {
    return self.convertMessageToData(data);
  } else {
    console.log('Default convertMessageToData is used.')
    return {x: data.x, y: data.y, measured: data.x};
  }
}

worker = insideWorker(function (e) {
  if (e.data.canvas) {
    //first message, set canvas values
    Chart.defaults.global.animation.duration = 0;
    self.window = self;
    canvas = e.data.canvas;
    this.ctx = canvas.getContext('2d');
    this.width = e.data.width;
    this.height = e.data.height;
    canvas.clientWidth = 600;
    canvas.clientHeight = 300;
    canvas.style = { width: '600px', height: '300px' };
  } else if (e.data.type === 'buildChart') {
    this.chartType = e.data.chartType;
    this.messageData = e.data.messageData;
    this.timeBackward = e.data.timeBackward;
    this.xAxisType = e.data.xAxisType;
    this.yAxisType = e.data.yAxisType;
    this.actDate = e.data.actDate;
    this.addresses = e.data.addresses;
    this.dataSetIDs = e.data.dataSetIDs; 
    this.colors = e.data.colors;
    this.duration = e.data.duration;
    this.suspended = false;
    messages = new Map();
    if (e.data.functionSource) {
      importScripts(e.data.functionSource);
    }
    createMessageData();
    connectToAddresses();
    buildChart();
    // render every 50 ms
    this.renderChartInterval = setInterval(() => renderChart(), 30);
  } else if (e.data.type === 'setSize') {
    setSize(e.data.width, e.data.height);
  } else if (e.data.type === 'updateDate') {
    this.actDate = e.data.actDate;
    // update latency every second
    updateLatency();
  } else if (e.data.type === 'updateDataSetIDs') {
    this.dataSetIDs = e.data.dataSetIDs;
    updateDataSetIDs();
  } else if (e.data.type === 'updateColors') {
    this.colors = e.data.colors;
    updateColors();
  } else if (e.data.type === 'updateDuration') {
    this.duration = e.data.duration;
  } else if (e.data.type === 'updateAddresses') {
    updateAddresses(e.data.addresses);
  } else if (e.data.type === 'renderChart') {
    renderChart();
  } else if (e.data.type === 'sendSpecialMessages') {
    sendSpecialMessages(e.data.messages);
  } else if (e.data.type === 'timeBackward') {
    this.timeBackward = e.data.timeBackward;
  } else if (e.data.type === 'suspended') {
    this.suspended = e.data.suspended;
  } else if (e.data.type === 'close') {
    clearInterval(this.renderChartInterval);
    closeConnections();
    this.myChart.destroy();
    close();
  } 
});

// update latency every second, could be moved to updateDate message handler
// setInterval(() => updateLatency(), 1000);
