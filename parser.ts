import {parser} from "lezer-python";
import {TreeCursor} from "lezer-tree";
import { isSpreadAssignment } from "typescript";
import {UnaOp, BinOp, Expr, Stmt, Type, isType, Program, Literal, VarDef, FuncDef, TypedVar, FuncBody} from "./ast";

export function traverseArgs(c : TreeCursor, s : string, callName : string) : Expr<null>[] {
  var args : Expr<null>[] = [];
  c.firstChild(); //  '('
  c.nextSibling();  // arglist or ')'
  while(c.type.name!==')'){
    var arg : Expr<null> = traverseExpr(c, s, true);
    c.nextSibling(); // ',' or ')'
    var curr_node = c.type.name;
    c.nextSibling();
    if(curr_node==',' && c.type.name==')')
      throw new Error("ParseError: Could not parse near " + c.from + ":" + c.to + ": " + s.substring(c.from, c.to));
    args.push(arg);
  }
  throwErrorIfLeftover(c, s);
  c.parent();
  return args;
}
export function throwErrorIfLeftover(c : TreeCursor, s : string){
  if(c.nextSibling())
    throw new Error("ParseError: Could not parse at " + c.from + ":" + c.to + ": " + s.substring(c.from, c.to));
}
export function traverseExpr(c : TreeCursor, s : string, isArgs : Boolean = false) : Expr<any> {
  var expr : Expr<any>;
  switch(c.type.name) {
    case "Number":
      if(!Number.isInteger(Number(s.substring(c.from, c.to))))
        throw new Error("ParseError: Invalid string id at " + c.from + ":" + c.to + ": " + s.substring(c.from, c.to))
      // else if(Number(s.substring(c.from, c.to))>Math.pow(2,31)-1 || Number(s.substring(c.from, c.to))<-Math.pow(2,31))
      //   throw new Error("ParseError: Number out of range for 32-bit integer");
      expr = { tag: "literal", value: { tag: "number", value: Number(s.substring(c.from, c.to)) } }
      break;
    case "Boolean":
      var value;
      if(s.substring(c.from, c.to)=="True")
        value = 1;
      else
        value = 0;
      expr = { tag: "literal", value: { tag: "boolean", value: value } }
      break;
    case "None":
      expr = { tag: "literal", value: { tag: "none", value: 0} }
      break;
    case "VariableName":
      expr = { tag: "id", name: s.substring(c.from, c.to) }
      break;
    case "UnaryExpression":
      c.firstChild();
      var unaop: UnaOp;
      switch(s.substring(c.from, c.to)){
        case "-": unaop = {tag:"-"};
        break;
        case "not": unaop = {tag:"not"};
        break;
        default:
          throw new Error("ParseError: Could not parse unary operator at " + c.from + ":" + c.to + ": " + s.substring(c.from, c.to));
      }
      c.nextSibling();
      const oprnd = traverseExpr(c, s);
      throwErrorIfLeftover(c, s);
      c.parent();
      expr = { tag: "unaexpr", op: unaop, oprnd: oprnd }
      break;
    case "BinaryExpression":
      c.firstChild();
      // console.log(c.type.name)
      const l_oprnd = traverseExpr(c, s);
      c.nextSibling();
      
      // if(binops.has(s.substring(c.from, c.to)))
      //   var op: BinOp = {tag: s.substring(c.from, c.to)};
      // else
      //   throw new Error("ParseError: Could not parse binary operator at " + c.from + ":" + c.to + ": " + s.substring(c.from, c.to));
      var binop: BinOp;
      switch(s.substring(c.from, c.to)){
        case "+": binop = {tag:"+"};
        break;
        case "-": binop = {tag:"-"};
        break;
        case "*": binop = {tag:"*"};
        break;
        case "//": binop = {tag:"//"};
        break;
        case "%": binop = {tag:"%"};
        break;
        case "==": binop = {tag:"=="};
        break;
        case "!=": binop = {tag:"!="};
        break;
        case "<=": binop = {tag:"<="};
        break;
        case ">=": binop = {tag:">="};
        break;
        case "<": binop = {tag:"<"};
        break;
        case ">": binop = {tag:">"};
        break;
        case "is": binop = {tag:"is"};
        break;
        default:
          throw new Error("ParseError: Could not parse binary operator at " + c.from + ":" + c.to + ": " + s.substring(c.from, c.to));
      }
      c.nextSibling();
      const r_oprnd = traverseExpr(c, s);
      throwErrorIfLeftover(c, s);
      c.parent();
      expr = { tag: "binexpr", l_oprnd: l_oprnd, op: binop, r_oprnd: r_oprnd }
      break;
    case "ParenthesizedExpression":
      c.firstChild(); // '('
      c.nextSibling(); // expr
      expr = { tag: "paranthexpr", expr: traverseExpr(c, s) }
      c.nextSibling();// ')'
      throwErrorIfLeftover(c, s);
      c.parent();
      break;
    case "CallExpression":
      c.firstChild(); //'name'
      const funcname = s.substring(c.from, c.to);
      c.nextSibling();  //'arglist'
      const arglist = traverseArgs(c, s, funcname);
      throwErrorIfLeftover(c, s);
      c.parent();
      expr = { tag: "call", name: funcname, arglist: arglist };
      break;
    default:
      throw new Error("ParseError: Could not parse expr at " + c.from + ":" + c.to + ": " + s.substring(c.from, c.to));
  }
  // if(c.nextSibling() && !isArgs)
  // // // if(s.substring(c.node.from, c.node.to)==',' && !isArgs)
  //   throw new Error("ParseError: Could not parse expr at " + c.from + ":" + c.to + ": " + s.substring(c.from, c.to));
  // else
  //   c.prevSibling();
  return expr;
}

