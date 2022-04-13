export type Program<A> = { a?: A, vardefs: VarDef<A>[], funcdefs: FuncDef<A>[], stmts: Stmt<A>[] }

export type VarDef<A> = { a?: A, name: string, typedef: Type, value: Literal<A> }

export type FuncDef<A> = { a?: A, name: string, args: TypedVar<A>[], rettype: Type, body: FuncBody<A> }

export type FuncBody<A> = { a?: A, vardefs: VarDef<A>[], stmts: Stmt<A>[] }

export type TypedVar<A> = { a?: A, name: string, typedef: Type }

// export type defStmt<A> = 
//   | VarDef<A> | FuncDef<A>


export type Stmt<A> =
  | { a?: A, tag: "assign", name: string, value: Expr<A> }
  | { a?: A, tag: "if",
      ifcondition?: Expr<A>, body: Stmt<A>[],
      elseblock?: Stmt<A> }
  | { a?: A, tag: "while",
      condition: Expr<A>,
      body: Stmt<A>[] }
  | { a?: A, tag: "pass" }
  | { a?: A, tag: "return", expr?: Expr<A> }
  | { a?: A, tag: "expr", expr: Expr<A> }

export type Expr<A> =
  | { a?: A, tag: "literal", value: Literal<A> }
  | { a?: A, tag: "id", name: string }
  | { a?: A, tag: "unaexpr", op: UnaOp, oprnd: Expr<A> }
  | { a?: A, tag: "binexpr", l_oprnd: Expr<A>, op: BinOp, r_oprnd: Expr<A> }
  | { a?: A, tag: "paranthexpr", expr: Expr<A> }
  | { a?: A, tag: "call", name: string, arglist?: Expr<A>[] }

export type UnaOp = 
  | { tag: "not"} | { tag: "-"}

export type BinOp = 
  | { tag: "+"} | { tag: "-"} | { tag: "*"} | { tag: "//"}
  | { tag: "%"} | { tag: "=="} | { tag: "!="} | { tag: "<="} 
  | { tag: ">="} | { tag: "<"} | { tag: ">"} | { tag: "is"}

// export type BinOp = "+"|"-"|"*"|"//"|"%"|"=="|"!="|"<="|">="|"<"|">"|"is"


export const binops = new Set(["+", "-","*","//","%","==","!=","<=",">=","<",">","is"])

export function getTypeFromBinOp(op: string) : Type {
  if(op in ["+","-","*","//","%","<=",">=","<",">"])
    return "int";
  else if(op in ["==","!="])
    return 
}

export type Literal<A> =
  | { a?: A, tag: "none", value: 0}
  | { a?: A, tag: "boolean", value: number }
  | { a?: A, tag: "number", value: number}

export type Type = "int" | "bool" | "none" | "any";

export function isType(maybeType: string): maybeType is Type{
  return maybeType=="int" || maybeType=="bool"
}