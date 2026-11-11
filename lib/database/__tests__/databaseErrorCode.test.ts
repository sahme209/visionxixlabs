import { expect, it, vi } from 'vitest';
import { databaseErrorCode } from '../databaseErrorCode';
it('preserves original code precedence and recognizes only the exact driver conflict payload',()=>{
 expect(databaseErrorCode({code:'P2028',name:'DriverAdapterError',cause:{kind:'TransactionWriteConflict'}})).toBe('P2028');
 expect(databaseErrorCode({name:'DriverAdapterError',cause:{kind:'TransactionWriteConflict'}})).toBe('P2034');
 expect(databaseErrorCode({code:'P2002'})).toBe('P2002');
});
it.each([null,undefined,'TransactionWriteConflict',new Error('TransactionWriteConflict'),{name:'DriverAdapterError',cause:{kind:'TableDoesNotExist'}},{cause:{kind:'TransactionWriteConflict'}},{name:'Error',cause:{kind:'TransactionWriteConflict'}},Object.create({name:'DriverAdapterError',cause:{kind:'TransactionWriteConflict'}})])('leaves unrelated and inherited errors unclassified',error=>expect(databaseErrorCode(error)).toBeUndefined());
it('does not invoke getters and refuses a throwing reflection proxy',()=>{
 const get=vi.fn(()=>{throw Error('must_not_execute')});
 expect(databaseErrorCode(Object.defineProperty({},'code',{get}))).toBeUndefined();
 expect(databaseErrorCode({name:'DriverAdapterError',cause:Object.defineProperty({},'kind',{get})})).toBeUndefined();
 expect(databaseErrorCode(new Proxy({},{getOwnPropertyDescriptor(){throw Error('private')}}))).toBeUndefined();
 expect(get).not.toHaveBeenCalled();
});
it('recognizes only a raw P2010 wrapper containing the exact adapter conflict',()=>{
 const conflict={name:'DriverAdapterError',cause:{kind:'TransactionWriteConflict'}};
 expect(databaseErrorCode({code:'P2010',meta:{driverAdapterError:conflict}})).toBe('P2034');
 expect(databaseErrorCode({code:'P2010',meta:{driverAdapterError:{name:'DriverAdapterError',cause:{kind:'TableDoesNotExist'}}}})).toBe('P2010');
 expect(databaseErrorCode({code:'P2028',meta:{driverAdapterError:conflict}})).toBe('P2028');
});

it('keeps wrapped P2010 when nested evidence is inherited, accessor-based or absent',()=>{
 const get=vi.fn(()=>{throw Error('must_not_execute')});
 for(const nested of [undefined, Object.create({name:'DriverAdapterError',cause:{kind:'TransactionWriteConflict'}}), {name:'DriverAdapterError',cause:Object.defineProperty({},'kind',{get})}])expect(databaseErrorCode({code:'P2010',meta:{driverAdapterError:nested}})).toBe('P2010');
 expect(databaseErrorCode(Object.defineProperty({name:'DriverAdapterError',cause:{kind:'TransactionWriteConflict'}},'code',{get}))).toBeUndefined();
 expect(get).not.toHaveBeenCalled();
});
