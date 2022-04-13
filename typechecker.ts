import { EnvironmentPlugin } from 'webpack';
import {Expr, Program, Type, Literal, Stmt, VarDef, FuncDef, FuncBody} from './ast';

type TypeEnv = {
    vars: Map<string, Type>,
    funcs: Map<string, { arglist:Type[], retType: Type }>
    retType: Type
}

type Env = {
    localEnv?: TypeEnv
    globalEnv: TypeEnv
}

function createNewScopeEnv(env: Env) : Env {
    return {
        localEnv: { vars: new Map(), funcs: new Map(), retType: "none"},
        globalEnv: env.globalEnv
    }
}

function getBuiltIns() : Map<string, { arglist:Type[], retType: Type }>{
    var builtins : Map<string, { arglist:Type[], retType: Type }> = new Map();
    builtins.set("print", {arglist: ["any"], retType: "none"});
    builtins.set("abs", {arglist: ["int"], retType: "int"});
    builtins.set("max", {arglist: ["int", "int"], retType: "int"});
    builtins.set("min", {arglist: ["int", "int"], retType: "int"});
    builtins.set("pow", {arglist: ["int", "int"], retType: "int"});

    return builtins
}

export function typeCheckProgram(program: Program<null>) : Program<Type>{
    var programType : Type = "none";
    const typedStmts : Stmt<Type>[] = [];
    const typedVarDefs : VarDef<Type>[] = [];
    const typedFuncDefs : FuncDef<Type>[] = [];

    var env: Env = {
        globalEnv: {
            vars: new Map<string,Type>(), funcs: getBuiltIns(), retType: "none"
        }
    }

    program.vardefs.forEach((vardef) => {
        const typedVarDef = typeCheckVarDef(vardef, env);
        typedVarDefs.push(typedVarDef);
    })
    program.funcdefs.forEach(funcdef => {
        if(env.globalEnv.funcs.has(funcdef.name))
            throw new Error("Duplicate declaration of variable in same scope: " + funcdef.name);

        env.globalEnv.funcs.set(funcdef.name, {arglist: funcdef.args.map(i => i.typedef), retType: funcdef.rettype})
    })
    program.funcdefs.forEach(funcdef => {
        const typedFuncDef = typeCheckFuncDef(funcdef, createNewScopeEnv(env))
        typedFuncDefs.push(typedFuncDef);
    })
    program.stmts.forEach((stmt) => {
        const typedStmt = typeCheckStmt(stmt, env);
        typedStmts.push(typedStmt);
    })
    console.log(env)
    return {...program, a: programType, vardefs:typedVarDefs, stmts: typedStmts}
}

export function typeCheckFuncDef(funcdef: FuncDef<null>, env:Env) : FuncDef<Type> {
    funcdef.args.forEach(arg => {
        env.localEnv.vars.set(arg.name, arg.typedef);
    })
    env.localEnv.retType = funcdef.rettype;
    const typedBody = typeCheckFuncBody(funcdef.body, env);
    if(typedBody.a!==env.localEnv.retType)
        throw new Error(`All paths in this function/method must have a return statement: ${funcdef.name}`);
    return {...funcdef, body: typedBody, a:env.localEnv.retType}
}

export function typeCheckFuncBody(funcbody: FuncBody<null>, env: Env) : FuncBody<Type> {
    const typedVarDefs : VarDef<Type>[] = [];
    funcbody.vardefs.forEach(vardef => {
        typedVarDefs.push(typeCheckVarDef(vardef, env));
    })

    const [typedStmts, rettype]:[Stmt<Type>[], Type] = typeCheckBody(funcbody.stmts, env);
    return {...funcbody, vardefs: typedVarDefs, stmts: typedStmts, a:rettype};

}

export function typeCheckVarDef(vardef: VarDef<null>, env: Env) : VarDef<Type> {
    const typedValue = typeCheckLiteral(vardef.value);
    if(typedValue.a!==vardef.typedef)
        throw new Error(`TypeError: Expected type <${vardef.typedef}>; got type <${typedValue.a}>`);
    if(env.localEnv==undefined){
        if(env.globalEnv.vars.has(vardef.name) || env.globalEnv.funcs.has(vardef.name))
            throw new Error("Duplicate declaration of variable in same scope: " + vardef.name);
        env.globalEnv.vars.set(vardef.name, vardef.typedef)
    }
    else if(env.localEnv.vars.has(vardef.name))
        throw new Error("Duplicate declaration of variable in same scope: " + vardef.name);
    else
        env.localEnv.vars.set(vardef.name, vardef.typedef)
    return {...vardef, a: vardef.typedef, value: typedValue}
}

