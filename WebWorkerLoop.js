//

;(function(){
  var MIN_WORKER_ITER = 10, MAX_WORKER_ITER = 1000000;
  var SET_IMPORT = 1, RUN_ITER = 2, INT_DATA = 3, CLOSE_WORKER = 4,
      TERMINATE_WORKER = 5, FINISHED = 6, SEND_DATA = 7;
  function _setcnd(T, args){
    if(args.iter!=null) T.iter = args.iter;
    //if(args.step!=null) T.step = args.step;
    if(args.start!=null) T.start = args.start;
    else T.start = 0;
    if(args.split_num!=null) T.split_num = args.split_num;
    if(args.split_rate!=null) T.split_rate = args.split_rate;
    if(args.onmessage!=null) T.onmessage = args.onmessage;
    if(args.iter_script_path!=null) T.iter_script_path = args.iter_script_path;
    if(args.integrate_script_path!=null) T.integrate_script_path = args.integrate_script_path;
    return T.iter!=null&&T.start!=null;
  }
  function _setcnd2(T, args){
    if(T.iter==null&&args.iter!=null) T.iter = args.iter;
    //if(T.step==null&&args.step!=null) T.step = args.step;
    if(T.start==null&&args.start!=null) T.start = args.start;
    if(T.split_num==null&&args.split_num!=null) T.split_num = args.split_num;
    if(T.split_rate==null&&args.split_rate!=null) T.split_rate = args.split_rate;
    if(T.iter_script_path==null&&args.iter_script_path!=null) T.iter_script_path = args.iter_script_path;
    if(T.integrate_script_path==null&&args.integrate_script_path!=null) T.integrate_script_path = args.integrate_script_path;
    return T.iter!=null&&T.start!=null;
  }
  function _rate2num(rate){
    return Math.floor(Math.pow(10, rate*(Math.log10(MAX_WORKER_ITER ) - Math.log10(MIN_WORKER_ITER ))));
  }
  /**
    @param  {Integer}  iter
    @param  {Integer}  start
    @param  {Integer}  split_num
    @param  {Float}    split_rate  0~1
    @param  {Function} onmessage
    @param  {String}   iter_script_path
    @param  {String}   integrate_script_path
  */
  window.WebWorkerLoop = function(args){
    args = args || {};
    if (!(this instanceof window.WebWorkerLoop))
      return new window.WebWorkerLoop(args);
    _setcnd(this, args);
    this.workerDataQueue = [];
  }
  WebWorkerLoop.iterWorkerPath = document.currentScript.src.substr(0,document.currentScript.src.lastIndexOf("/")+1)+"iter_worker.js";
  WebWorkerLoop.integrateWorkerPath = document.currentScript.src.substr(0,document.currentScript.src.lastIndexOf("/")+1)+"integrate_worker.js";
  WebWorkerLoop.prototype = {
    /**
      @param  {Array}  import_list
    */
    run:function(args){
      args = args || {};
      if(!_setcnd(this, args)) return console.error("Enter: start:iter");
      if(args.import_list==null) args.import_list = [];
      var T = this;
      var workers_num;
      var iter_num;
      var remain_iter;
      var remain_worker;
      var decline_worker = false;
      var worker_list;
      if(this.split_num!=null) iter_num = this.split_num;
      else if(this.split_rate!=null) iter_num = _rate2num(this.split_rate);
      else if(this.split_rate==null) iter_num = Math.floor(this.iter/10);
      workers_num = Math.floor(this.iter/iter_num);
      remain_iter = this.iter - workers_num*iter_num;
      
      if(remain_iter===0) decline_worker = -1;
      else if(remain_iter*2<iter_num) decline_worker = true;
      else workers_num++;
      if(workers_num===0) workers_num = 1, iter_num = this.iter, decline_worker = false;
      //console.log(remain_iter, workers_num, iter_num);
      this._run_obj = {decline:decline_worker,iter:iter_num,num:workers_num,remain:remain_iter};
      worker_list = new Array(workers_num);
      this._run_obj.worker_list = worker_list;
      this._run_obj.worker_finish = new Array(workers_num);
      args.import_list.push(this.iter_script_path);
      for(var i=0;i<workers_num;i++){
        var worker = new Worker(WebWorkerLoop.iterWorkerPath);
        this._run_obj.worker_finish[i] = false;
        worker_list[i] = worker;
        worker.postMessage([SET_IMPORT, args.import_list]);
        for(var j=0;i<T.workerDataQueue.length;j++)
          worker.postMessage([SEND_DATA, this.workerDataQueue[j]]);
      }
      args.import_list.pop();
      this._run_obj.remain_worker = worker_list[workers_num-1];
      if(this.integrate_script_path!=null){
        var queue = [];
        var sended = false;
        var int_worker = new Worker(WebWorkerLoop.integrateWorkerPath);
        this._run_obj.int_worker = int_worker;
        this._run_obj.int_worker_finish = false;
        args.import_list.push(this.integrate_script_path);
        int_worker.postMessage([SET_IMPORT, args.import_list]);
        for(var j=0;i<T.workerDataQueue.length;j++)
          int_worker.postMessage([SEND_DATA, this.workerDataQueue[j]]);
        args.import_list.pop();
        if(this.onmessage){
          var onmsg = this.onmessage;
          int_worker.onmessage = function(e){
            var data = e.data;
            var type = data[0];
            if(type === INT_DATA){
              T._run_obj.int_worker_finish = false;
              onmsg(data[1]);
              if(queue.length===0) sended = false;
              else int_worker.postMessage([INT_DATA, queue.shift()]);
            }else if(type === FINISHED)
              T._run_obj.int_worker_finish = true;
          }
        }else{
          int_worker.onmessage = function(e){
            var data = e.data;
            var type = data[0];
            if(type === INT_DATA){
              T._run_obj.int_worker_finish = false;
              if(queue.length===0) sended = false;
              else int_worker.postMessage([INT_DATA, queue.shift()]);
            }else if(type === FINISHED)
              T._run_obj.int_worker_finish = true;
          }
        }
        for(let i=0;i<workers_num;i++){
          worker_list[i].onmessage = function(e){
            var data = e.data;
            var type = data[0];
            if(type === INT_DATA){
              if(sended) queue.push(data[1]);
              else{
                int_worker.postMessage([INT_DATA, data[1]]);
                sended = true;
              }
            }else if(type === FINISHED)
              T._run_obj.worker_finish[i] = true;
          }
        }
      }else{
        if(T.onmessage){
          var onmsg = T.onmessage;
          for(let i=0;i<workers_num;i++){
            worker_list[i].onmessage = function(e){
              var data = e.data;
              var type = data[0];
              if(type === INT_DATA)
                onmsg(data[1]);
              else if(type === FINISHED)
                T._run_obj.worker_finish[i] = true;
            }
          }
        }else{
          for(let i=0;i<workers_num;i++){
            worker_list[i].onmessage = function(e){
              if(e.data[0] === FINISHED)
                T._run_obj.worker_finish[i] = true;
            }
          }
        }
        
      }//if(this.onmessage)
      
      var worker_start = this.start;
      for(var i=0;i<workers_num-1;i++){
        worker_list[i].postMessage([RUN_ITER, worker_start,iter_num]);
        worker_start += iter_num;
      }
      if(decline_worker===-1)  worker_list[workers_num-1].postMessage([RUN_ITER, worker_start,iter_num]);
      if(decline_worker)  worker_list[workers_num-1].postMessage([RUN_ITER, worker_start,iter_num+remain_iter]);
      else  worker_list[workers_num-1].postMessage([RUN_ITER, worker_start,remain_iter]);
    },
    terminate:function(){
      if(!this._run_obj) return false;
      var worker_list = this._run_obj.worker_list;
      var workers_num = this._run_obj.num;
      for(var i=0;i<workers_num;i++)
        worker_list[i].postMessage([CLOSE_WORKER]);
      return true;
    },
    terminateIntegrate:function(){
      if(!this._run_obj) return false;
      if(this._run_obj.int_worker)
        this._run_obj.int_worker.postMessage([CLOSE_WORKER]);
      else return false;
      return true;
    },
    forceTerminate:function(){
      if(!this._run_obj) return false;
      var worker_list = this._run_obj.worker_list;
      var workers_num = this._run_obj.num;
      for(var i=0;i<workers_num;i++)
        worker_list[i].terminate();
      if(this._run_obj.int_worker) this._run_obj.int_worker.terminate();
      return true;
    },
    isFinish:function(){
      if(!this._run_obj) return true;
      var worker_list = this._run_obj.worker_finish;
      var workers_num = this._run_obj.num;
      var res = 1;
      for(var i=0;i<workers_num;i++)
        res &= worker_list[i];
      if(this._run_obj.int_worker)
        res &= this._run_obj.int_worker_finish;
      return res == true;
    },
    sendWorkerData:function(data){
      if(this.isFinish()) this.workerDataQueue.push(data);
      else{
        var worker_list = this._run_obj.worker_list;
        var workers_num = this._run_obj.num;
        for(var i=0;i<workers_num;i++){
          worker_list[i].postMessage([SEND_DATA, data]);
        }
      }
    }
  };
})();

