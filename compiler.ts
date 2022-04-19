import { Set } from "typescript";
import {Expr, Program, Type, Literal, Stmt, VarDef, TypedVar, FuncDef, FuncBody} from './ast';
import { parse, traverseFuncDefArgList } from "./parser";
import {typeCheckProgram} from "./typechecker";

// https://learnxinyminutes.com/docs/wasm/

type LocalEnv = Map<string, boolean>;
var loop_counter : number = 0;
type CompileResult = {
  wasmSource: {
    funcDefCode: string,
    varDefCode: string,
    stmtsCode: string,
  }
};

export function compile(source: string) : CompileResult {
  var untypedast = parse(source);
  var ast = typeCheckProgram(untypedast);
  const definedVars = new Set();

  const scratchVar : string = `(local $scratch i32)`;
  // [scratchVar];
  // const varDefCode : string[] = [];

  // const funcDefCode : string[] = [];

  // var varDefCmds = new Array<string>();
  // ast.funcdefs.forEach(funcDef => {
  //   funcDefCode.push(codeGenFuncDef(funcDef));
  // })

  const varDefCode : string = codeGenVarDefs(ast.vardefs, "global");
  const funcDefCode : string = ast.funcdefs.map(funcdef => codeGenFuncDef(funcdef)).join('');
  
  // ast.vardefs.forEach(varDef => {
  //   if(definedVars.has(varDef.name))
  //     throw new Error("Duplicate declaration of id " + varDef.name)
  //     localDefines.push(`(local $${varDef.name} i32)`);
  //     varDefCmds = varDefCmds.concat(`(i32.const ${varDef.value.value})`, `(local.set $${varDef.name})`);
  //   definedVars.add(varDef.name)
  // });
  // var commands = new Array<string>();
  const stmtsCode : string = scratchVar + codeGenBody(ast.stmts);
  // ast.stmts.forEach(stmt => {
  //   switch(stmt.tag) {
  //     case "assign":
  //       var valStmts = codeGenExpr(stmt.value);
  //       if(definedVars.has(stmt.name))
  //         commands = commands.concat(valStmts, `(local.set $${stmt.name})`);
  //       else
  //         throw new Error("ReferenceError: '" + stmt.name + "' referenced before declaration")
  //       // commands = [`(local $${stmt.name} i32)`].concat(commands, valStmts, `(local.set $${stmt.name})`);
  //       // definedVars.add(stmt.name);
  //       break;
  //     case "expr":
  //       var exprStmts = codeGenExpr(stmt.expr);
  //       commands = commands.concat(exprStmts, `(local.set $$last)`);
  //   }
  // });
  // commands = localDefines.concat( varDefCmds, commands); //[].concat.apply([], commands));
  // console.log("Generated: ", commands.join("\n"));
  return {
    wasmSource: {
      funcDefCode: funcDefCode,
      varDefCode: varDefCode,
      stmtsCode: stmtsCode
    }
  };
}

function codeGenRetType(retType: Type) : string {
  if(retType==="none")
    return "(result i32)";
  return "(result i32)";
}

function codeGenArgs(args: TypedVar<Type>[]) : string {
  return args.map(arg => `(param $${arg.name} i32)`).join('')
}

function codeGenVarDefs(varDefs : VarDef<Type>[], scope : string) : string {
  if(scope==="global")
    return varDefs.map(varDef => `(global $${varDef.name} (mut i32) (i32.const ${varDef.value.value}))`).join('');
  // const defineStmts : string[] = [];
  // const initStmts : string[] = [];
  const defineStmts : string = varDefs.map(varDef => `(local $${varDef.name} i32)`).join('');
  const initStmts : string = varDefs.map(varDef => `(i32.const ${varDef.value.value})(local.set $${varDef.name})`).join('');
  // varDefs.forEach(varDef => {
  //   defineStmts.push(`(local $${varDef.name} i32)`);
  //   initStmts.push(`(i32.const $${varDef.value})(local.set $${varDef.name})`);
  // })
  // return (defineStmts.concat(initStmts)).join('');
  return defineStmts + initStmts;
}

function codeGenBody(stmts: Stmt<Type>[], localVars : Map<string, true> = new Map()) : string {
  return stmts.map(stmt => codeGenStmt(stmt, localVars)).join('');
}

function getLocalVars(funcdef: FuncDef<Type>) : Map<string, true>{
  const localVars : Map<string, true> = new Map();
  funcdef.args.forEach(arg => {
    localVars.set(arg.name, true);
  })
  funcdef.body.vardefs.forEach(vardef => {
    localVars.set(vardef.name, true);
  })
  return localVars;
}

function codeGenFuncDef(funcDef: FuncDef<Type>) : string {
  const localVars = getLocalVars(funcDef);
  console.log(localVars);
  const retTypeCode = codeGenRetType(funcDef.rettype);
  var returnCode = '(local.get $scratch)';
  // if(retTypeCode==='')
  //   returnCode = '';
  // else
  //   returnCode = '(local.get $scratch)';
  const argsCode = codeGenArgs(funcDef.args);
  const varDefsCode = `(local $scratch i32)` + codeGenVarDefs(funcDef.body.vardefs, "local");
  const bodyStmtsCode = codeGenBody(funcDef.body.stmts, localVars);
  return `(func $${funcDef.name} ${argsCode} ${retTypeCode} ${varDefsCode} ${bodyStmtsCode} ${returnCode})`;
  
}

