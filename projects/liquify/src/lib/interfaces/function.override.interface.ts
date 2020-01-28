export interface FunctionOverrideInterface {
  checkData(latestStatus): boolean;
  convertMessageToData(data): any;
  findDataSetID(latestStatus, address): any;
}
