const { Afip } = require('afip.ts');

const afip = new Afip({
  key: 'dummy',
  cert: 'dummy',
  cuit: 20300000000,
  production: false
});

console.log('registerScopeFourService methods:');
const s4 = afip.registerScopeFourService;
console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(s4)));
console.log(s4);
