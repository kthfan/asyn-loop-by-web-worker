//
var SET_IMPORT = 1, RUN_ITER = 2, INT_DATA = 3, CLOSE_WORKER = 4,
    TERMINATE_WORKER = 5, FINISHED = 6, SEND_DATA = 7;
self.workerState = {type:"integrate", running:false, terminated: false,
                    sendback:function(data){
                     postMessage([INT_DATA, data]);
                   }, dataQueue:[]
};
onmessage = function(e){
  var data = e.data;
  var type = data[0];
  if(type === SET_IMPORT){
    if(data[1]!=null){
      importScripts.apply(self,data[1]);
    }
  }else if(type === INT_DATA){
    self.workerState.running = true;
    self.workerState.run(data[1]);
    self.workerState.running = false;
    postMessage([FINISHED]);
  }else if(type === CLOSE_WORKER){
    self.workerState.terminated = true;
  }else if(type === SEND_DATA){
    self.workerState.dataQueue.push(data[1]);
  }
}