export function traverseStmt(c : TreeCursor, s : string) : Stmt<null> {
  switch(c.node.type.name) {
    case "AssignStatement":
      c.firstChild(); // name
        const name = s.substring(c.from, c.to);
      c.nextSibling(); // =
      c.nextSibling(); // go to value
      const value = traverseExpr(c, s);
      throwErrorIfLeftover(c, s);
      c.parent();
      return {
        tag: "assign", name: name, value: value }
    case "ExpressionStatement":
      c.firstChild();
      const expr = traverseExpr(c, s);
      throwErrorIfLeftover(c, s);
      c.parent(); // pop going into stmt
      
      return { tag: "expr", expr: expr }
    case "IfStatement":
      c.firstChild(); //'if'
      const ifExpr = traverseIfStatement(c, s);
      throwErrorIfLeftover(c, s);
      c.parent();
      return ifExpr;
    case "WhileStatement":
      c.firstChild(); //  while
      c.nextSibling();  // while condition
      const whileCondition = traverseExpr(c, s);
      c.nextSibling();  //Body
      const whileBody = traverseBody(c, s);
      throwErrorIfLeftover(c, s);
      c.parent();
      return { tag: "while", condition: whileCondition, body: whileBody };
    case "PassStatement":
      return { tag: "pass" }
    case "ReturnStatement":
      c.firstChild();
      if(!c.nextSibling()){
        throwErrorIfLeftover(c, s);
        c.parent();
        return { tag:"return" }
      }
      if(s.substring(c.node.from, c.node.to)===''){ //c.type.name==="⚠"){
        throwErrorIfLeftover(c, s);
        c.parent();
        return { tag:"return" }
      }
      const typedExpr = traverseExpr(c, s);
      throwErrorIfLeftover(c, s);
      c.parent();
      return { tag:"return", expr: typedExpr }
    default:
      throw new Error("ParseError: Could not parse stmt at " + c.node.from + ":" + c.node.to + ": " + s.substring(c.from, c.to));
  }
}

export function traverseIfStatement(c : TreeCursor, s : string) : Stmt<null> {
  if(c.type.name=="else"){
    c.nextSibling();
    var body = traverseBody(c, s);
    return { tag: "if", body: body }
  }
  c.nextSibling();
  const ifcondition = traverseExpr(c, s);
  c.nextSibling();
  var body = traverseBody(c, s);
  if(c.nextSibling()){
    const elseblock = traverseIfStatement(c, s);
    return { tag: "if", ifcondition: ifcondition, body: body, elseblock: elseblock }
  }
  return { tag: "if", ifcondition: ifcondition, body: body }
}