export function typeCheckIfStatement(stmt: Stmt<null>, env: Env) : Stmt<Type> {
    if(stmt.tag!=="if")
        throw new Error();
    const [typedBody, rettype]:[Stmt<Type>[], Type] = typeCheckBody(stmt.body, env);
    if(stmt.ifcondition==undefined)
        return {...stmt, body:typedBody, a:rettype};
    var typedCondition = typeCheckExpr(stmt.ifcondition, env);
    if(stmt.elseblock==undefined){
        if(typedCondition.a!=="bool")
            throw new Error(`Condition expression cannot be of type <${typedCondition.a}>`);
        return {...stmt, body:typedBody, ifcondition:typedCondition, a:"none"};
    }
    const typedElse = typeCheckIfStatement(stmt.elseblock, env);
    if(typedElse.a=="none" || rettype=="none")
        return {...stmt, body:typedBody, ifcondition:typedCondition, elseblock:typedElse ,a:"none"};
    return {...stmt, body:typedBody, ifcondition:typedCondition, elseblock:typedElse, a:rettype};

}

export function typeCheckBody(body: Stmt<null>[], env: Env) : [Stmt<Type>[], Type] {
    var rettype : Type = "none";
    const typedBody : Stmt<Type>[] = [];
    body.forEach(stmt => {
        const typedStmt = typeCheckStmt(stmt, env);
        rettype = typedStmt.a;
        typedBody.push(typedStmt);
    })
    return [typedBody, rettype];
}

export function typeCheckStmt(stmt: Stmt<null>, env: Env) : Stmt<Type> {
    switch(stmt.tag){
        case "assign":
            const typedValue = typeCheckExpr(stmt.value, env);
            if(env.localEnv==undefined)
                if(!env.globalEnv.vars.has(stmt.name))
                    throw new Error(`ReferenceError: Not a variable: ${stmt.name}`);
                else
                    var vartype = env.globalEnv.vars.get(stmt.name)
            else if(!env.localEnv.vars.has(stmt.name))
                if(!env.globalEnv.vars.has(stmt.name))
                    throw new Error(`ReferenceError: Not a variable: ${stmt.name}`);
                else
                    throw new Error(`Cannot assign to variable that is not explicitly declared in this scope: ${stmt.name}`);
            else
                var vartype = env.localEnv.vars.get(stmt.name)
            if(typedValue.a!==vartype)
                throw new Error(`TypeError: Expected type <${vartype}>; got type <${typedValue.a}>`);
            return {...stmt, a:"none", value:typedValue}
        
        case "while":
            const typedCondition = typeCheckExpr(stmt.condition, env);
            if(typedCondition.a!=="bool")
                throw new Error(`Condition expression cannot be of type <${typedCondition.a}>`);
            const [typedBody, rettype]:[Stmt<Type>[], Type] = typeCheckBody(stmt.body, env);
            return {...stmt, a:"none", condition:typedCondition, body:typedBody}
        
        case "if":
            return typeCheckIfStatement(stmt, env);
        
        case "expr":
            const typedExpr = typeCheckExpr(stmt.expr, env);
            return {...stmt, a: "none", expr: typedExpr}
        
        case "pass":
            return {...stmt, a:"none"};
        
        case "return":
            if(env.localEnv==undefined)
                throw new Error(`Return statement cannot appear at the top level`);
            var retType : Type;
            if(stmt.expr===undefined)
                retType = "none"
            else{
                var typedReturnExpr = typeCheckExpr(stmt.expr, env);
                retType = typedReturnExpr.a
            }
            if(retType!==env.localEnv.retType)
                throw new Error(`TypeError: Expected type <${env.localEnv.retType}>; got type <${retType}>`);
            if(stmt.expr==undefined)
                return {...stmt, a:retType}
            return {...stmt, a:retType, expr: typedReturnExpr}

    }
}

