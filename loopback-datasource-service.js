module.exports = function () {
  return {
    defaultDatasource: 'db',
    compile: function (objects) {
      var self = this;
      objects.forEach(function (obj) {
        obj.invokePropertiesOn({
          defaultLoopbackDatasource: function (dataSource) {
            self.defaultDatasource = dataSource;
          }
        })
      })
    }
  }
}
