const { restoreMongoKeys } = require('./server/utils/mongo');
const { ObjectId } = require('mongodb');

const id = new ObjectId();
console.log('Original ID:', id.toString());

const item = { _id: id, name: 'test' };
const restored = restoreMongoKeys(item);

console.log('Restored ID:', restored._id);
console.log('Stringified restored ID:', String(restored._id));

if (String(restored._id) === '[object Object]') {
    console.log('BUG CONFIRMED: ObjectId corrupted to [object Object]');
} else {
    console.log('Behavior seems fine or different from expected.');
}
