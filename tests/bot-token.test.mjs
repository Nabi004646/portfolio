import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBotToken,usableBotToken} from '../src/bot-token.js';
test('no request can use an unfinished, failed or expired bot check',()=>{
  let time=1000;const state=createBotToken({now:()=>time});
  assert.equal(state.token(),'');
  state.set('verified-token');assert.equal(state.token(),'verified-token');
  assert.equal(usableBotToken(state.token(),state.expiresAt(),time),true);
  time+=240000;assert.equal(state.token(),'');
  assert.equal(usableBotToken('old-token',state.expiresAt(),time),false);
  state.set('fresh-token');assert.equal(state.token(),'fresh-token');
  state.clear();assert.equal(state.token(),'');assert.equal(state.expiresAt(),0);
  assert.equal(usableBotToken('',time+1000,time),false);
});
