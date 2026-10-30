import {test} from 'node:test';
import assert from 'node:assert/strict';
import {botErrorMessage} from '../src/bot-errors.js';
test('invalid widget keys and unauthorized domains explain the owner configuration issue',()=>{
  for(const code of ['400020','110100','110110']){
    const message=botErrorMessage(code);assert.match(message,/public widget key is invalid/);assert.ok(message.includes(code));assert.match(message,/site owner/);
  }
  assert.match(botErrorMessage('110200'),/domain/);
});
test('unknown widget errors provide recovery without echoing untrusted text',()=>{
  assert.match(botErrorMessage('600010'),/Restart verification/);
  assert.ok(!botErrorMessage('<script>bad()</script>').includes('<script>'));
});
