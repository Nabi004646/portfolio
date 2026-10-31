import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publishingFeedback} from '../src/publishing-feedback.js';

test('saved content is never described as published before a completed deployment',()=>{
  assert.match(publishingFeedback({code:'publishing_not_configured'},{failed:true,status:503}),/not published.*connect your Cloudflare/);
  assert.match(publishingFeedback(null,{status:403,failed:true}),/second factor/);
  assert.match(publishingFeedback(null,{failed:true}),/not published.*saved content has been kept/);
  assert.match(publishingFeedback({ok:true,state:'requested',count:3}),/3 queued.*only after Cloudflare finishes deployment/);
  assert.match(publishingFeedback({ok:true,state:'no_pending_changes'}),/drafts are not published/);
});
