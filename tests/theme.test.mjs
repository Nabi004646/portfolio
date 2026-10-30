import {test} from 'node:test';
import assert from 'node:assert/strict';
import {preferredTheme,applyPalette} from '../src/theme.js';

test('saved themes take priority and invalid or absent preferences follow the device',()=>{
  assert.equal(preferredTheme({saved:'dark',systemDark:false}),'dark');
  assert.equal(preferredTheme({saved:'light',systemDark:true}),'light');
  assert.equal(preferredTheme({systemDark:true}),'dark');
  assert.equal(preferredTheme({saved:'invalid'}),'light');
});
test('editing the brand palette cannot overwrite the dark-mode page background',()=>{
  const properties=new Map();const root={style:{setProperty:(key,value)=>properties.set(key,value)}};
  applyPalette({cream:'#f5f3ee',blue:'#3156eb',coral:'#ff916c'},root);
  assert.equal(properties.get('--brand-paper'),'#f5f3ee');assert.ok(!properties.has('--paper'));
  applyPalette({cream:'red; color:transparent'},root);assert.equal(properties.get('--brand-paper'),'#f5f3ee');
});