export function traverseBody(c : TreeCursor, s : string) : Stmt<null>[] {
  c.firstChild(); //  ':'
  const bodyStmts : Stmt<null>[] = [];
  while(c.nextSibling()){
    bodyStmts.push(traverseStmt(c, s));
  }
  throwErrorIfLeftover(c, s);
  c.parent();
  return bodyStmts;
}

// export function traverseIf(c : TreeCursor, s : string) : boolean {

export function isAssignStmt(c : TreeCursor, s : string) : boolean {
  c.firstChild(); //id
  c.nextSibling(); //=
    var isAssign :boolean = false;
    if(c.type.name=="AssignOp")
      isAssign = true;
  c.parent();
  return isAssign;
}

export function traverseLiteral(c : TreeCursor, s : string) : Literal<null> {
  console.log(c.type.name)
  switch(c.type.name){
    case "Number":
      if(!Number.isInteger(Number(s.substring(c.from, c.to))))
        throw new Error("ParseError: Could not parse at " + c.from + ":" + c.to + ": " + s.substring(c.from, c.to))
      // else if(Number(s.substring(c.from, c.to))>Math.pow(2,31)-1 || Number(s.substring(c.from, c.to))<-Math.pow(2,31))
      //   throw new Error("ParseError: Number out of range for 32-bit integer");
      return { tag: "number", value: Number(s.substring(c.from, c.to)) }
    case "Boolean":
      var value;
      if(s.substring(c.from, c.to)=="True")
        value = 1;
      else
        value = 0;
      return { tag: "boolean", value: value }
    case "None":
      return { tag: "none", value: 0}
    default:
      throw new Error("ParseError: Could not parse literal at " + c.node.from + ":" + c.node.to + ": " + s.substring(c.from, c.to));
  }
}

export function traverseVarDef(c : TreeCursor, s : string) : VarDef<null> {
  c.firstChild(); // name
    const name = s.substring(c.from, c.to);
  c.nextSibling(); // TypeDef
    c.firstChild(); // :
      // if(c.name!==":")
      //     throw new Error("ParseError: Could not parse at " + c.node.from + ":" + c.node.to + ": " + s.substring(c.from, c.to));
    c.nextSibling(); // Type name
      const typeName=s.substring(c.node.from, c.node.to);
      if(typeName=="int" || typeName=="bool")
        var typedef: Type = typeName;
      else
        throw new Error("ParseError: Could not parse type at " + c.node.from + ":" + c.node.to + ": " + s.substring(c.from, c.to));
  throwErrorIfLeftover(c, s);
  c.parent(); // TypeDef
  c.nextSibling(); // =
  c.nextSibling(); // go to value
  console.log(c.type.name)
  const value = traverseLiteral(c, s);
  throwErrorIfLeftover(c, s);
  c.parent();
  return {
    name: name,
    typedef: typedef,
    value: value
  }
}

export function traverseFuncDefArgList(c : TreeCursor, s : string) : TypedVar<null>[] {
  c.firstChild() // '('
  var arglist: TypedVar<null>[] = [];
  c.nextSibling(); // 'First arg'
  while(c.type.name!==')'){
    var name = s.substring(c.node.from, c.node.to);
    c.nextSibling(); // TypeDef
    if(c.type.name!=='TypeDef')
      throw new Error("ParseError: Missed type annotation for parameter " + name)
    c.firstChild(); //:
      c.nextSibling(); // type
      const typename=s.substring(c.node.from, c.node.to);
      if(typename=="int" || typename=="bool")
        var typedef: Type = typename;
      else
        throw new Error("ParseError: Could not parse type at " + c.node.from + ":" + c.node.to + ": " + s.substring(c.from, c.to));
    throwErrorIfLeftover(c, s);
    c.parent();
    c.nextSibling(); //',' or ')'
    var curr_node = c.type.name;
    c.nextSibling();
    if(curr_node==',' && c.type.name.toString()==')')
      throw new Error("ParseError: Could not parse near " + c.from + ":" + c.to + ": " + s.substring(c.from, c.to));
    
    // c.nextSibling();
    arglist.push({name: name, typedef: typedef});
  }
  throwErrorIfLeftover(c, s);
  c.parent();
  return arglist;
}
// export function traverseType(c : TreeCursor, s : string) : Type{

