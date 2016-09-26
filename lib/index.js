"use strict";
var _Object$create = require("babel-runtime/core-js/object/create")["default"];

var _interopRequireDefault = require("babel-runtime/helpers/interop-require-default")["default"];

exports.__esModule = true;

var _babelTemplate = require("babel-template");
var fs = require('fs');
var _babelTemplate2 = _interopRequireDefault(_babelTemplate);
var tpl = ['\n  define(MODULE_NAME, [SOURCES], function (PARAMS) {\n',
    '     "use strict";',
    '     var exports = {}; \n',
    '    BODY;',
    '    return exports;',
    '\n',
    '});\n'].join('');
var buildDefine = _babelTemplate2["default"](tpl);
var buildOld = _babelTemplate2["default"]('');
var serverRealPath = function (path) {
    return path.replace(/(\\+|\\)/g, '/');
};
var PATH = require('path');
exports["default"] = function (_ref) {
    var t = _ref.types;

    function isValidRequireCall(path) {
        if (!path.isCallExpression()) return false;
        if (!path.get("callee").isIdentifier({name: "require"})) return false;
        if (path.scope.getBinding("require")) return false;

        var args = path.get("arguments");
        if (args.length !== 1) return false;

        var arg = args[0];
        if (!arg.isStringLiteral()) return false;

        return true;
    }

    var noVisitor = {
        Directive: function (path) {
            if (path.node.value.value == 'use strict') {
                path.remove();
            }
        }
    };

    var amdVisitor = {
        Directive: function (path) {
            if (path.node.value.value == 'use strict') {
                path.remove();
            }
        },

        CallExpression: function CallExpression(path) {
            var propery = path.node.callee.property;
            if (propery && propery.name == 'define') {
                this.es6 = false;
            }
            if (!isValidRequireCall(path)) return;
            this.bareSources.push(path.node.arguments[0]);
            path.remove();
        },

        VariableDeclarator: function VariableDeclarator(path) {
            var id = path.get("id");
            if (!id.isIdentifier()) return;

            var init = path.get("init");
            if (!isValidRequireCall(init)) return;

            var source = init.node.arguments[0];
            this.sourceNames[source.value] = true;
            this.sources.push([id.node, source]);
            path.remove();
        }
    };

    return {
        inherits: require("babel-plugin-transform-es2015-modules-commonjs"),
        pre: function pre() {
            // source strings
            this.sources = [];
            this.sourceNames = _Object$create(null);
            this.moduleName = null;
            this.bareSources = [];
            this.es6 = true;
        },

        visitor: {
            Program: {
                exit: function exit(path, state) {
                    // istanbul ignore next


                    var _this = this;
                    var fileOpts = _this.file.opts;

                    var fileInfo = {
                        fullName: serverRealPath(fileOpts.filename),
                        relativeName: serverRealPath(fileOpts.filenameRelative),
                        basename: fileOpts.basename
                    };
                    if (this.ran) return;
                    this.ran = true;

                    var getSourceModule = function (source) {
                        var sourceFullPath = PATH.join(fileInfo.relativeName.replace(fileInfo.basename + '.js', ''), source.value) + '.js';
                        var sourceIndexFullPath = PATH.join(fileInfo.relativeName.replace(fileInfo.basename + '.js', ''), source.value, './index.js');
                        if (!/^m\_/.test(source.value) && state.opts.commonjs) {
                            if (fs.existsSync(sourceFullPath)) {
                                source.value = serverRealPath(sourceFullPath).replace(/^.*js\/(.*)\.js$/g, '$1');
                            } else if (fs.existsSync(sourceIndexFullPath)) {
                                source.value = serverRealPath(sourceIndexFullPath).replace(/^.*js\/(.*)\.js$/g, '$1');
                            }
                        }
                        return source;
                    };
                    path.traverse(amdVisitor, this);

                    if (path.scope.globals.define || !this.es6) {
                        path.traverse(noVisitor, this);
                        if (state.opts.deploy) {
                            path.node.body = [buildOld()];
                        }
                        return;
                    }

                    var params = this.sources.map(function (source) {
                        return source[0];
                    });
                    var sources = this.sources.map(function (source) {
                        return getSourceModule(source[1]);
                    });

                    sources = sources.concat(this.bareSources.filter(function (str) {
                        return !_this.sourceNames[str.value];
                    }));

                    var module = fileInfo.relativeName.replace(/^.*js\/(.*)\.js$/g, '$1');
                    var mods_path = state.opts.mods_path || null;
                    if (fileInfo.fullName.indexOf(mods_path) > -1) {
                        var relFilePath = fileInfo.fullName.replace(mods_path, '');
                        if (/^([\\/])([^\\/]+)\1\2\.js$/g.test(relFilePath)) {
                            module = 'm_' + fileInfo.basename;
                        } else {
                            module = relFilePath.replace(/\.js$/g, '').replace(/^[\\/][^\\/]+/, '');
                        }
                    }
                    var moduleName = t.stringLiteral(state.opts.moduleName || module);

                    path.node.body = [buildDefine({
                        MODULE_NAME: moduleName,
                        SOURCES: sources,
                        PARAMS: params,
                        BODY: path.node.body
                    })];
                }
            }
        }
    };
};

module.exports = exports["default"];
