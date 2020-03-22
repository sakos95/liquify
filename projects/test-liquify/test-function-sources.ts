import { FunctionOverrideInterface } from 'liquify/public-api';

export class TestFunctionSources implements FunctionOverrideInterface {

    checkData(latestStatus) {
        return true;
    }
  
    convertMessageToData(data) {
        return {x: data.x, y: data.y, measured: data.x};
    }
  
    findDataSetID(latestStatus, address) {
        return address;
    }

}
