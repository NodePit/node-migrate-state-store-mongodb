import { MongoStateStore } from '../lib/index';

describe('migrate MongoDB state store', () => {

  describe('initialization', () => {

    it('can be instantiated', () => {
      const stateStore = new MongoStateStore('foo');
      expect(stateStore).toBeInstanceOf(Object);
    });

  });

  describe('loading state', () => {
    // TODO
  });

  describe('saving state', () => {
    // TODO
  });

});
