import {FunctionOverrideInterface} from '../interfaces/function.override.interface';

export class DefaultFunctionSources implements FunctionOverrideInterface {

  checkData(latestStatus) {
      return true;
  }

  convertMessageToData(data) {
      return {x: data.x, y: data.y, measured: data.x};
  }

  findDataSetID(latestStatus, address) {
      return '0';
  }

}
