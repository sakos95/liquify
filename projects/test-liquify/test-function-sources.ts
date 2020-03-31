import { FunctionOverrideInterface } from 'liquify/public-api';

export class TestFunctionSources implements FunctionOverrideInterface {
    chartType;
    checkData(latestStatus) {
        return true;
    }
  
    convertMessageToData(data) {
        if (this.chartType === 'bubble') {
            return {x: data.x, y: data.y, r: data.y, measured: data.x};
        } else {
            return {x: data.x, y: data.y, measured: data.x};
        }
    }
  
    findDataSetID(latestStatus, address) {
        return address;
    }

}
