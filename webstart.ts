import { ExitStatus } from 'typescript';
import {run} from './runner';


function webStart() {
  document.addEventListener("DOMContentLoaded", function() {
    var importObject = {
      imports: {
        print: (arg : any, type: number) => {
          console.log("Logging from WASM: ", arg);
          const elt = document.createElement("pre");
          document.getElementById("output").appendChild(elt);
          var printStmt = "";
          switch(type){
            case 0:
              printStmt = arg
              break;
            case 1:
              if(arg===0)
                printStmt = "False";
              else
                printStmt = "True";
            break;
            case 2:
              throw new Error("Invalid argument;\nExited with error code 1");
          }
          elt.innerText = printStmt;
          return arg;
        },
        abs: Math.abs,
        max: Math.max,
        min: Math.min,
        pow: Math.pow
      },
    };

    function renderResult(result : any) : void {
      if(result === undefined) { console.log("skip"); return; }
      const elt = document.createElement("pre");
      document.getElementById("output").appendChild(elt);
      elt.innerText = String(result);
    }

    function renderError(result : any) : void {
      const elt = document.createElement("pre");
      document.getElementById("output").appendChild(elt);
      elt.setAttribute("style", "color: red");
      elt.innerText = String(result);
    }

    document.getElementById("run").addEventListener("click", function(e) {
      const source = document.getElementById("user-code") as HTMLTextAreaElement;
      const output = document.getElementById("output").innerHTML = "";
      run(source.value, {importObject}).then((r) => { renderResult(r); console.log ("run finished") })
          .catch((e) => { renderError(e); console.log("run failed", e) });;
    });
  });
}

webStart();