export function typeCheckExpr(expr: Expr<null>, env: Env) : Expr<Type> {
    switch(expr.tag){
        case "id": 
            if(env.localEnv==undefined)
                if(!env.globalEnv.vars.has(expr.name))
                    throw new Error(`ReferenceError: Not a variable: ${expr.name}`);
                else
                    return {...expr, a:env.globalEnv.vars.get(expr.name)}
            else
                if(!env.localEnv.vars.has(expr.name))
                    if(!env.globalEnv.vars.has(expr.name))
                        throw new Error(`ReferenceError: Not a variable: ${expr.name}`);  
                    else
                        return {...expr, a:env.globalEnv.vars.get(expr.name)}
                else
                    return {...expr, a:env.localEnv.vars.get(expr.name)}

        case "literal":
            const typedLiteral = typeCheckLiteral(expr.value);
            return {...expr, a: typedLiteral.a, value: typedLiteral}
        
        case "call":
            const typedArgList : Expr<Type>[] = [];
            if(!env.globalEnv.funcs.get(expr.name))
                throw new Error(`ReferenceError: Not a function or class: ${expr.name}`);
            const funcArgList = env.globalEnv.funcs.get(expr.name);
            if(funcArgList.arglist.length!==expr.arglist.length)
                throw new Error(`Expected ${funcArgList.arglist.length} arguments; got ${expr.arglist.length}`)
            for(var i: number = 0; i<expr.arglist.length; i++){
                var typedArg = typeCheckExpr(expr.arglist[i], env);
                if(funcArgList.arglist[i]!==typedArg.a && funcArgList.arglist[i]!=="any")
                    throw new Error(`Expected type <${funcArgList.arglist[i]}>; got type <${typedArg.a}> in parameter ${i}`);
                typedArgList.push(typedArg);    
            }
            return {...expr, a: funcArgList.retType, arglist: typedArgList}

        case "binexpr":
            const typedl_oprnd = typeCheckExpr(expr.l_oprnd, env);
            const typedr_oprnd = typeCheckExpr(expr.r_oprnd, env);
            var binexprType : Type;
            if(new Set(["+","-","*","//","%"]).has(expr.op.tag)){
                if(typedl_oprnd.a!="int" || typedr_oprnd.a!="int")
                    throw new Error(`TypeError: Cannot perform operation ${expr.op.tag} on types <${typedl_oprnd.a}> and <${typedr_oprnd.a}>`)
                binexprType = "int";
            }
            else if(new Set(["<=",">=","<",">"]).has(expr.op.tag)){
                if(typedl_oprnd.a!="int" || typedr_oprnd.a!="int")
                    throw new Error(`TypeError: Cannot perform operation ${expr.op.tag} on types <${typedl_oprnd.a}> and <${typedr_oprnd.a}>`)
                binexprType = "bool";
            }
            else if(new Set(["==", "!="]).has(expr.op.tag)){
                if(typedl_oprnd.a=="none" || typedr_oprnd.a=="none" || typedl_oprnd.a!=typedr_oprnd.a)
                    throw new Error(`TypeError: Cannot perform operation ${expr.op.tag} on types <${typedl_oprnd.a}> and <${typedr_oprnd.a}>`)
                binexprType = "bool";
            }
            else{
                if(typedl_oprnd.a!=="none" || typedr_oprnd.a!=="none")
                    throw new Error(`TypeError: Cannot perform operation ${expr.op.tag} on types <${typedl_oprnd.a}> and <${typedr_oprnd.a}>`)
                binexprType = "bool"
            }
            return {...expr, a:binexprType, l_oprnd: typedl_oprnd, r_oprnd: typedr_oprnd};
        
        case "unaexpr":
            const typed_oprnd = typeCheckExpr(expr.oprnd, env);
            var unaexprType : Type;
            switch(expr.op.tag){
                case "-":
                    if(typed_oprnd.a!=="int")
                        throw new Error(`TypeError: Cannot perform operation ${expr.op.tag} on type <${typed_oprnd.a}>`);
                    unaexprType = "int";
                break;
                case "not":
                    if(typed_oprnd.a!=="bool")
                        throw new Error(`TypeError: Cannot perform operation ${expr.op.tag} on type <${typed_oprnd.a}>`);
                    unaexprType = "bool";
                break;
            }
            return {...expr, a: unaexprType, oprnd: typed_oprnd}
        
        case "paranthexpr":
            const typed_paranthexpr = typeCheckExpr(expr.expr, env);
            return {...expr, a: typed_paranthexpr.a, expr: typed_paranthexpr}
    }
}

export function typeCheckLiteral(literal: Literal<null>) : Literal<Type> {
    switch(literal.tag){
        case "number": 
            return {...literal, a: "int"}
        case "boolean": 
            return {...literal, a: "bool"}
        case "none": 
            return {...literal, a: "none"}
    }
}