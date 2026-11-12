import {describe,it,expect} from 'vitest';
import {customerHostedExposure,customerHostedReservationFits,customerHostedUsageLiability} from '../customerHostedTokenBudget';

describe('customer-hosted token liability (not currency)',()=>{
 it('charges current-window settled usage and keeps earlier unknown holds',()=>{
  expect(customerHostedExposure('new',[
   {windowId:'old',status:'settled',reservedTokens:100,reportedTokens:80},
   {windowId:'old',status:'unknown',reservedTokens:100,reportedTokens:null},
   {windowId:'new',status:'settled',reservedTokens:100,reportedTokens:40},
   {windowId:'new',status:'reserved',reservedTokens:20,reportedTokens:null},
  ])).toBe(160);
 });
 it('never drops dispatch-pending exposure at rollover',()=>{
  expect(customerHostedExposure('new',[{windowId:'old',status:'dispatched',reservedTokens:70,reportedTokens:null}])).toBe(70);
 });
 it('charges overreported usage in full even across windows',()=>{
  expect(customerHostedUsageLiability(100,150)).toEqual({status:'overrun',liabilityTokens:150});
  expect(customerHostedExposure('new',[{windowId:'old',status:'overrun',reservedTokens:100,reportedTokens:150}])).toBe(150);
 });
 it('missing and malformed usage keep the whole hold',()=>{
  for(const reported of [null,undefined,-1,0.5,NaN,Infinity,'10'])expect(customerHostedUsageLiability(100,reported)).toEqual({status:'unknown',liabilityTokens:100});
  expect(customerHostedUsageLiability(100,0)).toEqual({status:'settled',liabilityTokens:0});
 });
 it('requires safe explicit caps, exposure and positive reservation',()=>{
  expect(customerHostedReservationFits(200,160,40)).toBe(true);
  expect(customerHostedReservationFits(199,160,40)).toBe(false);
  expect(customerHostedReservationFits(0,0,1)).toBe(false);
  for(const value of [undefined,null,-1,0.5,NaN,Infinity,'200'])expect(customerHostedReservationFits(value,0,1)).toBe(false);
  expect(customerHostedReservationFits(200,0,0)).toBe(false);
  expect(customerHostedReservationFits(Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER,1)).toBe(false);
 });
 it('refuses corrupt records or overflow instead of understating liability',()=>{
  expect(customerHostedExposure('new',[{windowId:'new',status:'settled',reservedTokens:100,reportedTokens:null}])).toBeNull();
  expect(customerHostedExposure('new',[{windowId:'new',status:'unknown',reservedTokens:0,reportedTokens:null}])).toBeNull();
  expect(customerHostedExposure('new',[
   {windowId:'new',status:'unknown',reservedTokens:Number.MAX_SAFE_INTEGER,reportedTokens:null},
   {windowId:'new',status:'unknown',reservedTokens:1,reportedTokens:null},
  ])).toBeNull();
 });
});
