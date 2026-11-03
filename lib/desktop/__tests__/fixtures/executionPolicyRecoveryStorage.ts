/** Owned in-memory Storage fixture. Never accesses browser/native user data. */
export function ownedRecoveryStorage(){const values=new Map<string,string>();return{
 values,get length(){return values.size},key:(index:number)=>[...values.keys()][index]??null,
 getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value)},removeItem:(key:string)=>{values.delete(key)},
}}
