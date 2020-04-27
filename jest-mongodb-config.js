module.exports = {
  mongodbMemoryServerOptions: {
    instance: {
      dbName: 'db'
    },
    binary: {
      version: '3.4.6',
      skipMD5: true
    },
    autoStart: false
  }
};