// function codeGen(stmt: Stmt<any>, definedVars : any) : Array<string> {
//   switch(stmt.tag) {
//     case "assign":
//       var valStmts = codeGenExpr(stmt.value, definedVars);
//       return [`(local $${stmt.name} i32)`].concat(valStmts, `(local.set $${stmt.name})`);
//     case "expr":
//       var exprStmts = codeGenExpr(stmt.expr, definedVars);
//       if(stmt.expr.tag=="builtin1" && stmt.expr.name=="print")
//         return exprStmts;
//       return exprStmts.concat([`(local.set $$last)`]);
//   }
// }

function codeGenStmt(stmt : Stmt<Type>, localVars : Map<string, true> = new Map()) : string {
  switch(stmt.tag){
    case "assign":
      const valueCode = codeGenExpr(stmt.value, localVars);
      var scope : string;
      if(localVars.has(stmt.name))
        scope = "local"
      else
        scope = "global"
      return `${valueCode}(${scope}.set $${stmt.name})`;
    
    case "pass":
      return ''

    case "return":
      var retValueCode = ''
      if(stmt.expr!==undefined)
        retValueCode = codeGenExpr(stmt.expr, localVars);
      else
        retValueCode = '(local.get $scratch)'
      return `${retValueCode}(return)`;
    
    case "expr":
      return codeGenExpr(stmt.expr, localVars) + `(local.set $scratch)`;
    
    case "if":
      return codeGenIfStatement(stmt, localVars);
    
    case "while":
      const conditionCode = codeGenExpr(stmt.condition, localVars);
      const bodyStmtsCode = codeGenBody(stmt.body, localVars);
      return `(block $block_${loop_counter} 
                (loop $loop_${loop_counter} 
                  ${conditionCode} (i32.const 1)(i32.xor)
                  (br_if $block_${loop_counter})
                  ${bodyStmtsCode}
                  (br $loop_${loop_counter++})
                )
              )`
  }
}

function codeGenIfStatement(stmt : Stmt<Type>, localVars : Map<string, true> = new Map()) : string {
  if(stmt.tag!=="if") throw new Error();
  const bodyCode = codeGenBody(stmt.body, localVars);
  if(stmt.ifcondition==undefined)
    return bodyCode;
  const ifConditionCode = codeGenExpr(stmt.ifcondition, localVars);
  var elseBlockCode : string = '';
  if(stmt.elseblock!==undefined)
    elseBlockCode = `(else
                        ${codeGenIfStatement(stmt.elseblock, localVars)}
                      )`
  return `${ifConditionCode}
          (if
            (then
              ${bodyCode}
            )
            ${elseBlockCode}
          )`
}

function codeGenExpr(expr : Expr<any>, localVars : Map<string, true> = new Map()) : string {
  var exprCode : string[] = [];
  switch(expr.tag) {
    case "literal":
      switch(expr.value.tag){
        case "number":
          exprCode = ["(i32.const " + expr.value.value + ")"];  break;
        case "boolean":
          exprCode = ["(i32.const " + expr.value.value + ")"];  break;
        case "none":
          exprCode = ["(i32.const " + expr.value.value + ")"];  break;
      }
      break;
    case "id":
      var scope : string;
      if(!localVars.has(expr.name))
        scope = "global";
      else
        scope = "local"
      exprCode = [`(${scope}.get $${expr.name})`]; break;
    case "unaexpr":
      const oprndStmt = codeGenExpr(expr.oprnd, localVars);
      var opStmt: string;
      switch(expr.op.tag){
        case "not": 
          exprCode.push(oprndStmt.concat("(i32.const 1)","(i32.xor)")); break;
        case "-": 
          exprCode = ["(i32.const 0)"].concat(oprndStmt,"(i32.sub)"); break;
      }
    break;
    case "binexpr":
      const op1Stmt = codeGenExpr(expr.l_oprnd, localVars);
      const op2Stmt = codeGenExpr(expr.r_oprnd, localVars);
      const pyop2watop:any = {"+":"add", "-":"sub", "*":"mul", "//":"div_s", "%":"rem_s",
      "==":"eq", "!=":"ne", ">=":"ge_s", "<=":"le_s", ">":"gt_s", "<":"lt_s", "is":"eq"}
      var opStmt = "(i32." + pyop2watop[expr.op.tag]+")";
      exprCode.push(op1Stmt.concat(op2Stmt, opStmt)); break;
    case "paranthexpr":
      exprCode.push(codeGenExpr(expr.expr, localVars)); break;
    case "call":
      var argListCode : string = '';
      if(expr.name==="print")
        argListCode = codeGenPrint(expr.arglist[0].a);
      argListCode = expr.arglist.map(arg => codeGenExpr(arg, localVars)).join('') + argListCode;
      exprCode.push(argListCode + `(call $${expr.name})`);      
  }
  return exprCode.join('');
  // return (exprCode.concat(['(local.set $scratch)'])).join('');
}

function codeGenPrint(type: Type) : string {
  // console.log(type)
  const type2TypeFlag = new Map([
    ["int", 0], ["bool", 1], ["none", 2]
  ]);
  // console.log(type2TypeFlag)
  return `(i32.const ${type2TypeFlag.get(type)})`;
}
