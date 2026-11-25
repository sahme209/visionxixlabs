// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const io=vi.hoisted(()=>({token:vi.fn()}));
vi.mock('next-auth/jwt',()=>({getToken:io.token}));
import * as homepage from '../page';
import { proxy } from '../../proxy';
const root=(method='GET')=>new NextRequest('https://visionxixlabs.com/',{method});
beforeEach(()=>{vi.clearAllMocks();io.token.mockResolvedValue(null)});
describe('verified homepage return',()=>{
 it('serves the public page as static content with no per-request session read',()=>{
  expect(homepage).not.toHaveProperty('dynamic');
  expect(typeof homepage.default).toBe('function');
 });
 it('lets an anonymous visitor through to the public page',async()=>{
  const response=await proxy(root());
  expect(response.headers.get('location')).toBeNull();
  expect(io.token).toHaveBeenCalledTimes(1);
 });
 it.each(['GET','HEAD'])('redirects a canonical signed-in identity directly to control on %s, uncached',async method=>{
  io.token.mockResolvedValue({identityVersion:1,id:'canonical-user',email:'person@example.invalid'});
  const response=await proxy(root(method));
  expect(response.status).toBe(307);
  expect(response.headers.get('location')).toBe('https://visionxixlabs.com/control');
  expect(response.headers.get('cache-control')).toBe('private, no-store');
 });
 it.each([{},{email:'person@example.invalid'},{identityVersion:1,id:'canonical-user'},{identityVersion:1,id:' ',email:'person@example.invalid'},{identityVersion:1,id:'canonical-user',email:' '},{identityVersion:1,id:42,email:'person@example.invalid'},{identityVersion:2,id:'canonical-user',email:'person@example.invalid'}])('does not redirect an incomplete identity %j',async token=>{
  io.token.mockResolvedValue(token);
  expect((await proxy(root())).headers.get('location')).toBeNull();
 });
 it('treats an unreadable token as signed out',async()=>{
  io.token.mockRejectedValue(new Error('bad token'));
  expect((await proxy(root())).headers.get('location')).toBeNull();
 });
 it('evaluates each request separately so one identity cannot cache a redirect for an anonymous visitor',async()=>{
  io.token.mockResolvedValueOnce({identityVersion:1,id:'canonical-user',email:'person@example.invalid'}).mockResolvedValueOnce(null);
  expect((await proxy(root())).headers.get('location')).toBe('https://visionxixlabs.com/control');
  expect((await proxy(root())).headers.get('location')).toBeNull();
  expect(io.token).toHaveBeenCalledTimes(2);
 });
 it('does not read a session for other public pages',async()=>{
  await proxy(new NextRequest('https://visionxixlabs.com/docs'));
  expect(io.token).not.toHaveBeenCalled();
 });
});
