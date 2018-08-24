const level = require('level');
import { flexel } from '.';

(async function () {
  let db = flexel(level());

  let sub1 = db.sub('test');

  await sub1.set('name', 'World');

  let stack1 = sub1.stack<number>('stack-a');
  let stack2 = sub1.stack<boolean>('stack-b');

  stack1.push(7);
  stack2.push(true);
  stack2.push(true);
  stack2.push(false);
})();

