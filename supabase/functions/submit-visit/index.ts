import {visitHandler} from '../_shared/visit.ts';

Deno.serve(request => visitHandler(request));
