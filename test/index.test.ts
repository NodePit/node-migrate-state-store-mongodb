import expect = require('expect.js');
import { MongoStateStore } from '../lib/index';

describe('migrate MongoDB state store', () => {

  describe('initialization', () => {

    it('can be instantiated', () => {
      const stateStore = new MongoStateStore('foo');
      expect(stateStore).to.be.an('object');
    });

  });

  describe('loading state', () => {
    // TODO
  });

  describe('saving state', () => {
    // TODO
  });

});
