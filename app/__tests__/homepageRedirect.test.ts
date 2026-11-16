// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
const io=vi.hoisted(()=>({session:vi.fn(),redirect:vi.fn(),options:{marker:'existing-auth-options'}}));
vi.mock('next-auth',()=>({getServerSession:io.session}));
vi.mock('@/lib/auth',()=>({authOptions:io.options}));
vi.mock('next/navigation',()=>({redirect:(target:string)=>{io.redirect(target);throw Error('NEXT_REDIRECT')}}));
import Home, * as homepage from '../page';
beforeEach(()=>{vi.clearAllMocks();io.session.mockResolvedValue(null)});
describe('verified homepage return',()=>{
 it('uses the existing verified server-session contract and renders the public page when anonymous',async()=>{
  expect(await Home()).toBeTruthy();expect(io.session).toHaveBeenCalledWith(io.options);expect(io.redirect).not.toHaveBeenCalled();
 });
 it('redirects a canonical signed-in identity directly to control',async()=>{
  io.session.mockResolvedValue({user:{id:'canonical-user',email:'person@example.invalid'}});
  await expect(Home()).rejects.toThrow('NEXT_REDIRECT');expect(io.redirect).toHaveBeenCalledWith('/control');
 });
 it.each([{user:{}},{user:{email:'person@example.invalid'}},{user:{id:'canonical-user'}},{user:{id:' ',email:'person@example.invalid'}},{user:{id:'canonical-user',email:' '}},{user:{id:42,email:'person@example.invalid'}}])('does not redirect an incomplete identity %j',async session=>{
  io.session.mockResolvedValue(session);expect(await Home()).toBeTruthy();expect(io.redirect).not.toHaveBeenCalled();
 });
 it('evaluates each request separately so one identity cannot cache a redirect for an anonymous visitor',async()=>{
  expect(homepage).toHaveProperty('dynamic','force-dynamic');
  io.session.mockResolvedValueOnce({user:{id:'canonical-user',email:'person@example.invalid'}}).mockResolvedValueOnce(null);
  await expect(Home()).rejects.toThrow('NEXT_REDIRECT');io.redirect.mockClear();
  expect(await Home()).toBeTruthy();expect(io.redirect).not.toHaveBeenCalled();expect(io.session).toHaveBeenCalledTimes(2);
 });
});
