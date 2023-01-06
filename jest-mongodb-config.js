module.exports = {
  mongodbMemoryServerOptions: {
    instance: {
      dbName: 'db'
    },
    binary: {
      version: '4.2.23',
      skipMD5: true
    },
    autoStart: false
  }
};
