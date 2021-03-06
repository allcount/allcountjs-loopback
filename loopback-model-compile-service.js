var _ = require('underscore');

module.exports = function (loopback, loopbackApp, storageDriver, referenceNameService, loopbackDatasourceService) {
    return {
        entity: function (entityTypeId, persistenceEntityTypeId) {
            var self = this;
            return function (entityDescription) {
                var model = {};
                var config = {dataSource: loopbackDatasourceService.defaultDatasource};
                var builder = self.entityBuilder(entityTypeId, persistenceEntityTypeId, model, config);
                entityDescription.invokePropertiesOn(builder);
                var dataSource = model.ds;
                if (loopback.findModel(persistenceEntityTypeId) && loopback.findModel(persistenceEntityTypeId).extend) { //TODO is check extend the only way to figure out is it model stub or already defined?
                    model.base = persistenceEntityTypeId;
                }
                loopbackApp.model(loopback.createModel(model), config);
            }
        },
        entityBuilder: function (entityTypeId, persistenceEntityTypeId, model, config) {
            model.name = persistenceEntityTypeId;
            model.base = "PersistedModel";
            model.idInjection = true;
            return {
                fields: function (fields) {
                    var fieldMappings = {
                        'text': {type: 'string'},
                        'password': {type: 'string'},
                        'checkbox': {type: 'boolean'},
                        'money': { //TODO
                            "type": "number",
                            "dataType": "decimal",
                            "precision": 15,
                            "scale": 2,
                            mssql: {
                                dataType: "decimal",
                                dataPrecision: 15,
                                dataScale: 2
                            }
                        },
                        'integer': {
                            type: 'number'
                        }
                    };
                    var evaluatedFields = fields.evaluateProperties();
                    model.properties = _.chain(evaluatedFields).map(function (field, fieldName) {
                        if (field.fieldType.notPersisted || field.fieldType.id === 'reference') {
                            return;
                        }
                        var type = fieldMappings[field.fieldType.id] || field.fieldType.id;
                        return [fieldName, type]
                    }).filter(_.identity).object().value();

                    model.relations = _.chain(evaluatedFields).map(function (field, fieldName) {
                        if (field.fieldType.id === 'reference') {
                            return [fieldName, {
                                type: "belongsTo",
                                model: field.fieldType.referenceEntityTypeId,
                                foreignKey: ""
                            }]
                        }
                    }).filter(_.identity).object().value();
                    storageDriver.entityTypeIdToIncludes[entityTypeId] = _.chain(evaluatedFields).map(function (field, fieldName) {
                        if (field.fieldType.id === 'reference') {
                            return fieldName;
                        }
                    }).filter(_.identity).value();
                    storageDriver.serializers[entityTypeId] = _.chain(evaluatedFields).map(function (field, fieldName) {
                        if (field.fieldType.id === 'reference') {
                            return [fieldName, {
                                fromStorageValue: function (value, field, entity, fieldName) {
                                    var e = value();
                                    return e && {id: e.id, name: referenceNameService.referenceName(field.fieldType.referenceEntityTypeId, e)}
                                },
                                toStorageValue: function (value, field, entity, fieldName) {
                                    return value && value.id;
                                }
                            }]
                        } else if (field.fieldType.id === 'money') {
                            return [fieldName, {
                                fromStorageValue: function (value, field, entity, fieldName) {
                                    return value && value.toString(10);
                                },
                                toStorageValue: function (value, field, entity, fieldName) {
                                    return value;
                                }
                            }]
                        } else {
                            return [fieldName, {
                                fromStorageValue: _.identity,
                                toStorageValue: _.identity
                            }]
                        }
                    }).filter(_.identity).object().value();
                },
                permissions: function (permissions) {
                    model.acls = _.chain(permissions.evaluateProperties()).map(function (roles, permission) {
                        return roles != null && _.union([{
                            "accessType": permission === 'read' ? "READ" : "WRITE",
                            "principalType": "ROLE",
                            "principalId": "$everyone",
                            "permission": "DENY"
                        }], roles.map(function (role) {
                            return {
                                "accessType": permission === 'read' ? "READ" : "WRITE",
                                "principalType": "ROLE",
                                "principalId": role,
                                "permission": "ALLOW"
                            }
                        })) || [{
                            "accessType": permission === 'read' ? "READ" : "WRITE",
                            "principalType": "ROLE",
                            "principalId": "$everyone",
                            "permission": "ALLOW"
                        }]
                    }).flatten().value();
                },
                dataSource: function (ds) {
                  config.dataSource = ds;
                }
            }
        }
    }
};
