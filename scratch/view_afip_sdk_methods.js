const { Afip } = require('afip.ts');

const afip = new Afip({
  key: 'dummy',
  cert: 'dummy',
  cuit: 20300000000,
  production: false
});

console.log('Available properties and services on Afip instance:');
console.log(Object.getOwnPropertyNames(afip));
console.log(Object.keys(afip));

// Also let's check the prototype of Afip
console.log('Prototype methods:');
console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(afip)));