// }
export function traverseFuncBody(c : TreeCursor, s : string) : FuncBody<null> {
  c.firstChild(); // ':'
  c.nextSibling(); // Enter body of fn
  const vardefstmts : VarDef<null>[] = [];
  const stmts : Stmt<null>[] = [];
  var declareStmtsEnd: boolean = false
  var childnodetype;
  do {
    childnodetype = c.node.type.name;
    if(childnodetype=="AssignStatement" && !isAssignStmt(c, s))
      vardefstmts.push(traverseVarDef(c, s));
    // else if(childnodetype=="FunctionDefinition")
    //   funcDefStmts.push(traverseFuncDef(c, s));
    else{
      declareStmtsEnd = true;
      break;
    }
  } while(c.nextSibling())

  if(declareStmtsEnd){
    do {
      stmts.push(traverseStmt(c, s));
    } while(c.nextSibling())
  }
  throwErrorIfLeftover(c, s);
  c.parent();
  return {vardefs: vardefstmts, stmts: stmts};
}
export function traverseFuncDef(c : TreeCursor, s : string) : FuncDef<null> {
  c.firstChild(); //def
  c.nextSibling(); //id
    const funcname = s.substring(c.node.from, c.node.to);
  c.nextSibling(); //ParamList
  const args: TypedVar<null>[] = traverseFuncDefArgList(c, s)
  c.nextSibling(); //TypeDef or Body
  if(c.type.name=='TypeDef'){
    c.firstChild();
    var typename=s.substring(c.node.from, c.node.to);
    throwErrorIfLeftover(c, s);
    c.parent();
    if(typename=="int" || typename=="bool")
      var rettype : Type = typename;
    else
      throw new Error("ParseError: Could not parse type at " + c.node.from + ":" + c.node.to + ": " + s.substring(c.from, c.to));
    c.nextSibling(); //Body
    }
  else{
    var rettype : Type = "none";
  }
  const body : FuncBody<null> = traverseFuncBody(c, s);
  throwErrorIfLeftover(c, s);
  c.parent();
  return { name:funcname, args:args, rettype:rettype, body:body }
}

export function traverse(c : TreeCursor, s : string) : Program<null> {
  switch(c.node.type.name) {
    case "Script":
      // var parsedProgram : Program<null>;
      const varDefStmts : VarDef<null>[] = [];
      const funcDefStmts : FuncDef<null>[] = [];
      const stmts = [];
      c.firstChild();
      var childnodetype: string
      var declareStmtsEnd: boolean = false
      do {
         childnodetype= c.node.type.name;
        if(childnodetype=="AssignStatement" && !isAssignStmt(c, s))
          varDefStmts.push(traverseVarDef(c, s));
        else if(childnodetype=="FunctionDefinition")
          funcDefStmts.push(traverseFuncDef(c, s));
        else{
          declareStmtsEnd = true;
          break;
        }
      } while(c.nextSibling())
      
      if(declareStmtsEnd){
        do {
          stmts.push(traverseStmt(c, s));
        } while(c.nextSibling())
      }
      console.log("traversed " + stmts.length + " statements ", stmts, "stopped at " , c.node);
  
      return {vardefs: varDefStmts, funcdefs: funcDefStmts, stmts: stmts};
      
    default:
      throw new Error("ParseError: Could not parse program at " + c.node.from + ":" + c.node.to);
  }
}
export function parse(source : string) : Program<null> {
  const t = parser.parse(source);
  return traverse(t.cursor(), source);
}
