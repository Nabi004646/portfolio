import {publishingHandler} from '../_shared/publishing.ts';
Deno.serve(request=>publishingHandler(request));
